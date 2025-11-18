/**
 * CommandResolver
 *
 * Unified command resolution service that determines which commands to run
 * based on project language, package manager, Makefile targets, and configuration.
 *
 * Phase 1a: Foundation - Command Resolution
 */

import { LanguageDetectionService } from './LanguageDetectionService';
import {
  Language,
  PackageManager,
  VerificationConfig
} from '../types/index';

/**
 * Task types for verification
 */
export type VerificationTask = 'lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install';

/**
 * Command resolution result
 */
export interface ResolvedCommand {
  command: string;
  source: 'config' | 'makefile' | 'package-manager' | 'native' | 'not-found';
  language: Language;
  packageManager?: PackageManager;
  optional?: boolean;  // Task is optional (e.g., build when no build script exists)
}

/**
 * Command resolution options
 */
export interface ResolveOptions {
  task: VerificationTask;
  language: Language;
  packageManager?: PackageManager;
  workingDir?: string;
  config?: VerificationConfig;
  makefileTargets?: string[];
  dryRun?: boolean;
}

/**
 * CommandResolver
 *
 * Resolves verification commands based on project configuration and detected language.
 * Priority order:
 * 1. Custom config commands (.gpm.yml)
 * 2. Makefile targets (if preferMakefile is true)
 * 3. Package manager commands
 * 4. Native tool fallbacks
 *
 * Phase 1b: Supports Node.js workspaces - prefers root-level Makefile and commands
 */
export class CommandResolver {
  private languageDetector: LanguageDetectionService;
  private workspaceRoot: string | null = null;
  private workspaceRootDetected: boolean = false;

  constructor(workingDir: string = process.cwd()) {
    this.languageDetector = new LanguageDetectionService(workingDir);
  }

  /**
   * Phase 1b: Get workspace root if in a workspace
   */
  async getWorkspaceRoot(): Promise<string | null> {
    if (!this.workspaceRootDetected) {
      this.workspaceRoot = await this.languageDetector.detectWorkspaceRoot();
      this.workspaceRootDetected = true;
    }
    return this.workspaceRoot;
  }

  /**
   * Resolve command for a verification task
   */
  async resolve(options: ResolveOptions): Promise<ResolvedCommand> {
    const {
      task,
      language,
      packageManager,
      config,
      makefileTargets = []
    } = options;

    // 1. Check for custom config command override
    if (config?.commands?.[task]) {
      return {
        command: config.commands[task]!,
        source: 'config',
        language,
        packageManager
      };
    }

    // 2. Check for Makefile target (if preferMakefile is enabled)
    const preferMakefile = config?.preferMakefile !== false; // Default: true
    if (preferMakefile && makefileTargets.length > 0) {
      const makefileCommand = this.resolveMakefileCommand(task, makefileTargets, config);
      if (makefileCommand) {
        return {
          command: makefileCommand,
          source: 'makefile',
          language,
          packageManager
        };
      }
    }

    // 3. Get package manager or native tool commands
    const toolCommands = await this.languageDetector.getToolCommands(language, packageManager);

    // 4. Select first available command from fallback chain
    const commandChain = toolCommands[task] || [];

    for (const cmd of commandChain) {
      // Skip 'make' commands if we already checked Makefile
      if (cmd.startsWith('make ') && preferMakefile) {
        continue; // Already checked Makefile, skip
      }

      // Check if tool is available
      const [tool] = cmd.split(' ');
      const isAvailable = await this.languageDetector.checkToolAvailable(tool);

      if (isAvailable) {
        return {
          command: cmd,
          source: packageManager ? 'package-manager' : 'native',
          language,
          packageManager
        };
      }
    }

    // 5. No command found
    // Build task is optional - mark it so verify command can skip it gracefully
    const isOptional = task === 'build';

    return {
      command: '',
      source: 'not-found',
      language,
      packageManager,
      optional: isOptional
    };
  }

  /**
   * Resolve Makefile command for a task
   * @private
   */
  private resolveMakefileCommand(
    task: VerificationTask,
    makefileTargets: string[],
    config?: VerificationConfig
  ): string | null {
    // 1. Check for custom Makefile target mapping in config
    const customTarget = config?.makefileTargets?.[task];
    if (customTarget && makefileTargets.includes(customTarget)) {
      return `make ${customTarget}`;
    }

    // 2. Check for default target name
    if (makefileTargets.includes(task)) {
      return `make ${task}`;
    }

    // 3. Phase 1b: Check for aliased target names
    // Example: if Makefile has 'check' and config has { check: 'test' }, use 'make check' for test task
    if (config?.makefileAliases) {
      for (const [actualTarget, mappedTask] of Object.entries(config.makefileAliases)) {
        if (mappedTask === task && makefileTargets.includes(actualTarget)) {
          return `make ${actualTarget}`;
        }
      }
    }

    return null;
  }

  /**
   * Get suggested install command for missing tool
   */
  getSuggestedInstallCommand(tool: string, language: Language): string | null {
    const installSuggestions: Record<string, Record<Language, string>> = {
      ruff: {
        python: 'pip install ruff',
        nodejs: 'npm install -D ruff',
        go: '',
        rust: ''
      },
      pytest: {
        python: 'pip install pytest',
        nodejs: '',
        go: '',
        rust: ''
      },
      mypy: {
        python: 'pip install mypy',
        nodejs: '',
        go: '',
        rust: ''
      },
      eslint: {
        python: '',
        nodejs: 'npm install -D eslint',
        go: '',
        rust: ''
      },
      'golangci-lint': {
        python: '',
        nodejs: '',
        go: 'go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest',
        rust: ''
      }
    };

    return installSuggestions[tool]?.[language] || null;
  }

  /**
   * Get detection summary for dry-run mode
   * Phase 1b: Includes workspace information when detected
   */
  async getDetectionSummary(
    language: Language,
    packageManager?: PackageManager
  ): Promise<string> {
    const lines: string[] = [];

    lines.push('▸ Detection Summary');
    lines.push('─'.repeat(80));
    lines.push(`Language: ${language}`);

    if (packageManager) {
      lines.push(`Package Manager: ${packageManager}`);
    }

    // Phase 1b: Show workspace information
    const workspaceRoot = await this.getWorkspaceRoot();
    if (workspaceRoot) {
      lines.push(`Workspace Root: ${workspaceRoot}`);
    }

    // Get Makefile targets
    const makefileTargets = await this.languageDetector.getMakefileTargets();
    if (makefileTargets.length > 0) {
      lines.push(`Makefile Targets: ${makefileTargets.join(', ')}`);
    } else {
      lines.push('Makefile: Not found');
    }

    return lines.join('\n');
  }
}
