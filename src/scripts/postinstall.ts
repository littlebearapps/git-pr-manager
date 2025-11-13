#!/usr/bin/env node

/**
 * Post-install script - runs after npm install
 * Provides helpful setup guidance for new users
 */

import { execSync } from 'child_process';

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
 * Main post-install logic
 */
function main() {
  console.log('\n✨ git-workflow-manager installed!\n');

  // Check for GitHub token
  const hasToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!hasToken) {
    console.log('⚠️  No GitHub token found!');
    console.log('   Set GITHUB_TOKEN or GH_TOKEN environment variable');
    console.log('   Generate token at: https://github.com/settings/tokens\n');
  } else {
    console.log('✅ GitHub token detected\n');
  }

  // Check for required/optional tools
  const tools = [
    { name: 'git', required: true },
    { name: 'gh', required: false }
  ];

  const missing = tools.filter(tool => !commandExists(tool.name));

  if (missing.length > 0) {
    const requiredMissing = missing.filter(t => t.required);
    const optionalMissing = missing.filter(t => !t.required);

    if (requiredMissing.length > 0) {
      console.log(`❌ Required tools missing: ${requiredMissing.map(t => t.name).join(', ')}`);
      console.log('   Please install them before using gwm\n');
    }

    if (optionalMissing.length > 0) {
      console.log(`ℹ️  Optional tools not found: ${optionalMissing.map(t => t.name).join(', ')}`);
      console.log('   Some features may be limited\n');
    }
  }

  // Show quick start guide
  console.log('📖 Quick Start:');
  console.log('   gwm init              - Initialize .gwm.yml configuration');
  console.log('   gwm feature <name>    - Start a new feature branch');
  console.log('   gwm auto              - Automated workflow (create PR, CI, merge)');
  console.log('   gwm --help            - Show all commands\n');

  // ✨ Opt-in Features - Prominent but optional
  console.log('✨ OPTIONAL: Enhance Your Workflow (100% Opt-In)');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ 🎯 Git Hooks - Never Miss gwm in Your Workflow            │');
  console.log('│                                                            │');
  console.log('│   gwm install-hooks       Install pre-push hook            │');
  console.log('│                           (suggests gwm before push)       │');
  console.log('│                                                            │');
  console.log('│   Benefits:                                                │');
  console.log('│   • Reminds you to run gwm ship before pushing             │');
  console.log('│   • Prevents accidentally pushing without CI checks        │');
  console.log('│   • 100% optional - you choose when to enable              │');
  console.log('│                                                            │');
  console.log('│ 📚 Learn More:                                             │');
  console.log('│   gwm docs                View all documentation           │');
  console.log('│   gwm docs --guide=AI-AGENT-INTEGRATION                    │');
  console.log('└────────────────────────────────────────────────────────────┘\n');

  console.log('🔗 Documentation: https://github.com/littlebearapps/git-workflow-manager#readme\n');
}

// Run post-install
main();
