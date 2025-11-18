/**
 * LanguageDetectionService
 *
 * Detects project language, package manager, and provides tool command mappings.
 * Supports Python, Node.js, Go, and Rust.
 *
 * Phase 1a: Foundation - Core Language Detection
 */

import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  Language,
  PackageManager,
  DetectedLanguage,
  DetectedPackageManager,
  ToolCommands
} from '../types/index.js';

/**
 * Language marker files for detection
 */
const LANGUAGE_MARKERS: Record<Language, string[]> = {
  python: ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile', '.python-version'],
  nodejs: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
  go: ['go.mod', 'go.sum'],
  rust: ['Cargo.toml', 'Cargo.lock']
};

/**
 * Package manager detection markers
 */
const PACKAGE_MANAGER_MARKERS: Record<PackageManager, string> = {
  // Python
  poetry: 'poetry.lock',
  pipenv: 'Pipfile.lock',
  uv: 'uv.lock',
  pip: 'requirements.txt',
  // Node.js
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  bun: 'bun.lockb',
  npm: 'package-lock.json',
  // Go
  'go-mod': 'go.mod',
  // Rust
  cargo: 'Cargo.toml'
};

/**
 * Tool command mappings by language
 */
const TOOL_COMMANDS: Record<Language, ToolCommands> = {
  python: {
    lint: ['make lint', 'ruff check .', 'flake8 .', 'pylint .'],
    test: ['make test', 'pytest tests/', 'python -m pytest', 'tox'],
    typecheck: ['make typecheck', 'mypy .', 'pyright .'],
    format: ['black --check .', 'ruff format --check .', 'autopep8 --diff --recursive .'],
    build: [],  // Python typically doesn't need a build step
    install: [] // Will be set by package manager
  },
  nodejs: {
    lint: ['npm run lint', 'npx eslint .'],
    test: ['npm test', 'npx jest', 'npx vitest'],
    typecheck: ['npm run typecheck', 'npx tsc --noEmit'],
    format: ['prettier --check .', 'biome check --formatter-enabled=true .', 'npx prettier --check .'],
    build: ['npm run build', 'npx tsc'],
    install: [] // Will be set by package manager
  },
  go: {
    lint: ['make lint', 'golangci-lint run'],
    test: ['make test', 'go test ./...'],
    typecheck: [], // Go has built-in type checking
    format: ['gofmt -l .', 'goimports -l .'],
    build: ['make build', 'go build', 'go build ./...'],
    install: ['go mod download']
  },
  rust: {
    lint: ['make lint', 'cargo clippy'],
    test: ['make test', 'cargo test'],
    typecheck: [], // Rust has built-in type checking
    format: ['cargo fmt --check'],
    build: ['make build', 'cargo build'],
    install: ['cargo fetch']
  }
};

/**
 * Install commands by package manager
 */
const INSTALL_COMMANDS: Record<PackageManager, string> = {
  // Python
  poetry: 'poetry install',
  pipenv: 'pipenv install',
  uv: 'uv sync',
  pip: 'pip install -r requirements.txt',
  // Node.js
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --frozen-lockfile',
  bun: 'bun install',
  npm: 'npm ci',
  // Go
  'go-mod': 'go mod download',
  // Rust
  cargo: 'cargo fetch'
};

/**
 * LanguageDetectionService
 *
 * Provides language detection, package manager detection, and tool command mapping.
 */
interface CachedToolAvailability {
  available: boolean;
  timestamp: number;
}

export class LanguageDetectionService {
  private workingDir: string;
  private toolAvailabilityCache: Map<string, CachedToolAvailability> = new Map();
  private cacheExpiry: number = 60 * 60 * 1000; // 1 hour TTL

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  /**
   * Detect the primary language of the project
   */
  async detectLanguage(): Promise<DetectedLanguage> {
    // 1. Check for explicit override in config (would be passed in from ConfigService)
    // For now, we'll skip this and implement it in Phase 1.3

    // 2. Check for project marker files
    const markers = await this.detectMarkerFiles();

    // Priority order: Python > Node.js > Go > Rust
    // (Python first because many Node.js projects have Python dev dependencies)

    if (markers.python.length > 0) {
      return {
        primary: 'python',
        additional: markers.nodejs.length > 0 ? ['nodejs'] : [],
        confidence: 95,
        sources: markers.python
      };
    }

    if (markers.nodejs.length > 0) {
      return {
        primary: 'nodejs',
        additional: [],
        confidence: 95,
        sources: markers.nodejs
      };
    }

    if (markers.go.length > 0) {
      return {
        primary: 'go',
        additional: [],
        confidence: 95,
        sources: markers.go
      };
    }

    if (markers.rust.length > 0) {
      return {
        primary: 'rust',
        additional: [],
        confidence: 95,
        sources: markers.rust
      };
    }

    // 3. Fallback to Node.js (backward compatibility)
    return {
      primary: 'nodejs',
      additional: [],
      confidence: 50,
      sources: ['fallback']
    };
  }

