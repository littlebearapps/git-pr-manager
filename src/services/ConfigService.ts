import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowConfig } from '../types';

const DEFAULT_CONFIG: WorkflowConfig = {
  branchProtection: {
    enabled: false,
    requireReviews: 0,
    requireStatusChecks: [],
    enforceAdmins: false
  },
  ci: {
    waitForChecks: true,
    failFast: true,
    retryFlaky: false,
    timeout: 30 // 30 minutes
  },
  security: {
    scanSecrets: true,
    scanDependencies: true,
    allowedVulnerabilities: []
  },
  pr: {
    templatePath: undefined,
    autoAssign: [],
    autoLabel: []
  },
  // Session 3.1: Auto-fix defaults
  autoFix: {
    enabled: true,
    maxAttempts: 2,
    maxChangedLines: 1000,
    requireTests: true,
    enableDryRun: false,
    autoMerge: false,
    createPR: true
  }
};

const CONFIG_FILENAME = '.gwm.yml';

/**
 * ConfigService - Manages .gwm.yml configuration file
 * Implements TTL-based caching to reduce disk I/O and parsing overhead
 */
export class ConfigService {
  private configPath: string;
  private config: WorkflowConfig | null = null;
  private cacheTime: number = 0;
  private cacheTTL: number = 60000; // 1 minute default

  constructor(workingDir: string = process.cwd(), cacheTTL?: number) {
    this.configPath = path.join(workingDir, CONFIG_FILENAME);
    if (cacheTTL !== undefined) {
      this.cacheTTL = cacheTTL;
    }
  }

  /**
   * Load configuration from .gwm.yml
   * Returns default config if file doesn't exist
   * Uses TTL-based cache to avoid repeated disk I/O
   */
  async load(): Promise<WorkflowConfig> {
    const now = Date.now();

    // Return cached config if still fresh
    if (this.config && (now - this.cacheTime) < this.cacheTTL) {
      return this.config;
    }

    try {
      const exists = await this.exists();
      if (!exists) {
        this.config = { ...DEFAULT_CONFIG };
        this.cacheTime = now;
        return this.config;
      }

      const fileContent = await fs.readFile(this.configPath, 'utf-8');
      const parsed = yaml.parse(fileContent);

      // Merge with defaults to ensure all fields are present
      this.config = this.mergeWithDefaults(parsed);
      this.cacheTime = now;
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error}`);
    }
  }

  /**
   * Save configuration to .gwm.yml
   */
  async save(config: WorkflowConfig): Promise<void> {
    try {
      const yamlContent = yaml.stringify(config, {
        indent: 2,
        lineWidth: 0
      });

      await fs.writeFile(this.configPath, yamlContent, 'utf-8');
      this.config = config;
      this.cacheTime = Date.now();
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${error}`);
    }
  }

  /**
   * Invalidate the config cache
   * Forces next load() to read from disk
   */
  invalidateCache(): void {
    this.config = null;
    this.cacheTime = 0;
  }

  /**
   * Check if config file exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new .gwm.yml with default values
   */
  /**
   * Get template configuration without saving
   */
  getTemplateConfig(template: 'basic' | 'standard' | 'strict'): WorkflowConfig {
    let config: WorkflowConfig;

    switch (template) {
      case 'strict':
        config = {
          ...DEFAULT_CONFIG,
          branchProtection: {
            enabled: true,
            requireReviews: 1,
            requireStatusChecks: ['test', 'lint', 'typecheck'],
            enforceAdmins: true
          },
          ci: {
            waitForChecks: true,
            failFast: true,
            retryFlaky: true,
            timeout: 30
          },
          security: {
            scanSecrets: true,
            scanDependencies: true,
            allowedVulnerabilities: []
          }
        };
        break;

      case 'standard':
        config = {
          ...DEFAULT_CONFIG,
          branchProtection: {
            enabled: true,
            requireReviews: 0,
            requireStatusChecks: ['test'],
            enforceAdmins: false
          }
        };
        break;

      case 'basic':
      default:
        config = { ...DEFAULT_CONFIG };
        break;
    }

    return config;
  }

  async init(template?: 'basic' | 'standard' | 'strict'): Promise<void> {
    const exists = await this.exists();
    if (exists) {
      throw new Error(`Config file already exists at ${this.configPath}`);
    }

    const config = this.getTemplateConfig(template || 'basic');
    await this.save(config);
  }

  /**
   * Get a specific config value
   */
  async get<K extends keyof WorkflowConfig>(key: K): Promise<WorkflowConfig[K] | undefined> {
    const config = await this.load();
    return config[key];
  }

  /**
   * Set a specific config value
   */
  async set<K extends keyof WorkflowConfig>(key: K, value: WorkflowConfig[K]): Promise<void> {
    const config = await this.load();
    config[key] = value;
    await this.save(config);
  }

  /**
   * Get the full config
   */
  async getConfig(): Promise<WorkflowConfig> {
    return await this.load();
  }

  /**
   * Merge parsed config with defaults
   */
  private mergeWithDefaults(parsed: Partial<WorkflowConfig>): WorkflowConfig {
    return {
      branchProtection: {
        enabled: parsed.branchProtection?.enabled ?? DEFAULT_CONFIG.branchProtection!.enabled,
        requireReviews: parsed.branchProtection?.requireReviews ?? DEFAULT_CONFIG.branchProtection!.requireReviews,
        requireStatusChecks: parsed.branchProtection?.requireStatusChecks ?? DEFAULT_CONFIG.branchProtection!.requireStatusChecks,
        enforceAdmins: parsed.branchProtection?.enforceAdmins ?? DEFAULT_CONFIG.branchProtection!.enforceAdmins
      },
      ci: {
        ...DEFAULT_CONFIG.ci,
        ...parsed.ci
      },
      security: {
        ...DEFAULT_CONFIG.security,
        ...parsed.security
      },
      pr: {
        ...DEFAULT_CONFIG.pr,
        ...parsed.pr
      },
      // Session 3.1: Merge autoFix config
      autoFix: {
        ...DEFAULT_CONFIG.autoFix,
        ...parsed.autoFix
      }
    };
  }

  /**
   * Reset config to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save(this.config);
  }

  /**
   * Validate config structure
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const config = await this.load();

    // Validate CI timeout
    if (config.ci?.timeout && config.ci.timeout < 1) {
      errors.push('CI timeout must be at least 1 minute');
    }

    if (config.ci?.timeout && config.ci.timeout > 120) {
      errors.push('CI timeout must be at most 120 minutes');
    }

    // Validate branch protection
    if (config.branchProtection?.requireReviews && config.branchProtection.requireReviews < 0) {
      errors.push('Required reviews must be non-negative');
    }

    if (config.branchProtection?.requireReviews && config.branchProtection.requireReviews > 6) {
      errors.push('Required reviews must be at most 6');
    }

    // Session 3.1: Validate autoFix configuration
    if (config.autoFix?.maxAttempts !== undefined) {
      if (config.autoFix.maxAttempts < 1) {
        errors.push('autoFix.maxAttempts must be at least 1');
      }
      if (config.autoFix.maxAttempts > 5) {
        errors.push('autoFix.maxAttempts must be at most 5');
      }
    }

    if (config.autoFix?.maxChangedLines !== undefined) {
      if (config.autoFix.maxChangedLines < 1) {
        errors.push('autoFix.maxChangedLines must be at least 1');
      }
      if (config.autoFix.maxChangedLines > 10000) {
        errors.push('autoFix.maxChangedLines must be at most 10000');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
