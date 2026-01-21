import { getUncachableGitHubClient, getGitHubUsername } from '../server/github-client';
import * as fs from 'fs';
import * as path from 'path';

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.upm',
  '.cache',
  '.config',
  'dist',
  '.nix-profile',
  '.pythonlibs',
  '.breakpoints',
  'package-lock.json',
  'uv.lock',
  '.local'
];

function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split('/');
  for (const pattern of IGNORE_PATTERNS) {
    if (parts.includes(pattern)) return true;
    if (filePath === pattern) return true;
  }
  return false;
}

function getAllFiles(dirPath: string, basePath: string = ''): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = basePath ? `${basePath}/${item}` : item;
      
      if (shouldIgnore(relativePath)) continue;
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, relativePath));
      } else {
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return files;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadToGitHub() {
  try {
    console.log('Getting GitHub client...');
    const octokit = await getUncachableGitHubClient();
    const username = await getGitHubUsername();
    console.log(`Authenticated as: ${username}`);

    const repoName = 'ai-community-platform';
    const owner = username;

    // Check if repo exists, create if not
    let needsInit = false;
    try {
      await octokit.repos.get({ owner, repo: repoName });
      console.log(`Repository ${repoName} exists.`);
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`Creating repository ${repoName}...`);
        await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description: 'AI Community Platform - 생성형 AI 커뮤니티 플랫폼',
          private: false,
          auto_init: true
        });
        console.log('Repository created with README!');
        await sleep(3000);
      } else {
        throw error;
      }
    }

    // Get the current main branch SHA
    let baseSha: string | undefined;
    let baseTreeSha: string | undefined;
    try {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo: repoName,
        ref: 'heads/main'
      });
      baseSha = ref.object.sha;
      
      const { data: commit } = await octokit.git.getCommit({
        owner,
        repo: repoName,
        commit_sha: baseSha
      });
      baseTreeSha = commit.tree.sha;
      console.log(`Found existing commit: ${baseSha.substring(0, 7)}`);
    } catch (e) {
      console.log('No existing main branch found, will create new.');
    }

    console.log('\nCollecting files...');
    const files = getAllFiles('.');
    console.log(`Found ${files.length} files to upload`);

    // Create blobs with rate limit handling
    const blobs: { path: string; sha: string; mode: string; type: string }[] = [];

    console.log('\nCreating blobs (with rate limit handling)...');
    let count = 0;
    let retryCount = 0;
    const maxRetries = 3;

    for (const filePath of files) {
      let success = false;
      retryCount = 0;

      while (!success && retryCount < maxRetries) {
        try {
          const content = fs.readFileSync(filePath);
          const base64Content = content.toString('base64');
          
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo: repoName,
            content: base64Content,
            encoding: 'base64'
          });
          
          blobs.push({
            path: filePath,
            sha: blob.sha,
            mode: '100644',
            type: 'blob'
          });
          
          count++;
          if (count % 10 === 0) {
            console.log(`  Uploaded ${count}/${files.length} files...`);
          }
          success = true;
          
          // Small delay to avoid rate limits
          if (count % 30 === 0) {
            await sleep(1000);
          }
        } catch (error: any) {
          if (error.status === 403 || error.message?.includes('rate limit')) {
            retryCount++;
            console.log(`  Rate limit hit for ${filePath}, waiting 60s (attempt ${retryCount}/${maxRetries})...`);
            await sleep(60000);
          } else {
            console.error(`  Error uploading ${filePath}:`, error.message);
            break;
          }
        }
      }

      if (!success) {
        console.error(`  Failed to upload ${filePath} after ${maxRetries} attempts`);
      }
    }
    
    console.log(`\nCreated ${blobs.length} blobs out of ${files.length} files`);

    if (blobs.length === 0) {
      console.error('No blobs created, aborting.');
      process.exit(1);
    }

    console.log('\nCreating tree...');
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree: blobs as any,
      base_tree: baseTreeSha
    });

    console.log('Creating commit...');
    const parents = baseSha ? [baseSha] : [];
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: 'Upload: AI Community Platform - Complete source code',
      tree: tree.sha,
      parents
    });

    console.log('Updating main branch...');
    try {
      await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: 'heads/main',
        sha: commit.sha,
        force: true
      });
    } catch (e) {
      await octokit.git.createRef({
        owner,
        repo: repoName,
        ref: 'refs/heads/main',
        sha: commit.sha
      });
    }

    console.log(`\n✅ Successfully uploaded ${blobs.length} files to GitHub!`);
    console.log(`📁 Repository: https://github.com/${username}/${repoName}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

uploadToGitHub();
