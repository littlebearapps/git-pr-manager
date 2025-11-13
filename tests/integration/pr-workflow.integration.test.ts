import { BranchProtectionChecker } from '../../src/services/BranchProtectionChecker';
import { ErrorClassifier } from '../../src/utils/ErrorClassifier';
import { SuggestionEngine } from '../../src/utils/SuggestionEngine';

/**
 * Integration tests for the complete PR workflow
 *
 * These tests verify that multiple services work together correctly
 * to handle the full lifecycle of a pull request.
 */
describe('PR Workflow Integration', () => {
  let mockOctokit: any;
  let protectionChecker: BranchProtectionChecker;
  let errorClassifier: ErrorClassifier;
  let suggestionEngine: SuggestionEngine;

  beforeEach(() => {
    // Create comprehensive mock Octokit
    mockOctokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
          updateBranchProtection: jest.fn(),
          getCombinedStatusForRef: jest.fn(() => Promise.resolve({ data: { statuses: [] } })),
          compareCommits: jest.fn(),
        },
        pulls: {
          create: jest.fn(),
          get: jest.fn(),
          update: jest.fn(),
          merge: jest.fn(),
          listReviews: jest.fn(),
          listReviewComments: jest.fn(),
        },
        checks: {
          listForRef: jest.fn(() => Promise.resolve({ data: { check_runs: [] } })),
        },
        issues: {
          listComments: jest.fn(),
          createComment: jest.fn(),
        },
      },
    };

    // Initialize services
    protectionChecker = new BranchProtectionChecker(mockOctokit, 'owner', 'repo');
    errorClassifier = new ErrorClassifier();
    suggestionEngine = new SuggestionEngine();
  });

  describe('Complete PR Lifecycle', () => {
    it('should handle successful PR validation with all checks passing', async () => {
      // Setup: Mock PR
      const mockPR = {
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          title: 'feat: Add new feature',
          body: 'This adds a new feature',
          base: { ref: 'main', sha: 'base123' },
          head: { ref: 'feature/new', sha: 'head456' },
        },
      };

      mockOctokit.rest.pulls.get.mockResolvedValue(mockPR);

      // Setup: Branch protection is enabled
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ['ci', 'security'],
          },
          required_pull_request_reviews: {
            required_approving_review_count: 1,
          },
          required_conversation_resolution: {
            enabled: true,
          },
        },
      };

      mockOctokit.rest.repos.getBranchProtection.mockResolvedValue(mockProtection);

      // Setup: All checks passing
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'ci', status: 'completed', conclusion: 'success' },
            { name: 'security', status: 'completed', conclusion: 'success' },
          ],
        },
      });

      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      // Setup: Branch is up to date
      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: { behind_by: 0 },
      });

      // Setup: Approved reviews
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({
        data: [{ state: 'APPROVED', user: { login: 'reviewer1' } }],
      });

      // Setup: No unresolved comments
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      // Act: Validate PR readiness
      const validation = await protectionChecker.validatePRReadiness(123);

      // Assert: PR should be ready to merge
      expect(validation.ready).toBe(true);
      expect(validation.issues).toEqual([]);
      if (validation.protection) {
        expect(validation.protection.enabled).toBe(true);
        expect(validation.protection.requiredStatusChecks).toEqual(['ci', 'security']);
      }
    });

    it('should handle PR with failing checks and provide suggestions', async () => {
      // Setup: Mock PR
      const mockPR = {
        data: {
          number: 124,
          base: { ref: 'main', sha: 'base123' },
          head: { ref: 'feature/buggy', sha: 'head789' },
        },
      };

      mockOctokit.rest.pulls.get.mockResolvedValue(mockPR);

      // Setup: Branch protection enabled
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ['ci', 'security', 'tests'],
          },
          required_pull_request_reviews: {
            required_approving_review_count: 2,
          },
        },
      };

      mockOctokit.rest.repos.getBranchProtection.mockResolvedValue(mockProtection);

      // Setup: Some checks failing
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'ci', status: 'completed', conclusion: 'failure' },
            { name: 'security', status: 'completed', conclusion: 'success' },
            // tests check is missing
          ],
        },
      });

      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });

      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: { behind_by: 2 },
      });

      // Setup: Insufficient reviews
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({
        data: [{ state: 'APPROVED', user: { login: 'reviewer1' } }],
      });

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      // Act: Validate PR
      const validation = await protectionChecker.validatePRReadiness(124);

      // Assert: PR should not be ready
      expect(validation.ready).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);

      // Act: Classify errors and get suggestion
      const issues = validation.issues.join('\n');
      const mockCheck = {
        name: 'ci',
        output: {
          summary: issues,
          title: 'CI Failure'
        }
      };
      const classification = errorClassifier.classify(mockCheck);
      const suggestion = suggestionEngine.getSuggestion(issues, classification, []);

      // Assert: Should provide helpful suggestion
      expect(suggestion).toBeDefined();
      expect(suggestion.command).toBeDefined();
      expect(suggestion.command.length).toBeGreaterThan(0);
    });

    it('should handle PR without branch protection', async () => {
      // Setup: Mock PR
      const mockPR = {
        data: {
          number: 125,
          base: { ref: 'main', sha: 'base123' },
          head: { ref: 'feature/unprotected', sha: 'head999' },
        },
      };

      mockOctokit.rest.pulls.get.mockResolvedValue(mockPR);

      // Setup: No branch protection
      const error: any = new Error('Branch not protected');
      error.status = 404;
      mockOctokit.rest.repos.getBranchProtection.mockRejectedValue(error);

      // Act: Validate PR
      const validation = await protectionChecker.validatePRReadiness(125);

      // Assert: Should pass but with warning
      expect(validation.ready).toBe(true);
      expect(validation.issues).toEqual([]);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('No branch protection'))).toBe(true);
    });
  });

  describe('Branch Protection Setup Integration', () => {
    it('should setup protection and validate against it', async () => {
      // Setup: Mock updateBranchProtection
      mockOctokit.rest.repos.updateBranchProtection.mockResolvedValue({});

      // Act: Setup standard protection
      await protectionChecker.setupProtection('main', 'standard');

      // Assert: updateBranchProtection was called with correct config
      expect(mockOctokit.rest.repos.updateBranchProtection).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          required_status_checks: {
            strict: true,
            contexts: ['ci', 'security'],
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: false,
            required_approving_review_count: 0,
          },
          required_conversation_resolution: true,
          enforce_admins: false,
        })
      );

      // Setup: Mock getProtection to return what we just set
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ['ci', 'security'],
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: false,
            required_approving_review_count: 0,
          },
          required_conversation_resolution: {
            enabled: true,
          },
          enforce_admins: {
            enabled: false,
          },
          allow_force_pushes: {
            enabled: false,
          },
          allow_deletions: {
            enabled: false,
          },
        },
      };

      mockOctokit.rest.repos.getBranchProtection.mockResolvedValue(mockProtection);

      // Act: Get protection status
      const protection = await protectionChecker.getProtection('main');

      // Assert: Should match what we set
      expect(protection.enabled).toBe(true);
      expect(protection.requiredStatusChecks).toEqual(['ci', 'security']);
      expect(protection.strictChecks).toBe(true);
      expect(protection.requiredReviews).toBe(0);
      expect(protection.dismissStaleReviews).toBe(true);
    });

    it('should handle upgrading from basic to strict protection', async () => {
      // Setup: Currently basic protection
      mockOctokit.rest.repos.updateBranchProtection.mockResolvedValue({});

      // Act: Setup basic first
      await protectionChecker.setupProtection('main', 'basic');

      // Act: Upgrade to strict
      await protectionChecker.setupProtection('main', 'strict');

      // Assert: Should be called twice
      expect(mockOctokit.rest.repos.updateBranchProtection).toHaveBeenCalledTimes(2);

      // Assert: Second call should be strict
      const secondCall = mockOctokit.rest.repos.updateBranchProtection.mock.calls[1][0];
      expect(secondCall.required_status_checks.contexts).toContain('ci');
      expect(secondCall.required_status_checks.contexts).toContain('security');
      expect(secondCall.required_status_checks.contexts).toContain('tests');
      expect(secondCall.required_status_checks.contexts).toContain('lint');
      expect(secondCall.required_pull_request_reviews.required_approving_review_count).toBe(1);
      expect(secondCall.required_pull_request_reviews.require_code_owner_reviews).toBe(true);
      expect(secondCall.enforce_admins).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle GitHub API errors gracefully', async () => {
      // Setup: Mock API error
      const apiError: any = new Error('API rate limit exceeded');
      apiError.status = 429;
      mockOctokit.rest.repos.getBranchProtection.mockRejectedValue(apiError);

      // Act & Assert: Should propagate error
      await expect(
        protectionChecker.getProtection('main')
      ).rejects.toThrow('API rate limit exceeded');
    });

    it('should handle network timeouts', async () => {
      // Setup: Mock timeout
      const timeoutError = new Error('ETIMEDOUT');
      mockOctokit.rest.repos.getBranchProtection.mockRejectedValue(timeoutError);

      // Act & Assert: Should handle gracefully
      await expect(protectionChecker.getProtection('main')).rejects.toThrow('ETIMEDOUT');
    });

    it('should handle missing PR', async () => {
      // Setup: PR doesn't exist
      const error: any = new Error('Not Found');
      error.status = 404;
      mockOctokit.rest.pulls.get.mockRejectedValue(error);

      // Act & Assert: Should throw appropriate error
      await expect(protectionChecker.validatePRReadiness(999)).rejects.toThrow('Not Found');
    });
  });

  describe('Multi-Service Validation', () => {
    it('should coordinate checks across multiple services', async () => {
      // This test demonstrates how multiple services would work together
      // in a real workflow orchestrator

      // Setup: Mock PR
      const mockPR = {
        data: {
          number: 126,
          base: { ref: 'main', sha: 'base123' },
          head: { ref: 'feature/comprehensive', sha: 'head111' },
        },
      };

      mockOctokit.rest.pulls.get.mockResolvedValue(mockPR);

      // Setup: Branch protection
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ['ci', 'security'],
          },
        },
      };

      mockOctokit.rest.repos.getBranchProtection.mockResolvedValue(mockProtection);
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            { name: 'ci', status: 'completed', conclusion: 'success' },
            { name: 'security', status: 'completed', conclusion: 'success' },
          ],
        },
      });
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      });
      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: { behind_by: 0 },
      });
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.pulls.listReviewComments.mockResolvedValue({ data: [] });

      // Act: Run all validations
      const protectionValidation = await protectionChecker.validatePRReadiness(126);

      // Assert: Results can be aggregated
      const allIssues = [...protectionValidation.issues];

      // In a real orchestrator, you'd also run:
      // - securityScanner.scan()
      // - verifyService.runChecks()
      // And aggregate all results

      expect(protectionValidation.ready).toBe(true);
      expect(allIssues.length).toBe(0);
    });
  });
});
