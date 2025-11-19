import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";

export interface DocsOptions {
  guide?: string;
}

/**
 * Show documentation index or specific guide
 */
export async function docsCommand(options: DocsOptions): Promise<void> {
  try {
    // Get package installation location (works for both npm link and published package)
    const indexPath = join(__dirname, "../../");

    if (options.guide) {
      // Show specific guide
      await showGuide(options.guide, indexPath);
    } else {
      // Show documentation index
      showIndex(indexPath);
    }
  } catch (error: any) {
    logger.error("Failed to show documentation");
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
    join(basePath, "docs", "guides", `${guideName}.md`),
    join(basePath, "docs", `${guideName}.md`),
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
    const availableGuides = [
      "REPOSITORY-SECURITY-GUIDE",
      "AI-AGENT-INTEGRATION",
      "GITHUB-ACTIONS-INTEGRATION",
      "JSON-OUTPUT-SCHEMAS",
      "CONFIGURATION",
      "README",
    ];

    // Output JSON error if in JSON mode
    logger.outputJsonResult(false, null, {
      code: "ERROR",
      message: `Guide not found: ${guideName}`,
      suggestions: [`Available guides: ${availableGuides.join(", ")}`],
    });

    // Human-readable error (only displays if not in JSON mode)
    logger.error(`Guide not found: ${guideName}`);
    logger.info("Available guides:");
    availableGuides.forEach((guide) => logger.info(`  • ${guide}`));
    process.exit(1);
  }

  // Read and display guide
  const content = readFileSync(guidePath, "utf-8");

  // Build JSON data for structured output
  const jsonData = {
    guide: guideName,
    path: guidePath,
    found: true,
    contentLength: content.length,
    // Only include full content if explicitly requested (would be huge)
    contentPreview:
      content.substring(0, 500) + (content.length > 500 ? "..." : ""),
  };

  // Output JSON if in JSON mode (will only output if jsonMode enabled)
  logger.outputJsonResult(true, jsonData);

  // Human-readable output below (only when NOT in JSON mode)
  if (!logger.isJsonMode()) {
    console.log(content);
  }
}

/**
 * Show documentation index
 */
function showIndex(basePath: string): void {
  const pkg = require(join(basePath, "package.json"));

  const availableGuides = [
    {
      name: "REPOSITORY-SECURITY-GUIDE",
      description: "Repository Security & Setup Guide ⭐",
      command: "gpm docs --guide=REPOSITORY-SECURITY-GUIDE",
    },
    {
      name: "AI-AGENT-INTEGRATION",
      description: "AI Agent Setup Guide",
      command: "gpm docs --guide=AI-AGENT-INTEGRATION",
    },
    {
      name: "GITHUB-ACTIONS-INTEGRATION",
      description: "GitHub Actions Integration Guide",
      command: "gpm docs --guide=GITHUB-ACTIONS-INTEGRATION",
    },
    {
      name: "JSON-OUTPUT-SCHEMAS",
      description: "JSON Output Schemas Reference",
      command: "gpm docs --guide=JSON-OUTPUT-SCHEMAS",
    },
    {
      name: "CONFIGURATION",
      description: "Configuration Guide",
      command: "gpm docs --guide=CONFIGURATION",
    },
    {
      name: "README",
      description: "Full README",
      command: "gpm docs --guide=README",
    },
  ];

  // Build JSON data for structured output
  const jsonData = {
    version: pkg.version,
    installationPath: basePath,
    availableGuides,
    paths: {
      guides: join(basePath, "docs", "guides"),
      quickrefs: join(basePath, "quickrefs"),
      docs: join(basePath, "docs"),
    },
    links: {
      npm: "https://www.npmjs.com/package/@littlebearapps/git-pr-manager",
      github: "https://github.com/littlebearapps/git-pr-manager",
      issues: "https://github.com/littlebearapps/git-pr-manager/issues",
    },
  };

  // Output JSON if in JSON mode (will only output if jsonMode enabled)
  logger.outputJsonResult(true, jsonData);

  // Human-readable output below (will only output if jsonMode disabled)
  console.log(`
📚 Git PR Manager Documentation (v${pkg.version})

📍 Installation Location: ${basePath}

📖 Available Guides:
  • Security Guide ⭐: gpm docs --guide=REPOSITORY-SECURITY-GUIDE
  • AI Agent Setup:    gpm docs --guide=AI-AGENT-INTEGRATION
  • GitHub Actions:    gpm docs --guide=GITHUB-ACTIONS-INTEGRATION
  • JSON Schemas:      gpm docs --guide=JSON-OUTPUT-SCHEMAS
  • Configuration:     gpm docs --guide=CONFIGURATION
  • Full README:       gpm docs --guide=README

🔗 Online Documentation:
  • npm package:  https://www.npmjs.com/package/@littlebearapps/git-pr-manager
  • GitHub repo:  https://github.com/littlebearapps/git-pr-manager
  • Issue tracker: https://github.com/littlebearapps/git-pr-manager/issues

💡 Quick Start:
  gpm init --interactive     # Initialize configuration
  gpm feature my-feature     # Start feature branch
  gpm auto                   # Automated PR workflow

📄 Local Documentation Files:
  • Guides:       ${join(basePath, "docs", "guides")}
  • Quick Refs:   ${join(basePath, "quickrefs")}
  • Full Docs:    ${join(basePath, "docs")}

🤖 For AI Agents (Claude Code, etc.):
  This package includes comprehensive documentation designed for AI agent integration.
  Documentation is co-located with the package installation.

  Claude Code users: The package includes CLAUDE.md and quickrefs/ for optimal context.
  Other AI agents: All guides are available via 'gpm docs --guide=<name>' command.
`);
}
