// Mock dependencies first
jest.mock('../../src/services/ConfigService');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    blank: jest.fn(),
    section: jest.fn(),
    log: jest.fn(),
    outputJsonResult: jest.fn(),
  }
}));
jest.mock('../../src/utils/spinner', () => ({
  spinner: {
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  }
}));

// Import after mocks are set up
import { initCommand } from '../../src/commands/init';
import { ConfigService } from '../../src/services/ConfigService';
import { logger } from '../../src/utils/logger';

const mockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;

describe('init command', () => {
  let mockConfigInstance: jest.Mocked<ConfigService>;
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.log for JSON output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Mock process.exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`Process.exit called with code ${code}`);
    }) as any);

    // Mock ConfigService instance
    mockConfigInstance = {
      exists: jest.fn(),
      init: jest.fn(),
      getConfig: jest.fn(),
      getTemplateConfig: jest.fn(),
      load: jest.fn(),
      save: jest.fn(),
    } as any;

    // Make ConfigService constructor return our mock
    mockedConfigService.mockImplementation(() => mockConfigInstance);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('successful initialization', () => {
    it('should initialize config with basic template', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      mockConfigInstance.init.mockResolvedValue(undefined);
      mockConfigInstance.getConfig.mockResolvedValue({
        branchProtection: {
          enabled: false,
          requireReviews: 0,
          requireStatusChecks: [],
          enforceAdmins: false,
        },
        ci: {
          waitForChecks: true,
          failFast: true,
          retryFlaky: false,
          timeout: 30,
        },
        security: {
          scanSecrets: true,
          scanDependencies: true,
          allowedVulnerabilities: [],
        },
        pr: {
          templatePath: undefined,
          autoAssign: [],
          autoLabel: [],
        },
        autoFix: {
          enabled: true,
          maxAttempts: 2,
          maxChangedLines: 1000,
          requireTests: true,
          enableDryRun: false,
          autoMerge: false,
          createPR: true,
        },
        hooks: {
          prePush: {
            enabled: false,
            reminder: true,
          },
          postCommit: {
            enabled: false,
            reminder: true,
          },
        },
      });

      await initCommand({ template: 'basic' });

      expect(mockConfigInstance.exists).toHaveBeenCalled();
      expect(mockConfigInstance.init).toHaveBeenCalledWith('basic');
      expect(mockConfigInstance.getConfig).toHaveBeenCalled();
    });

    it('should output JSON when --json flag is set', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      mockConfigInstance.init.mockResolvedValue(undefined);
      const mockConfig = {
        branchProtection: {
          enabled: false,
          requireReviews: 0,
          requireStatusChecks: [],
          enforceAdmins: false,
        },
        ci: {
          waitForChecks: true,
          failFast: true,
          retryFlaky: false,
          timeout: 30,
        },
      };
      mockConfigInstance.getConfig.mockResolvedValue(mockConfig);

      // Enable JSON mode
      (logger as any).setJsonMode = jest.fn();
      (logger as any).outputJsonResult = jest.fn();

      await initCommand({ template: 'basic' });

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          created: true,
          template: 'basic',
          filePath: '.gwm.yml',
          config: mockConfig,
        })
      );
    });
  });

  describe('error cases', () => {
    it('should error when config already exists', async () => {
      mockConfigInstance.exists.mockResolvedValue(true);
      (logger as any).outputJsonResult = jest.fn();

      await expect(initCommand({ template: 'basic' })).rejects.toThrow('Process.exit called with code');

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        false,
        null,
        expect.objectContaining({
          code: 'ERROR',
          message: '.gwm.yml already exists',
          suggestions: expect.arrayContaining([
            expect.stringContaining('Delete the existing file'),
          ]),
        })
      );
    });

    it('should error with invalid template', async () => {
      await expect(initCommand({ template: 'invalid' as any })).rejects.toThrow('Process.exit called with code');
    });

    it('should output JSON error when config exists and --json is set', async () => {
      mockConfigInstance.exists.mockResolvedValue(true);
      (logger as any).outputJsonResult = jest.fn();

      await expect(initCommand({ template: 'basic' })).rejects.toThrow('Process.exit called with code');

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        false,
        null,
        expect.objectContaining({
          code: 'ERROR',
          message: '.gwm.yml already exists',
          suggestions: expect.any(Array),
        })
      );
    });
  });

  describe('template validation', () => {
    it('should accept basic template', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      mockConfigInstance.init.mockResolvedValue(undefined);
      mockConfigInstance.getConfig.mockResolvedValue({} as any);

      await initCommand({ template: 'basic' });

      expect(mockConfigInstance.init).toHaveBeenCalledWith('basic');
    });

    it('should accept standard template', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      mockConfigInstance.init.mockResolvedValue(undefined);
      mockConfigInstance.getConfig.mockResolvedValue({} as any);

      await initCommand({ template: 'standard' });

      expect(mockConfigInstance.init).toHaveBeenCalledWith('standard');
    });

    it('should accept strict template', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      mockConfigInstance.init.mockResolvedValue(undefined);
      mockConfigInstance.getConfig.mockResolvedValue({} as any);

      await initCommand({ template: 'strict' });

      expect(mockConfigInstance.init).toHaveBeenCalledWith('strict');
    });

    it('should default to basic template when not specified', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      mockConfigInstance.init.mockResolvedValue(undefined);
      mockConfigInstance.getConfig.mockResolvedValue({} as any);

      await initCommand({});

      expect(mockConfigInstance.init).toHaveBeenCalledWith('basic');
    });
  });
});
