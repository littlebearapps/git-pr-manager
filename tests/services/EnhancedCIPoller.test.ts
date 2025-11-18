import { ErrorType, PollStrategy } from '../../src/types';

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('../../src/utils/ErrorClassifier');
jest.mock('../../src/utils/SuggestionEngine');

// Import after mocks are defined
import { Octokit } from '@octokit/rest';
import { EnhancedCIPoller } from '../../src/services/EnhancedCIPoller';
import { ErrorClassifier } from '../../src/utils/ErrorClassifier';
import { SuggestionEngine } from '../../src/utils/SuggestionEngine';
import { logger } from '../../src/utils/logger';

// Create mock Octokit instance
const mockOctokitMethods = {
  pulls: {
    get: jest.fn()
  },
  checks: {
    listForRef: jest.fn(),
    listAnnotations: jest.fn()
  },
  repos: {
    getCombinedStatusForRef: jest.fn()
  }
};

class MockOctokit {
  rest = mockOctokitMethods;
  constructor(_options?: any) {}
}

// Mock Octokit class for testing
(Octokit as any) = MockOctokit; // eslint-disable-line @typescript-eslint/no-unused-vars

describe('EnhancedCIPoller', () => {
  let poller: EnhancedCIPoller;
  let mockErrorClassifier: jest.Mocked<ErrorClassifier>;
  let mockSuggestionEngine: jest.Mocked<SuggestionEngine>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockErrorClassifier = {
      classify: jest.fn().mockReturnValue(ErrorType.TEST_FAILURE)
    } as any;

    mockSuggestionEngine = {
      getSuggestion: jest.fn().mockReturnValue('Run: npm test')
    } as any;

    (ErrorClassifier as jest.Mock).mockImplementation(() => mockErrorClassifier);
    (SuggestionEngine as jest.Mock).mockImplementation(() => mockSuggestionEngine);

    poller = new EnhancedCIPoller({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo'
    });
  });

  afterEach(() => {
    // Ensure timers are always cleaned up to prevent leaks
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with provided options', () => {
      expect(poller).toBeDefined();
      expect(ErrorClassifier).toHaveBeenCalled();
      expect(SuggestionEngine).toHaveBeenCalled();
    });
  });

  describe('getDetailedCheckStatus', () => {
    it('should fetch and parse check status for PR', async () => {
      const mockPR = {
        data: {
          head: { sha: 'abc123' }
        }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'completed',
              conclusion: 'success',
              started_at: '2025-01-13T10:00:00Z',
              completed_at: '2025-01-13T10:05:00Z',
              output: {
                summary: 'All tests passed',
                text: ''
              }
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: {
          statuses: []
        }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const result = await poller.getDetailedCheckStatus(123);

      expect(result).toMatchObject({
        total: 1,
        passed: 1,
        failed: 0,
        pending: 0,
        overallStatus: 'success'
      });

      expect(mockOctokitMethods.pulls.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123
      });

      expect(mockOctokitMethods.checks.listForRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'abc123',
        per_page: 100
      });
    });

    it('should handle failed checks', async () => {
      const mockPR = {
        data: {
          head: { sha: 'abc123' }
        }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2025-01-13T10:00:00Z',
              completed_at: '2025-01-13T10:05:00Z',
              output: {
                summary: 'Tests failed',
                text: 'tests/auth.test.ts::test_login FAILED'
              },
              html_url: 'https://github.com/test/test/runs/123'
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: {
          statuses: []
        }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const result = await poller.getDetailedCheckStatus(123);

      expect(result).toMatchObject({
        total: 1,
        passed: 0,
        failed: 1,
        pending: 0,
        overallStatus: 'failure'
      });

      expect(result.failureDetails).toHaveLength(1);
      expect(result.failureDetails[0]).toMatchObject({
        checkName: 'test',
        errorType: ErrorType.TEST_FAILURE,
        summary: 'Tests failed',
        suggestedFix: 'Run: npm test',
        url: 'https://github.com/test/test/runs/123'
      });
    });

    it('should handle pending checks', async () => {
      const mockPR = {
        data: {
          head: { sha: 'abc123' }
        }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'in_progress',
              conclusion: null,
              started_at: '2025-01-13T10:00:00Z',
              output: {
                summary: 'Running...'
              }
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: {
          statuses: []
        }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const result = await poller.getDetailedCheckStatus(123);

      expect(result).toMatchObject({
        total: 1,
        passed: 0,
        failed: 0,
        pending: 1,
        overallStatus: 'pending'
      });

      expect(result.completedAt).toBeUndefined();
    });

    it('should include commit statuses in total count', async () => {
      const mockPR = {
        data: {
          head: { sha: 'abc123' }
        }
      };

      const mockCheckRuns = {
        data: {
          check_runs: []
        }
      };

      const mockCommitStatus = {
        data: {
          statuses: [
            { state: 'success', context: 'ci/external' },
            { state: 'success', context: 'ci/other' }
          ]
        }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const result = await poller.getDetailedCheckStatus(123);

      expect(result.total).toBe(2);
    });
  });

  describe('extractFiles', () => {
    it('should extract pytest file paths', () => {
      const output = 'tests/auth.test.ts::test_login FAILED';
      const files = (poller as any).extractFiles(output);

      expect(files).toContain('tests/auth.test.ts');
    });

    it('should extract TypeScript file paths with line/column', () => {
      const output = 'src/components/Button.tsx(45,12): error TS2322';
      const files = (poller as any).extractFiles(output);

      expect(files).toContain('src/components/Button.tsx');
    });

    it('should extract Python traceback file paths', () => {
      const output = 'File "app/models/user.py", line 123';
      const files = (poller as any).extractFiles(output);

      expect(files).toContain('app/models/user.py');
    });

    it('should extract ESLint file paths', () => {
      const output = '/src/utils/helper.js\n  45:12  error  Missing semicolon';
      const files = (poller as any).extractFiles(output);

      expect(files).toContain('src/utils/helper.js');
    });

    it('should return unique file paths', () => {
      const output = 'tests/auth.test.ts::test_login FAILED\ntests/auth.test.ts::test_logout FAILED';
      const files = (poller as any).extractFiles(output);

      expect(files).toEqual(['tests/auth.test.ts']);
    });

    it('should handle multiple file types', () => {
      const output = `
        tests/auth.test.ts::test_login FAILED
        src/components/Button.tsx(45,12): error TS2322
        File "app/models/user.py", line 123
      `;
      const files = (poller as any).extractFiles(output);

      // The regex may match partial paths, so we check for key files
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files).toContain('tests/auth.test.ts');
      expect(files.some((f: string) => f.includes('Button.tsx'))).toBe(true);
      expect(files.some((f: string) => f.includes('user.py'))).toBe(true);
    });
  });

  describe('getCheckAnnotations', () => {
    it('should fetch annotations for check run', async () => {
      const mockAnnotations = {
        data: [
          {
            path: 'src/auth.ts',
            start_line: 45,
            end_line: 45,
            annotation_level: 'failure',
            message: 'Type error',
            title: 'TypeScript Error',
            raw_details: 'Type "string" is not assignable to type "number"'
          }
        ]
      };

      mockOctokitMethods.checks.listAnnotations.mockResolvedValue(mockAnnotations as any);

      const result = await poller.getCheckAnnotations(123);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'src/auth.ts',
        start_line: 45,
        end_line: 45,
        annotation_level: 'failure',
        message: 'Type error'
      });

      expect(mockOctokitMethods.checks.listAnnotations).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 123,
        per_page: 50
      });
    });

    it('should respect custom limit', async () => {
      const mockAnnotations = { data: [] };
      mockOctokitMethods.checks.listAnnotations.mockResolvedValue(mockAnnotations as any);

      await poller.getCheckAnnotations(123, 100);

      expect(mockOctokitMethods.checks.listAnnotations).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        check_run_id: 123,
        per_page: 100
      });
    });
  });

  describe('calculateNextInterval', () => {
    it('should return fixed interval for fixed strategy', () => {
      const strategy: PollStrategy = {
        type: 'fixed',
        initialInterval: 5000
      };

      const interval = (poller as any).calculateNextInterval(10000, strategy);

      expect(interval).toBe(5000);
    });

    it('should apply exponential backoff with default multiplier', () => {
      const strategy: PollStrategy = {
        type: 'exponential',
        initialInterval: 5000
      };

      const interval = (poller as any).calculateNextInterval(5000, strategy);

      expect(interval).toBe(7500); // 5000 * 1.5
    });

    it('should apply exponential backoff with custom multiplier', () => {
      const strategy: PollStrategy = {
        type: 'exponential',
        initialInterval: 5000,
        multiplier: 2.0
      };

      const interval = (poller as any).calculateNextInterval(5000, strategy);

      expect(interval).toBe(10000); // 5000 * 2.0
    });

    it('should cap interval at maxInterval', () => {
      const strategy: PollStrategy = {
        type: 'exponential',
        initialInterval: 5000,
        maxInterval: 15000,
        multiplier: 2.0
      };

      const interval = (poller as any).calculateNextInterval(10000, strategy);

      expect(interval).toBe(15000); // Capped from 20000
    });

    it('should use default maxInterval of 30000 if not specified', () => {
      const strategy: PollStrategy = {
        type: 'exponential',
        initialInterval: 5000,
        multiplier: 10.0 // Would be 50000 without cap
      };

      const interval = (poller as any).calculateNextInterval(5000, strategy);

      expect(interval).toBe(30000); // Default max
    });

    it('should reduce interval for fast check duration (adaptive)', () => {
      const strategy: PollStrategy = {
        type: 'exponential',
        initialInterval: 5000,
        multiplier: 2.0
      };

      // checkDuration < 10000 triggers adaptive reduction
      const interval = (poller as any).calculateNextInterval(10000, strategy, 5000);

      expect(interval).toBe(10000); // (10000 * 2.0) / 2 = 10000
    });

    it('should not reduce below initialInterval (adaptive)', () => {
      const strategy: PollStrategy = {
        type: 'exponential',
        initialInterval: 5000,
        multiplier: 1.5
      };

      // Would reduce to 3750, but capped at initialInterval
      const interval = (poller as any).calculateNextInterval(5000, strategy, 5000);

      expect(interval).toBe(5000);
    });
  });

  describe('waitForChecks', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should complete successfully when all checks pass', async () => {
      const mockPR = {
        data: { head: { sha: 'abc123' } }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'completed',
              conclusion: 'success',
              started_at: '2025-01-13T10:00:00Z',
              completed_at: '2025-01-13T10:05:00Z',
              output: { summary: 'Passed' }
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: { statuses: [] }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const resultPromise = poller.waitForChecks(123);
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.summary.failed).toBe(0);
      expect(result.retriesUsed).toBe(0);
    });

    describe('waitForChecks - no checks scenario', () => {
      it('should detect no CI checks configured', async () => {
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

        const zeroStatus = {
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          failureDetails: [],
          overallStatus: 'success',
          startedAt: new Date()
        } as any;

        const statusSpy = jest
          .spyOn(poller as any, 'getDetailedCheckStatus')
          .mockResolvedValue(zeroStatus);

        const resultPromise = poller.waitForChecks(123);
        // Advance time beyond 20s grace period to trigger no-checks path
        jest.advanceTimersByTime(21000);
        const result = await resultPromise;

        expect(result.success).toBe(true);
        expect(statusSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No CI checks configured'));
        // Ensure we also logged info about skipping monitoring
        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping CI check wait'));
      });

      it('should wait briefly for registration, then proceed when checks appear', async () => {
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

        const zeroStatus = {
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          failureDetails: [],
          overallStatus: 'success',
          startedAt: new Date()
        } as any;

        const successStatus = {
          total: 1,
          passed: 1,
          failed: 0,
          pending: 0,
          skipped: 0,
          failureDetails: [],
          overallStatus: 'success',
          startedAt: new Date(),
          completedAt: new Date()
        } as any;

        const statusSpy = jest.spyOn(poller as any, 'getDetailedCheckStatus');
        statusSpy
          .mockResolvedValueOnce(zeroStatus)
          .mockResolvedValueOnce(zeroStatus)
          .mockResolvedValue(successStatus);

        const resultPromise = poller.waitForChecks(456, { pollStrategy: { type: 'fixed', initialInterval: 1000 } });
        // Advance by a couple of cycles (1s + 1s)
        jest.advanceTimersByTime(2000);
        const result = await resultPromise;

        expect(result.success).toBe(true);
        expect(result.summary.total).toBe(1);
        expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('No CI checks configured'));
      });
    });

    it('should complete with failure when checks fail', async () => {
      const mockPR = {
        data: { head: { sha: 'abc123' } }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2025-01-13T10:00:00Z',
              completed_at: '2025-01-13T10:05:00Z',
              output: {
                summary: 'Failed',
                text: ''
              },
              html_url: 'https://github.com'
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: { statuses: [] }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const resultPromise = poller.waitForChecks(123);
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.summary.failed).toBe(1);
    });

    it('should call onProgress callback when status changes', async () => {
      const onProgress = jest.fn();

      const mockPR = {
        data: { head: { sha: 'abc123' } }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'completed',
              conclusion: 'success',
              started_at: '2025-01-13T10:00:00Z',
              completed_at: '2025-01-13T10:05:00Z',
              output: { summary: 'Passed' }
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: { statuses: [] }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const resultPromise = poller.waitForChecks(123, { onProgress });
      jest.runAllTimers();
      await resultPromise;

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls[0][0]).toMatchObject({
        total: 1,
        passed: 1,
        failed: 0,
        pending: 0
      });
    });

    it('should throw TimeoutError when timeout is exceeded', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      const mockPR = {
        data: { head: { sha: 'abc123' } }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'test',
              status: 'in_progress',
              conclusion: null,
              started_at: '2025-01-13T10:00:00Z'
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: { statuses: [] }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      await expect(
        poller.waitForChecks(123, {
          timeout: 100,  // Very short timeout
          pollStrategy: { type: 'fixed', initialInterval: 10 }
        })
      ).rejects.toThrow('CI checks did not complete within 100ms');

      // Restore fake timers
      jest.useFakeTimers();
    }, 5000); // Increase jest timeout to 5 seconds

    it('should exit early with fail-fast on critical failure', async () => {
      mockErrorClassifier.classify.mockReturnValue(ErrorType.BUILD_ERROR);

      const mockPR = {
        data: { head: { sha: 'abc123' } }
      };

      const mockCheckRuns = {
        data: {
          check_runs: [
            {
              name: 'build',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2025-01-13T10:00:00Z',
              completed_at: '2025-01-13T10:05:00Z',
              output: {
                summary: 'Build failed',
                text: ''
              },
              html_url: 'https://github.com'
            },
            {
              name: 'test',
              status: 'in_progress',
              conclusion: null,
              started_at: '2025-01-13T10:00:00Z',
              output: {
                summary: 'Running...'
              }
            }
          ]
        }
      };

      const mockCommitStatus = {
        data: { statuses: [] }
      };

      mockOctokitMethods.pulls.get.mockResolvedValue(mockPR as any);
      mockOctokitMethods.checks.listForRef.mockResolvedValue(mockCheckRuns as any);
      mockOctokitMethods.repos.getCombinedStatusForRef.mockResolvedValue(mockCommitStatus as any);

      const resultPromise = poller.waitForChecks(123, { failFast: true });
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.reason).toBe('critical_failure');
    });
  });

  describe('isRetryable', () => {
    it('should return true when failure matches retry pattern', () => {
      const status = {
        failureDetails: [
          { summary: 'Connection timeout error' }
        ]
      } as any;

      const result = (poller as any).isRetryable(status, ['timeout', 'network']);

      expect(result).toBe(true);
    });

    it('should return false when failure does not match pattern', () => {
      const status = {
        failureDetails: [
          { summary: 'Type error in auth.ts' }
        ]
      } as any;

      const result = (poller as any).isRetryable(status, ['timeout', 'network']);

      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      const status = {
        failureDetails: [
          { summary: 'NETWORK ERROR' }
        ]
      } as any;

      const result = (poller as any).isRetryable(status, ['network']);

      expect(result).toBe(true);
    });
  });

  describe('hasCriticalFailure', () => {
    it('should return true for test failures', () => {
      const status = {
        failureDetails: [
          { errorType: ErrorType.TEST_FAILURE }
        ]
      } as any;

      const result = (poller as any).hasCriticalFailure(status);

      expect(result).toBe(true);
    });

    it('should return true for build errors', () => {
      const status = {
        failureDetails: [
          { errorType: ErrorType.BUILD_ERROR }
        ]
      } as any;

      const result = (poller as any).hasCriticalFailure(status);

      expect(result).toBe(true);
    });

    it('should return true for security issues', () => {
      const status = {
        failureDetails: [
          { errorType: ErrorType.SECURITY_ISSUE }
        ]
      } as any;

      const result = (poller as any).hasCriticalFailure(status);

      expect(result).toBe(true);
    });

    it('should return false for non-critical failures', () => {
      const status = {
        failureDetails: [
          { errorType: ErrorType.LINTING_ERROR }
        ]
      } as any;

      const result = (poller as any).hasCriticalFailure(status);

      expect(result).toBe(false);
    });
  });

  describe('hasStatusChanged', () => {
    it('should return true when no previous status', () => {
      const current = {
        passed: 1,
        failed: 0,
        pending: 0
      } as any;

      const result = (poller as any).hasStatusChanged(null, current);

      expect(result).toBe(true);
    });

    it('should return true when passed count changed', () => {
      const prev = {
        passed: 0,
        failed: 0,
        pending: 1
      } as any;

      const current = {
        passed: 1,
        failed: 0,
        pending: 0
      } as any;

      const result = (poller as any).hasStatusChanged(prev, current);

      expect(result).toBe(true);
    });

    it('should return true when failed count changed', () => {
      const prev = {
        passed: 0,
        failed: 0,
        pending: 1
      } as any;

      const current = {
        passed: 0,
        failed: 1,
        pending: 0
      } as any;

      const result = (poller as any).hasStatusChanged(prev, current);

      expect(result).toBe(true);
    });

    it('should return false when status unchanged', () => {
      const prev = {
        passed: 1,
        failed: 0,
        pending: 0
      } as any;

      const current = {
        passed: 1,
        failed: 0,
        pending: 0
      } as any;

      const result = (poller as any).hasStatusChanged(prev, current);

      expect(result).toBe(false);
    });
  });

  describe('getNewFailures', () => {
    it('should return empty array when no previous status', () => {
      const current = {
        failureDetails: [
          { checkName: 'test' }
        ]
      } as any;

      const result = (poller as any).getNewFailures(null, current);

      expect(result).toEqual([]);
    });

    it('should return new failures not in previous status', () => {
      const prev = {
        failureDetails: [
          { checkName: 'test1' }
        ]
      } as any;

      const current = {
        failureDetails: [
          { checkName: 'test1' },
          { checkName: 'test2' }
        ]
      } as any;

      const result = (poller as any).getNewFailures(prev, current);

      expect(result).toEqual(['test2']);
    });
  });

  describe('getNewPasses', () => {
    it('should return empty array when no previous status', () => {
      const current = {
        failureDetails: []
      } as any;

      const result = (poller as any).getNewPasses(null, current);

      expect(result).toEqual([]);
    });

    it('should return checks that passed (no longer in failure list)', () => {
      const prev = {
        failureDetails: [
          { checkName: 'test1' },
          { checkName: 'test2' }
        ]
      } as any;

      const current = {
        failureDetails: [
          { checkName: 'test2' }
        ]
      } as any;

      const result = (poller as any).getNewPasses(prev, current);

      expect(result).toEqual(['test1']);
    });
  });

  describe('calculateDuration', () => {
    it('should return undefined when no completed checks', () => {
      const checks = [
        { status: 'in_progress', started_at: '2025-01-13T10:00:00Z' }
      ];

      const result = (poller as any).calculateDuration(checks);

      expect(result).toBeUndefined();
    });

    it('should return max duration of completed checks', () => {
      const checks = [
        {
          started_at: '2025-01-13T10:00:00Z',
          completed_at: '2025-01-13T10:02:00Z'
        },
        {
          started_at: '2025-01-13T10:00:00Z',
          completed_at: '2025-01-13T10:05:00Z'
        }
      ];

      const result = (poller as any).calculateDuration(checks);

      expect(result).toBe(5 * 60 * 1000); // 5 minutes in milliseconds
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay for specified milliseconds', async () => {
      const sleepPromise = (poller as any).sleep(5000);

      jest.advanceTimersByTime(5000);

      await expect(sleepPromise).resolves.toBeUndefined();
    });
  });
});
