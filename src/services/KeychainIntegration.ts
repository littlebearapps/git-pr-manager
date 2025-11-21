/**
 * KeychainIntegration service - secure token storage with fallback options
 * Provides integration with system keychains and secure storage methods
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { logger } from "../utils/logger";

/**
 * Token storage method
 */
export enum StorageMethod {
  KEYCHAIN_MACOS = "keychain-macos",
  KEYCHAIN_HELPER = "keychain-helper",
  DIRENV = "direnv",
  ENV_FILE = "env-file",
  SHELL_PROFILE = "shell-profile",
  SESSION = "session",
  NOT_STORED = "not-stored",
}

/**
 * Token storage result
 */
export interface StorageResult {
  method: StorageMethod;
  success: boolean;
  location?: string;
  message?: string;
  instructions?: string[];
}

/**
 * Token validation result
 */
export interface ValidationResult {
  valid: boolean;
  scopes?: string[];
  message?: string;
}

/**
 * Available storage methods on the system
 */
export interface AvailableMethod {
  method: StorageMethod;
  available: boolean;
  priority: number; // Lower is higher priority
  description: string;
  security: "high" | "medium" | "low";
}

/**
 * Service for managing GitHub token storage
 */
export class KeychainIntegration {
  private readonly homeDir: string;
  private readonly keychainHelperPath: string;

  constructor() {
    this.homeDir = homedir();
    this.keychainHelperPath = join(this.homeDir, "bin", "kc.sh");
  }

