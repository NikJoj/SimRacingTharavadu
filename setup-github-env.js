#!/usr/bin/env node

/**
 * Automated GitHub Environment Variables Setup Script
 * 
 * This script helps you set up the required GitHub environment variables
 * for the poster sync feature in Vercel.
 * 
 * Usage:
 *   node setup-github-env.js
 * 
 * Or add to package.json and run:
 *   npm run setup:github
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

async function setVercelEnvVar(key, value, environments = ['production', 'preview', 'development']) {
  try {
    for (const env of environments) {
      const command = `vercel env add ${key} ${env}`;
      log(`Setting ${key} for ${env}...`, 'blue');
      
      // Use echo to pipe the value to vercel env add
      execSync(`echo "${value}" | ${command}`, { 
        stdio: 'inherit',
        shell: true 
      });
    }
    log(`✓ ${key} set successfully`, 'green');
    return true;
  } catch (error) {
    log(`✗ Failed to set ${key}: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║  GitHub Poster Sync - Environment Setup Script        ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝\n', 'bright');

  // Check if Vercel CLI is installed
  const hasVercelCLI = await checkVercelCLI();
  
  if (!hasVercelCLI) {
    log('⚠️  Vercel CLI is not installed!', 'yellow');
    log('\nPlease install it first:', 'yellow');
    log('  npm install -g vercel', 'blue');
    log('\nOr use the manual setup instructions in POSTER_SYNC_SETUP.md\n', 'yellow');
    process.exit(1);
  }

  log('✓ Vercel CLI detected\n', 'green');

  // Check if user is logged in to Vercel
  try {
    execSync('vercel whoami', { stdio: 'ignore' });
    log('✓ Logged in to Vercel\n', 'green');
  } catch (error) {
    log('⚠️  Not logged in to Vercel', 'yellow');
    log('\nPlease login first:', 'yellow');
    log('  vercel login', 'blue');
    log('\nThen run this script again.\n', 'yellow');
    process.exit(1);
  }

  log('This script will help you set up the GitHub environment variables.\n', 'blue');
  log('You will need:', 'yellow');
  log('  1. GitHub Personal Access Token (with repo scope)');
  log('  2. Your GitHub username');
  log('  3. Your repository name\n');

  const proceed = await question('Do you want to continue? (y/n): ');
  
  if (proceed.toLowerCase() !== 'y') {
    log('\nSetup cancelled.', 'yellow');
    rl.close();
    process.exit(0);
  }

  log('\n' + '─'.repeat(60) + '\n', 'blue');

  // Collect information
  log('📝 Please provide the following information:\n', 'bright');

  const githubToken = await question('GitHub Personal Access Token (ghp_...): ');
  if (!githubToken.startsWith('ghp_')) {
    log('\n⚠️  Warning: Token should start with "ghp_"', 'yellow');
    const continueAnyway = await question('Continue anyway? (y/n): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      log('\nSetup cancelled.', 'yellow');
      rl.close();
      process.exit(0);
    }
  }

  const githubOwner = await question('GitHub Username: ');
  const githubRepo = await question('Repository Name (default: SimRacingTharavadu): ') || 'SimRacingTharavadu';
  const githubBranch = await question('Branch Name (default: main): ') || 'main';

  log('\n' + '─'.repeat(60) + '\n', 'blue');

  // Confirm settings
  log('📋 Configuration Summary:\n', 'bright');
  log(`  GITHUB_TOKEN: ${githubToken.substring(0, 10)}...`, 'blue');
  log(`  GITHUB_OWNER: ${githubOwner}`, 'blue');
  log(`  GITHUB_REPO: ${githubRepo}`, 'blue');
  log(`  GITHUB_BRANCH: ${githubBranch}`, 'blue');

  log('\nThese will be set for: production, preview, and development environments\n');

  const confirm = await question('Is this correct? (y/n): ');
  
  if (confirm.toLowerCase() !== 'y') {
    log('\nSetup cancelled.', 'yellow');
    rl.close();
    process.exit(0);
  }

  log('\n' + '─'.repeat(60) + '\n', 'blue');
  log('🚀 Setting environment variables...\n', 'bright');

  // Set environment variables
  const results = [];
  
  results.push(await setVercelEnvVar('GITHUB_TOKEN', githubToken));
  results.push(await setVercelEnvVar('GITHUB_OWNER', githubOwner));
  results.push(await setVercelEnvVar('GITHUB_REPO', githubRepo));
  results.push(await setVercelEnvVar('GITHUB_BRANCH', githubBranch));

  log('\n' + '─'.repeat(60) + '\n', 'blue');

  const allSuccess = results.every(r => r === true);

  if (allSuccess) {
    log('✅ All environment variables set successfully!\n', 'green');
    log('Next steps:', 'bright');
    log('  1. Redeploy your application:', 'blue');
    log('     vercel --prod', 'blue');
    log('  2. Test the poster upload feature in your admin dashboard\n', 'blue');
    log('📖 For more information, see POSTER_SYNC_SETUP.md\n', 'yellow');
  } else {
    log('⚠️  Some environment variables failed to set.', 'yellow');
    log('Please check the errors above and try again.\n', 'yellow');
    log('You can also set them manually in the Vercel dashboard:', 'blue');
    log('  https://vercel.com/dashboard → Your Project → Settings → Environment Variables\n', 'blue');
  }

  rl.close();
}

// Run the script
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});

// Made with Bob
