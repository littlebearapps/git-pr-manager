import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { GitServiceOptions, BranchInfo } from '../types';

/**
 * GitService - Wraps simple-git for local git operations
 */
export class GitService {
  private git: SimpleGit;
  private workingDir: string;

  constructor(options: GitServiceOptions) {
    this.workingDir = options.workingDir || process.cwd();
    this.git = simpleGit(this.workingDir);
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'unknown';
  }

  /**
   * Get branch information including clean status
   */
  async getBranchInfo(): Promise<BranchInfo> {
    const status = await this.git.status();
    const branches = await this.git.branch();

    return {
      current: status.current || 'unknown',
      isClean: status.isClean(),
      hasUncommittedChanges: !status.isClean(),
      remoteBranches: Object.keys(branches.branches).filter(b => b.startsWith('remotes/'))
    };
  }

  /**
   * Check if working directory is clean (no uncommitted changes)
   */
  async isClean(): Promise<boolean> {
    const status = await this.git.status();
    return status.isClean();
  }

  /**
   * Get git status
   */
  async getStatus(): Promise<StatusResult> {
    return await this.git.status();
  }

  /**
   * Create and checkout a new branch
   */
  async createBranch(branchName: string, baseBranch?: string): Promise<void> {
    if (baseBranch) {
      await this.git.checkout(baseBranch);
    }
    await this.git.checkoutLocalBranch(branchName);
  }

  /**
   * Checkout an existing branch
   */
  async checkout(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  /**
   * Push branch to remote
   */
  async push(remote: string = 'origin', branch?: string, setUpstream: boolean = false): Promise<void> {
    const currentBranch = branch || await this.getCurrentBranch();

    if (setUpstream) {
      await this.git.push(['-u', remote, currentBranch]);
    } else {
      await this.git.push(remote, currentBranch);
    }
  }

  /**
   * Pull from remote
   */
  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    if (branch) {
      await this.git.pull(remote, branch);
    } else {
      await this.git.pull();
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remote: string = 'origin'): Promise<void> {
    await this.git.fetch(remote);
  }

  /**
   * Delete local branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    if (force) {
      await this.git.deleteLocalBranch(branchName, true);
    } else {
      await this.git.deleteLocalBranch(branchName);
    }
  }

  /**
   * Get list of all branches
   */
  async listBranches(): Promise<string[]> {
    const branches = await this.git.branch();
    return branches.all;
  }

  /**
   * Check if branch exists locally
   */
  async branchExists(branchName: string): Promise<boolean> {
    const branches = await this.git.branch();
    return branches.all.includes(branchName);
  }

  /**
   * Get remote URL
   */
  async getRemoteUrl(remote: string = 'origin'): Promise<string> {
    const remotes = await this.git.getRemotes(true);
    const targetRemote = remotes.find(r => r.name === remote);

    if (!targetRemote || !targetRemote.refs || !targetRemote.refs.fetch) {
      throw new Error(`Remote '${remote}' not found`);
    }

    return targetRemote.refs.fetch;
  }

  /**
   * Add files to staging
   */
  async add(files: string | string[]): Promise<void> {
    if (Array.isArray(files)) {
      await this.git.add(files);
    } else {
      await this.git.add(files);
    }
  }

  /**
   * Commit changes
   */
  async commit(message: string): Promise<void> {
    await this.git.commit(message);
  }

  /**
   * Get diff for current changes
   */
  async getDiff(): Promise<string> {
    return await this.git.diff();
  }

  /**
   * Get diff for staged changes
   */
  async getStagedDiff(): Promise<string> {
    return await this.git.diff(['--cached']);
  }

  /**
   * Get commit log
   */
  async getLog(options?: { maxCount?: number; from?: string; to?: string }): Promise<any> {
    const logOptions: any = {};

    if (options?.maxCount) {
      logOptions.maxCount = options.maxCount;
    }

    if (options?.from && options?.to) {
      logOptions.from = options.from;
      logOptions.to = options.to;
    }

    return await this.git.log(logOptions);
  }

  /**
   * Stash current changes
   */
  async stash(message?: string): Promise<void> {
    if (message) {
      await this.git.stash(['push', '-m', message]);
    } else {
      await this.git.stash();
    }
  }

  /**
   * Pop stashed changes
   */
  async stashPop(): Promise<void> {
    await this.git.stash(['pop']);
  }

  /**
   * Get default branch (usually main or master)
   */
  async getDefaultBranch(): Promise<string> {
    try {
      // Try to get the default branch from the remote
      const result = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const match = result.trim().match(/refs\/remotes\/origin\/(.+)/);
      if (match) {
        return match[1];
      }
    } catch (error) {
      // If that fails, check common default branch names
      const branches = await this.listBranches();
      if (branches.includes('main')) {
        return 'main';
      }
      if (branches.includes('master')) {
        return 'master';
      }
    }

    // Default to 'main' if we can't determine
    return 'main';
  }
}
