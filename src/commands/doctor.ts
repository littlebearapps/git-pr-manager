#!/usr/bin/env node

/**
 * Doctor command - checks system requirements and optional dependencies
 * Helps users verify their gpm setup and identify missing tools
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

interface Tool {
  name: string;
  required: boolean;
  purpose: string;
  installCommand?: string;
  checkCommand?: string;
}

interface SetupOption {
  priority: 'recommended' | 'alternative';
  method: string;
  security: 'high' | 'medium' | 'low';
  steps: string[];
}

interface TokenCheckResult {
  found: boolean;
  source?: string;
  setupOptions?: SetupOption[];
}

interface AvailableTools {
  direnv: boolean;
  keychain: boolean;
  hasEnvrc: boolean;
  hasEnv: boolean;
}

const TOOLS: Tool[] = [
  {
    name: 'git',
    required: true,
    purpose: 'Version control - required for all gpm operations',
    checkCommand: 'git --version'
  },
  {
    name: 'node',
    required: true,
    purpose: 'JavaScript runtime - required to run gpm',
    checkCommand: 'node --version'
  },
  {
    name: 'gh',
    required: false,
    purpose: 'GitHub CLI - enhanced PR features',
    installCommand: 'https://cli.github.com/',
    checkCommand: 'gh --version'
  },
  {
    name: 'detect-secrets',
    required: false,
    purpose: 'Secret scanning in code',
    installCommand: 'pip install detect-secrets',
    checkCommand: 'detect-secrets --version'
  },
  {
    name: 'pip-audit',
    required: false,
    purpose: 'Python dependency vulnerability scanning',
    installCommand: 'pip install pip-audit',
    checkCommand: 'pip-audit --version'
  },
  {
    name: 'npm',
    required: false,
    purpose: 'JavaScript/Node.js package manager',
    installCommand: 'https://nodejs.org/',
    checkCommand: 'npm --version'
  }
];

/**
 * Check if a command exists on the system
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version of a tool if available
 */
