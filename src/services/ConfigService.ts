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
  },
  // Phase 2: Git hooks defaults
  hooks: {
    prePush: {
      enabled: false,
      reminder: true
    },
    postCommit: {
      enabled: false,
      reminder: true
    }
  },
  // Phase 1a: Multi-language verification defaults
  verification: {
    detectionEnabled: true,
    preferMakefile: true
  }
};

const CONFIG_FILENAME = '.gpm.yml';

/**
 * ConfigService - Manages .gpm.yml configuration file
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
   * Load configuration from .gpm.yml
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
   * Save configuration to .gpm.yml
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
   * Initialize a new .gpm.yml with default values
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

  /**
   * Generate YAML with AI-readable comments
   * Makes it easy for AI agents to understand preferred workflows
   */
  private generateYamlWithComments(template: 'basic' | 'standard' | 'strict'): string {
    const config = this.getTemplateConfig(template);

    // Extract values with defaults to satisfy TypeScript strict null checks
    const bp = config.branchProtection || DEFAULT_CONFIG.branchProtection;
    const ci = config.ci || DEFAULT_CONFIG.ci;
    const security = config.security || DEFAULT_CONFIG.security;
    const pr = config.pr || DEFAULT_CONFIG.pr;
    const autoFix = config.autoFix || DEFAULT_CONFIG.autoFix;
    const hooks = config.hooks || DEFAULT_CONFIG.hooks;
    const verification = config.verification || DEFAULT_CONFIG.verification;

    // Build YAML with inline comments that guide AI agents
    const yaml = `# .gpm.yml - Git PR Manager Configuration
# Generated: ${new Date().toISOString()}
# Template: ${template}
#
# 💡 AI Agent Guidance:
#   - Use 'gpm ship' for full PR workflow (create, wait, merge)
#   - Use 'gpm auto' for quick PR creation
#   - Use 'gpm security' before creating PRs
#   - Use 'gpm checks <pr-number>' to monitor CI status
#
# 🎯 Optional Features:
#   - Run 'gpm install-hooks' to get reminders before push
#   - Run 'gpm docs' for full documentation

# Branch Protection
# Solo developer? Set requireReviews: 0
# Small team (2-5)? Set requireReviews: 1
# Enterprise? Set requireReviews: 2+
branchProtection:
  enabled: ${bp!.enabled}
  requireReviews: ${bp!.requireReviews}  # 0 = no reviews (solo dev), 1+ = team
  requireStatusChecks:
${(bp!.requireStatusChecks || []).map(check => `    - ${check}`).join('\n') || '    []'}
  enforceAdmins: ${bp!.enforceAdmins}

# CI Configuration
# waitForChecks: true  = gpm waits for all CI checks to pass
# failFast: true       = stop on first critical failure
# retryFlaky: true     = retry flaky tests automatically
ci:
  waitForChecks: ${ci!.waitForChecks}
  failFast: ${ci!.failFast}
  retryFlaky: ${ci!.retryFlaky}
  timeout: ${ci!.timeout}  # minutes

# Security Scanning
# scanSecrets: true     = check for hardcoded secrets/tokens
# scanDependencies: true = check for vulnerable packages
security:
  scanSecrets: ${security!.scanSecrets}
  scanDependencies: ${security!.scanDependencies}
  allowedVulnerabilities: []

# Pull Request Settings
# autoAssign: []  = list of GitHub usernames to auto-assign
# autoLabel: []   = list of labels to auto-add
pr:
  templatePath: ${pr!.templatePath || 'null'}
  autoAssign: []
  autoLabel: []

# Auto-Fix Configuration
# enabled: true        = attempt to auto-fix linting/formatting errors
# maxAttempts: 2       = max fix attempts per failure
# createPR: true       = create separate PR for fixes
autoFix:
  enabled: ${autoFix!.enabled}
  maxAttempts: ${autoFix!.maxAttempts}
  maxChangedLines: ${autoFix!.maxChangedLines}
  requireTests: ${autoFix!.requireTests}
  enableDryRun: ${autoFix!.enableDryRun}
  autoMerge: ${autoFix!.autoMerge}
  createPR: ${autoFix!.createPR}

# Git Hooks (Optional - install with 'gpm install-hooks')
# These track installation state - updated by gpm install-hooks/uninstall-hooks
# enabled: false       = hook not installed
# enabled: true        = hook installed in .git/hooks/
# reminder: true       = show reminder message (can be disabled per hook)
hooks:
  prePush:
    enabled: ${hooks!.prePush!.enabled}
    reminder: ${hooks!.prePush!.reminder}
  postCommit:
    enabled: ${hooks!.postCommit!.enabled}
    reminder: ${hooks!.postCommit!.reminder}

# Multi-Language Verification (Phase 1a)
# detectionEnabled: true  = auto-detect language from project markers
# preferMakefile: true    = prefer Makefile targets over package manager commands
# For advanced configuration, see: gpm docs --guide=MULTI-LANGUAGE-SUPPORT
verification:
  detectionEnabled: ${verification!.detectionEnabled}
  preferMakefile: ${verification!.preferMakefile}

# 📚 Documentation:
#   gpm docs                                  - View all guides
#   gpm docs --guide=AI-AGENT-INTEGRATION     - AI agent setup
#   gpm docs --guide=GITHUB-ACTIONS-INTEGRATION - CI/CD setup
#
# 🎯 Next Steps:
#   1. Review this configuration
#   2. Run 'gpm install-hooks' for workflow reminders (optional)
#   3. Run 'gpm feature <name>' to start your first feature branch
#   4. Run 'gpm ship' to create PR and merge
`;

    return yaml;
  }

  async init(template?: 'basic' | 'standard' | 'strict'): Promise<void> {
    const exists = await this.exists();
    if (exists) {
      throw new Error(`Config file already exists at ${this.configPath}`);
    }

    // Generate YAML with AI-readable comments
    const yamlContent = this.generateYamlWithComments(template || 'basic');

    try {
      await fs.writeFile(this.configPath, yamlContent, 'utf-8');

      // Update cache
      const config = this.getTemplateConfig(template || 'basic');
      this.config = config;
      this.cacheTime = Date.now();
    } catch (error) {
      throw new Error(`Failed to create config at ${this.configPath}: ${error}`);
    }
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
      },
      // Phase 2: Merge hooks config
      hooks: {
        prePush: {
          ...DEFAULT_CONFIG.hooks!.prePush,
          ...parsed.hooks?.prePush
        },
        postCommit: {
          ...DEFAULT_CONFIG.hooks!.postCommit,
          ...parsed.hooks?.postCommit
        }
      },
      // Phase 1a: Merge verification config
      verification: {
        ...DEFAULT_CONFIG.verification,
        ...parsed.verification
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
