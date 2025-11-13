import { PRService } from '../../src/services/PRService';
import { GitHubService } from '../../src/services/GitHubService';
import { GitService } from '../../src/services/GitService';
import { ConfigService } from '../../src/services/ConfigService';

// Mock all dependencies
jest.mock('../../src/services/GitHubService');
jest.mock('../../src/services/GitService');
jest.mock('../../src/services/ConfigService');

// Mock PRTemplateService dynamically
jest.mock('../../src/services/PRTemplateService', () => {
  const mockDiscoverTemplate = jest.fn().mockResolvedValue(null);  // No template found by default
  const mockRenderTemplate = jest.fn().mockResolvedValue('');      // Empty string by default

  return {
    PRTemplateService: jest.fn().mockImplementation(() => ({
      discoverTemplate: mockDiscoverTemplate,
      renderTemplate: mockRenderTemplate,
    })),
  };
});

const MockedGitHubService = GitHubService as jest.MockedClass<typeof GitHubService>;
const MockedGitService = GitService as jest.MockedClass<typeof GitService>;
const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;

describe('PRService', () => {
  let prService: PRService;
  let mockGitHub: jest.Mocked<GitHubService>;
  let mockGit: jest.Mocked<GitService>;
  let mockConfig: jest.Mocked<ConfigService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockGitHub = {
      createPR: jest.fn(),
      getPR: jest.fn(),
      listPRs: jest.fn(),
      mergePR: jest.fn(),
      deleteBranch: jest.fn(),
    } as any;

    mockGit = {
      getCurrentBranch: jest.fn(),
      getDefaultBranch: jest.fn(),
      isClean: jest.fn(),
    } as any;

    mockConfig = {
      get: jest.fn(),
    } as any;

    MockedGitHubService.mockImplementation(() => mockGitHub);
    MockedGitService.mockImplementation(() => mockGit);
    MockedConfigService.mockImplementation(() => mockConfig);

    prService = new PRService(mockGitHub, mockGit, mockConfig);
  });

  describe('createPR', () => {
    it('should create PR with explicit title and body', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('feature/new-feature');
      mockGit.getDefaultBranch.mockResolvedValue('main');
      mockGit.isClean.mockResolvedValue(true);
      mockGitHub.createPR.mockResolvedValue({
        number: 123,
        html_url: 'https://github.com/owner/repo/pull/123',
      } as any);

      const result = await prService.createPR({
        title: 'Add new feature',
        body: 'This PR adds a new feature',
      });

      expect(result.number).toBe(123);
      expect(result.url).toBe('https://github.com/owner/repo/pull/123');
      expect(mockGitHub.createPR).toHaveBeenCalledWith({
        title: 'Add new feature',
        body: 'This PR adds a new feature',
        head: 'feature/new-feature',
        base: 'main',
        draft: undefined,
      });
    });

    it('should throw error when creating PR from base branch', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('main');
      mockGit.getDefaultBranch.mockResolvedValue('main');

      await expect(
        prService.createPR({ title: 'Test PR' })
      ).rejects.toThrow('Cannot create PR from main branch');
    });

    it('should throw error when working directory is dirty', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('feature/test');
      mockGit.getDefaultBranch.mockResolvedValue('main');
      mockGit.isClean.mockResolvedValue(false);

      await expect(
        prService.createPR({ title: 'Test PR' })
      ).rejects.toThrow('Working directory has uncommitted changes');
    });

    it('should create draft PR when specified', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('feature/draft');
      mockGit.getDefaultBranch.mockResolvedValue('main');
      mockGit.isClean.mockResolvedValue(true);
      mockGitHub.createPR.mockResolvedValue({
        number: 124,
        html_url: 'https://github.com/owner/repo/pull/124',
      } as any);

      const result = await prService.createPR({
        title: 'Draft feature',
        draft: true,
      });

      expect(result.number).toBe(124);
      expect(mockGitHub.createPR).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
        })
      );
    });

    it('should use specified head and base branches', async () => {
      mockGit.isClean.mockResolvedValue(true);
      mockGitHub.createPR.mockResolvedValue({
        number: 125,
        html_url: 'https://github.com/owner/repo/pull/125',
      } as any);

      await prService.createPR({
        title: 'Test PR',
        body: 'Test body',  // Provide body to skip template discovery
        head: 'feature/custom',
        base: 'develop',
      });

      expect(mockGitHub.createPR).toHaveBeenCalledWith(
        expect.objectContaining({
          head: 'feature/custom',
          base: 'develop',
        })
      );
    });
  });

  describe('getPR', () => {
    it('should get PR details', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: 'Test body',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: {
          ref: 'feature/test',
          sha: 'abc123',
        },
        base: {
          ref: 'main',
        },
        mergeable: true,
        merged: false,
      };

      mockGitHub.getPR.mockResolvedValue(mockPR as any);

      const result = await prService.getPR(123);

      expect(result.number).toBe(123);
      expect(result.title).toBe('Test PR');
      expect(result.state).toBe('open');
      expect(result.mergeable).toBe(true);
      expect(result.merged).toBe(false);
      expect(mockGitHub.getPR).toHaveBeenCalledWith(123);
    });

    it('should handle null PR body', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: null,
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main' },
        mergeable: true,
        merged: false,
      };

      mockGitHub.getPR.mockResolvedValue(mockPR as any);

      const result = await prService.getPR(123);

      expect(result.body).toBe('');
    });
  });

  describe('listPRs', () => {
    it('should list open PRs by default', async () => {
      const mockPRs = [
        {
          number: 123,
          title: 'PR 1',
          body: 'Body 1',
          state: 'open',
          html_url: 'https://github.com/owner/repo/pull/123',
          head: { ref: 'feature/1', sha: 'abc123' },
          base: { ref: 'main' },
          mergeable: true,
          merged: false,
        },
        {
          number: 124,
          title: 'PR 2',
          body: 'Body 2',
          state: 'open',
          html_url: 'https://github.com/owner/repo/pull/124',
          head: { ref: 'feature/2', sha: 'def456' },
          base: { ref: 'main' },
          mergeable: false,
          merged: false,
        },
      ];

      mockGitHub.listPRs.mockResolvedValue(mockPRs as any);

      const result = await prService.listPRs();

      expect(result).toHaveLength(2);
      expect(result[0].number).toBe(123);
      expect(result[1].number).toBe(124);
      expect(mockGitHub.listPRs).toHaveBeenCalledWith('open');
    });

    it('should list closed PRs when specified', async () => {
      mockGitHub.listPRs.mockResolvedValue([]);

      await prService.listPRs('closed');

      expect(mockGitHub.listPRs).toHaveBeenCalledWith('closed');
    });

    it('should list all PRs when specified', async () => {
      mockGitHub.listPRs.mockResolvedValue([]);

      await prService.listPRs('all');

      expect(mockGitHub.listPRs).toHaveBeenCalledWith('all');
    });
  });

  describe('mergePR', () => {
    const mockPR = {
      number: 123,
      title: 'Test PR',
      body: 'Test body',
      state: 'open',
      html_url: 'https://github.com/owner/repo/pull/123',
      head: {
        ref: 'feature/test',
        sha: 'abc123',
      },
      base: {
        ref: 'main',
      },
      mergeable: true,
      merged: false,
    };

    beforeEach(() => {
      mockGitHub.getPR.mockResolvedValue(mockPR as any);
    });

    it('should merge PR successfully', async () => {
      mockGitHub.mergePR.mockResolvedValue({
        merged: true,
        sha: 'merged-sha',
      } as any);

      const result = await prService.mergePR(123);

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merged-sha');
      expect(mockGitHub.mergePR).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          method: 'merge',
          sha: 'abc123',
        })
      );
    });

    it('should throw error when PR is closed', async () => {
      mockGitHub.getPR.mockResolvedValue({
        ...mockPR,
        state: 'closed',
      } as any);

      await expect(prService.mergePR(123)).rejects.toThrow('PR #123 is closed, cannot merge');
    });

    it('should throw error when PR is already merged', async () => {
      mockGitHub.getPR.mockResolvedValue({
        ...mockPR,
        merged: true,
      } as any);

      await expect(prService.mergePR(123)).rejects.toThrow('PR #123 is already merged');
    });

    it('should throw error when PR has conflicts', async () => {
      mockGitHub.getPR.mockResolvedValue({
        ...mockPR,
        mergeable: false,
      } as any);

      await expect(prService.mergePR(123)).rejects.toThrow('PR #123 has conflicts and cannot be merged');
    });

    it('should delete branch after merge when requested', async () => {
      mockGitHub.mergePR.mockResolvedValue({
        merged: true,
        sha: 'merged-sha',
      } as any);
      mockGitHub.deleteBranch.mockResolvedValue(undefined as any);

      await prService.mergePR(123, { deleteBranch: true });

      expect(mockGitHub.deleteBranch).toHaveBeenCalledWith('feature/test');
    });

    it('should not fail if branch deletion fails', async () => {
      mockGitHub.mergePR.mockResolvedValue({
        merged: true,
        sha: 'merged-sha',
      } as any);
      mockGitHub.deleteBranch.mockRejectedValue(new Error('Branch protected'));

      // Should not throw
      const result = await prService.mergePR(123, { deleteBranch: true });

      expect(result.merged).toBe(true);
    });

    it('should support squash merge method', async () => {
      mockGitHub.mergePR.mockResolvedValue({
        merged: true,
        sha: 'merged-sha',
      } as any);

      await prService.mergePR(123, { method: 'squash' });

      expect(mockGitHub.mergePR).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          method: 'squash',
        })
      );
    });

    it('should support rebase merge method', async () => {
      mockGitHub.mergePR.mockResolvedValue({
        merged: true,
        sha: 'merged-sha',
      } as any);

      await prService.mergePR(123, { method: 'rebase' });

      expect(mockGitHub.mergePR).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          method: 'rebase',
        })
      );
    });
  });

  describe('findPRForBranch', () => {
    it('should find PR for current branch', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('feature/test');
      mockGitHub.listPRs.mockResolvedValue([
        {
          number: 123,
          title: 'Test PR',
          body: 'Body',
          state: 'open',
          html_url: 'https://github.com/owner/repo/pull/123',
          head: { ref: 'feature/test', sha: 'abc123' },
          base: { ref: 'main' },
          mergeable: true,
          merged: false,
        },
        {
          number: 124,
          title: 'Other PR',
          body: 'Body',
          state: 'open',
          html_url: 'https://github.com/owner/repo/pull/124',
          head: { ref: 'feature/other', sha: 'def456' },
          base: { ref: 'main' },
          mergeable: true,
          merged: false,
        },
      ] as any);

      const result = await prService.findPRForBranch();

      expect(result).not.toBeNull();
      expect(result?.number).toBe(123);
      expect(result?.head.ref).toBe('feature/test');
    });

    it('should find PR for specified branch', async () => {
      mockGitHub.listPRs.mockResolvedValue([
        {
          number: 125,
          title: 'Specific PR',
          body: 'Body',
          state: 'open',
          html_url: 'https://github.com/owner/repo/pull/125',
          head: { ref: 'feature/specific', sha: 'xyz789' },
          base: { ref: 'main' },
          mergeable: true,
          merged: false,
        },
      ] as any);

      const result = await prService.findPRForBranch('feature/specific');

      expect(result).not.toBeNull();
      expect(result?.number).toBe(125);
    });

    it('should return null when no PR found', async () => {
      mockGit.getCurrentBranch.mockResolvedValue('feature/no-pr');
      mockGitHub.listPRs.mockResolvedValue([]);

      const result = await prService.findPRForBranch();

      expect(result).toBeNull();
    });
  });

  describe('validatePRReadiness', () => {
    it('should validate PR is ready to merge', async () => {
      const mockPR = {
        number: 123,
        title: 'Test PR',
        body: 'Body',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main' },
        mergeable: true,
        merged: false,
      };

      mockGitHub.getPR.mockResolvedValue(mockPR as any);

      const result = await prService.validatePRReadiness(123);

      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should detect closed PR', async () => {
      mockGitHub.getPR.mockResolvedValue({
        number: 123,
        title: 'Test',
        body: 'Body',
        state: 'closed',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main' },
        merged: false,
        mergeable: true,
      } as any);

      const result = await prService.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(result.issues).toContain('PR is closed, not open');
    });

    it('should detect already merged PR', async () => {
      mockGitHub.getPR.mockResolvedValue({
        number: 123,
        title: 'Test',
        body: 'Body',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main' },
        merged: true,
        mergeable: true,
      } as any);

      const result = await prService.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(result.issues).toContain('PR is already merged');
    });

    it('should detect merge conflicts', async () => {
      mockGitHub.getPR.mockResolvedValue({
        number: 123,
        title: 'Test',
        body: 'Body',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main' },
        merged: false,
        mergeable: false,
      } as any);

      const result = await prService.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(result.issues).toContain('PR has merge conflicts');
    });

    it('should detect undetermined mergeable status', async () => {
      mockGitHub.getPR.mockResolvedValue({
        number: 123,
        title: 'Test',
        body: 'Body',
        state: 'open',
        html_url: 'https://github.com/owner/repo/pull/123',
        head: { ref: 'feature/test', sha: 'abc123' },
        base: { ref: 'main' },
        merged: false,
        mergeable: null,
      } as any);

      const result = await prService.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(result.issues).toContain('Mergeable status not yet determined');
    });
  });

  describe('getPRCommits', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const result = await prService.getPRCommits(123);

      expect(result).toEqual([]);
    });
  });
});
