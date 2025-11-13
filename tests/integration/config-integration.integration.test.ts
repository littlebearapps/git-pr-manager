import { ConfigService } from '../../src/services/ConfigService';
import { BranchProtectionChecker } from '../../src/services/BranchProtectionChecker';
import { VerifyService } from '../../src/services/VerifyService';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import * as child_process from 'child_process';

/**
 * Integration tests for Configuration Service with other services
 *
 * These tests verify that configuration changes correctly affect
 * the behavior of other services.
 */

jest.mock('fs/promises');
jest.mock('yaml');
jest.mock('child_process');

const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockedFsWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockedYamlParse = yaml.parse as jest.MockedFunction<typeof yaml.parse>;
const mockedYamlStringify = yaml.stringify as jest.MockedFunction<typeof yaml.stringify>;
const mockedExec = child_process.exec as jest.MockedFunction<typeof child_process.exec>;

describe('Configuration Integration', () => {
  let configService: ConfigService;
  let mockOctokit: any;
  let protectionChecker: BranchProtectionChecker;
  let verifyService: VerifyService;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = new ConfigService('/test/dir');

    mockOctokit = {
      rest: {
        repos: {
          getBranchProtection: jest.fn(),
          updateBranchProtection: jest.fn(),
          getCombinedStatusForRef: jest.fn(),
          compareCommits: jest.fn(),
        },
        pulls: {
          get: jest.fn(),
          listReviews: jest.fn(),
          listReviewComments: jest.fn(),
        },
        checks: {
          listForRef: jest.fn(),
        },
        issues: {
          listComments: jest.fn(),
        },
      },
    };

    protectionChecker = new BranchProtectionChecker(mockOctokit, 'owner', 'repo');
    verifyService = new VerifyService('/test/dir');
  });

  describe('Configuration-Driven Workflows', () => {
    it('should apply branch protection based on configuration', async () => {
      // Setup: Load config with strict protection
      const mockConfig = {
        branchProtection: {
          enabled: true,
          requireReviews: 2,
          requireStatusChecks: ['ci', 'security', 'tests'],
          enforceAdmins: true,
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
          autoAssign: ['reviewer1', 'reviewer2'],
          autoLabel: ['needs-review'],
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue('config content');
      mockedYamlParse.mockReturnValue(mockConfig);

      // Act: Load config
      const config = await configService.load();

      // Assert: Config loaded correctly
      expect(config.branchProtection?.enabled).toBe(true);
      expect(config.branchProtection?.requireReviews).toBe(2);

      // Setup: Apply protection based on config
      mockOctokit.rest.repos.updateBranchProtection.mockResolvedValue({});

      // This would be done by an orchestrator reading the config
      if (config.branchProtection?.enabled) {
        await protectionChecker.setupProtection('main', 'strict');
      }

      // Assert: Protection was set up
      expect(mockOctokit.rest.repos.updateBranchProtection).toHaveBeenCalled();
    });

    it('should skip checks when disabled in configuration', async () => {
      // Setup: Load config with security disabled
      const mockConfig = {
        branchProtection: {
          enabled: false,
          requireReviews: 0,
          requireStatusChecks: [],
          enforceAdmins: false,
        },
        ci: {
          waitForChecks: false,
          failFast: true,
          retryFlaky: false,
          timeout: 30,
        },
        security: {
          scanSecrets: false,
          scanDependencies: false,
          allowedVulnerabilities: [],
        },
        pr: {
          autoAssign: [],
          autoLabel: [],
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue('config content');
      mockedYamlParse.mockReturnValue(mockConfig);

      // Act: Load config
      const config = await configService.load();

      // Assert: Security checks disabled
      expect(config.security?.scanSecrets).toBe(false);
      expect(config.security?.scanDependencies).toBe(false);

      // In a real orchestrator, this would skip security scans
      // We're just demonstrating the config is loaded correctly
    });

    it('should use CI timeout from configuration', async () => {
      // Setup: Config with custom timeout
      const mockConfig = {
        branchProtection: {
          enabled: false,
          requireReviews: 0,
          requireStatusChecks: [],
          enforceAdmins: false,
        },
        ci: {
          waitForChecks: true,
          failFast: false,
          retryFlaky: true,
          timeout: 60,
        },
        security: {
          scanSecrets: true,
          scanDependencies: true,
          allowedVulnerabilities: [],
        },
        pr: {
          autoAssign: [],
          autoLabel: [],
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue('config content');
      mockedYamlParse.mockReturnValue(mockConfig);

      // Act: Load config
      const config = await configService.load();

      // Assert: Timeout configured
      expect(config.ci?.timeout).toBe(60);

      // Setup: Verification with configured timeout
      mockedFsAccess.mockResolvedValueOnce(undefined);
      mockedExec.mockImplementationOnce((_cmd, opts: any, _callback: any) => {
        // In a real orchestrator, timeout would come from config
        expect(opts.timeout).toBe(60000); // 60 minutes in ms
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === 'close') handler(0);
          }),
        } as any;
      });

      // Act: Run with configured timeout
      const timeoutMs = (config.ci?.timeout || 30) * 1000;
      await verifyService.runChecks({
        timeout: timeoutMs,
      });
    });
  });

  describe('Configuration Validation and Workflow', () => {
    it('should prevent invalid configuration from being used', async () => {
      // Setup: Invalid config
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedYamlStringify.mockReturnValue('yaml content');
      mockedFsWriteFile.mockResolvedValue(undefined);

      // Act: Try to set invalid timeout
      await configService.set('ci', {
        waitForChecks: true,
        failFast: true,
        retryFlaky: false,
        timeout: 200, // Too high
      });

      // Act: Validate
      const validation = await configService.validate();

      // Assert: Should fail validation
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('CI timeout must be at most 120 minutes');
    });

    it('should allow configuration changes and re-validation', async () => {
      // Setup: Start with default config
      mockedFsAccess.mockRejectedValue(new Error('not found'));

      // Act: Get initial config
      const initialConfig = await configService.load();
      expect(initialConfig.branchProtection?.enabled).toBe(false);

      // Setup: Update config
      mockedYamlStringify.mockReturnValue('yaml content');
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.set('branchProtection', {
        enabled: true,
        requireReviews: 1,
        requireStatusChecks: ['ci', 'security'],
        enforceAdmins: false,
      });

      // Act: Validate new config
      const validation = await configService.validate();

      // Assert: Should be valid
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('Template-Based Configuration', () => {
    it('should initialize with basic template and validate', async () => {
      // Setup: No existing config
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedYamlStringify.mockReturnValue('yaml content');
      mockedFsWriteFile.mockResolvedValue(undefined);

      // Act: Initialize with basic template
      await configService.init('basic');

      // Act: Validate
      const validation = await configService.validate();

      // Assert: Should be valid
      expect(validation.valid).toBe(true);
    });

    it('should initialize with standard template and validate', async () => {
      // Setup: No existing config
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedFsWriteFile.mockResolvedValue(undefined);

      // Act: Initialize with standard template
      await configService.init('standard');

      // Act: Load and verify YAML content (second argument is content)
      const savedYaml = mockedFsWriteFile.mock.calls[0][1];
      expect(savedYaml).toContain('enabled: true'); // branchProtection.enabled
      expect(savedYaml).toContain('requireReviews: 0'); // branchProtection.requireReviews

      // Act: Validate
      const validation = await configService.validate();

      // Assert: Should be valid
      expect(validation.valid).toBe(true);
    });

    it('should initialize with strict template and validate', async () => {
      // Setup: No existing config
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedFsWriteFile.mockResolvedValue(undefined);

      // Act: Initialize with strict template
      await configService.init('strict');

      // Act: Load and verify YAML content (second argument is content)
      const savedYaml = mockedFsWriteFile.mock.calls[0][1];
      expect(savedYaml).toContain('enabled: true'); // branchProtection.enabled
      expect(savedYaml).toContain('requireReviews: 1'); // branchProtection.requireReviews
      expect(savedYaml).toContain('enforceAdmins: true'); // branchProtection.enforceAdmins

      // Act: Validate
      const validation = await configService.validate();

      // Assert: Should be valid
      expect(validation.valid).toBe(true);
    });
  });

  describe('Configuration Persistence', () => {
    it('should save and reload configuration correctly', async () => {
      // Setup: Initial config
      const configToSave = {
        branchProtection: {
          enabled: true,
          requireReviews: 2,
          requireStatusChecks: ['ci', 'security', 'tests'],
          enforceAdmins: true,
        },
        ci: {
          waitForChecks: true,
          failFast: false,
          retryFlaky: true,
          timeout: 45,
        },
        security: {
          scanSecrets: true,
          scanDependencies: true,
          allowedVulnerabilities: ['CVE-2023-1234'],
        },
        pr: {
          templatePath: '.github/PULL_REQUEST_TEMPLATE.md',
          autoAssign: ['reviewer1'],
          autoLabel: ['needs-review', 'enhancement'],
        },
      };

      // Act: Save config
      mockedYamlStringify.mockReturnValue('yaml content');
      mockedFsWriteFile.mockResolvedValue(undefined);
      await configService.save(configToSave);

      // Setup: Reload config
      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue('yaml content');
      mockedYamlParse.mockReturnValue(configToSave);

      // Act: Load config
      const reloadedConfig = await configService.load();

      // Assert: Should match saved config
      expect(reloadedConfig.branchProtection?.enabled).toBe(true);
      expect(reloadedConfig.branchProtection?.requireReviews).toBe(2);
      expect(reloadedConfig.ci?.timeout).toBe(45);
      expect(reloadedConfig.security?.allowedVulnerabilities).toEqual(['CVE-2023-1234']);
      expect(reloadedConfig.pr?.autoLabel).toEqual(['needs-review', 'enhancement']);
    });

    it('should handle config reset to defaults', async () => {
      // Setup: Modified config
      mockedFsAccess.mockRejectedValue(new Error('not found'));
      mockedYamlStringify.mockReturnValue('yaml content');
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.set('branchProtection', {
        enabled: true,
        requireReviews: 5,
        requireStatusChecks: ['ci', 'security', 'tests', 'lint', 'format'],
        enforceAdmins: true,
      });

      // Act: Reset to defaults
      await configService.reset();

      // Act: Load config
      const config = await configService.load();

      // Assert: Should be defaults
      expect(config.branchProtection?.enabled).toBe(false);
      expect(config.branchProtection?.requireReviews).toBe(0);
      expect(config.ci?.waitForChecks).toBe(true);
      expect(config.security?.scanSecrets).toBe(true);
    });
  });

  describe('Cross-Service Configuration Effects', () => {
    it('should demonstrate how config affects multiple services', async () => {
      // Setup: Load comprehensive config
      const mockConfig = {
        branchProtection: {
          enabled: true,
          requireReviews: 1,
          requireStatusChecks: ['ci', 'security'],
          enforceAdmins: false,
        },
        ci: {
          waitForChecks: true,
          failFast: false,
          retryFlaky: true,
          timeout: 30,
        },
        security: {
          scanSecrets: true,
          scanDependencies: true,
          allowedVulnerabilities: [],
        },
        pr: {
          templatePath: '.github/PULL_REQUEST_TEMPLATE.md',
          autoAssign: ['reviewer1'],
          autoLabel: ['needs-review'],
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue('config content');
      mockedYamlParse.mockReturnValue(mockConfig);

      // Act: Load config
      const config = await configService.load();

      // Demonstrate: Branch protection would be applied
      if (config.branchProtection?.enabled) {
        mockOctokit.rest.repos.updateBranchProtection.mockResolvedValue({});
        await protectionChecker.setupProtection('main', 'standard');
        expect(mockOctokit.rest.repos.updateBranchProtection).toHaveBeenCalled();
      }

      // Demonstrate: Security scans would run
      if (config.security?.scanSecrets || config.security?.scanDependencies) {
        // In a real orchestrator, this would trigger scans
        expect(config.security.scanSecrets).toBe(true);
        expect(config.security.scanDependencies).toBe(true);
      }

      // Demonstrate: CI timeout would be applied
      if (config.ci?.timeout) {
        expect(config.ci.timeout).toBe(30);
        // This timeout would be passed to verify service
      }
    });
  });
});
