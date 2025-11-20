import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import { throttling } from "@octokit/plugin-throttling";
import { GitHubServiceOptions, PROptions, MergeOptions } from "../types";
import { logger } from "../utils/logger";
import * as childProcess from "child_process";

// Extend Octokit with throttling plugin
const MyOctokit = Octokit.plugin(throttling);

/**
 * Custom error classes for better error handling
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class PRExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PRExistsError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class MergeBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeBlockedError";
  }
}

export class MergeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeConflictError";
  }
}

/**
 * GitHubService - Wraps Octokit SDK for all GitHub operations
 */
export class GitHubService {
  public octokit: Octokit;
  public owner: string;
  public repo: string;

  constructor(options: GitHubServiceOptions) {
    this.octokit = new MyOctokit({
      auth: options.token,
      throttle: {
        onRateLimit: (retryAfter, _options, _octokit, retryCount) => {
          logger.warn(
            `Rate limit exceeded, retrying after ${retryAfter}s (attempt ${retryCount + 1})`,
          );

          if (retryCount < 3) {
            return true; // Retry
          }

          logger.error("Rate limit retry attempts exhausted");
          return false;
        },
        onSecondaryRateLimit: (retryAfter, _options, _octokit) => {
          logger.warn(`Secondary rate limit hit, waiting ${retryAfter}s`);
          return true; // Always retry secondary rate limits
        },
      },
    });

    // If owner/repo provided, use them; otherwise parse from git remote
    if (options.owner && options.repo) {
      this.owner = options.owner;
      this.repo = options.repo;
    } else {
      const { owner, repo } = this.parseRemoteUrlSync();
      this.owner = owner;
      this.repo = repo;
    }
  }

  /**
   * Verify GitHub authentication
   */
  async verifyAuth(): Promise<{ login: string }> {
    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      return { login: user.login };
    } catch (error) {
      if (error instanceof RequestError) {
        throw new AuthError(`GitHub authentication failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create pull request
   */
  async createPR(options: PROptions) {
    const { title, body, head, base, draft = false } = options;

    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head,
        base,
        draft,
      });

      return {
        number: data.number,
        html_url: data.html_url,
        head: data.head.sha,
      };
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 422) {
          throw new PRExistsError(
            "Pull request already exists for this branch",
          );
        } else if (error.status === 404) {
          throw new NotFoundError("Repository not found or no access");
        }
      }
      throw error;
    }
  }

  /**
   * Get pull request details
   */
  async getPR(prNumber: number): Promise<{
    number: number;
    title: string;
    body: string | null;
    state: string;
    html_url: string;
    head: { ref: string; sha: string };
    base: { ref: string };
    mergeable: boolean | null;
    merged: boolean;
    [key: string]: any;
  }> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return data as any;
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        throw new NotFoundError(`Pull request #${prNumber} not found`);
      }
      throw error;
    }
  }

  /**
   * List pull requests
   */
  async listPRs(state: "open" | "closed" | "all" = "open"): Promise<
    Array<{
      number: number;
      title: string;
      body: string | null;
      state: string;
      html_url: string;
      head: { ref: string; sha: string };
      base: { ref: string };
      mergeable: boolean | null;
      merged: boolean;
      [key: string]: any;
    }>
  > {
    const { data } = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state,
    });

    return data as any;
  }

  /**
   * Merge pull request
   */
  async mergePR(prNumber: number, options: MergeOptions) {
    const { method = "merge", commitTitle, commitMessage, sha } = options;

    try {
      const { data } = await this.octokit.rest.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: method,
        commit_title: commitTitle,
        commit_message: commitMessage,
        sha,
      });

      return {
        merged: data.merged,
        sha: data.sha,
      };
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 405) {
          throw new MergeBlockedError(
            "PR cannot be merged (conflicts or failed checks)",
          );
        } else if (error.status === 409) {
          throw new MergeConflictError("PR has merge conflicts");
        }
      }
      throw error;
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(branch: string) {
    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
      });
    } catch (error) {
      if (error instanceof RequestError && error.status === 422) {
        throw new Error(`Branch ${branch} does not exist or already deleted`);
      }
      throw error;
    }
  }

  /**
   * Get repository information
   */
  async getRepo() {
    const { data } = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });

    return data;
  }

  /**
   * Get GitHub API rate limit status
   */
  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    reset: Date;
    used: number;
  }> {
    const { data } = await this.octokit.rest.rateLimit.get();
    const { remaining, limit, reset, used } = data.rate;

    // Warn if running low
    if (remaining < 1000) {
      logger.warn(
        `API rate limit low: ${remaining}/${limit} requests remaining`,
      );
      logger.info(
        `Rate limit resets at: ${new Date(reset * 1000).toLocaleString()}`,
      );
    }

    return {
      remaining,
      limit,
      reset: new Date(reset * 1000),
      used,
    };
  }

  /**
   * Parse owner/repo from git remote URL (synchronous)
   * Supports both SSH and HTTPS formats:
   * - git@github.com:littlebearapps/notebridge.git
   * - https://github.com/littlebearapps/notebridge.git
   */
  private parseRemoteUrlSync(): { owner: string; repo: string } {
    try {
      // Use exec to get remote URL synchronously
      const remoteUrl = childProcess
        .execSync("git config --get remote.origin.url", {
          encoding: "utf-8",
          cwd: process.cwd(),
        })
        .trim();

      return this.parseGitUrl(remoteUrl);
    } catch (error) {
      throw new Error(`Failed to parse git remote URL: ${error}`);
    }
  }

  /**
   * Parse a git URL into owner and repo
   */
  private parseGitUrl(url: string): { owner: string; repo: string } {
    // SSH format: git@github.com:littlebearapps/notebridge.git
    const sshMatch = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2],
      };
    }

    // HTTPS format: https://github.com/littlebearapps/notebridge.git
    const httpsMatch = url.match(
      /https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/,
    );
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2],
      };
    }

    throw new Error(`Could not parse git URL: ${url}`);
  }
}
