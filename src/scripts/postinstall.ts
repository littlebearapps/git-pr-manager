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
  console.log('\n✨ git-pr-manager installed!\n');

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
    { name: 'git', required: true, purpose: 'Version control' },
    { name: 'gh', required: false, purpose: 'GitHub CLI (enhanced PR features)' },
    { name: 'detect-secrets', required: false, purpose: 'Secret scanning (pip install detect-secrets)' },
    { name: 'pip-audit', required: false, purpose: 'Python dependency scanning' },
    { name: 'npm', required: false, purpose: 'JavaScript dependency scanning' }
  ];

  const missing = tools.filter(tool => !commandExists(tool.name));

  if (missing.length > 0) {
    const requiredMissing = missing.filter(t => t.required);
    const optionalMissing = missing.filter(t => !t.required);

    if (requiredMissing.length > 0) {
      console.log(`❌ Required tools missing: ${requiredMissing.map(t => t.name).join(', ')}`);
      console.log('   Please install them before using gpm\n');
    }

    if (optionalMissing.length > 0) {
      console.log('ℹ️  Optional Security Tools Not Found:');
      optionalMissing.forEach(tool => {
        console.log(`   • ${tool.name.padEnd(16)} - ${tool.purpose}`);
      });
      console.log('   gpm will skip these scans gracefully when tools are unavailable\n');
    }
  }

  // Internal telemetry setup (Nathan only - private)
  try {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    const username = os.userInfo().username;
    if (username === 'nathanschram') {
      console.log('\n🔧 Internal installation detected');

      const installRoot = path.join(__dirname, '../..');
      const telemetryPath = path.join(installRoot, 'telemetry');

      // Check if telemetry directory exists
      if (!fs.existsSync(telemetryPath)) {
        console.log('📥 Downloading private telemetry module...');

        try {
          // Try HTTPS first (works with GitHub tokens)
          execSync(
            'git clone https://github.com/nathanschram/cloakpipe-telemetry.git telemetry',
            { cwd: installRoot, stdio: 'inherit' }
          );
          console.log('✅ Telemetry downloaded');
        } catch (cloneError) {
          console.warn('⚠️  Could not download telemetry (private repo)');
          console.warn('   Continuing without telemetry - tool will work normally\n');
          return; // Skip telemetry setup, continue with standard install
        }
      }

      // Install telemetry dependencies
      if (fs.existsSync(telemetryPath)) {
        console.log('📦 Installing telemetry dependencies...');
        execSync('npm install', {
          cwd: telemetryPath,
          stdio: 'inherit'
        });
        console.log('✅ Internal telemetry ready\n');
      }
    }
  } catch (error) {
    // Silently fail - telemetry is optional internal tooling
    console.warn('⚠️  Telemetry setup encountered an issue');
    console.warn('   Continuing without telemetry - tool will work normally\n');
  }

  // Show quick start guide
  console.log('📖 Quick Start:');
  console.log('   gpm init              - Initialize .gpm.yml configuration');
  console.log('   gpm feature <name>    - Start a new feature branch');
  console.log('   gpm auto              - Automated workflow (create PR, CI, merge)');
  console.log('   gpm --help            - Show all commands\n');

  // ✨ Opt-in Features - Prominent but optional
  console.log('✨ OPTIONAL: Enhance Your Workflow (100% Opt-In)');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ 🎯 Git Hooks - Never Miss gpm in Your Workflow            │');
  console.log('│                                                            │');
  console.log('│   gpm install-hooks       Install pre-push hook            │');
  console.log('│                           (suggests gpm before push)       │');
  console.log('│                                                            │');
  console.log('│   Benefits:                                                │');
  console.log('│   • Reminds you to run gpm ship before pushing             │');
  console.log('│   • Prevents accidentally pushing without CI checks        │');
  console.log('│   • 100% optional - you choose when to enable              │');
  console.log('│                                                            │');
  console.log('│ 📚 Learn More:                                             │');
  console.log('│   gpm docs                View all documentation           │');
  console.log('│   gpm docs --guide=AI-AGENT-INTEGRATION                    │');
  console.log('└────────────────────────────────────────────────────────────┘\n');

  console.log('🔗 Documentation: https://github.com/littlebearapps/git-pr-manager#readme\n');
}

// Run post-install
main();
