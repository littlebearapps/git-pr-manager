// Mock dependencies first
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    blank: jest.fn(),
    section: jest.fn(),
    log: jest.fn(),
    divider: jest.fn(),
  }
}));

// Import after mocks are set up
import { doctorCommand } from '../../src/commands/doctor';
import { logger } from '../../src/utils/logger';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('doctor command', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original environment
    originalEnv = { ...process.env };

    // Mock execSync for command existence checks
    mockedExecSync.mockImplementation(((cmd: string) => {
      // Default: most commands exist
      if (cmd.includes('command -v git')) return Buffer.from('');
      if (cmd.includes('command -v node')) return Buffer.from('');
      if (cmd.includes('command -v gh')) return Buffer.from('');
      if (cmd.includes('command -v npm')) return Buffer.from('');
      if (cmd.includes('command -v direnv')) return Buffer.from('');

      // Version commands
      if (cmd.includes('git --version')) return Buffer.from('git version 2.51.0');
      if (cmd.includes('node --version')) return Buffer.from('v20.10.0');
      if (cmd.includes('gh --version')) return Buffer.from('gh version 2.78.0');
      if (cmd.includes('npm --version')) return Buffer.from('11.6.0');

      // Optional tools not installed
      if (cmd.includes('detect-secrets') || cmd.includes('pip-audit')) {
        throw new Error('Command not found');
      }

      throw new Error('Command not found');
    }) as any);

    // Mock existsSync
    mockedExistsSync.mockImplementation((path: any) => {
      const pathStr = path.toString();

      // Keychain helper exists
      if (pathStr.includes('bin/kc.sh')) return true;

      // No .envrc or .env by default
      if (pathStr.includes('.envrc') || pathStr.includes('.env')) return false;

      return false;
    });
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('GitHub token detection', () => {
    it('should detect GITHUB_TOKEN when set', async () => {
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith('GitHub token: GITHUB_TOKEN');
      expect(logger.warn).not.toHaveBeenCalledWith('GitHub token: Not found');
    });

    it('should detect GH_TOKEN when set', async () => {
      process.env.GH_TOKEN = 'ghp_test_token';

      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith('GitHub token: GH_TOKEN');
      expect(logger.warn).not.toHaveBeenCalledWith('GitHub token: Not found');
    });

    it('should warn when no token is set', async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      await doctorCommand();

      expect(logger.warn).toHaveBeenCalledWith('GitHub token: Not found');
      expect(logger.success).not.toHaveBeenCalledWith(expect.stringContaining('GitHub token:'));
    });
  });

  describe('Setup options with direnv + keychain', () => {
    beforeEach(() => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      // direnv exists
      mockedExecSync.mockImplementation(((cmd: string) => {
        if (cmd.includes('command -v direnv')) return Buffer.from('');
        if (cmd.includes('command -v git')) return Buffer.from('');
        if (cmd.includes('command -v node')) return Buffer.from('');
        if (cmd.includes('git --version')) return Buffer.from('git version 2.51.0');
        if (cmd.includes('node --version')) return Buffer.from('v20.10.0');
        throw new Error('Command not found');
      }) as any);

      // Keychain helper exists
      mockedExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('bin/kc.sh')) return true;
        return false;
      });
    });

    it('should recommend direnv + keychain when both available', async () => {
      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Recommended: direnv + keychain')
      );
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('high security')
      );
    });

    it('should show keychain integration steps', async () => {
      await doctorCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('source ~/bin/kc.sh')
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('kc_get GITHUB_PAT')
      );
    });

    it('should show alternative options', async () => {
      await doctorCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Alternative 1:')
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('shell profile')
      );
    });

    it('should show token generation link', async () => {
      await doctorCommand();

      expect(logger.log).toHaveBeenCalledWith(
        'Generate token at: https://github.com/settings/tokens'
      );
      expect(logger.log).toHaveBeenCalledWith(
        'Required scopes: repo (full control of private repositories)'
      );
    });
  });

  describe('Setup options without keychain', () => {
    beforeEach(() => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      // direnv exists but no keychain
      mockedExecSync.mockImplementation(((cmd: string) => {
        if (cmd.includes('command -v direnv')) return Buffer.from('');
        if (cmd.includes('command -v git')) return Buffer.from('');
        if (cmd.includes('command -v node')) return Buffer.from('');
        if (cmd.includes('git --version')) return Buffer.from('git version 2.51.0');
        if (cmd.includes('node --version')) return Buffer.from('v20.10.0');
        throw new Error('Command not found');
      }) as any);

      // No keychain helper
      mockedExistsSync.mockImplementation(() => false);
    });

    it('should recommend direnv with .envrc when keychain not available', async () => {
      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Recommended: direnv with .envrc')
      );
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('medium security')
      );
    });

    it('should warn about .gitignore for .envrc', async () => {
      await doctorCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore')
      );
    });
  });

  describe('Setup options without direnv or keychain', () => {
    beforeEach(() => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      // No direnv, no keychain
      mockedExecSync.mockImplementation(((cmd: string) => {
        if (cmd.includes('command -v git')) return Buffer.from('');
        if (cmd.includes('command -v node')) return Buffer.from('');
        if (cmd.includes('git --version')) return Buffer.from('git version 2.51.0');
        if (cmd.includes('node --version')) return Buffer.from('v20.10.0');
        throw new Error('Command not found');
      }) as any);

      mockedExistsSync.mockImplementation(() => false);
    });

    it('should recommend shell profile when no advanced tools available', async () => {
      await doctorCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Alternative 1: shell profile')
      );
    });

    it('should show all alternative methods', async () => {
      await doctorCommand();

      // Should show shell profile, .env, and current session
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('shell profile')
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('.env file')
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('current session')
      );
    });
  });

  describe('Required and optional tools', () => {
    it('should check required tools (git, node)', async () => {
      process.env.GITHUB_TOKEN = 'test_token';

      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('git')
      );
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('node')
      );
    });

    it('should check optional tools (gh, detect-secrets, pip-audit, npm)', async () => {
      process.env.GITHUB_TOKEN = 'test_token';

      await doctorCommand();

      // gh and npm exist
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('gh')
      );
      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('npm')
      );

      // detect-secrets and pip-audit don't exist
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('detect-secrets')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pip-audit')
      );
    });

    it('should show summary when optional tools missing', async () => {
      process.env.GITHUB_TOKEN = 'test_token';

      await doctorCommand();

      expect(logger.warn).toHaveBeenCalledWith(
        'ℹ️  Some optional tools are missing'
      );
    });
  });
});
