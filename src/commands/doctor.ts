#!/usr/bin/env node

/**
 * Doctor command - checks system requirements and optional dependencies
 * Helps users verify their gwm setup and identify missing tools
 */

import { execSync } from 'child_process';
import { logger } from '../utils/logger';

interface Tool {
  name: string;
  required: boolean;
  purpose: string;
  installCommand?: string;
  checkCommand?: string;
}

const TOOLS: Tool[] = [
  {
    name: 'git',
    required: true,
    purpose: 'Version control - required for all gwm operations',
    checkCommand: 'git --version'
  },
  {
    name: 'node',
    required: true,
    purpose: 'JavaScript runtime - required to run gwm',
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
 * Check GitHub token
 */
function checkGitHubToken(): { found: boolean; source?: string } {
  if (process.env.GITHUB_TOKEN) {
    return { found: true, source: 'GITHUB_TOKEN' };
  }
  if (process.env.GH_TOKEN) {
    return { found: true, source: 'GH_TOKEN' };
  }
  return { found: false };
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
    logger.info('  Set GITHUB_TOKEN or GH_TOKEN environment variable');
    logger.info('  Generate token at: https://github.com/settings/tokens');
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
    logger.error('⚠️  Required tools are missing - gwm may not work correctly');
    logger.info('   Please install missing required tools before using gwm');
  } else if (hasWarnings) {
    logger.warn('ℹ️  Some optional tools are missing');
    logger.info('   gwm will work but some features may be limited:');
    logger.info('   • Secret scanning requires detect-secrets');
    logger.info('   • Python security scans require pip-audit');
    logger.info('   • Enhanced GitHub features require gh CLI');
  } else {
    logger.success('✅ All tools installed - your setup is complete!');
  }

  logger.blank();
  logger.log('Next Steps:');
  logger.info('  gwm init              - Initialize .gwm.yml configuration');
  logger.info('  gwm docs              - View documentation');
  logger.info('  gwm --help            - Show all commands');
}
