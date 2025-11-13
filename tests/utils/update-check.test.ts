import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies BEFORE importing the module
const mockPackageJson = jest.fn();
jest.mock('package-json', () => mockPackageJson);

import {
  checkForUpdate,
  maybeNotifyUpdate,
  shouldSuppressNotification,
  clearUpdateCache,
} from '../../src/utils/update-check';

const packageJson = mockPackageJson as jest.MockedFunction<any>;

describe('Update Checker', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear cache before each test
    await clearUpdateCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('checkForUpdate', () => {
    it('should detect update available', async () => {
      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      const result = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.4.0-beta.1',
        channel: 'latest',
      });

      expect(result.updateAvailable).toBe(true);
      expect(result.currentVersion).toBe('1.4.0-beta.1');
      expect(result.latestVersion).toBe('2.0.0');
      expect(result.channel).toBe('latest');
      expect(result.error).toBeUndefined();
    });

    it('should detect no update available', async () => {
      packageJson.mockResolvedValue({
        version: '1.4.0-beta.1',
      });

      const result = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.4.0-beta.1',
        channel: 'latest',
      });

      expect(result.updateAvailable).toBe(false);
      expect(result.currentVersion).toBe('1.4.0-beta.1');
      expect(result.latestVersion).toBe('1.4.0-beta.1');
    });

    it('should use "latest" channel by default', async () => {
      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });

      expect(packageJson).toHaveBeenCalledWith(
        '@littlebearapps/git-workflow-manager',
        { version: 'latest' }
      );
    });

    it('should support "next" channel', async () => {
      packageJson.mockResolvedValue({
        version: '2.0.0-beta.1',
      });

      const result = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
        channel: 'next',
      });

      expect(packageJson).toHaveBeenCalledWith(
        '@littlebearapps/git-workflow-manager',
        { version: 'next' }
      );
      expect(result.channel).toBe('next');
    });

    it('should handle network errors gracefully', async () => {
      packageJson.mockRejectedValue(new Error('Network error'));

      const result = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });

      expect(result.updateAvailable).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should timeout after specified duration', async () => {
      packageJson.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ version: '2.0.0' }), 10000))
      );

      const result = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
        timeoutMs: 100,
      });

      expect(result.updateAvailable).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('should use cache on subsequent calls', async () => {
      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      // First call - should fetch
      const result1 = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });
      expect(result1.cached).toBe(false);
      expect(packageJson).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });
      expect(result2.cached).toBe(true);
      expect(packageJson).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should cache different channels separately', async () => {
      packageJson
        .mockResolvedValueOnce({ version: '2.0.0' })
        .mockResolvedValueOnce({ version: '2.1.0-beta.1' });

      // Check latest channel
      const result1 = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
        channel: 'latest',
      });
      expect(result1.latestVersion).toBe('2.0.0');

      // Check next channel - should make new call
      const result2 = await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
        channel: 'next',
      });
      expect(result2.latestVersion).toBe('2.1.0-beta.1');
      expect(packageJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('shouldSuppressNotification', () => {
    it('should suppress in CI environment (CI=true)', () => {
      process.env.CI = 'true';
      expect(shouldSuppressNotification([])).toBe(true);
    });

    it('should suppress in CI environment (CONTINUOUS_INTEGRATION=true)', () => {
      process.env.CONTINUOUS_INTEGRATION = 'true';
      expect(shouldSuppressNotification([])).toBe(true);
    });

    it('should suppress with --json flag', () => {
      expect(shouldSuppressNotification(['--json'])).toBe(true);
    });

    it('should suppress in non-TTY environment', () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = false;

      expect(shouldSuppressNotification([])).toBe(true);

      process.stdout.isTTY = originalIsTTY;
    });

    it('should suppress with NO_UPDATE_NOTIFIER=1', () => {
      process.env.NO_UPDATE_NOTIFIER = '1';
      expect(shouldSuppressNotification([])).toBe(true);
    });

    it('should not suppress in normal environment', () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      expect(shouldSuppressNotification([])).toBe(false);

      process.stdout.isTTY = originalIsTTY;
    });
  });

  describe('maybeNotifyUpdate', () => {
    const pkg = {
      name: '@littlebearapps/git-workflow-manager',
      version: '1.0.0',
    };

    it('should return null when suppressed (CI)', async () => {
      process.env.CI = 'true';
      const result = await maybeNotifyUpdate({ pkg, argv: [] });
      expect(result).toBeNull();
    });

    it('should return null when suppressed (--json)', async () => {
      const result = await maybeNotifyUpdate({ pkg, argv: ['--json'] });
      expect(result).toBeNull();
    });

    it('should check for updates when not suppressed', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      const result = await maybeNotifyUpdate({ pkg, argv: [] });

      expect(result).not.toBeNull();
      expect(result?.updateAvailable).toBe(true);
      expect(result?.latestVersion).toBe('2.0.0');

      process.stdout.isTTY = originalIsTTY;
    });

    it('should use "latest" channel for stable versions', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      await maybeNotifyUpdate({ pkg, argv: [] });

      expect(packageJson).toHaveBeenCalledWith(pkg.name, { version: 'latest' });

      process.stdout.isTTY = originalIsTTY;
    });

    it('should use "next" channel for prerelease versions', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      const prereleasePkg = {
        name: '@littlebearapps/git-workflow-manager',
        version: '1.0.0-beta.1',
      };

      packageJson.mockResolvedValue({
        version: '2.0.0-beta.1',
      });

      await maybeNotifyUpdate({ pkg: prereleasePkg, argv: [] });

      expect(packageJson).toHaveBeenCalledWith(prereleasePkg.name, { version: 'next' });

      process.stdout.isTTY = originalIsTTY;
    });

    it('should silently fail on errors', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      packageJson.mockRejectedValue(new Error('Network error'));

      const result = await maybeNotifyUpdate({ pkg, argv: [] });

      // Should not throw, returns error result
      expect(result).not.toBeNull();
      expect(result?.error).toBe('Network error');
      expect(result?.updateAvailable).toBe(false);

      process.stdout.isTTY = originalIsTTY;
    });
  });

  describe('clearUpdateCache', () => {
    it('should clear cache successfully', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      // Populate cache
      await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });
      expect(packageJson).toHaveBeenCalledTimes(1);

      // Verify cache is used
      await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });
      expect(packageJson).toHaveBeenCalledTimes(1);

      // Clear cache
      await clearUpdateCache();

      // Should fetch again
      await checkForUpdate({
        packageName: '@littlebearapps/git-workflow-manager',
        currentVersion: '1.0.0',
      });
      expect(packageJson).toHaveBeenCalledTimes(2);

      process.stdout.isTTY = originalIsTTY;
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete update flow', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = true;

      packageJson.mockResolvedValue({
        version: '2.0.0',
      });

      const pkg = {
        name: '@littlebearapps/git-workflow-manager',
        version: '1.0.0',
      };

      // First check - should fetch and notify
      const result1 = await maybeNotifyUpdate({ pkg, argv: [] });
      expect(result1?.updateAvailable).toBe(true);
      expect(result1?.cached).toBe(false);

      // Second check - should use cache
      const result2 = await maybeNotifyUpdate({ pkg, argv: [] });
      expect(result2?.updateAvailable).toBe(true);
      expect(result2?.cached).toBe(true);

      process.stdout.isTTY = originalIsTTY;
    });

    it('should respect multiple suppression conditions', async () => {
      const originalIsTTY = process.stdout.isTTY;

      // Test CI + JSON (double suppression)
      process.env.CI = 'true';
      expect(shouldSuppressNotification(['--json'])).toBe(true);

      // Test non-TTY + NO_UPDATE_NOTIFIER (double suppression)
      process.env.CI = undefined;
      process.env.NO_UPDATE_NOTIFIER = '1';
      process.stdout.isTTY = false;
      expect(shouldSuppressNotification([])).toBe(true);

      // Cleanup
      process.stdout.isTTY = originalIsTTY;
      process.env.NO_UPDATE_NOTIFIER = undefined;
    });
  });
});
