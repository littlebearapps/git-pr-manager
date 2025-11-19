import { WorktreeInfo } from "../types";

/**
 * Parse `git worktree list --porcelain` output
 *
 * Format:
 * worktree /path/to/worktree
 * HEAD abc123def
 * branch refs/heads/feature-name
 *
 * worktree /path/to/another
 * HEAD def456abc
 * detached
 *
 * @param output - Raw output from `git worktree list --porcelain`
 * @returns Array of parsed worktree information
 */
export function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];

  // Split by blank lines to separate each worktree entry
  const entries = output.trim().split(/\n\n+/);

  for (const entry of entries) {
    const lines = entry.split("\n").filter((line) => line.trim());
    const info: Partial<WorktreeInfo> = {
      branch: null,
      isMain: false,
    };

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        info.path = line.substring("worktree ".length).trim();
      } else if (line.startsWith("HEAD ")) {
        info.commit = line.substring("HEAD ".length).trim();
      } else if (line.startsWith("branch ")) {
        const branchRef = line.substring("branch ".length).trim();
        // Extract branch name from refs/heads/branch-name
        info.branch = branchRef.replace("refs/heads/", "");
      } else if (line === "bare") {
        info.isMain = true;
      } else if (line === "detached") {
        // Explicitly mark as detached (branch already null)
        info.branch = null;
      }
    }

    // Only add if we have the required fields
    if (info.path && info.commit !== undefined) {
      worktrees.push(info as WorktreeInfo);
    }
  }

  return worktrees;
}