  /**
   * Detect available storage methods on the system
   */
  async detectAvailableMethods(): Promise<AvailableMethod[]> {
    const methods: AvailableMethod[] = [];

    // Check macOS Keychain
    if (process.platform === "darwin") {
      methods.push({
        method: StorageMethod.KEYCHAIN_MACOS,
        available: true,
        priority: 1,
        description: "macOS Keychain (native, most secure)",
        security: "high",
      });
    }

    // Check keychain helper script
    if (existsSync(this.keychainHelperPath)) {
      methods.push({
        method: StorageMethod.KEYCHAIN_HELPER,
        available: true,
        priority: 2,
        description: "Keychain helper script (secure wrapper)",
        security: "high",
      });
    }

    // Check direnv
    if (this.commandExists("direnv")) {
      methods.push({
        method: StorageMethod.DIRENV,
        available: true,
        priority: 3,
        description: "direnv (.envrc file with auto-loading)",
        security: existsSync(this.keychainHelperPath) ? "high" : "medium",
      });
    }

    // .env file (always available)
    methods.push({
      method: StorageMethod.ENV_FILE,
      available: true,
      priority: 4,
      description: ".env file (project-specific)",
      security: "low",
    });

    // Shell profile (always available)
    methods.push({
      method: StorageMethod.SHELL_PROFILE,
      available: true,
      priority: 5,
      description: "Shell profile (~/.zshrc or ~/.bashrc)",
      security: "medium",
    });

    // Session (always available)
    methods.push({
      method: StorageMethod.SESSION,
      available: true,
      priority: 6,
      description: "Current session only (temporary)",
      security: "low",
    });

    return methods.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Store GitHub token using the specified method
   */
  async storeToken(
    token: string,
    method: StorageMethod,
  ): Promise<StorageResult> {
    switch (method) {
      case StorageMethod.KEYCHAIN_MACOS:
        return this.storeInMacOSKeychain(token);

      case StorageMethod.KEYCHAIN_HELPER:
        return this.storeWithKeychainHelper(token);

      case StorageMethod.DIRENV:
        return this.storeInDirenv(token);

      case StorageMethod.ENV_FILE:
        return this.storeInEnvFile(token);

      case StorageMethod.SHELL_PROFILE:
        return this.storeInShellProfile(token);

      case StorageMethod.SESSION:
        return this.storeInSession(token);

      default:
        return {
          method,
          success: false,
          message: "Unknown storage method",
        };
    }
  }

  /**
   * Validate GitHub token by making an API call
   */
  async validateToken(token: string): Promise<ValidationResult> {
    try {
      const result = execSync(
        `curl -s -H "Authorization: token ${token}" https://api.github.com/user`,
        { encoding: "utf-8", stdio: "pipe" },
      );

      const userData = JSON.parse(result);

      if (userData.login) {
        // Get token scopes from headers
        const scopesResult = execSync(
          `curl -sI -H "Authorization: token ${token}" https://api.github.com/user | grep "x-oauth-scopes:"`,
          { encoding: "utf-8", stdio: "pipe" },
        ).trim();

        const scopes = scopesResult
          .replace("x-oauth-scopes:", "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        return {
          valid: true,
          scopes,
          message: `Token valid for user: ${userData.login}`,
        };
      }

      return {
        valid: false,
        message: "Invalid token response",
      };
    } catch {
      return {
        valid: false,
        message: "Token validation failed - check token and network connection",
      };
    }
  }

  /**
   * Retrieve stored token (if accessible)
   */
  async retrieveToken(): Promise<string | null> {
    // Check environment variables first
    if (process.env.GITHUB_TOKEN) {
      return process.env.GITHUB_TOKEN;
    }
    if (process.env.GH_TOKEN) {
      return process.env.GH_TOKEN;
    }

    // Try keychain helper if available
    if (existsSync(this.keychainHelperPath)) {
      try {
        const result = execSync(
          `source ${this.keychainHelperPath} && kc_get GITHUB_PAT`,
          { encoding: "utf-8", stdio: "pipe", shell: "/bin/bash" },
        ).trim();
        if (result && !result.includes("not found")) {
          return result;
        }
      } catch {
        // Keychain helper failed, continue
      }
    }

    // Try macOS Keychain directly
    if (process.platform === "darwin") {
      try {
        const result = execSync(
          'security find-generic-password -w -s "GITHUB_PAT" 2>/dev/null',
          { encoding: "utf-8", stdio: "pipe" },
        ).trim();
        if (result) {
          return result;
        }
      } catch {
        // Keychain read failed, continue
      }
    }

    // Check .env file
    if (existsSync(".env")) {
      try {
        const envContent = readFileSync(".env", "utf-8");
        const match = envContent.match(/^GITHUB_TOKEN=(.+)$/m);
        if (match) {
          return match[1].replace(/["']/g, "");
        }
      } catch {
        // .env read failed
      }
    }

    return null;
  }

  /**
   * Generate setup instructions for the user
   */
  generateSetupInstructions(methods: AvailableMethod[]): string[] {
    const instructions: string[] = [];

    instructions.push("📋 GitHub Token Setup Guide");
    instructions.push("");
    instructions.push("1. Generate a GitHub Personal Access Token:");
    instructions.push("   • Visit: https://github.com/settings/tokens/new");
    instructions.push("   • Name: 'gpm CLI Access'");
    instructions.push("   • Expiration: 90 days (recommended)");
    instructions.push(
      "   • Scopes: Select 'repo' (full control of private repositories)",
    );
    instructions.push("   • Click 'Generate token' and copy the token");
    instructions.push("");
    instructions.push("2. Available storage methods (ranked by security):");
    instructions.push("");

    for (const method of methods) {
      const icon =
        method.security === "high"
          ? "🔒"
          : method.security === "medium"
            ? "🔐"
            : "⚠️";
      instructions.push(`   ${icon} ${method.description}`);
      instructions.push(`      Security: ${method.security}`);
      instructions.push(`      Method: ${method.method}`);
      instructions.push("");
    }

    instructions.push("3. Run setup to configure your token:");
    instructions.push("   gpm setup github-token");
    instructions.push("");
    instructions.push(
      "The setup wizard will guide you through storing your token securely.",
    );

    return instructions;
  }

  // Private methods

  private async storeInMacOSKeychain(token: string): Promise<StorageResult> {
    try {
      // Delete existing entry first (if any)
      try {
        execSync(
          'security delete-generic-password -s "GITHUB_PAT" 2>/dev/null',
          { stdio: "pipe" },
        );
      } catch {
        // Ignore if doesn't exist
      }

      // Add new entry
      execSync(
        `security add-generic-password -s "GITHUB_PAT" -a "$USER" -w "${token}"`,
        { stdio: "pipe" },
      );

      return {
        method: StorageMethod.KEYCHAIN_MACOS,
        success: true,
        location: "macOS Keychain",
        message: "Token stored securely in macOS Keychain",
        instructions: [
          "Token stored successfully!",
          "It will be automatically loaded when you use gpm.",
        ],
      };
    } catch (error: any) {
      return {
        method: StorageMethod.KEYCHAIN_MACOS,
        success: false,
        message: `Failed to store in macOS Keychain: ${error.message}`,
      };
    }
  }

  private async storeWithKeychainHelper(token: string): Promise<StorageResult> {
    try {
      execSync(
        `source ${this.keychainHelperPath} && kc_set GITHUB_PAT "${token}"`,
        { stdio: "pipe", shell: "/bin/bash" },
      );

      return {
        method: StorageMethod.KEYCHAIN_HELPER,
        success: true,
        location: "Keychain (via helper script)",
        message: "Token stored securely via keychain helper",
        instructions: [
          "Token stored successfully!",
          "To use in your shell, add to .envrc:",
          "  source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)",
        ],
      };
    } catch (error: any) {
      return {
        method: StorageMethod.KEYCHAIN_HELPER,
        success: false,
        message: `Failed to store via keychain helper: ${error.message}`,
      };
    }
  }

  private async storeInDirenv(token: string): Promise<StorageResult> {
    try {
      const envrcPath = ".envrc";
      let content = "";

      // Read existing content if file exists
      if (existsSync(envrcPath)) {
        content = readFileSync(envrcPath, "utf-8");
        // Remove any existing GITHUB_TOKEN lines
        content = content.replace(/^export GITHUB_TOKEN=.+$/gm, "").trim();
        if (content) content += "\n";
      }

      // Add token based on available methods
      if (existsSync(this.keychainHelperPath)) {
        content +=
          "source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)";

        // Also store in keychain
        await this.storeWithKeychainHelper(token);
      } else {
        content += `export GITHUB_TOKEN="${token}"`;
      }

      writeFileSync(envrcPath, content + "\n");

      // Allow direnv
      execSync("direnv allow", { stdio: "pipe" });

      // Ensure .envrc is in .gitignore
      this.addToGitignore(".envrc");

      return {
        method: StorageMethod.DIRENV,
        success: true,
        location: ".envrc",
        message: "Token configured in .envrc with direnv",
        instructions: [
          "Token configured successfully!",
          ".envrc has been allowed with direnv.",
          existsSync(this.keychainHelperPath)
            ? "Token is stored securely in keychain and loaded via .envrc"
            : "⚠️  Remember: .envrc contains your token - keep it secure!",
        ],
      };
    } catch (error: any) {
      return {
        method: StorageMethod.DIRENV,
        success: false,
        message: `Failed to configure direnv: ${error.message}`,
      };
    }
  }

  private async storeInEnvFile(token: string): Promise<StorageResult> {
    try {
      const envPath = ".env";
      let content = "";

      // Read existing content if file exists
      if (existsSync(envPath)) {
        content = readFileSync(envPath, "utf-8");
        // Remove any existing GITHUB_TOKEN lines
        content = content.replace(/^GITHUB_TOKEN=.+$/gm, "").trim();
        if (content) content += "\n";
      }

      content += `GITHUB_TOKEN=${token}`;
      writeFileSync(envPath, content + "\n");

      // Ensure .env is in .gitignore
      this.addToGitignore(".env");

      return {
        method: StorageMethod.ENV_FILE,
        success: true,
        location: ".env",
        message: "Token stored in .env file",
        instructions: [
          "Token stored in .env file.",
          "⚠️  CRITICAL: Never commit .env to git!",
          ".env has been added to .gitignore for safety.",
        ],
      };
    } catch (error: any) {
      return {
        method: StorageMethod.ENV_FILE,
        success: false,
        message: `Failed to store in .env: ${error.message}`,
      };
    }
  }

  private async storeInShellProfile(token: string): Promise<StorageResult> {
    const shell = process.env.SHELL || "/bin/bash";
    const profileFile = shell.includes("zsh") ? ".zshrc" : ".bashrc";
    const profilePath = join(this.homeDir, profileFile);

    try {
      let content = "";

      // Read existing content if file exists
      if (existsSync(profilePath)) {
        content = readFileSync(profilePath, "utf-8");
        // Remove any existing GITHUB_TOKEN lines
        content = content.replace(/^export GITHUB_TOKEN=.+$/gm, "").trim();
        if (content) content += "\n";
      }

      content += `\n# GitHub token for gpm\nexport GITHUB_TOKEN="${token}"\n`;
      writeFileSync(profilePath, content);

      return {
        method: StorageMethod.SHELL_PROFILE,
        success: true,
        location: profilePath,
        message: `Token stored in ${profileFile}`,
        instructions: [
          `Token added to ${profileFile}.`,
          `Run: source ~/${profileFile}`,
          "Or restart your terminal for the change to take effect.",
        ],
      };
    } catch (error: any) {
      return {
        method: StorageMethod.SHELL_PROFILE,
        success: false,
        message: `Failed to store in shell profile: ${error.message}`,
      };
    }
  }

  private async storeInSession(token: string): Promise<StorageResult> {
    process.env.GITHUB_TOKEN = token;

    return {
      method: StorageMethod.SESSION,
      success: true,
      location: "Current session",
      message: "Token set for current session only",
      instructions: [
        "Token set for this session only.",
        "To make permanent, run:",
        `  export GITHUB_TOKEN="${token}"`,
        "Note: Token will be lost when you close the terminal.",
      ],
    };
  }

  private commandExists(cmd: string): boolean {
    try {
      execSync(`command -v ${cmd}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  private addToGitignore(file: string): void {
    const gitignorePath = ".gitignore";

    try {
      let content = "";
      if (existsSync(gitignorePath)) {
        content = readFileSync(gitignorePath, "utf-8");

        // Check if file is already in .gitignore
        if (content.includes(file)) {
          return;
        }
      }

      // Add file to .gitignore
      if (content && !content.endsWith("\n")) {
        content += "\n";
      }
      content += `${file}\n`;

      writeFileSync(gitignorePath, content);
    } catch {
      // Failed to update .gitignore - log warning
      logger.warn(`Could not add ${file} to .gitignore - please add manually!`);
    }
  }
}
