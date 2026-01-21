import { getUncachableGitHubClient, getGitHubUsername } from '../server/github-client';
import { execSync } from 'child_process';

async function pushToGitHub() {
  try {
    console.log('Getting GitHub client...');
    const octokit = await getUncachableGitHubClient();
    const username = await getGitHubUsername();
    console.log(`Authenticated as: ${username}`);

    const repoName = 'ai-community-platform';
    
    let repoExists = false;
    try {
      await octokit.repos.get({
        owner: username,
        repo: repoName
      });
      repoExists = true;
      console.log(`Repository ${repoName} already exists.`);
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`Creating repository ${repoName}...`);
        await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description: 'AI Community Platform - 생성형 AI 커뮤니티 플랫폼',
          private: false,
          auto_init: false
        });
        console.log('Repository created successfully!');
      } else {
        throw error;
      }
    }

    const remoteUrl = `https://github.com/${username}/${repoName}.git`;
    console.log(`Remote URL: ${remoteUrl}`);

    try {
      execSync('git remote remove origin', { stdio: 'pipe' });
    } catch (e) {
    }

    console.log('Adding remote origin...');
    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });

    console.log('Staging all files...');
    execSync('git add -A', { stdio: 'inherit' });

    console.log('Creating commit...');
    try {
      execSync('git commit -m "Initial commit: AI Community Platform"', { stdio: 'inherit' });
    } catch (e) {
      console.log('No changes to commit or already committed.');
    }

    console.log('Pushing to GitHub...');
    const token = await getAccessToken();
    const pushUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`;
    
    try {
      execSync(`git push -u ${pushUrl} main --force`, { stdio: 'inherit' });
    } catch (e) {
      try {
        execSync(`git push -u ${pushUrl} master --force`, { stdio: 'inherit' });
      } catch (e2) {
        execSync('git branch -M main', { stdio: 'inherit' });
        execSync(`git push -u ${pushUrl} main --force`, { stdio: 'inherit' });
      }
    }

    console.log(`\n✅ Successfully pushed to GitHub!`);
    console.log(`📁 Repository URL: https://github.com/${username}/${repoName}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

pushToGitHub();
