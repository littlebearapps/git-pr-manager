import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";

/**
 * Tool status information
 */
export interface ToolStatus {
  id: string;
  name: string;
  status: "ok" | "missing" | "incompatible" | "misconfigured";
  version?: string;
  details: string;
  recommendedAction?: string;
  required: boolean;
}

/**
 * Version information for a tool
 */
export interface VersionInfo {
  installed: boolean;
  version: string | null;
  compatible: boolean;
  minVersion?: string;
}

/**
 * Configuration status for a tool
 */
export interface ConfigStatus {
  found: boolean;
  valid: boolean;
  path?: string;
  issues?: string[];
}

/**
 * Package manager information
 */
export interface PackageManagerInfo {
  type: "npm" | "yarn" | "pnpm" | "bun";
  version: string;
  lockFile?: string;
}

/**
 * Language detection information
 */
export interface LanguageInfo {
  primary: "nodejs" | "python" | "go" | "rust";
  confidence: number;
  markers: string[];
}

/**
 * Check result for doctor command
 */
export interface Check {
  id: string;
  status: "ok" | "missing" | "incompatible" | "misconfigured";
  details: string;
  version?: string;
  recommendedAction?: string;
}

/**
 * Doctor response for JSON output
 */
export interface DoctorResponse {
  status: "ok" | "warnings" | "errors";
  checks: Check[];
  metadata: {
    timestamp: string;
    gpm_version: string;
    platform: string;
  };
}

/**
 * Service for detecting tools, configurations, and project setup
 */
export class ToolDetector {
  /**
   * Detect all installed tools and their status
   */
  async detectInstalledTools(): Promise<ToolStatus[]> {
    const tools: ToolStatus[] = [];

    // Required tools
    tools.push(await this.checkTool("git", true, "git --version"));
    tools.push(await this.checkTool("node", true, "node --version", "18.0.0"));

    // Package managers (at least one required)
    const npm = await this.checkTool("npm", false, "npm --version");
    const yarn = await this.checkTool("yarn", false, "yarn --version");
    const pnpm = await this.checkTool("pnpm", false, "pnpm --version");
    const bun = await this.checkTool("bun", false, "bun --version");

    // Mark at least one package manager as required
    const hasPackageManager = [npm, yarn, pnpm, bun].some(
      (t) => t.status === "ok",
    );
    if (!hasPackageManager) {
      npm.required = true;
      npm.recommendedAction = "install:npm (comes with Node.js)";
    }

    tools.push(npm, yarn, pnpm, bun);

    // Optional tools
    tools.push(
      await this.checkTool(
        "gh",
        false,
        "gh --version",
        null,
        "https://cli.github.com/",
      ),
    );
    tools.push(
      await this.checkTool(
        "detect-secrets",
        false,
        "detect-secrets --version",
        null,
        "pip install detect-secrets",
      ),
    );
    tools.push(
      await this.checkTool(
        "pip-audit",
        false,
        "pip-audit --version",
        null,
        "pip install pip-audit",
      ),
    );

    // Verification tools (check locally installed versions)
    tools.push(
      await this.checkTool(
        "eslint",
        false,
        "npx --no-install eslint --version 2>/dev/null",
        null,
        "npm install -D eslint",
      ),
    );
    tools.push(
      await this.checkTool(
        "prettier",
        false,
        "npx --no-install prettier --version 2>/dev/null",
        null,
        "npm install -D prettier",
      ),
    );
    tools.push(
      await this.checkTool(
        "typescript",
        false,
        "npx --no-install tsc --version 2>/dev/null",
        null,
        "npm install -D typescript",
      ),
    );
    tools.push(
      await this.checkTool(
        "jest",
        false,
        "npx --no-install jest --version 2>/dev/null",
        null,
        "npm install -D jest",
      ),
    );

    return tools;
  }

  /**
   * Check a specific tool's version and status
   */
  async checkToolVersion(tool: string): Promise<VersionInfo> {
    const versionCommands: Record<string, string> = {
      git: "git --version",
      node: "node --version",
      npm: "npm --version",
      yarn: "yarn --version",
      pnpm: "pnpm --version",
      bun: "bun --version",
      gh: "gh --version",
      eslint: "npx --no-install eslint --version 2>/dev/null",
      prettier: "npx --no-install prettier --version 2>/dev/null",
      typescript: "npx --no-install tsc --version 2>/dev/null",
      jest: "npx --no-install jest --version 2>/dev/null",
    };

    const command = versionCommands[tool];
    if (!command) {
      return { installed: false, version: null, compatible: false };
    }

    try {
      const output = execSync(command, {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 3000, // 3 second timeout
      }).trim();
      const version = this.extractVersion(output);

      // Check compatibility for tools with minimum versions
      const minVersions: Record<string, string> = {
        node: "18.0.0",
        npm: "8.0.0",
      };

      const compatible = minVersions[tool]
        ? this.compareVersions(version || "", minVersions[tool]) >= 0
        : true;

      return {
        installed: true,
        version,
        compatible,
        minVersion: minVersions[tool],
      };
    } catch {
      return { installed: false, version: null, compatible: false };
    }
  }

