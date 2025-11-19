import { execSync } from "child_process";

/**
 * Smart version detection for CLI
 *
 * Published package: Returns npm-injected version (e.g., "1.8.0")
 * Development mode: Returns git tag + commits ahead (e.g., "1.7.0-dev+3")
 * Fallback: Returns placeholder (e.g., "0.0.0-development")
 */
export function getVersion(): string {
  const pkg = require("../../package.json");

  // Published package - npm injects real version during publish
  if (pkg.version !== "0.0.0-development") {
    return pkg.version;
  }

  // Development mode - get version from git tags
  try {
    // Get git repository root
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();

    const currentDir = process.cwd();

    // Check if we're inside the gpm repository
    if (currentDir.startsWith(gitRoot)) {
      // Get latest git tag (e.g., "v1.7.0")
      const latestTag = execSync("git describe --tags --abbrev=0", {
        stdio: "pipe",
        encoding: "utf-8",
      }).trim();

      // Count commits since last tag
      const commitsSince = execSync(`git rev-list ${latestTag}..HEAD --count`, {
        stdio: "pipe",
        encoding: "utf-8",
      }).trim();

      // If on the tag exactly, return clean version
      if (commitsSince === "0") {
        return latestTag.replace(/^v/, "");
      }

      // Development version: tag + commits ahead
      // Example: "1.7.0-dev+3" (3 commits ahead of v1.7.0)
      return `${latestTag.replace(/^v/, "")}-dev+${commitsSince}`;
    }
  } catch {
    // Not in git repo, or git not available
  }

  // Fallback to placeholder
  return "0.0.0-development";
}
