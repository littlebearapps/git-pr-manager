import { Logger, VerbosityLevel, createLogger } from '../../src/utils/logger';

// Mock simple-git for errorWithContext tests
jest.mock('simple-git');

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let stdoutWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
    // Clean up environment variables BEFORE each test (for CI compatibility)
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    // Clean up environment variables
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  describe('Constructor & Initialization', () => {
    it('should initialize with default NORMAL level', () => {
      const logger = new Logger();

      expect(logger.getLevel()).toBe(VerbosityLevel.NORMAL);
    });

    it('should initialize with verbose flag', () => {
      const logger = new Logger({ verbose: true });

      expect(logger.getLevel()).toBe(VerbosityLevel.VERBOSE);
    });

    it('should initialize with explicit level', () => {
      const logger = new Logger({ level: VerbosityLevel.DEBUG });

      expect(logger.getLevel()).toBe(VerbosityLevel.DEBUG);
    });

    it('should initialize with JSON mode', () => {
      const logger = new Logger({ jsonMode: true });

      logger.success('test', { foo: 'bar' });

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = stdoutWriteSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should prefer explicit level over verbose flag', () => {
      const logger = new Logger({ verbose: true, level: VerbosityLevel.QUIET });

      expect(logger.getLevel()).toBe(VerbosityLevel.QUIET);
    });
  });

  describe('Environment Detection', () => {
    it('should detect CI environment and use QUIET level', () => {
      process.env.CI = 'true';

      const logger = new Logger();

      expect(logger.getLevel()).toBe(VerbosityLevel.QUIET);
    });

    it('should detect GitHub Actions and use QUIET level', () => {
      process.env.GITHUB_ACTIONS = 'true';

      const logger = new Logger();

      expect(logger.getLevel()).toBe(VerbosityLevel.QUIET);
    });

    it('should use NORMAL level in non-CI environment', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;

      const logger = new Logger();

      expect(logger.getLevel()).toBe(VerbosityLevel.NORMAL);
    });

    it('should allow overriding CI detection with explicit level', () => {
      process.env.CI = 'true';

      const logger = new Logger({ level: VerbosityLevel.VERBOSE });

      expect(logger.getLevel()).toBe(VerbosityLevel.VERBOSE);
    });
  });

  describe('Verbosity Levels - SILENT', () => {
    it('should output nothing in SILENT mode', () => {
      const logger = new Logger({ level: VerbosityLevel.SILENT });

      logger.debug('debug');
      logger.info('info');
      logger.log('log');
      logger.warn('warn');
      logger.success('success');
      logger.error('error');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Verbosity Levels - QUIET', () => {
    it('should only output errors in QUIET mode', () => {
      const logger = new Logger({ level: VerbosityLevel.QUIET });

      logger.debug('debug');
      logger.info('info');
      logger.log('log');
      logger.warn('warn');
      logger.success('success');
      logger.error('error');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), 'error');
    });
  });

  describe('Verbosity Levels - NORMAL', () => {
    it('should output errors, warnings, and success in NORMAL mode', () => {
      const logger = new Logger({ level: VerbosityLevel.NORMAL });

      logger.debug('debug');
      logger.info('info');
      logger.log('log');
      logger.warn('warn');
      logger.success('success');
      logger.error('error');

      // Should output: log, warn, success (console.log)
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      // Should output: error (console.error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Verbosity Levels - VERBOSE', () => {
    it('should output info messages in VERBOSE mode', () => {
      const logger = new Logger({ level: VerbosityLevel.VERBOSE });

      logger.debug('debug');
      logger.info('info');
      logger.log('log');
      logger.warn('warn');
      logger.success('success');
      logger.error('error');

      // Should output: info, log, warn, success (console.log)
      expect(consoleLogSpy).toHaveBeenCalledTimes(4);
      // Should output: error (console.error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Verbosity Levels - DEBUG', () => {
    it('should output debug messages in DEBUG mode', () => {
      const logger = new Logger({ level: VerbosityLevel.DEBUG });

      logger.debug('debug');
      logger.info('info');
      logger.log('log');
      logger.warn('warn');
      logger.success('success');
      logger.error('error');

      // Should output: debug, info, log, warn, success (console.log)
      expect(consoleLogSpy).toHaveBeenCalledTimes(5);
      // Should output: error (console.error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Output Methods', () => {
    describe('info', () => {
      it('should output info message in VERBOSE mode', () => {
        const logger = new Logger({ level: VerbosityLevel.VERBOSE });

        logger.info('Test info message');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), 'Test info message');
      });

      it('should not output info in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.info('Test info message');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('success', () => {
      it('should output success message in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.success('Test success');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), 'Test success');
      });

      it('should not output success in QUIET mode', () => {
        const logger = new Logger({ level: VerbosityLevel.QUIET });

        logger.success('Test success');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('warn', () => {
      it('should output warning message in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.warn('Test warning');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), 'Test warning');
      });

      it('should not output warning in QUIET mode', () => {
        const logger = new Logger({ level: VerbosityLevel.QUIET });

        logger.warn('Test warning');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('error', () => {
      it('should output error message in QUIET mode', () => {
        const logger = new Logger({ level: VerbosityLevel.QUIET });

        logger.error('Test error');

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), 'Test error');
      });

      it('should output error with suggestions', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.error('Test error', 'ERR_CODE', {}, ['Suggestion 1', 'Suggestion 2']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), 'Test error');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestions'));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestion 1'));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestion 2'));
      });

      it('should not output error in SILENT mode', () => {
        const logger = new Logger({ level: VerbosityLevel.SILENT });

        logger.error('Test error');

        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    describe('errorWithContext', () => {
      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should include worktree branch context when available', async () => {
        // Mock simple-git to return worktree info
        const mockGit = {
          raw: jest.fn().mockResolvedValue(
            `${process.cwd()} abc123 [feature/test-branch]\n` +
            '/Users/test/project/main def456 [main]'
          )
        };
        const simpleGit = require('simple-git');
        simpleGit.mockReturnValue(mockGit);

        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        await logger.errorWithContext('Test error', 'ERR_CODE', { file: 'test.ts' });

        // Should display worktree context
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Worktree:'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('feature/test-branch'));
        // Should call error with enhanced details
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), 'Test error');
      });

      it('should not display worktree context in JSON mode', async () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL, jsonMode: true });

        await logger.errorWithContext('Test error', 'ERR_CODE');

        // Should not display worktree in JSON mode
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Worktree:'));
      });

      it('should handle when worktree context is not available', async () => {
        // Mock simple-git to simulate no worktree (standard repo or error)
        const mockGit = {
          raw: jest.fn().mockRejectedValue(new Error('fatal: not a git repository'))
        };
        const simpleGit = require('simple-git');
        simpleGit.mockReturnValue(mockGit);

        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        await logger.errorWithContext('Test error', 'ERR_CODE', { file: 'test.ts' });

        // Should still call error method
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), 'Test error');
        // Should not crash or display worktree
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Worktree:'));
      });

      it('should pass through suggestions to error method', async () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        await logger.errorWithContext(
          'Test error',
          'ERR_CODE',
          {},
          ['Suggestion 1', 'Suggestion 2']
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestions'));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestion 1'));
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestion 2'));
      });
    });

    describe('debug', () => {
      it('should output debug message in DEBUG mode', () => {
        const logger = new Logger({ level: VerbosityLevel.DEBUG });

        logger.debug('Test debug');

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), 'Test debug');
      });

      it('should not output debug in VERBOSE mode', () => {
        const logger = new Logger({ level: VerbosityLevel.VERBOSE });

        logger.debug('Test debug');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('log', () => {
      it('should output plain message in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.log('Plain message');

        expect(consoleLogSpy).toHaveBeenCalledWith('Plain message');
      });

      it('should not output in JSON mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL, jsonMode: true });

        logger.log('Plain message');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('divider', () => {
      it('should output divider in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.divider();

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('─'));
      });

      it('should not output divider in QUIET mode', () => {
        const logger = new Logger({ level: VerbosityLevel.QUIET });

        logger.divider();

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('blank', () => {
      it('should output blank line in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.blank();

        expect(consoleLogSpy).toHaveBeenCalledWith('');
      });

      it('should not output blank in JSON mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL, jsonMode: true });

        logger.blank();

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('section', () => {
      it('should output section header in NORMAL mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL });

        logger.section('Test Section');

        expect(consoleLogSpy).toHaveBeenCalledWith('');  // blank line
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test Section'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('─'));  // divider
      });

      it('should not output section in JSON mode', () => {
        const logger = new Logger({ level: VerbosityLevel.NORMAL, jsonMode: true });

        logger.section('Test Section');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('JSON Mode', () => {
    it('should output JSON for success with data', () => {
      const logger = new Logger({ jsonMode: true });

      logger.success('Success message', { result: 'test' });

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(output.success).toBe(true);
      expect(output.data).toEqual({ result: 'test' });
      expect(output.metadata).toBeDefined();
    });

    it('should output JSON for error with code and details', () => {
      const logger = new Logger({ jsonMode: true });

      logger.error('Error message', 'ERR_TEST', { detail: 'info' }, ['Fix 1', 'Fix 2']);

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(output.success).toBe(false);
      expect(output.error).toEqual({
        code: 'ERR_TEST',
        message: 'Error message',
        details: { detail: 'info' },
        suggestions: ['Fix 1', 'Fix 2']
      });
    });

    it('should include metadata in JSON output', () => {
      const logger = new Logger({ jsonMode: true });

      logger.success('Success', { data: 'test' });

      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(output.metadata).toHaveProperty('timestamp');
      expect(output.metadata).toHaveProperty('duration');
      expect(output.metadata).toHaveProperty('version');
      expect(typeof output.metadata.timestamp).toBe('string');
      expect(typeof output.metadata.duration).toBe('number');
    });

    it('should not output plain text in JSON mode', () => {
      const logger = new Logger({ jsonMode: true, level: VerbosityLevel.VERBOSE });

      logger.info('Info message');
      logger.warn('Warning message');
      logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should output JSON result with outputJsonResult', () => {
      const logger = new Logger({ jsonMode: true });

      logger.outputJsonResult(true, { result: 'data' });

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(output.success).toBe(true);
      expect(output.data).toEqual({ result: 'data' });
    });

    it('should output JSON result with error', () => {
      const logger = new Logger({ jsonMode: true });

      logger.outputJsonResult(false, undefined, {
        code: 'ERR_FAIL',
        message: 'Failed',
        suggestions: ['Try again']
      });

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(output.success).toBe(false);
      expect(output.error).toEqual({
        code: 'ERR_FAIL',
        message: 'Failed',
        suggestions: ['Try again']
      });
    });

    it('should not output JSON result when not in JSON mode', () => {
      const logger = new Logger({ jsonMode: false });

      logger.outputJsonResult(true, { result: 'data' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Setters and Getters', () => {
    it('should set and get verbosity level', () => {
      const logger = new Logger();

      logger.setLevel(VerbosityLevel.DEBUG);

      expect(logger.getLevel()).toBe(VerbosityLevel.DEBUG);
    });

    it('should enable JSON mode dynamically', () => {
      const logger = new Logger();

      logger.setJsonMode(true);
      logger.success('Test', { data: 'value' });

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = stdoutWriteSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should disable JSON mode dynamically', () => {
      const logger = new Logger({ jsonMode: true });

      logger.setJsonMode(false);
      logger.success('Test');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), 'Test');
    });
  });

  describe('createLogger factory', () => {
    it('should create logger with default options', () => {
      const logger = createLogger();

      expect(logger.getLevel()).toBe(VerbosityLevel.NORMAL);
    });

    it('should create logger with custom options', () => {
      const logger = createLogger({ verbose: true, jsonMode: true });

      expect(logger.getLevel()).toBe(VerbosityLevel.VERBOSE);
    });

    it('should create independent logger instances', () => {
      const logger1 = createLogger({ level: VerbosityLevel.QUIET });
      const logger2 = createLogger({ level: VerbosityLevel.DEBUG });

      expect(logger1.getLevel()).toBe(VerbosityLevel.QUIET);
      expect(logger2.getLevel()).toBe(VerbosityLevel.DEBUG);
    });
  });
});
