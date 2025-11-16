import { LRUCache } from 'lru-cache';
import packageJson from 'package-json';
import semver from 'semver';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Result of checking for updates
 */
export interface UpdateCheckResult {
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Current installed version */
  currentVersion: string;
  /** Latest available version */
  latestVersion: string;
  /** Update channel (latest or next) */
  channel: 'latest' | 'next';
  /** Whether the check was served from cache */
  cached: boolean;
  /** Error message if check failed */
  error?: string;
}

/**
 * In-memory cache for update checks
 * Default TTL: 7 days (604800000 ms)
 */
const updateCache = new LRUCache<string, UpdateCheckResult>({
  max: 10,
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * Get the cache directory for update checks
 * Uses TMPDIR for ephemeral storage
 */
function getCacheDir(): string {
  return join(tmpdir(), 'gpm-update-check');
}

/**
 * Get the cache file path for a specific package and channel
 */
function getCacheFilePath(packageName: string, channel: string): string {
  const safeName = packageName.replace(/[@/]/g, '_');
  return join(getCacheDir(), `${safeName}_${channel}.json`);
}

/**
 * Load cached update check from disk
 */
async function loadCachedCheck(
  packageName: string,
  channel: string,
  cacheMs: number
): Promise<UpdateCheckResult | null> {
  try {
    const cacheFile = getCacheFilePath(packageName, channel);
    const data = await fs.readFile(cacheFile, 'utf-8');
    const cached = JSON.parse(data) as UpdateCheckResult & { timestamp: number };

    // Check if cache is still valid
    if (Date.now() - cached.timestamp < cacheMs) {
      return { ...cached, cached: true };
    }
  } catch {
    // Cache miss or error - return null
  }
  return null;
}

/**
 * Save update check to disk cache
 */
async function saveCachedCheck(
  packageName: string,
  channel: string,
  result: UpdateCheckResult
): Promise<void> {
  try {
    const cacheDir = getCacheDir();
    await fs.mkdir(cacheDir, { recursive: true });

    const cacheFile = getCacheFilePath(packageName, channel);
    const data = JSON.stringify({ ...result, timestamp: Date.now() }, null, 2);
    await fs.writeFile(cacheFile, data, 'utf-8');
  } catch {
    // Silently fail - cache is non-critical
  }
}

/**
 * Check for updates from npm registry
 *
 * @param options - Configuration options
 * @returns Update check result
 *
 * @example
 * ```typescript
 * const result = await checkForUpdate({
 *   packageName: '@littlebearapps/git-pr-manager',
 *   currentVersion: '1.4.0-beta.1',
 *   channel: 'latest'
 * });
 *
 * if (result.updateAvailable) {
 *   console.log(`Update available: ${result.latestVersion}`);
 * }
 * ```
 */
export async function checkForUpdate(options: {
  packageName: string;
  currentVersion: string;
  channel?: 'latest' | 'next';
  cacheMs?: number;
  timeoutMs?: number;
}): Promise<UpdateCheckResult> {
  const {
    packageName,
    currentVersion,
    channel = 'latest',
    cacheMs = 7 * 24 * 60 * 60 * 1000, // 7 days
    timeoutMs = 5000, // 5 seconds
  } = options;

  // Check in-memory cache first
  const cacheKey = `${packageName}:${channel}`;
  const memCached = updateCache.get(cacheKey);
  if (memCached) {
    return { ...memCached, cached: true };
  }

  // Check disk cache
  const diskCached = await loadCachedCheck(packageName, channel, cacheMs);
  if (diskCached) {
    // Populate in-memory cache
    updateCache.set(cacheKey, diskCached);
    return diskCached;
  }

  // Fetch from npm registry
  try {
    const metadata = await Promise.race([
      packageJson(packageName, { version: channel }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);

    const latestVersion = metadata.version;
    const updateAvailable = semver.gt(latestVersion, currentVersion);

    const result: UpdateCheckResult = {
      updateAvailable,
      currentVersion,
      latestVersion,
      channel,
      cached: false,
    };

    // Cache the result
    updateCache.set(cacheKey, result);
    await saveCachedCheck(packageName, channel, result);

    return result;
  } catch (error) {
    // Return error result (don't cache errors)
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      channel,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determine if update notifications should be suppressed
 *
 * Suppression rules:
 * 1. CI environments (CI=true, CONTINUOUS_INTEGRATION=true)
 * 2. JSON output mode (--json flag)
 * 3. Non-TTY environments
 * 4. Explicit suppression (NO_UPDATE_NOTIFIER=1)
 */
export function shouldSuppressNotification(argv: string[]): boolean {
  // Check for CI environment
  if (process.env.CI === 'true' || process.env.CONTINUOUS_INTEGRATION === 'true') {
    return true;
  }

  // Check for JSON mode
  if (argv.includes('--json')) {
    return true;
  }

  // Check for non-TTY
  if (!process.stdout.isTTY) {
    return true;
  }

  // Check for explicit suppression
  if (process.env.NO_UPDATE_NOTIFIER === '1') {
    return true;
  }

  return false;
}

/**
 * Format update notification message
 */
function formatUpdateMessage(result: UpdateCheckResult, packageName: string): string {
  const lines = [
    '',
    chalk.yellow('╭─────────────────────────────────────────────────╮'),
    chalk.yellow('│') + '  ' + chalk.bold('Update available!') + '                           ' + chalk.yellow('│'),
    chalk.yellow('│') + '                                                 ' + chalk.yellow('│'),
    chalk.yellow('│') +
      '  ' +
      chalk.dim(`${result.currentVersion}`) +
      ' → ' +
      chalk.green.bold(result.latestVersion) +
      '                         ' +
      chalk.yellow('│'),
    chalk.yellow('│') + '                                                 ' + chalk.yellow('│'),
    chalk.yellow('│') +
      '  Run ' +
      chalk.cyan(`npm install -g ${packageName}`) +
      '   ' +
      chalk.yellow('│'),
    chalk.yellow('│') + '  to update.                                      ' + chalk.yellow('│'),
    chalk.yellow('╰─────────────────────────────────────────────────╯'),
    '',
  ];

  return lines.join('\n');
}

/**
 * Maybe notify user about available updates
 *
 * This is the main entry point for the fire-and-forget update check.
 * It respects suppression rules and handles errors gracefully.
 *
 * @param options - Configuration options
 * @returns Update check result or null if suppressed/failed
 *
 * @example
 * ```typescript
 * // In CLI entry point (src/index.ts)
 * import { maybeNotifyUpdate } from './utils/update-check';
 *
 * const pkg = require('../package.json');
 * maybeNotifyUpdate({ pkg, argv: process.argv }).catch(() => {
 *   // Silently fail - update check is non-critical
 * });
 * ```
 */
export async function maybeNotifyUpdate(options: {
  pkg: { name: string; version: string };
  argv: string[];
}): Promise<UpdateCheckResult | null> {
  const { pkg, argv } = options;

  // Check suppression rules
  if (shouldSuppressNotification(argv)) {
    return null;
  }

  try {
    // Determine channel based on version
    const channel = pkg.version.includes('-') ? 'next' : 'latest';

    // Check for updates
    const result = await checkForUpdate({
      packageName: pkg.name,
      currentVersion: pkg.version,
      channel,
    });

    // Show notification if update available
    if (result.updateAvailable && !result.error) {
      console.log(formatUpdateMessage(result, pkg.name));
    }

    return result;
  } catch {
    // Silently fail - update check is non-critical
    return null;
  }
}

/**
 * Clear update check cache
 *
 * Useful for testing or forcing a fresh check.
 *
 * @example
 * ```typescript
 * import { clearUpdateCache } from './utils/update-check';
 *
 * await clearUpdateCache();
 * ```
 */
export async function clearUpdateCache(): Promise<void> {
  // Clear in-memory cache
  updateCache.clear();

  // Clear disk cache
  try {
    const cacheDir = getCacheDir();
    await fs.rm(cacheDir, { recursive: true, force: true });
  } catch {
    // Silently fail - cache cleanup is non-critical
  }
}
