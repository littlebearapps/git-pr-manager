#!/usr/bin/env node

import { Command } from 'commander';
import { checksCommand } from './commands/checks';
import { initCommand } from './commands/init';
import { statusCommand } from './commands/status';
import { shipCommand } from './commands/ship';
import { featureCommand } from './commands/feature';
import { protectCommand } from './commands/protect';
import { securityCommand } from './commands/security';
import { verifyCommand } from './commands/verify';
import { autoCommand } from './commands/auto';
import { checkUpdateCommand } from './commands/check-update';
import { docsCommand } from './commands/docs';
import { doctorCommand } from './commands/doctor';
import { installHooksCommand } from './commands/install-hooks';
import { uninstallHooksCommand } from './commands/uninstall-hooks';
import { worktreeListCommand, worktreePruneCommand } from './commands/worktree';
import { logger, VerbosityLevel } from './utils/logger';
import { maybeNotifyUpdate } from './utils/update-check';

// Fire-and-forget update check (non-blocking)
const pkg = require('../package.json');
maybeNotifyUpdate({ pkg, argv: process.argv }).catch(() => {
  // Silently fail - update check is non-critical
});

// Internal telemetry (optional - Nathan only, private)
let telemetry: any = null;
await (async () => {
  try {
    const os = await import('os');
    const username = os.userInfo().username;

    if (username === 'nathanschram') {
      // @ts-expect-error - Optional internal telemetry module (no types needed)
      const { initTelemetry, captureBreadcrumb, captureError } = await import('../telemetry/src/telemetry.js');
      telemetry = {
        init: () => initTelemetry('git-pr-manager', pkg.version),
        breadcrumb: captureBreadcrumb,
        error: captureError
      };
      telemetry.init();
    }
  } catch {
    // Telemetry not available - gracefully degrade
  }
})();

const program = new Command();

program
  .name('gpm')
  .description('Git PR Manager - Enhanced git workflow automation with CI integration')
  .version('1.4.0')
  .option('--json', 'Output in JSON format (machine-readable)')
  .option('--quiet', 'Quiet mode (errors/warnings only)')
  .option('--silent', 'Silent mode (no output except exit codes)')
  .option('--verbose', 'Verbose mode (detailed output)')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();

    // Capture command execution breadcrumb
    telemetry?.breadcrumb(`command:${thisCommand.name()}`, {
      args: thisCommand.args,
      options: Object.keys(opts)
    });

    // Configure logger based on flags
    if (opts.json) {
      logger.setJsonMode(true);
    }

    if (opts.silent) {
      logger.setLevel(VerbosityLevel.SILENT);
    } else if (opts.quiet) {
      logger.setLevel(VerbosityLevel.QUIET);
    } else if (opts.verbose) {
      logger.setLevel(VerbosityLevel.VERBOSE);
    }
  });

// Register commands
program
  .command('feature')
  .description('Start a new feature branch')
  .argument('<name>', 'Feature name')
  .option('--from <branch>', 'Base branch (defaults to main/master)')
  .action(featureCommand);

program
  .command('ship')
  .description('Ship feature - create PR, wait for CI, merge')
  .option('--no-wait', 'Do not wait for CI checks')
  .option('--no-fail-fast', 'Do not exit on first critical failure')
  .option('--retry-flaky', 'Retry flaky tests')
  .option('--skip-verify', 'Skip pre-commit verification')
  .option('--skip-security', 'Skip security scan')
  .option('--skip-ci', 'Skip CI checks entirely')
  .option('--skip-auto-fix', 'Skip automated fixes for CI failures')
  .option('--no-delete-branch', 'Keep branch after merge')
  .option('--draft', 'Create as draft PR')
  .option('--title <title>', 'PR title (auto-generated from branch if not provided)')
  .option('--template <path>', 'PR template path or name')
  .action(shipCommand);

program
  .command('checks')
  .description('Show detailed CI check status for a PR')
  .argument('<pr-number>', 'Pull request number')
  .option('--details', 'Show full error details with annotations')
  .option('--files', 'List affected files only')
  .action(checksCommand);

program
  .command('init')
  .description('Initialize .gpm.yml configuration')
  .option('--template <type>', 'Configuration template (basic, standard, strict)', 'basic')
  .option('--interactive', 'Interactive setup wizard')
  .action(initCommand);

program
  .command('status')
  .description('Show current git and workflow status')
  .action(statusCommand);

program
  .command('protect')
  .description('Configure branch protection')
  .option('--branch <name>', 'Branch to protect (defaults to main/master)')
  .option('--preset <type>', 'Protection preset (basic, standard, strict)', 'standard')
  .option('--show', 'Show current protection settings')
  .action(protectCommand);

program
  .command('security')
  .description('Run security scans (secrets + vulnerabilities)')
  .action(securityCommand);

program
  .command('verify')
  .description('Run pre-commit verification (lint, typecheck, test, build)')
  .option('--skip-lint', 'Skip ESLint check')
  .option('--skip-typecheck', 'Skip TypeScript type check')
  .option('--skip-test', 'Skip test suite')
  .option('--skip-build', 'Skip build step')
  .action(verifyCommand);

program
  .command('auto')
  .description('Auto workflow - create PR, wait for CI, merge automatically')
  .option('--draft', 'Create as draft PR')
  .option('--no-merge', 'Skip automatic merge (stop after CI passes)')
  .option('--skip-security', 'Skip security scan')
  .option('--skip-verify', 'Skip verification checks')
  .action(autoCommand);

program
  .command('check-update')
  .description('Check for available updates')
  .option('--clear-cache', 'Clear update cache and force fresh check')
  .option('--channel <type>', 'Update channel (latest or next)', 'latest')
  .action(checkUpdateCommand);

program
  .command('docs')
  .description('Show documentation index or specific guide')
  .option('--guide <name>', 'Show specific guide (AI-AGENT-INTEGRATION, GITHUB-ACTIONS-INTEGRATION, etc.)')
  .action(docsCommand);

program
  .command('doctor')
  .description('Check system requirements and optional dependencies')
  .action(doctorCommand);

program
  .command('install-hooks')
  .description('Install git hooks to remind about gpm workflow')
  .option('--force', 'Overwrite existing hooks')
  .option('--post-commit', 'Also install post-commit hook')
  .action(installHooksCommand);

program
  .command('uninstall-hooks')
  .description('Remove gpm git hooks')
  .action(uninstallHooksCommand);

// Worktree command group
const worktree = program
  .command('worktree')
  .description('Manage git worktrees');

worktree
  .command('list')
  .description('List all worktrees')
  .option('--json', 'Output as JSON')
  .action(worktreeListCommand);

worktree
  .command('prune')
  .description('Prune stale worktree data')
  .option('--dry-run', 'Show what would be pruned')
  .option('--json', 'Output as JSON')
  .action(worktreePruneCommand);

// Global error handler
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  telemetry?.error(error, { type: 'uncaughtException' });
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  telemetry?.error(error, { type: 'unhandledRejection' });
  if (process.env.DEBUG) {
    console.error(reason);
  }
  process.exit(1);
});

// Parse arguments and execute
program.parse();