  /**
   * Detect package manager for a language
   */
  async detectPackageManager(language: Language): Promise<DetectedPackageManager> {
    const markers = await this.detectPackageManagerMarkers(language);

    // Return the first match with highest priority
    for (const [pkgManager, marker] of Object.entries(markers)) {
      if (marker) {
        return {
          packageManager: pkgManager as PackageManager,
          lockFile: path.join(this.workingDir, marker),
          confidence: 95
        };
      }
    }

    // Fallback to default package manager for language
    const defaults: Record<Language, PackageManager> = {
      python: 'pip',
      nodejs: 'npm',
      go: 'go-mod',
      rust: 'cargo'
    };

    return {
      packageManager: defaults[language],
      lockFile: null,
      confidence: 50
    };
  }

  /**
   * Get tool commands for a language
   */
  async getToolCommands(
    language: Language,
    packageManager?: PackageManager
  ): Promise<ToolCommands> {
    const baseCommands = { ...TOOL_COMMANDS[language] };

    // Add install command based on package manager
    if (packageManager) {
      baseCommands.install = [INSTALL_COMMANDS[packageManager]];
    }

    // For Node.js and Python, adjust commands based on package manager
    if (language === 'nodejs' && packageManager) {
      baseCommands.lint = this.adaptNodeCommands(baseCommands.lint, packageManager);
      baseCommands.test = this.adaptNodeCommands(baseCommands.test, packageManager);
      if (baseCommands.typecheck) {
        baseCommands.typecheck = this.adaptNodeCommands(baseCommands.typecheck, packageManager);
      }
      if (baseCommands.format) {
        baseCommands.format = this.adaptNodeCommands(baseCommands.format, packageManager);
      }
      if (baseCommands.build) {
        baseCommands.build = this.adaptNodeCommands(baseCommands.build, packageManager);
      }
    }

    if (language === 'python' && packageManager) {
      baseCommands.lint = this.adaptPythonCommands(baseCommands.lint, packageManager);
      baseCommands.test = this.adaptPythonCommands(baseCommands.test, packageManager);
      if (baseCommands.typecheck) {
        baseCommands.typecheck = this.adaptPythonCommands(baseCommands.typecheck, packageManager);
      }
      if (baseCommands.format) {
        baseCommands.format = this.adaptPythonCommands(baseCommands.format, packageManager);
      }
    }

    return baseCommands;
  }