function getVersion(checkCommand: string): string | null {
  try {
    const output = execSync(checkCommand, { encoding: 'utf-8', stdio: 'pipe' });
    return output.trim().split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Detect available token setup tools
 */
function detectAvailableTools(): AvailableTools {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  return {
    direnv: commandExists('direnv'),
    keychain: existsSync(join(homeDir, 'bin', 'kc.sh')),
    hasEnvrc: existsSync('.envrc'),
    hasEnv: existsSync('.env')
  };
}

/**
 * Build ranked setup options based on available tools
 */
function buildSetupOptions(tools: AvailableTools): SetupOption[] {
  const options: SetupOption[] = [];

  // Option 1: direnv + keychain (most secure)
  if (tools.direnv && tools.keychain) {
    options.push({
      priority: 'recommended',
      method: 'direnv + keychain',
      security: 'high',
      steps: [
        'Create .envrc with keychain integration:',
        '  echo \'source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)\' >> .envrc',
        '  direnv allow',
        '  echo \'.envrc\' >> .gitignore  # Prevent accidental commit'
      ]
    });
  }

  // Option 2: direnv with plaintext
  if (tools.direnv && !tools.keychain) {
    options.push({
      priority: options.length === 0 ? 'recommended' : 'alternative',
      method: 'direnv with .envrc',
      security: 'medium',
      steps: [
        'Create .envrc file:',
        '  echo \'export GITHUB_TOKEN="ghp_your_token_here"\' >> .envrc',
        '  direnv allow',
        '  echo \'.envrc\' >> .gitignore  # IMPORTANT: Prevent token leak!'
      ]
    });
  }

  // Option 3: Shell profile (persistent)
  options.push({
    priority: 'alternative',
    method: 'shell profile',
    security: 'medium',
    steps: [
      'Add to ~/.zshrc or ~/.bashrc:',
      '  echo \'export GITHUB_TOKEN="ghp_your_token_here"\' >> ~/.zshrc',
      '  source ~/.zshrc'
    ]
  });

  // Option 4: .env file
  options.push({
    priority: 'alternative',
    method: '.env file',
    security: 'low',
    steps: [
      'Create .env file:',
      '  echo \'GITHUB_TOKEN=ghp_your_token_here\' >> .env',
      '  echo \'.env\' >> .gitignore  # CRITICAL: Prevent token leak!'
    ]
  });

  // Option 5: Current session only
  options.push({
    priority: 'alternative',
    method: 'current session',
    security: 'low',
    steps: [
      'Export in current shell (temporary):',
      '  export GITHUB_TOKEN="ghp_your_token_here"',
      '',
      'Note: Token will be lost when you close the terminal'
    ]
  });

  return options;
}

/**
 * Check GitHub token with smart detection
 */
function checkGitHubToken(): TokenCheckResult {
  // Check if token is already set (any method works!)
  if (process.env.GITHUB_TOKEN) {
    return { found: true, source: 'GITHUB_TOKEN' };
  }
  if (process.env.GH_TOKEN) {
    return { found: true, source: 'GH_TOKEN' };
  }

  // Token not found - detect available tools and provide suggestions
  const tools = detectAvailableTools();
  const setupOptions = buildSetupOptions(tools);

  return {
    found: false,
    setupOptions
  };
}

/**
 * Doctor command - check system requirements
 */
export async function doctorCommand(): Promise<void> {
  logger.section('System Health Check');

  let hasErrors = false;
  let hasWarnings = false;

  // Check GitHub token
  const tokenStatus = checkGitHubToken();
  if (tokenStatus.found) {
    logger.success(`GitHub token: ${tokenStatus.source}`);
  } else {
    logger.warn('GitHub token: Not found');
    logger.blank();

    // Show ranked setup options
    if (tokenStatus.setupOptions && tokenStatus.setupOptions.length > 0) {
      logger.log('Setup Options (ranked by security & your system):');
      logger.blank();

      // Show recommended option first
      const recommended = tokenStatus.setupOptions.filter(opt => opt.priority === 'recommended');
      const alternatives = tokenStatus.setupOptions.filter(opt => opt.priority === 'alternative');

      if (recommended.length > 0) {
        for (const option of recommended) {
          logger.success(`✨ Recommended: ${option.method} (${option.security} security)`);
          for (const step of option.steps) {
            logger.log(`   ${step}`);
          }
          logger.blank();
        }
      }

      // Show alternatives
      if (alternatives.length > 0) {
        for (let i = 0; i < alternatives.length; i++) {
          const option = alternatives[i];
          logger.log(`Alternative ${i + 1}: ${option.method} (${option.security} security)`);
          for (const step of option.steps) {
            logger.log(`   ${step}`);
          }
          if (i < alternatives.length - 1) {
            logger.blank();
          }
        }
      }

      logger.blank();
      logger.log('Generate token at: https://github.com/settings/tokens');
      logger.log('Required scopes: repo (full control of private repositories)');
    }

    hasWarnings = true;
  }

  logger.blank();
  logger.log('Required Tools:');
  logger.divider();

  // Check required tools
  const requiredTools = TOOLS.filter(t => t.required);
  for (const tool of requiredTools) {
    const exists = commandExists(tool.name);
    if (exists) {
      const version = tool.checkCommand ? getVersion(tool.checkCommand) : null;
      logger.success(`${tool.name.padEnd(20)} ${version || '(installed)'}`);
    } else {
      logger.error(`${tool.name.padEnd(20)} NOT FOUND`);
      logger.info(`  ${tool.purpose}`);
      if (tool.installCommand) {
        logger.info(`  Install: ${tool.installCommand}`);
      }
      hasErrors = true;
    }
  }

  logger.blank();
  logger.log('Optional Tools:');
  logger.divider();

  // Check optional tools
  const optionalTools = TOOLS.filter(t => !t.required);
  for (const tool of optionalTools) {
    const exists = commandExists(tool.name);
    if (exists) {
      const version = tool.checkCommand ? getVersion(tool.checkCommand) : null;
      logger.success(`${tool.name.padEnd(20)} ${version || '(installed)'}`);
    } else {
      logger.warn(`${tool.name.padEnd(20)} NOT FOUND (optional)`);
      logger.info(`  ${tool.purpose}`);
      if (tool.installCommand) {
        logger.info(`  Install: ${tool.installCommand}`);
      }
      hasWarnings = true;
    }
  }

  logger.blank();
  logger.divider();

  // Summary
  if (hasErrors) {
    logger.error('⚠️  Required tools are missing - gpm may not work correctly');
    logger.info('   Please install missing required tools before using gpm');
  } else if (hasWarnings) {
    logger.warn('ℹ️  Some optional tools are missing');
    logger.info('   gpm will work but some features may be limited:');
    logger.info('   • Secret scanning requires detect-secrets');
    logger.info('   • Python security scans require pip-audit');
    logger.info('   • Enhanced GitHub features require gh CLI');
  } else {
    logger.success('✅ All tools installed - your setup is complete!');
  }

  logger.blank();
  logger.log('Next Steps:');
  logger.info('  gpm init              - Initialize .gpm.yml configuration');
  logger.info('  gpm docs              - View documentation');
  logger.info('  gpm --help            - Show all commands');
}
