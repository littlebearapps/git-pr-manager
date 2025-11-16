import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Get the git hooks directory, supporting both standard repos and worktrees
 *
 * Strategy:
 * 1. Try `git rev-parse --git-common-dir` (works for all git setups)
 * 2. Fallback: Check .git manually (file for worktrees, directory for standard repos)
 *
 * In standard repos: .git/hooks/
 * In worktrees: .bare/hooks/ (or wherever the common git dir is)
 */
export async function getGitHooksDir(cwd: string = process.cwd()): Promise<string> {
  try {
    // Use git rev-parse to find the common git directory
    // This works for both normal repos and worktrees
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    // Return the hooks directory path
    return path.resolve(cwd, gitCommonDir, 'hooks');
  } catch (error) {
    // Fallback: Check if .git exists
    const gitPath = path.join(cwd, '.git');

    try {
      const stats = await fs.stat(gitPath);

      if (stats.isDirectory()) {
        // Standard .git directory
        return path.join(gitPath, 'hooks');
      } else if (stats.isFile()) {
        // Worktree: .git is a file, read it to find the gitdir
        const gitFileContent = await fs.readFile(gitPath, 'utf-8');
        const match = gitFileContent.match(/^gitdir:\s*(.+)$/m);

        if (match && match[1]) {
          const worktreeGitDir = path.resolve(cwd, match[1].trim());
          // For worktrees, hooks are in the common dir (usually .bare/hooks)
          // Navigate up from worktrees/<name> to the bare repo
          const bareDir = path.dirname(path.dirname(worktreeGitDir));
          return path.join(bareDir, 'hooks');
        }
      }
    } catch {
      // .git doesn't exist or can't be read
    }

    throw new Error('Not a git repository');
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a hook was created by gpm
 * Checks for gpm signature on line 2
 */
export async function isGpmHook(hookPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(hookPath, { encoding: 'utf-8' });
    const lines = content.split('\n');
    // Check for gpm signature on line 2 (0-indexed line 1)
    return !!(lines[1] && (
      lines[1].includes('gpm pre-push hook') ||
      lines[1].includes('gpm post-commit hook')
    ));
  } catch {
    return false;
  }
}