  /**
   * Validate configuration for a tool
   */
  async validateConfiguration(tool: string): Promise<ConfigStatus> {
    const configFiles: Record<string, string[]> = {
      eslint: [
        ".eslintrc.json",
        ".eslintrc.js",
        ".eslintrc.yml",
        ".eslintrc",
        "eslint.config.js",
      ],
      prettier: [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.yml",
        ".prettierrc.js",
        "prettier.config.js",
      ],
      typescript: ["tsconfig.json"],
      jest: ["jest.config.js", "jest.config.ts", "jest.config.json"],
      git: [".gitignore"],
      npm: ["package.json"],
    };

    const possibleFiles = configFiles[tool];
    if (!possibleFiles) {
      return { found: false, valid: false };
    }

    for (const file of possibleFiles) {
      if (existsSync(file)) {
        const issues = await this.validateConfigFile(tool, file);
        return {
          found: true,
          valid: issues.length === 0,
          path: file,
          issues: issues.length > 0 ? issues : undefined,
        };
      }
    }

    return { found: false, valid: false };
  }

  /**
   * Detect the package manager being used
   */
  async detectPackageManager(): Promise<PackageManagerInfo | null> {
    // Check lock files first (most reliable)
    if (existsSync("bun.lockb")) {
      const version = await this.getToolVersion("bun");
      return {
        type: "bun",
        version: version || "unknown",
        lockFile: "bun.lockb",
      };
    }

    if (existsSync("pnpm-lock.yaml")) {
      const version = await this.getToolVersion("pnpm");
      return {
        type: "pnpm",
        version: version || "unknown",
        lockFile: "pnpm-lock.yaml",
      };
    }

    if (existsSync("yarn.lock")) {
      const version = await this.getToolVersion("yarn");
      return {
        type: "yarn",
        version: version || "unknown",
        lockFile: "yarn.lock",
      };
    }

    if (existsSync("package-lock.json")) {
      const version = await this.getToolVersion("npm");
      return {
        type: "npm",
        version: version || "unknown",
        lockFile: "package-lock.json",
      };
    }

    // No lock file, check if package.json exists
    if (existsSync("package.json")) {
      // Default to npm if package.json exists but no lock file
      const version = await this.getToolVersion("npm");
      return { type: "npm", version: version || "unknown" };
    }

    return null;
  }

  /**
   * Detect the primary language of the project
   */
  async detectLanguage(): Promise<LanguageInfo> {
    const markers: string[] = [];

    // Check for Node.js/JavaScript/TypeScript
    if (existsSync("package.json")) {
      markers.push("package.json");
      return { primary: "nodejs", confidence: 95, markers };
    }

    // Check for Python
    if (
      existsSync("pyproject.toml") ||
      existsSync("setup.py") ||
      existsSync("requirements.txt")
    ) {
      if (existsSync("pyproject.toml")) markers.push("pyproject.toml");
      if (existsSync("setup.py")) markers.push("setup.py");
      if (existsSync("requirements.txt")) markers.push("requirements.txt");
      return { primary: "python", confidence: 90, markers };
    }

    // Check for Go
    if (existsSync("go.mod")) {
      markers.push("go.mod");
      return { primary: "go", confidence: 95, markers };
    }

    // Check for Rust
    if (existsSync("Cargo.toml")) {
      markers.push("Cargo.toml");
      return { primary: "rust", confidence: 95, markers };
    }

    // Default to Node.js if no clear markers
    return { primary: "nodejs", confidence: 50, markers: ["default"] };
  }

  /**
   * Check if package.json has required scripts
   */
  async checkPackageScripts(): Promise<Check[]> {
    const checks: Check[] = [];

    if (!existsSync("package.json")) {
      checks.push({
        id: "package.json",
        status: "missing",
        details: "No package.json found",
        recommendedAction: "run:npm init",
      });
      return checks;
    }

    try {
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
      const scripts = packageJson.scripts || {};

      const recommendedScripts = [
        { name: "lint", command: "eslint .", purpose: "Code linting" },
        {
          name: "format",
          command: "prettier --check .",
          purpose: "Code formatting check",
        },
        { name: "test", command: "jest", purpose: "Run tests" },
        {
          name: "typecheck",
          command: "tsc --noEmit",
          purpose: "TypeScript type checking",
        },
        { name: "build", command: "tsc", purpose: "Build project" },
      ];

      for (const script of recommendedScripts) {
        if (scripts[script.name]) {
          checks.push({
            id: `script.${script.name}`,
            status: "ok",
            details: `Script '${script.name}' found`,
          });
        } else {
          checks.push({
            id: `script.${script.name}`,
            status: "missing",
            details: `Script '${script.name}' not found - ${script.purpose}`,
            recommendedAction: `add-script:${script.name}:${script.command}`,
          });
        }
      }
    } catch (error: any) {
      checks.push({
        id: "package.json",
        status: "misconfigured",
        details: `Invalid package.json: ${error.message}`,
        recommendedAction: "fix:package.json",
      });
    }

    return checks;
  }