  /**
   * Get available Makefile targets
   */
  async getMakefileTargets(): Promise<string[]> {
    const makefilePath = path.join(this.workingDir, 'Makefile');

    try {
      const content = await fs.readFile(makefilePath, 'utf-8');
      const targets = new Set<string>();

      // Split into lines for processing
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Extract targets from .PHONY declarations
        // Example: .PHONY: test lint build
        if (trimmed.startsWith('.PHONY:')) {
          const phonyTargets = trimmed
            .replace('.PHONY:', '')
            .trim()
            .split(/\s+/)
            .filter((t) => t.length > 0);

          phonyTargets.forEach((t) => targets.add(t));
          continue;
        }

        // Extract targets with or without dependencies
        // Examples:
        //   target:
        //   target: dependency1 dependency2
        const targetMatch = trimmed.match(/^([a-zA-Z0-9_-]+):/);
        if (targetMatch) {
          targets.add(targetMatch[1]);
        }
      }

      return Array.from(targets).sort();
    } catch {
      return [];
    }
  }

  /**
   * Check if a tool is available
   */
  async checkToolAvailable(tool: string): Promise<boolean> {
    // Check cache first
    const cached = this.toolAvailabilityCache.get(tool);
    if (cached !== undefined) {
      // Check if cache is still valid (not expired)
      const now = Date.now();
      if (now - cached.timestamp < this.cacheExpiry) {
        return cached.available;
      }
      // Cache expired, remove it
      this.toolAvailabilityCache.delete(tool);
    }

    try {
      // Use 'command -v' which is POSIX-compliant
      execSync(`command -v ${tool}`, { stdio: 'ignore' });
      this.toolAvailabilityCache.set(tool, { available: true, timestamp: Date.now() });
      return true;
    } catch {
      this.toolAvailabilityCache.set(tool, { available: false, timestamp: Date.now() });
      return false;
    }
  }

  /**
   * Phase 1b: Detect if the project is a Node.js workspace
   * Returns workspace root directory if detected, null otherwise
   */
  async detectWorkspaceRoot(): Promise<string | null> {
    // Check for Node.js workspaces (package.json with workspaces field)
    const nodeWorkspaceRoot = await this.findNodeWorkspaceRoot();
    if (nodeWorkspaceRoot) {
      return nodeWorkspaceRoot;
    }

    // Check for Yarn workspaces (.yarnrc.yml)
    const yarnWorkspaceRoot = await this.findYarnWorkspaceRoot();
    if (yarnWorkspaceRoot) {
      return yarnWorkspaceRoot;
    }

    // Check for pnpm workspaces (pnpm-workspace.yaml)
    const pnpmWorkspaceRoot = await this.findPnpmWorkspaceRoot();
    if (pnpmWorkspaceRoot) {
      return pnpmWorkspaceRoot;
    }

    return null;
  }

  /**
   * Find Node.js workspace root (package.json with workspaces field)
   * @private
   */
  private async findNodeWorkspaceRoot(): Promise<string | null> {
    let currentDir = this.workingDir;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const packageJsonPath = path.join(currentDir, 'package.json');

      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);

        // Check for workspaces field (npm/yarn style)
        if (packageJson.workspaces) {
          return currentDir;
        }
      } catch {
        // File doesn't exist or isn't valid JSON, continue searching
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Find Yarn workspace root (.yarnrc.yml)
   * @private
   */
  private async findYarnWorkspaceRoot(): Promise<string | null> {
    let currentDir = this.workingDir;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const yarnrcPath = path.join(currentDir, '.yarnrc.yml');

      if (existsSync(yarnrcPath)) {
        // Also verify package.json exists in the same directory
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (existsSync(packageJsonPath)) {
          return currentDir;
        }
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Find pnpm workspace root (pnpm-workspace.yaml)
   * @private
   */
  private async findPnpmWorkspaceRoot(): Promise<string | null> {
    let currentDir = this.workingDir;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const pnpmWorkspacePath = path.join(currentDir, 'pnpm-workspace.yaml');

      if (existsSync(pnpmWorkspacePath)) {
        // Also verify package.json exists in the same directory
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (existsSync(packageJsonPath)) {
          return currentDir;
        }
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Detect marker files for each language
   * @private
   */
  private async detectMarkerFiles(): Promise<Record<Language, string[]>> {
    const result: Record<Language, string[]> = {
      python: [],
      nodejs: [],
      go: [],
      rust: []
    };

    for (const [language, markers] of Object.entries(LANGUAGE_MARKERS)) {
      for (const marker of markers) {
        const filePath = path.join(this.workingDir, marker);
        if (existsSync(filePath)) {
          result[language as Language].push(marker);
        }
      }
    }

    return result;
  }

  /**
   * Detect package manager markers for a language
   * @private
   */
  private async detectPackageManagerMarkers(
    language: Language
  ): Promise<Partial<Record<PackageManager, string>>> {
    const result: Partial<Record<PackageManager, string>> = {};

    // Filter package managers relevant to this language
    const relevantManagers = Object.entries(PACKAGE_MANAGER_MARKERS).filter(
      ([pkgManager]) => {
        if (language === 'python') {
          return ['poetry', 'pipenv', 'uv', 'pip'].includes(pkgManager);
        }
        if (language === 'nodejs') {
          return ['pnpm', 'yarn', 'bun', 'npm'].includes(pkgManager);
        }
        if (language === 'go') {
          return pkgManager === 'go-mod';
        }
        if (language === 'rust') {
          return pkgManager === 'cargo';
        }
        return false;
      }
    );

    for (const [pkgManager, marker] of relevantManagers) {
      const filePath = path.join(this.workingDir, marker);
      if (existsSync(filePath)) {
        result[pkgManager as PackageManager] = marker;
      }
    }

    return result;
  }

  /**
   * Adapt Node.js commands for specific package manager
   * @private
   */
  private adaptNodeCommands(commands: string[], packageManager: PackageManager): string[] {
    return commands.map((cmd) => {
      // Replace npm with appropriate package manager
      if (cmd.startsWith('npm run ')) {
        const script = cmd.replace('npm run ', '');
        switch (packageManager) {
          case 'pnpm':
            return `pnpm run ${script}`;
          case 'yarn':
            return `yarn ${script}`;
          case 'bun':
            return `bun run ${script}`;
          default:
            return cmd;
        }
      }

      if (cmd.startsWith('npm test')) {
        switch (packageManager) {
          case 'pnpm':
            return cmd.replace('npm test', 'pnpm test');
          case 'yarn':
            return cmd.replace('npm test', 'yarn test');
          case 'bun':
            return cmd.replace('npm test', 'bun test');
          default:
            return cmd;
        }
      }

      return cmd;
    });
  }

  /**
   * Adapt Python commands for specific package manager
   * @private
   */
  private adaptPythonCommands(commands: string[], packageManager: PackageManager): string[] {
    return commands.map((cmd) => {
      // For poetry and pipenv, prepend package manager run command
      if (packageManager === 'poetry' && !cmd.startsWith('make ')) {
        return `poetry run ${cmd}`;
      }

      if (packageManager === 'pipenv' && !cmd.startsWith('make ')) {
        return `pipenv run ${cmd}`;
      }

      return cmd;
    });
  }
}
