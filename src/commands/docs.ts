import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface DocsOptions {
  guide?: string;
}

/**
 * Show documentation index or specific guide
 */
export async function docsCommand(options: DocsOptions): Promise<void> {
  try {
    // Get package installation location (works for both npm link and published package)
    const indexPath = join(__dirname, '../../');

    if (options.guide) {
      // Show specific guide
      await showGuide(options.guide, indexPath);
    } else {
      // Show documentation index
      showIndex(indexPath);
    }
  } catch (error: any) {
    logger.error('Failed to show documentation');
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Show specific documentation guide
 */
async function showGuide(guideName: string, basePath: string): Promise<void> {
  // Try different possible paths
  const possiblePaths = [
    join(basePath, 'docs', 'guides', `${guideName}.md`),
    join(basePath, 'docs', `${guideName}.md`),
    join(basePath, `${guideName}.md`),
  ];

  let guidePath: string | undefined;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      guidePath = path;
      break;
    }
  }

  if (!guidePath) {
    logger.error(`Guide not found: ${guideName}`);
    logger.info('Available guides:');
    logger.info('  • AI-AGENT-INTEGRATION');
    logger.info('  • GITHUB-ACTIONS-INTEGRATION');
    logger.info('  • CONFIGURATION');
    logger.info('  • README');
    process.exit(1);
  }

  // Read and display guide
  const content = readFileSync(guidePath, 'utf-8');
  console.log(content);
}

/**
 * Show documentation index
 */
function showIndex(basePath: string): void {
  const pkg = require(join(basePath, 'package.json'));

  console.log(`
📚 Git Workflow Manager Documentation (v${pkg.version})

📍 Installation Location: ${basePath}

📖 Available Guides:
  • AI Agent Setup:    gwm docs --guide=AI-AGENT-INTEGRATION
  • GitHub Actions:    gwm docs --guide=GITHUB-ACTIONS-INTEGRATION
  • Configuration:     gwm docs --guide=CONFIGURATION
  • Full README:       gwm docs --guide=README

🔗 Online Documentation:
  • npm package:  https://www.npmjs.com/package/@littlebearapps/git-workflow-manager
  • GitHub repo:  https://github.com/littlebearapps/git-workflow-manager
  • Issue tracker: https://github.com/littlebearapps/git-workflow-manager/issues

💡 Quick Start:
  gwm init --interactive     # Initialize configuration
  gwm feature my-feature     # Start feature branch
  gwm auto                   # Automated PR workflow

📄 Local Documentation Files:
  • Guides:       ${join(basePath, 'docs', 'guides')}
  • Quick Refs:   ${join(basePath, 'quickrefs')}
  • Full Docs:    ${join(basePath, 'docs')}

🤖 For AI Agents (Claude Code, etc.):
  This package includes comprehensive documentation designed for AI agent integration.
  Documentation is co-located with the package installation.

  Claude Code users: The package includes CLAUDE.md and quickrefs/ for optimal context.
  Other AI agents: All guides are available via 'gwm docs --guide=<name>' command.
`);
}
