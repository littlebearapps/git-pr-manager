/**
 * Tests for LanguageDetectionService
 *
 * Phase 1a: Foundation - Core Language Detection
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LanguageDetectionService } from '../../src/services/LanguageDetectionService';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { execSync } from 'child_process';

// Mock modules
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('child_process');

const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockReadFile = fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('LanguageDetectionService', () => {
  let service: LanguageDetectionService;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LanguageDetectionService(testDir);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('detectLanguage', () => {
    it('should detect Python project from pyproject.toml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('pyproject.toml');
      });

      const result = await service.detectLanguage();

      expect(result.primary).toBe('python');
      expect(result.confidence).toBe(95);
      expect(result.sources).toContain('pyproject.toml');
      expect(result.additional).toEqual([]);
    });

    it('should detect Node.js project from package.json', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('package.json');
      });

      const result = await service.detectLanguage();

      expect(result.primary).toBe('nodejs');
      expect(result.confidence).toBe(95);
      expect(result.sources).toContain('package.json');
    });

    it('should detect Go project from go.mod', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('go.mod');
      });

      const result = await service.detectLanguage();

      expect(result.primary).toBe('go');
      expect(result.confidence).toBe(95);
      expect(result.sources).toContain('go.mod');
    });

    it('should detect Rust project from Cargo.toml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('Cargo.toml');
      });

      const result = await service.detectLanguage();

      expect(result.primary).toBe('rust');
      expect(result.confidence).toBe(95);
      expect(result.sources).toContain('Cargo.toml');
    });

    it('should detect monorepo with Python and Node.js', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.includes('pyproject.toml') || pathStr.includes('package.json');
      });

      const result = await service.detectLanguage();

      expect(result.primary).toBe('python');
      expect(result.additional).toContain('nodejs');
      expect(result.confidence).toBe(95);
    });

    it('should fallback to Node.js when no markers found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.detectLanguage();

      expect(result.primary).toBe('nodejs');
      expect(result.confidence).toBe(50);
      expect(result.sources).toEqual(['fallback']);
    });

    it('should prioritize Python over Node.js in mixed projects', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.includes('pyproject.toml') || pathStr.includes('package.json');
      });

      const result = await service.detectLanguage();

      expect(result.primary).toBe('python');
      expect(result.additional).toContain('nodejs');
    });
  });

  describe('detectPackageManager', () => {
    it('should detect poetry from poetry.lock', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('poetry.lock');
      });

      const result = await service.detectPackageManager('python');

      expect(result.packageManager).toBe('poetry');
      expect(result.confidence).toBe(95);
      expect(result.lockFile).toContain('poetry.lock');
    });

    it('should detect pipenv from Pipfile.lock', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('Pipfile.lock');
      });

      const result = await service.detectPackageManager('python');

      expect(result.packageManager).toBe('pipenv');
      expect(result.confidence).toBe(95);
    });

    it('should fallback to pip for Python', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.detectPackageManager('python');

      expect(result.packageManager).toBe('pip');
      expect(result.confidence).toBe(50);
      expect(result.lockFile).toBeNull();
    });

    it('should detect pnpm from pnpm-lock.yaml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('pnpm-lock.yaml');
      });

      const result = await service.detectPackageManager('nodejs');

      expect(result.packageManager).toBe('pnpm');
      expect(result.confidence).toBe(95);
    });

    it('should detect yarn from yarn.lock', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes('yarn.lock');
      });

      const result = await service.detectPackageManager('nodejs');

      expect(result.packageManager).toBe('yarn');
      expect(result.confidence).toBe(95);
    });

    it('should fallback to npm for Node.js', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await service.detectPackageManager('nodejs');

      expect(result.packageManager).toBe('npm');
      expect(result.confidence).toBe(50);
    });

    it('should detect go-mod for Go projects', async () => {
      mockExistsSync.mockReturnValue(true);

      const result = await service.detectPackageManager('go');

      expect(result.packageManager).toBe('go-mod');
    });

    it('should detect cargo for Rust projects', async () => {
      mockExistsSync.mockReturnValue(true);

      const result = await service.detectPackageManager('rust');

      expect(result.packageManager).toBe('cargo');
    });
  });

  describe('getToolCommands', () => {
    it('should return Python tool commands', async () => {
      const commands = await service.getToolCommands('python');

      expect(commands.lint).toContain('ruff check .');
      expect(commands.test).toContain('pytest tests/');
      expect(commands.typecheck).toContain('mypy .');
      expect(commands.format).toContain('ruff format --check .');
    });

    it('should return Node.js tool commands', async () => {
      const commands = await service.getToolCommands('nodejs');

      expect(commands.lint).toContain('npm run lint');
      expect(commands.test).toContain('npm test');
      expect(commands.typecheck).toContain('npm run typecheck');
      expect(commands.build).toContain('npm run build');
    });

    it('should return Go tool commands', async () => {
      const commands = await service.getToolCommands('go');

      expect(commands.lint).toContain('golangci-lint run');
      expect(commands.test).toContain('go test ./...');
      expect(commands.build).toContain('go build');
    });

    it('should return Rust tool commands', async () => {
      const commands = await service.getToolCommands('rust');

      expect(commands.lint).toContain('cargo clippy');
      expect(commands.test).toContain('cargo test');
      expect(commands.build).toContain('cargo build');
    });

    it('should adapt Node.js commands for pnpm', async () => {
      const commands = await service.getToolCommands('nodejs', 'pnpm');

      expect(commands.lint).toContain('pnpm run lint');
      expect(commands.test).toContain('pnpm test');
      expect(commands.install).toContain('pnpm install --frozen-lockfile');
    });

    it('should adapt Node.js commands for yarn', async () => {
      const commands = await service.getToolCommands('nodejs', 'yarn');

      expect(commands.lint).toContain('yarn lint');
      expect(commands.test).toContain('yarn test');
      expect(commands.install).toContain('yarn install --frozen-lockfile');
    });

    it('should adapt Python commands for poetry', async () => {
      const commands = await service.getToolCommands('python', 'poetry');

      // Should prepend 'poetry run' to non-make commands
      expect(commands.lint.some((cmd) => cmd.includes('poetry run'))).toBe(true);
      expect(commands.test.some((cmd) => cmd.includes('poetry run'))).toBe(true);
      expect(commands.install).toContain('poetry install');
    });

    it('should adapt Python commands for pipenv', async () => {
      const commands = await service.getToolCommands('python', 'pipenv');

      // Should prepend 'pipenv run' to non-make commands
      expect(commands.lint.some((cmd) => cmd.includes('pipenv run'))).toBe(true);
      expect(commands.test.some((cmd) => cmd.includes('pipenv run'))).toBe(true);
      expect(commands.install).toContain('pipenv install');
    });

    it('should include install command based on package manager', async () => {
      const commands = await service.getToolCommands('python', 'pip');

      expect(commands.install).toContain('pip install -r requirements.txt');
    });
  });

  describe('getMakefileTargets', () => {
    it('should parse simple Makefile', async () => {
      const makefileContent = `
lint:
\techo "Linting..."

test:
\techo "Testing..."

build:
\techo "Building..."
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toContain('lint');
      expect(targets).toContain('test');
      expect(targets).toContain('build');
      expect(targets).toHaveLength(3);
    });

    it('should parse complex Makefile with various targets', async () => {
      const makefileContent = `
.PHONY: lint test build clean

lint:
\truff check .

test:
\tpytest tests/

typecheck:
\tmypy .

build:
\tpython -m build

clean:
\trm -rf dist/

install-dev:
\tpip install -e ".[dev]"
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toContain('lint');
      expect(targets).toContain('test');
      expect(targets).toContain('typecheck');
      expect(targets).toContain('build');
      expect(targets).toContain('clean');
      expect(targets).toContain('install-dev');
    });

    it('should return empty array when Makefile not found', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const targets = await service.getMakefileTargets();

      expect(targets).toEqual([]);
    });

    it('should handle Makefile with no targets', async () => {
      const makefileContent = `
# Just comments
# No actual targets
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toEqual([]);
    });

    // Phase 1b: Enhanced Makefile parsing tests
    it('should extract targets from .PHONY declarations', async () => {
      const makefileContent = `.PHONY: lint test build
lint:
\techo "Linting..."
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toContain('lint');
      expect(targets).toContain('test');
      expect(targets).toContain('build');
    });

    it('should handle targets with dependencies', async () => {
      const makefileContent = `
test: build lint
\tpytest tests/

build:
\tpython -m build

lint:
\truff check .
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toContain('test');
      expect(targets).toContain('build');
      expect(targets).toContain('lint');
      expect(targets).toHaveLength(3);
    });

    it('should skip commented targets', async () => {
      const makefileContent = `
# This is a comment
lint:
\techo "Linting..."

# test:
#\techo "Testing..."

build:
\techo "Building..."
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toContain('lint');
      expect(targets).toContain('build');
      expect(targets).not.toContain('test');
      expect(targets).toHaveLength(2);
    });

    it('should return sorted targets', async () => {
      const makefileContent = `
test:
\techo "Testing..."

build:
\techo "Building..."

lint:
\techo "Linting..."

clean:
\techo "Cleaning..."
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      expect(targets).toEqual(['build', 'clean', 'lint', 'test']);
    });

    it('should deduplicate targets from .PHONY and definitions', async () => {
      const makefileContent = `.PHONY: test lint build

test:
\tpytest tests/

lint:
\truff check .

build:
\tpython -m build
`;
      mockReadFile.mockResolvedValue(makefileContent as any);

      const targets = await service.getMakefileTargets();

      // Should not have duplicates
      expect(targets).toEqual(['build', 'lint', 'test']);
    });
  });

  describe('checkToolAvailable', () => {
    it('should return true when tool exists', async () => {
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/ruff'));

      const result = await service.checkToolAvailable('ruff');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('command -v ruff', { stdio: 'ignore' });
    });

    it('should return false when tool does not exist', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await service.checkToolAvailable('nonexistent-tool');

      expect(result).toBe(false);
    });

    it('should cache tool availability results', async () => {
      mockExecSync.mockReturnValue(Buffer.from('/usr/bin/ruff'));

      // First call
      const result1 = await service.checkToolAvailable('ruff');
      expect(result1).toBe(true);
      expect(mockExecSync).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      const result2 = await service.checkToolAvailable('ruff');
      expect(result2).toBe(true);
      expect(mockExecSync).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should cache negative results', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      // First call
      const result1 = await service.checkToolAvailable('nonexistent');
      expect(result1).toBe(false);
      expect(mockExecSync).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      const result2 = await service.checkToolAvailable('nonexistent');
      expect(result2).toBe(false);
      expect(mockExecSync).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  // Phase 1b: Workspace detection tests
  describe('detectWorkspaceRoot', () => {
    it('should detect Node.js workspace from package.json with workspaces field', async () => {
      const packageJsonPath = '/test/project/package.json';
      const packageJsonContent = JSON.stringify({
        name: 'my-workspace',
        workspaces: ['packages/*']
      });

      mockExistsSync.mockReturnValue(false);
      mockReadFile.mockImplementation(async (path: any) => {
        if (path.toString() === packageJsonPath) {
          return packageJsonContent as any;
        }
        throw new Error('File not found');
      });

      const result = await service.detectWorkspaceRoot();

      expect(result).toBe('/test/project');
    });

    it('should detect Yarn workspace from .yarnrc.yml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.includes('.yarnrc.yml') || pathStr.includes('package.json');
      });

      const result = await service.detectWorkspaceRoot();

      expect(result).toBe('/test/project');
    });

    it('should detect pnpm workspace from pnpm-workspace.yaml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.includes('pnpm-workspace.yaml') || pathStr.includes('package.json');
      });

      const result = await service.detectWorkspaceRoot();

      expect(result).toBe('/test/project');
    });

    it('should return null when no workspace is detected', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await service.detectWorkspaceRoot();

      expect(result).toBeNull();
    });

    it('should find workspace root in parent directory', async () => {
      const childService = new LanguageDetectionService('/test/project/packages/app');
      const parentPackageJsonPath = '/test/project/package.json';
      const packageJsonContent = JSON.stringify({
        name: 'my-workspace',
        workspaces: ['packages/*']
      });

      mockExistsSync.mockReturnValue(false);
      mockReadFile.mockImplementation(async (path: any) => {
        if (path.toString() === parentPackageJsonPath) {
          return packageJsonContent as any;
        }
        throw new Error('File not found');
      });

      const result = await childService.detectWorkspaceRoot();

      expect(result).toBe('/test/project');
    });

    it('should not detect workspace when package.json has no workspaces field', async () => {
      const packageJsonPath = '/test/project/package.json';
      const packageJsonContent = JSON.stringify({
        name: 'my-app',
        version: '1.0.0'
      });

      mockExistsSync.mockReturnValue(false);
      mockReadFile.mockImplementation(async (path: any) => {
        if (path.toString() === packageJsonPath) {
          return packageJsonContent as any;
        }
        throw new Error('File not found');
      });

      const result = await service.detectWorkspaceRoot();

      expect(result).toBeNull();
    });

    it('should require package.json alongside .yarnrc.yml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        // Only .yarnrc.yml exists, no package.json
        return pathStr.includes('.yarnrc.yml') && !pathStr.includes('package.json');
      });

      const result = await service.detectWorkspaceRoot();

      expect(result).toBeNull();
    });

    it('should require package.json alongside pnpm-workspace.yaml', async () => {
      mockExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();
        // Only pnpm-workspace.yaml exists, no package.json
        return pathStr.includes('pnpm-workspace.yaml') && !pathStr.includes('package.json');
      });

      const result = await service.detectWorkspaceRoot();

      expect(result).toBeNull();
    });
  });
});