  /**
   * Check GitHub token configuration
   */
  async checkGitHubToken(): Promise<Check> {
    if (process.env.GITHUB_TOKEN) {
      return {
        id: "github.token",
        status: "ok",
        details: "GitHub token found (GITHUB_TOKEN)",
      };
    }

    if (process.env.GH_TOKEN) {
      return {
        id: "github.token",
        status: "ok",
        details: "GitHub token found (GH_TOKEN)",
      };
    }

    return {
      id: "github.token",
      status: "missing",
      details: "GitHub token not found",
      recommendedAction: "run:gpm setup github-token",
    };
  }

  /**
   * Generate comprehensive doctor response
   */
  async generateDoctorResponse(gpmVersion: string): Promise<DoctorResponse> {
    const checks: Check[] = [];
    let hasErrors = false;
    let hasWarnings = false;

    // Check GitHub token
    const tokenCheck = await this.checkGitHubToken();
    checks.push(tokenCheck);
    if (tokenCheck.status === "missing") hasWarnings = true;

    // Check all tools
    const tools = await this.detectInstalledTools();
    for (const tool of tools) {
      const check: Check = {
        id: `tool.${tool.id}`,
        status: tool.status,
        details: tool.details,
        version: tool.version,
        recommendedAction: tool.recommendedAction,
      };

      checks.push(check);

      if (tool.required && tool.status !== "ok") {
        hasErrors = true;
      } else if (!tool.required && tool.status !== "ok") {
        hasWarnings = true;
      }
    }

    // Check package.json scripts
    const scriptChecks = await this.checkPackageScripts();
    checks.push(...scriptChecks);
    for (const check of scriptChecks) {
      if (check.status !== "ok") hasWarnings = true;
    }

    // Determine overall status
    const status = hasErrors ? "errors" : hasWarnings ? "warnings" : "ok";

    return {
      status,
      checks,
      metadata: {
        timestamp: new Date().toISOString(),
        gpm_version: gpmVersion,
        platform: process.platform,
      },
    };
  }

  /**
   * Private helper: Check a single tool
   */
  private async checkTool(
    name: string,
    required: boolean,
    command: string,
    minVersion?: string | null,
    installCommand?: string,
  ): Promise<ToolStatus> {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");

    try {
      const output = execSync(command, {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 3000, // 3 second timeout
      }).trim();
      const version = this.extractVersion(output);

      // Check version compatibility if minimum version specified
      if (minVersion && version) {
        const compatible = this.compareVersions(version, minVersion) >= 0;
        if (!compatible) {
          return {
            id,
            name,
            status: "incompatible",
            version,
            details: `Version ${version} installed, but ${minVersion}+ required`,
            recommendedAction: installCommand
              ? `update:${installCommand}`
              : undefined,
            required,
          };
        }
      }

      return {
        id,
        name,
        status: "ok",
        version: version || undefined,
        details: version || "Installed",
        required,
      };
    } catch {
      return {
        id,
        name,
        status: "missing",
        details: `${name} not found`,
        recommendedAction: installCommand
          ? `install:${installCommand}`
          : undefined,
        required,
      };
    }
  }

  /**
   * Extract version from command output
   */
  private extractVersion(output: string): string | null {
    // Try various version patterns
    const patterns = [
      /(\d+\.\d+\.\d+)/, // Standard semver
      /v(\d+\.\d+\.\d+)/, // With 'v' prefix
      /version\s+(\d+\.\d+\.\d+)/i, // With 'version' keyword
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  /**
   * Get tool version
   */
  private async getToolVersion(tool: string): Promise<string | null> {
    const versionCommands: Record<string, string> = {
      npm: "npm --version",
      yarn: "yarn --version",
      pnpm: "pnpm --version",
      bun: "bun --version",
    };

    const command = versionCommands[tool];
    if (!command) return null;

    try {
      const output = execSync(command, {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 3000, // 3 second timeout
      }).trim();
      return this.extractVersion(output);
    } catch {
      return null;
    }
  }

  /**
   * Validate a configuration file
   */
  private async validateConfigFile(
    tool: string,
    file: string,
  ): Promise<string[]> {
    const issues: string[] = [];

    try {
      const content = readFileSync(file, "utf-8");

      // Basic JSON validation for JSON files
      if (file.endsWith(".json")) {
        try {
          JSON.parse(content);
        } catch {
          issues.push("Invalid JSON syntax");
        }
      }

      // Tool-specific validations
      if (tool === "typescript" && file === "tsconfig.json") {
        const config = JSON.parse(content);
        if (!config.compilerOptions) {
          issues.push("Missing compilerOptions");
        }
      }

      if (tool === "eslint" && file.includes("eslintrc")) {
        const config = file.endsWith(".js") ? {} : JSON.parse(content);
        // Basic validation - could be enhanced
        if (typeof config !== "object") {
          issues.push("Invalid configuration format");
        }
      }
    } catch (error: any) {
      issues.push(`Failed to read/parse: ${error.message}`);
    }

    return issues;
  }
}
