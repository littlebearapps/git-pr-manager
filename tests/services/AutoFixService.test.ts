import { AutoFixService } from '../../src/services/AutoFixService';
import { GitService } from '../../src/services/GitService';
import { GitHubService } from '../../src/services/GitHubService';
import { ErrorType, FailureDetail } from '../../src/types';
import { exec } from 'child_process';

// Mock dependencies
jest.mock('child_process');
jest.mock('../../src/services/GitService');
jest.mock('../../src/services/GitHubService');

const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('AutoFixService', () => {
  let autoFixService: AutoFixService;
  let mockGitService: jest.Mocked<GitService>;
  let mockGitHubService: jest.Mocked<GitHubService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockGitService = new GitService({ workingDir: '.' }) as jest.Mocked<GitService>;
    mockGitHubService = new GitHubService({ token: 'test-token' }) as jest.Mocked<GitHubService>;

    // Setup default mock implementations
    mockGitService.getCurrentBranch = jest.fn().mockResolvedValue('feature/test-branch');
    mockGitService.createBranch = jest.fn().mockResolvedValue(undefined);
    mockGitService.add = jest.fn().mockResolvedValue(undefined);
    mockGitService.commit = jest.fn().mockResolvedValue(undefined);
    mockGitService.push = jest.fn().mockResolvedValue(undefined);
    mockGitService.getDiff = jest.fn().mockResolvedValue('+ changed line\n- deleted line');

    mockGitHubService.createPR = jest.fn().mockResolvedValue({
      number: 42,
      html_url: 'https://github.com/owner/repo/pull/42'
    });

    // Setup default exec mock (prevents timeouts)
    (mockExec as any).mockImplementation((_cmd: string, callback: any) => {
      // Default: command succeeds
      callback(null, { stdout: '', stderr: '' });
    });

    // Create service instance
    autoFixService = new AutoFixService(mockGitService, mockGitHubService);
  });

  describe('attemptFix', () => {
    it('should return not_auto_fixable for test failures', async () => {
      const failure = {
        checkName: 'test',
        errorType: ErrorType.TEST_FAILURE,
        summary: 'Tests failed',
        affectedFiles: ['test.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_auto_fixable');
    });

    it('should return not_auto_fixable for build errors', async () => {
      const failure = {
        checkName: 'build',
        errorType: ErrorType.BUILD_ERROR,
        summary: 'Build failed',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_auto_fixable');
    });

    it('should return not_auto_fixable for type errors', async () => {
      const failure = {
        checkName: 'typecheck',
        errorType: ErrorType.TYPE_ERROR,
        summary: 'Type errors found',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_auto_fixable');
      expect(result.errorType).toBe(ErrorType.TYPE_ERROR);
    });

    it('should enforce max attempts limit', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // First attempt - fail (no changes)
      mockGitService.getDiff = jest.fn().mockResolvedValue('');
      const result1 = await autoFixService.attemptFix(failure, 1);
      expect(result1.reason).toBe('no_changes');

      // Second attempt - fail (no changes)
      const result2 = await autoFixService.attemptFix(failure, 1);
      expect(result2.reason).toBe('no_changes');

      // Third attempt - should be blocked by max attempts
      const result3 = await autoFixService.attemptFix(failure, 1);

      expect(result3.success).toBe(false);
      expect(result3.reason).toBe('max_attempts_reached');
      expect(result3.attempts).toBe(2);
    });
  });

  describe('Language Detection', () => {
    it('should detect JavaScript files', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.js', 'src/utils.js'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock command check to return true for eslint
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which eslint')) {
          callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed line');

      await autoFixService.attemptFix(failure, 1);

      // Verify eslint was used (command would be called)
      expect(mockGitService.getDiff).toHaveBeenCalled();
    });

    it('should detect TypeScript files', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.ts', 'src/types.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock no changes to avoid PR creation
      mockGitService.getDiff = jest.fn().mockResolvedValue('');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.reason).toBe('no_changes');
    });

    it('should detect Python files', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/main.py', 'src/utils.py'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      mockGitService.getDiff = jest.fn().mockResolvedValue('');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.reason).toBe('no_changes');
    });

    it('should return unsupported_language for unknown file types', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/main.rb'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('unsupported_language');
      expect(result.language).toBe('unknown');
    });
  });

  describe('Linting Fixes', () => {
    it('should fix JavaScript linting errors with eslint', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'ESLint errors',
        affectedFiles: ['src/index.js'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock eslint available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which eslint')) {
          callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
        } else if (cmd.includes('eslint --fix')) {
          callback(null, { stdout: 'Fixed 2 errors', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed line\n- old line');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(42);
      expect(result.changedLines).toBe(2);
    });

    it('should fallback to npm run lint:fix if eslint not found', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock eslint not available, but npm script available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which eslint')) {
          callback(new Error('not found'), { stdout: '', stderr: 'not found' });
        } else if (cmd.includes('npm run')) {
          if (cmd.includes('npm run lint:fix')) {
            callback(null, { stdout: 'lint:fix\n', stderr: '' });
          } else {
            callback(null, { stdout: 'Available scripts:\nlint:fix\n', stderr: '' });
          }
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(42);
    });

    it('should return no_lint_tool if neither eslint nor npm script available', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock no tools available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which')) {
          callback(new Error('not found'), { stdout: '', stderr: 'not found' });
        } else {
          callback(null, { stdout: 'Available scripts:\ntest\n', stderr: '' });
        }
      });

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_lint_tool');
    });

    it('should enforce max changed lines limit', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/large-file.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock eslint available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which eslint')) {
          callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Create a diff with > 1000 changed lines
      const largeDiff = Array(1001).fill('+ new line').join('\n');
      mockGitService.getDiff = jest.fn().mockResolvedValue(largeDiff);

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('too_many_changes');
      expect(result.changedLines).toBeGreaterThan(1000);
    });
  });

  describe('Format Fixes', () => {
    it('should fix JavaScript format errors with prettier', async () => {
      const failure = {
        checkName: 'format',
        errorType: ErrorType.FORMAT_ERROR,
        summary: 'Format errors',
        affectedFiles: ['src/index.js'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock prettier available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which prettier')) {
          callback(null, { stdout: '/usr/bin/prettier', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ formatted line');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(42);
    });

    it('should fix Python format errors with black', async () => {
      const failure = {
        checkName: 'format',
        errorType: ErrorType.FORMAT_ERROR,
        summary: 'Format errors',
        affectedFiles: ['src/main.py'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock black available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which black')) {
          callback(null, { stdout: '/usr/bin/black', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ formatted');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(42);
    });

    it('should return no_changes if formatter made no changes', async () => {
      const failure = {
        checkName: 'format',
        errorType: ErrorType.FORMAT_ERROR,
        summary: 'Format errors',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock prettier available
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which prettier')) {
          callback(null, { stdout: '/usr/bin/prettier', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // No diff - no changes made
      mockGitService.getDiff = jest.fn().mockResolvedValue('');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_changes');
    });
  });

  describe('Security Fixes', () => {
    it('should fix dependency vulnerabilities with npm audit', async () => {
      const failure = {
        checkName: 'security',
        errorType: ErrorType.SECURITY_ISSUE,
        summary: 'Dependency vulnerability found',
        affectedFiles: ['package-lock.json'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      // Mock npm audit fix
      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('npm audit fix')) {
          callback(null, { stdout: 'fixed 3 vulnerabilities', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('- "lodash": "4.17.15"\n+ "lodash": "4.17.21"');

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(42);
    });

    it('should return limited_auto_fix_capability for secret detection', async () => {
      const failure = {
        checkName: 'security',
        errorType: ErrorType.SECURITY_ISSUE,
        summary: 'Secret detected in code',
        affectedFiles: ['src/config.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      const result = await autoFixService.attemptFix(failure, 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('limited_auto_fix_capability');
    });
  });

  describe('PR Creation', () => {
    it('should create PR with correct title and body for lint fixes', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.ts', 'src/utils.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which eslint')) {
          callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

      await autoFixService.attemptFix(failure, 1);

      expect(mockGitHubService.createPR).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'fix: auto-fix linting errors',
          head: expect.stringContaining('-autofix-'),
          base: 'feature/test-branch',
          draft: false
        })
      );
    });

    it('should create fix branch with timestamp', async () => {
      const failure = {
        checkName: 'format',
        errorType: ErrorType.FORMAT_ERROR,
        summary: 'Format errors',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which prettier')) {
          callback(null, { stdout: '/usr/bin/prettier', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ formatted');

      await autoFixService.attemptFix(failure, 1);

      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        expect.stringMatching(/^feature\/test-branch-autofix-\d+$/)
      );
    });

    it('should push fix branch with upstream tracking', async () => {
      const failure = {
        checkName: 'lint',
        errorType: ErrorType.LINTING_ERROR,
        summary: 'Lint errors',
        affectedFiles: ['src/index.ts'],
        annotations: [],
        suggestedFix: null,
        url: 'https://example.com'
      };

      (mockExec as any).mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('which eslint')) {
          callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

      await autoFixService.attemptFix(failure, 1);

      expect(mockGitService.push).toHaveBeenCalledWith(
        'origin',
        expect.stringMatching(/^feature\/test-branch-autofix-\d+$/),
        true
      );
    });
  });

  describe('Session 2: Verification and Rollback', () => {
    describe('Post-Fix Verification', () => {
      it('should run verification after successful fix', async () => {
        const { VerifyService } = require('../../src/services/VerifyService');
        const mockVerifyService = new VerifyService('.') as jest.Mocked<any>;

        mockVerifyService.runChecks = jest.fn().mockResolvedValue({
          success: true,
          output: '',
          errors: [],
          duration: 1000
        });

        const serviceWithVerify = new AutoFixService(
          mockGitService,
          mockGitHubService,
          { requireTests: true },
          mockVerifyService
        );

        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

        const result = await serviceWithVerify.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(mockVerifyService.runChecks).toHaveBeenCalledWith({ timeout: 120000 });
      });

      it('should skip verification when VerifyService not provided', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(true);
      });

      it('should skip verification when requireTests is false', async () => {
        const { VerifyService } = require('../../src/services/VerifyService');
        const mockVerifyService = new VerifyService('.') as jest.Mocked<any>;

        mockVerifyService.runChecks = jest.fn();

        const serviceWithoutTests = new AutoFixService(
          mockGitService,
          mockGitHubService,
          { requireTests: false },
          mockVerifyService
        );

        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

        const result = await serviceWithoutTests.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(mockVerifyService.runChecks).not.toHaveBeenCalled();
      });
    });

    describe('Rollback Capability', () => {
      it('should rollback when verification fails', async () => {
        const { VerifyService } = require('../../src/services/VerifyService');
        const mockVerifyService = new VerifyService('.') as jest.Mocked<any>;

        mockVerifyService.runChecks = jest.fn().mockResolvedValue({
          success: false,
          output: 'Tests failed',
          errors: ['test_user.py::test_login FAILED'],
          duration: 1000
        });

        const serviceWithVerify = new AutoFixService(
          mockGitService,
          mockGitHubService,
          { requireTests: true },
          mockVerifyService
        );

        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        let gitStashPopCalled = false;
        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'M src/test.ts', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: 'Saved working directory', stderr: '' });
          } else if (cmd.includes('git stash pop')) {
            gitStashPopCalled = true;
            callback(null, { stdout: 'Restored', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

        const result = await serviceWithVerify.attemptFix(failure, 1);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('verification_failed');
        expect(result.verificationFailed).toBe(true);
        expect(result.verificationErrors).toEqual(['test_user.py::test_login FAILED']);
        expect(result.rolledBack).toBe(true);
        expect(gitStashPopCalled).toBe(true);
      });

      it('should rollback when too many lines changed', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        let gitStashPopCalled = false;
        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'M src/test.ts', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: 'Saved working directory', stderr: '' });
          } else if (cmd.includes('git stash pop')) {
            gitStashPopCalled = true;
            callback(null, { stdout: 'Restored', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        // Mock a huge diff (>1000 lines)
        const hugeDiff = Array(2000).fill('+ changed line').join('\n');
        mockGitService.getDiff = jest.fn().mockResolvedValue(hugeDiff);

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('too_many_changes');
        expect(result.changedLines).toBeGreaterThan(1000);
        expect(result.rolledBack).toBe(true);
        expect(gitStashPopCalled).toBe(true);
      });

      it('should rollback on execution error', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        let gitStashPopCalled = false;
        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'M src/test.ts', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: 'Saved working directory', stderr: '' });
          } else if (cmd.includes('git stash pop')) {
            gitStashPopCalled = true;
            callback(null, { stdout: 'Restored', stderr: '' });
          } else if (cmd.includes('eslint --fix')) {
            // Simulate eslint failure
            callback(new Error('ESLint crashed'), { stdout: '', stderr: 'Fatal error' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('execution_failed');
        expect(result.error).toContain('ESLint crashed');
        expect(result.rolledBack).toBe(true);
        expect(gitStashPopCalled).toBe(true);
      });
    });

    describe('Dry-Run Mode', () => {
      it('should simulate linting fix without executing', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        const result = await autoFixService.attemptFix(failure, 1, true);

        expect(result.success).toBe(true);
        expect(result.reason).toBe('dry_run');
        expect(result.error).toContain('Would run: npx eslint --fix');
        expect(mockGitService.createBranch).not.toHaveBeenCalled();
        expect(mockGitService.commit).not.toHaveBeenCalled();
      });

      it('should simulate formatting fix without executing', async () => {
        const failure = {
          checkName: 'format',
          errorType: ErrorType.FORMAT_ERROR,
          summary: 'Formatting errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which prettier')) {
            callback(null, { stdout: '/usr/bin/prettier', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        const result = await autoFixService.attemptFix(failure, 1, true);

        expect(result.success).toBe(true);
        expect(result.reason).toBe('dry_run');
        expect(result.error).toContain('Would run: npx prettier --write');
      });

      it('should not track attempts in dry-run mode', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        // First dry-run
        await autoFixService.attemptFix(failure, 1, true);

        // Second dry-run
        await autoFixService.attemptFix(failure, 1, true);

        // Third dry-run (should not hit max attempts)
        const result = await autoFixService.attemptFix(failure, 1, true);

        expect(result.success).toBe(true);
        expect(result.reason).toBe('dry_run');
      });

      it('should use config default when dryRun not specified', async () => {
        const serviceWithDryRun = new AutoFixService(
          mockGitService,
          mockGitHubService,
          { enableDryRun: true }
        );

        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        const result = await serviceWithDryRun.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(result.reason).toBe('dry_run');
      });
    });

    describe('State Management', () => {
      it('should save state before making changes', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        let gitStashPushCalled = false;
        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: 'M src/test.ts', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            gitStashPushCalled = true;
            callback(null, { stdout: 'Saved working directory', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

        await autoFixService.attemptFix(failure, 1);

        expect(gitStashPushCalled).toBe(true);
      });

      it('should skip stash when no changes to save', async () => {
        const failure = {
          checkName: 'lint',
          errorType: ErrorType.LINTING_ERROR,
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        let gitStashPushCalled = false;
        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '/usr/bin/eslint', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: '', stderr: '' }); // No changes
          } else if (cmd.includes('git stash push')) {
            gitStashPushCalled = true;
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed');

        await autoFixService.attemptFix(failure, 1);

        expect(gitStashPushCalled).toBe(false);
      });
    });
  });

  describe('Priority 3: Edge Cases & Polish', () => {
    describe('Metrics Edge Cases', () => {
      it('should export metrics with zero attempts', () => {
        const metrics = autoFixService.getMetrics();

        expect(metrics.totalAttempts).toBe(0);
        expect(metrics.successfulFixes).toBe(0);
        expect(metrics.failedFixes).toBe(0);
        expect(metrics.rollbackCount).toBe(0);
        expect(metrics.verificationFailures).toBe(0);
        expect(metrics.dryRunAttempts).toBe(0);
        expect(metrics.byErrorType).toEqual({});
        expect(metrics.byReason).toEqual({});
        expect(metrics.totalFixDuration).toBe(0);
      });

      it('should export metrics as valid JSON', () => {
        const json = autoFixService.exportMetrics();

        expect(() => JSON.parse(json)).not.toThrow();

        const parsed = JSON.parse(json);
        expect(parsed).toHaveProperty('totalAttempts');
        expect(parsed).toHaveProperty('successfulFixes');
        expect(parsed).toHaveProperty('failedFixes');
        expect(parsed).toHaveProperty('rollbackCount');
        expect(parsed).toHaveProperty('verificationFailures');
        expect(parsed).toHaveProperty('dryRunAttempts');
        expect(parsed).toHaveProperty('byErrorType');
        expect(parsed).toHaveProperty('byReason');
        expect(parsed).toHaveProperty('totalFixDuration');
        expect(parsed).toHaveProperty('startTime');
        expect(parsed).toHaveProperty('lastUpdated');
      });

      it('should reset metrics to initial state', () => {
        // First, make some changes to metrics by attempting a fix
        const failure: FailureDetail = {
          errorType: ErrorType.LINTING_ERROR,
          checkName: 'Linting error',
          summary: 'ESLint errors',
          affectedFiles: ['src/test.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '', stderr: '' }); // eslint not found
          } else if (cmd.includes('npm run')) {
            callback(null, { stdout: '', stderr: '' }); // npm script not found
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        autoFixService.attemptFix(failure, 1);

        // Reset metrics
        autoFixService.resetMetrics();

        const metrics = autoFixService.getMetrics();
        expect(metrics.totalAttempts).toBe(0);
        expect(metrics.successfulFixes).toBe(0);
        expect(metrics.failedFixes).toBe(0);
        expect(metrics.rollbackCount).toBe(0);
        expect(metrics.verificationFailures).toBe(0);
      });
    });

    describe('Language Detection Edge Cases', () => {
      it('should handle Python files with pip requirements', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.LINTING_ERROR,
          checkName: 'Python lint error',
          summary: 'Ruff errors',
          affectedFiles: ['src/main.py', 'requirements.txt'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which ruff')) {
            callback(null, { stdout: '/usr/bin/ruff', stderr: '' });
          } else if (cmd.includes('ruff check --fix')) {
            callback(null, { stdout: 'Fixed 2 errors', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: '', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed python code');

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(result.changedLines).toBeDefined();
      });

      it('should handle Go format files', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.FORMAT_ERROR,
          checkName: 'Go format error',
          summary: 'Go fmt issues',
          affectedFiles: ['main.go', 'server.go'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('go fmt')) {
            callback(null, { stdout: '', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: '', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ formatted go code');

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(result.changedLines).toBeDefined();
      });

      it('should return unsupported_language for Rust files', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.LINTING_ERROR,
          checkName: 'Rust lint error',
          summary: 'Clippy errors',
          affectedFiles: ['src/main.rs', 'lib.rs'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((_cmd: string, callback: any) => {
          callback(null, { stdout: '', stderr: '' });
        });

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('unsupported_language');
      });
    });

    describe('Tool Availability Edge Cases', () => {
      it('should handle missing formatter for Python gracefully', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.FORMAT_ERROR,
          checkName: 'Python format error',
          summary: 'Black formatting issues',
          affectedFiles: ['src/main.py'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which black')) {
            // Simulate command not found by throwing an error
            callback(new Error('Command not found: black'), { stdout: '', stderr: 'black: command not found' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('no_format_tool');
      });

      it('should handle biome fallback for TypeScript files', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.LINTING_ERROR,
          checkName: 'TypeScript lint error',
          summary: 'Linting errors',
          affectedFiles: ['src/index.ts'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which eslint')) {
            callback(null, { stdout: '', stderr: '' }); // eslint not found
          } else if (cmd.includes('which biome')) {
            callback(null, { stdout: '/usr/bin/biome', stderr: '' });
          } else if (cmd.includes('biome check --apply')) {
            callback(null, { stdout: 'Fixed 1 error', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: '', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ fixed ts code');

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(result.changedLines).toBeDefined();
      });
    });

    describe('Complex Scenarios', () => {
      it('should handle npm audit fix for JavaScript dependencies', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.SECURITY_ISSUE,
          checkName: 'security',
          summary: 'Dependency vulnerability found',
          affectedFiles: ['package-lock.json'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('npm audit fix')) {
            callback(null, { stdout: 'fixed 2 vulnerabilities', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('- "axios": "0.21.0"\n+ "axios": "0.21.4"');

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(result.prNumber).toBe(42);
        expect(result.changedLines).toBeDefined();
      });

      it('should handle mixed file types gracefully', async () => {
        const failure: FailureDetail = {
          errorType: ErrorType.FORMAT_ERROR,
          checkName: 'Format error',
          summary: 'Mixed format issues',
          affectedFiles: ['src/app.js', 'README.md', 'package.json'],
          annotations: [],
          suggestedFix: null,
          url: ''
        };

        (mockExec as any).mockImplementation((cmd: string, callback: any) => {
          if (cmd.includes('which prettier')) {
            callback(null, { stdout: '/usr/bin/prettier', stderr: '' });
          } else if (cmd.includes('npx prettier --write')) {
            callback(null, { stdout: '', stderr: '' });
          } else if (cmd.includes('git status --porcelain')) {
            callback(null, { stdout: '', stderr: '' });
          } else if (cmd.includes('git stash push')) {
            callback(null, { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: '', stderr: '' });
          }
        });

        mockGitService.getDiff = jest.fn().mockResolvedValue('+ formatted multiple files');

        const result = await autoFixService.attemptFix(failure, 1);

        expect(result.success).toBe(true);
        expect(result.changedLines).toBeDefined();
      });
    });
  });
});
