import { VerifyService } from '../../src/services/VerifyService';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs/promises');

const mockedExec = child_process.exec as jest.MockedFunction<typeof child_process.exec>;
const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

describe('VerifyService', () => {
  let verifyService: VerifyService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyService = new VerifyService('/test/dir');
  });

  describe('runChecks', () => {
    it('should return success when no verification script found', async () => {
      mockedFsAccess.mockRejectedValue(new Error('not found'));

      const result = await verifyService.runChecks();

      expect(result.success).toBe(true);
      expect(result.output).toContain('No verification script found');
      expect(result.errors).toEqual([]);
    });

    it('should run verify.sh when found', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined); // verify.sh exists

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(0);
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.success).toBe(true);
      expect(mockedExec).toHaveBeenCalledWith(
        'bash /test/dir/verify.sh',
        expect.any(Object)
      );
    });

    it('should run npm run verify when package.json has verify script', async () => {
      mockedFsAccess.mockRejectedValueOnce(new Error('verify.sh not found'));
      mockedFsReadFile.mockResolvedValueOnce(JSON.stringify({
        scripts: {
          verify: 'npm test && npm run lint'
        }
      }));

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(0);
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.success).toBe(true);
      expect(mockedExec).toHaveBeenCalledWith(
        'npm run verify',
        expect.any(Object)
      );
    });

    it('should run tox when tox.ini found', async () => {
      // verify.sh not found
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      // package.json not found
      mockedFsReadFile.mockRejectedValueOnce(new Error('not found'));
      // tox.ini exists
      mockedFsAccess.mockResolvedValueOnce(undefined);

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(0);
          })
        } as any;
      });

      await verifyService.runChecks();

      expect(mockedExec).toHaveBeenCalledWith(
        'tox',
        expect.any(Object)
      );
    });

    it('should run make verify when Makefile has verify target', async () => {
      // verify.sh not found
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      // package.json not found
      mockedFsReadFile.mockRejectedValueOnce(new Error('not found'));
      // tox.ini not found
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      // Makefile exists with verify target
      mockedFsReadFile.mockResolvedValueOnce('verify:\n\techo "verifying"');

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(0);
          })
        } as any;
      });

      await verifyService.runChecks();

      expect(mockedExec).toHaveBeenCalledWith(
        'make verify',
        expect.any(Object)
      );
    });

    it('should handle verification failure', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined); // verify.sh exists

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(1); // Non-zero exit code
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should call progress callback during execution', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const progressCallback = jest.fn();

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === 'data') stdoutHandlers.push(handler);
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              // Emit some data first
              stdoutHandlers.forEach(h => h('Running tests...'));
              handler(0);
            }
          })
        } as any;
      });

      await verifyService.runChecks({ onProgress: progressCallback });

      expect(progressCallback).toHaveBeenCalledWith('Running verification checks...');
      expect(progressCallback).toHaveBeenCalledWith('Running tests...');
    });

    it('should respect timeout option', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      mockedExec.mockImplementationOnce((_cmd, opts: any, _callback: any) => {
        expect(opts.timeout).toBe(60000); // Custom timeout
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(0);
          })
        } as any;
      });

      await verifyService.runChecks({ timeout: 60000 });
    });

    it('should handle execution errors', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'error') handler(new Error('Command failed'));
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Command failed');
    });
  });

  describe('parseErrors', () => {
    it('should parse test failures', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const failureOutput = 'FAILED tests/test_user.py::test_login\nFAILED tests/test_auth.py::test_register';

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === 'data') stdoutHandlers.push(handler);
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              stdoutHandlers.forEach(h => h(failureOutput));
              handler(1);
            }
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('FAILED'))).toBe(true);
    });

    it('should parse TypeScript errors', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const tsOutput = 'TS2304: Cannot find name "foo"\nTS2345: Argument type mismatch';

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === 'data') stdoutHandlers.push(handler);
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              stdoutHandlers.forEach(h => h(tsOutput));
              handler(1);
            }
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.errors.some(e => e.includes('TS2304'))).toBe(true);
    });

    it('should filter out test console output with "error" in it', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      // Simulate test output with console.log lines containing "error"
      const testOutput = `
  console.log
    [AutoFix 2025-11-14T08:27:34.134Z] Error type test_failure is not auto-fixable

      at AutoFixService.log (src/services/AutoFixService.ts:688:17)

  console.warn
    [AutoFix 2025-11-14T08:27:34.604Z] Auto-fix failed for linting_error {
      reason: 'no_changes',
      duration: '16ms'
    }

      689 |         break;
      690 |       case 'warn':
    > 691 |         console.warn(\`\${prefix} \${message}\`, data || '');
          |                 ^
      692 |         break;

error { prNumber: 1, dryRun: false, attempt: 1, maxAttempts: 2 }
Error: Branch protected
      `;

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === 'data') stdoutHandlers.push(handler);
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              stdoutHandlers.forEach(h => h(testOutput));
              handler(1); // Non-zero exit code
            }
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      // Should not include console.log/warn lines or stack trace lines
      expect(result.errors.every(e => !e.includes('console.log'))).toBe(true);
      expect(result.errors.every(e => !e.includes('console.warn'))).toBe(true);
      expect(result.errors.every(e => !e.includes('AutoFix'))).toBe(true);
      expect(result.errors.every(e => !e.trim().startsWith('at '))).toBe(true);

      // Should still include the generic error message since no actual errors found
      expect(result.errors.some(e => e.includes('exit code'))).toBe(true);
    });

    it('should include real linting errors but filter test console output', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      // Mix of real errors and test console output
      const mixedOutput = `
  console.log
    [AutoFix] Error type test_failure is not auto-fixable

src/utils/helper.ts:15:3 error  'foo' is not defined  no-undef
error { prNumber: 1 }

      at AutoFixService.log (src/services/AutoFixService.ts:688:17)
      `;

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === 'data') stdoutHandlers.push(handler);
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              stdoutHandlers.forEach(h => h(mixedOutput));
              handler(1); // Non-zero exit code
            }
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      // Should include real linting error
      expect(result.errors.some(e => e.includes('src/utils/helper.ts'))).toBe(true);
      expect(result.errors.some(e => e.includes('no-undef'))).toBe(true);

      // Should NOT include test console output
      expect(result.errors.every(e => !e.includes('console.log'))).toBe(true);
      expect(result.errors.every(e => !e.includes('AutoFix'))).toBe(true);
    });
  });

  describe('hasVerifyScript', () => {
    it('should return true when verify.sh exists', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const result = await verifyService.hasVerifyScript();

      expect(result).toBe(true);
    });

    it('should return true when package.json has verify script', async () => {
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      mockedFsReadFile.mockResolvedValueOnce(JSON.stringify({
        scripts: { verify: 'npm test' }
      }));

      const result = await verifyService.hasVerifyScript();

      expect(result).toBe(true);
    });

    it('should return false when no verification script found', async () => {
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedFsReadFile.mockRejectedValue(new Error('not found'));

      const result = await verifyService.hasVerifyScript();

      expect(result).toBe(false);
    });
  });

  describe('getVerifyCommand', () => {
    it('should return verify.sh command', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const command = await verifyService.getVerifyCommand();

      expect(command).toBe('bash /test/dir/verify.sh');
    });

    it('should return npm command for package.json script', async () => {
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      mockedFsReadFile.mockResolvedValueOnce(JSON.stringify({
        scripts: { precommit: 'npm test && npm run lint' }
      }));

      const command = await verifyService.getVerifyCommand();

      expect(command).toBe('npm run precommit');
    });

    it('should fall back to npm test when no specific verify script', async () => {
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      mockedFsReadFile.mockResolvedValueOnce(JSON.stringify({
        scripts: { test: 'jest' }
      }));

      const command = await verifyService.getVerifyCommand();

      expect(command).toBe('npm test');
    });

    it('should return combined test and lint when both available', async () => {
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      mockedFsReadFile.mockResolvedValueOnce(JSON.stringify({
        scripts: {
          test: 'jest',
          lint: 'eslint .'
        }
      }));

      const command = await verifyService.getVerifyCommand();

      expect(command).toBe('npm test && npm run lint');
    });

    it('should return null when no verification script found', async () => {
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedFsReadFile.mockRejectedValue(new Error('not found'));

      const command = await verifyService.getVerifyCommand();

      expect(command).toBeNull();
    });
  });

  describe('duration tracking', () => {
    it('should track execution duration', async () => {
      mockedFsAccess.mockResolvedValueOnce(undefined);

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') {
              // Simulate some delay
              setTimeout(() => handler(0), 100);
            }
          })
        } as any;
      });

      const result = await verifyService.runChecks();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });
  });
});
