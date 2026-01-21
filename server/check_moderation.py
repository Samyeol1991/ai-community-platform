#!/usr/bin/env python3
import sys
import json
import os
import warnings
import httpx

# Suppress warnings
warnings.filterwarnings('ignore')
os.environ['GRADIO_ANALYTICS_ENABLED'] = 'False'

# Save original stdout
original_stdout = sys.stdout

# Redirect all output to stderr during import
sys.stdout = sys.stderr

from gradio_client import Client

# Restore stdout after import
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
        
        # Timeout 증가 (120초) - Sleep 상태 Space 깨우기
        client = Client('samyeool/kookmin_project', token=token, httpx_kwargs={'timeout': httpx.Timeout(120.0)})
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
