import { GitHubService } from './GitHubService';
import { GitService } from './GitService';
import { ConfigService } from './ConfigService';
import { MergeOptions } from '../types';

export interface CreatePRInput {
  title: string;
  body?: string;
  head?: string; // Defaults to current branch
  base?: string; // Defaults to main/master
  draft?: boolean;
  template?: string; // Path to template or template name
}

export interface PRInfo {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
  mergeable: boolean | null;
  merged: boolean;
}

/**
 * PRService - High-level PR operations with validation and templates
 */
export class PRService {
  constructor(
    private github: GitHubService,
    private git: GitService,
    private config: ConfigService
  ) {}

  /**
   * Create a pull request with optional template
   */
  async createPR(input: CreatePRInput): Promise<{ number: number; url: string }> {
    // Get current branch if not specified
    const head = input.head || await this.git.getCurrentBranch();

    // Get base branch from config or default
    const base = input.base || await this.git.getDefaultBranch();

    // Ensure we're not creating PR from base branch
    if (head === base) {
      throw new Error(`Cannot create PR from ${base} branch. Create a feature branch first.`);
    }

    // Check if working directory is clean
    const isClean = await this.git.isClean();
    if (!isClean) {
      throw new Error('Working directory has uncommitted changes. Commit or stash them first.');
    }

    // Get PR body from template if specified
    let body = input.body || '';
    if (input.template) {
      const templateService = new (await import('./PRTemplateService')).PRTemplateService(
        this.config
      );
      body = await templateService.renderTemplate(input.template, {
        title: input.title,
        branch: head,
        baseBranch: base
      });
    } else if (!body) {
      // Try to discover template automatically
      const templateService = new (await import('./PRTemplateService')).PRTemplateService(
        this.config
      );
      const template = await templateService.discoverTemplate();
      if (template) {
        body = await templateService.renderTemplate(template, {
          title: input.title,
          branch: head,
          baseBranch: base
        });
      }
    }

    // Create the PR
    const result = await this.github.createPR({
      title: input.title,
      body: body || `# ${input.title}\n\nAutomatically generated PR`,
      head,
      base,
      draft: input.draft
    });

    return {
      number: result.number,
      url: result.html_url
    };
  }

  /**
   * Get PR details
   */
  async getPR(prNumber: number): Promise<PRInfo> {
    const pr = await this.github.getPR(prNumber);

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      html_url: pr.html_url,
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha
      },
      base: {
        ref: pr.base.ref
      },
      mergeable: pr.mergeable,
      merged: pr.merged
    };
  }

  /**
   * List pull requests
   */
  async listPRs(state: 'open' | 'closed' | 'all' = 'open'): Promise<PRInfo[]> {
    const prs = await this.github.listPRs(state);

    return prs.map(pr => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      html_url: pr.html_url,
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha
      },
      base: {
        ref: pr.base.ref
      },
      mergeable: pr.mergeable,
      merged: pr.merged
    }));
  }

  /**
   * Merge a pull request with validation
   */
  async mergePR(
    prNumber: number,
    options: MergeOptions & { deleteBranch?: boolean } = {}
  ): Promise<{ merged: boolean; sha: string }> {
    // Get PR details
    const pr = await this.getPR(prNumber);

    // Validate PR is mergeable
    if (pr.state !== 'open') {
      throw new Error(`PR #${prNumber} is ${pr.state}, cannot merge`);
    }

    if (pr.merged) {
      throw new Error(`PR #${prNumber} is already merged`);
    }

    if (pr.mergeable === false) {
      throw new Error(`PR #${prNumber} has conflicts and cannot be merged`);
    }

    // Merge the PR
    const result = await this.github.mergePR(prNumber, {
      method: options.method || 'merge',
      commitTitle: options.commitTitle,
      commitMessage: options.commitMessage,
      sha: options.sha || pr.head.sha
    });

    // Delete branch if requested
    if (options.deleteBranch && result.merged) {
      try {
        await this.github.deleteBranch(pr.head.ref);
      } catch (error) {
        // Branch deletion is not critical, log but don't fail
        console.warn(`Warning: Failed to delete branch ${pr.head.ref}:`, error);
      }
    }

    return result;
  }

  /**
   * Check if a PR exists for the current branch
   */
  async findPRForBranch(branch?: string): Promise<PRInfo | null> {
    const branchName = branch || await this.git.getCurrentBranch();
    const prs = await this.listPRs('open');

    const pr = prs.find(p => p.head.ref === branchName);
    return pr || null;
  }

  /**
   * Validate PR is ready for merge
   */
  async validatePRReadiness(prNumber: number): Promise<{
    ready: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const pr = await this.getPR(prNumber);

    // Check PR state
    if (pr.state !== 'open') {
      issues.push(`PR is ${pr.state}, not open`);
    }

    if (pr.merged) {
      issues.push('PR is already merged');
    }

    // Check mergeable status
    if (pr.mergeable === false) {
      issues.push('PR has merge conflicts');
    } else if (pr.mergeable === null) {
      issues.push('Mergeable status not yet determined');
    }

    return {
      ready: issues.length === 0,
      issues
    };
  }

  /**
   * Get commit list for a PR
   */
  async getPRCommits(_prNumber: number): Promise<any[]> {
    // This would use GitHub API to get commits
    // For now, return empty array (to be implemented)
    return [];
  }
}
