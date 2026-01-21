import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

interface ModerationResult {
  isFlagged: boolean;
  moderationScore: string;
  moderationReason: string;
}

export async function checkContentModeration(text: string, retries = 3): Promise<ModerationResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 개발 환경과 운영 환경에서 다른 경로 사용
      let scriptPath = path.join(__dirname, 'check_moderation.py');
      
      // 개발 환경에서는 server/ 폴더에, 운영 환경에서는 dist/ 폴더에 있음
      if (!fs.existsSync(scriptPath)) {
        scriptPath = path.join(process.cwd(), 'server', 'check_moderation.py');
      }
      if (!fs.existsSync(scriptPath)) {
        scriptPath = path.join(process.cwd(), 'dist', 'check_moderation.py');
      }
      
      // 스크립트가 없으면 생성 (운영 환경 대비)
      if (!fs.existsSync(scriptPath)) {
        const pythonScript = `#!/usr/bin/env python3
import sys
import json
import os
import warnings
import httpx

warnings.filterwarnings('ignore')
os.environ['GRADIO_ANALYTICS_ENABLED'] = 'False'

original_stdout = sys.stdout
sys.stdout = sys.stderr

from gradio_client import Client

sys.stdout = original_stdout

def check_content(text):
    try:
        token = os.environ.get('HUGGINGFACE_TOKEN')
        if not token:
            return {
                'isFlagged': False,
                'moderationScore': '0',
                'moderationReason': 'No token provided'
            }
        
        client = Client('samyeool/kookmin_project', token=token, httpx_kwargs={'timeout': httpx.Timeout(60.0)})
        result = client.predict(text, api_name='/predict')
        
        label = result.get('label', '')
        confidences = result.get('confidences', [])
        
        is_toxic = '악성' in label
        
        toxic_confidence = 0
        for conf in confidences:
            if '악성' in conf.get('label', ''):
                toxic_confidence = conf.get('confidence', 0)
                break
        
        return {
            'isFlagged': is_toxic,
            'moderationScore': str(toxic_confidence),
            'moderationReason': label
        }
    except Exception as e:
        return {
            'isFlagged': False,
            'moderationScore': '0',
            'moderationReason': f'Error: {str(e)}'
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'isFlagged': False, 'moderationScore': '0', 'moderationReason': 'No text provided'}))
        sys.exit(1)
    
    text = sys.argv[1]
    result = check_content(text)
    print(json.dumps(result))
`;
        
        // dist 폴더가 없으면 생성
        const distDir = path.join(process.cwd(), 'dist');
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        
        // Python 스크립트 생성
        scriptPath = path.join(distDir, 'check_moderation.py');
        fs.writeFileSync(scriptPath, pythonScript);
        fs.chmodSync(scriptPath, '755');
        console.log('[Moderation] Created Python script at:', scriptPath);
      }
      const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`').replace(/\n/g, '\\n');
      
      console.log(`[Moderation] Checking content (attempt ${attempt}/${retries})...`);
      
      const { stdout, stderr } = await execAsync(
        `python3 "${scriptPath}" "${escapedText}"`,
        {
          env: { ...process.env },
          timeout: 60000  // 60초로 증가
        }
      );

      if (stderr) {
        console.error('[Moderation] Python stderr:', stderr);
      }

      console.log('[Moderation] Raw stdout:', stdout);
      
      // stdout에서 JSON 부분만 추출 (다른 출력 무시)
      const jsonMatch = stdout.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        console.error('[Moderation] No valid JSON found in stdout');
        throw new Error('Invalid response format');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      // timeout 에러인 경우 재시도
      if (result.moderationReason && result.moderationReason.includes('timed out')) {
        if (attempt < retries) {
          console.log(`[Moderation] Timeout detected, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
          continue;
        }
      }
      
      console.log('[Moderation] Parsed result:', result);
      
      return {
        isFlagged: result.isFlagged || false,
        moderationScore: result.moderationScore || '0',
        moderationReason: result.moderationReason || ''
      };
    } catch (error: any) {
      if (attempt < retries) {
        console.log(`[Moderation] Error on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        continue;
      }
      
      console.error('[Moderation] Content moderation error (all retries failed):', error);
      console.error('[Moderation] Error details:', {
        message: error.message,
        stderr: error.stderr,
        stdout: error.stdout
      });
      return {
        isFlagged: false,
        moderationScore: '0',
        moderationReason: `Moderation check failed: ${error.message}`
      };
    }
  }
  
  // Should never reach here, but TypeScript needs it
  return {
    isFlagged: false,
    moderationScore: '0',
    moderationReason: 'Unexpected error'
  };
}
