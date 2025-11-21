import chalk from "chalk";
import simpleGit from "simple-git";
import pkg from "../../package.json";

/**
 * Verbosity levels for logger
 */
export enum VerbosityLevel {
  SILENT = 0, // No output
  QUIET = 1, // Errors only
  NORMAL = 2, // Errors + warnings + success
  VERBOSE = 3, // + info messages
  DEBUG = 4, // + debug logs
}

/**
 * JSON response structure for machine-readable output
 */
export interface JsonResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
  };
  metadata: {
    timestamp: string;
    duration: number;
    version: string;
  };
}

/**
 * Get current worktree context for error messages
 * @returns Branch name if in a worktree, null otherwise
 */
async function getWorktreeContext(): Promise<string | null> {
  try {
    const git = simpleGit(process.cwd());
    const output = await git.raw(["worktree", "list"]);

    // Find current worktree from output
    const cwd = process.cwd();
    const lines = output.split("\n");
    const currentLine = lines.find((line) => line.startsWith(cwd));

    if (currentLine) {
      // Extract branch from line
      const match = currentLine.match(/\[(.+?)\]/);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Logger utility for consistent CLI output
 * Supports:
 * - Human-readable colored output
 * - Machine-readable JSON output
 * - Configurable verbosity levels
 * - Auto-detection of CI environments
 */
export class Logger {
  private level: VerbosityLevel;
  private jsonMode: boolean;
  private startTime: number;

  constructor(
    options: {
      verbose?: boolean;
      jsonMode?: boolean;
      level?: VerbosityLevel;
    } = {},
  ) {
    this.jsonMode = options.jsonMode ?? false;
    this.startTime = Date.now();

    // Determine verbosity level
    if (options.level !== undefined) {
      this.level = options.level;
    } else if (options.verbose) {
      this.level = VerbosityLevel.VERBOSE;
    } else {
      this.level = Logger.detectEnvironment();
    }
  }

  /**
   * Auto-detect environment and set appropriate verbosity
   */
  static detectEnvironment(): VerbosityLevel {
    // CI environments should be quiet by default
    if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
      return VerbosityLevel.QUIET;
    }
    return VerbosityLevel.NORMAL;
  }

  /**
   * Set JSON output mode
   */
  setJsonMode(enabled: boolean): void {
    this.jsonMode = enabled;
  }

  /**
   * Set verbosity level
   */
  setLevel(level: VerbosityLevel): void {
    this.level = level;
  }

  /**
   * Get current verbosity level
   */
  getLevel(): VerbosityLevel {
    return this.level;
  }

  /**
   * Check if JSON mode is enabled
   */
  isJsonMode(): boolean {
    return this.jsonMode;
  }

  /**
   * Log info message
   */
  info(message: string): void {
    if (this.level >= VerbosityLevel.VERBOSE) {
      if (this.jsonMode) {
        // In JSON mode, info messages are suppressed unless verbose
        return;
      }
      console.log(chalk.blue("ℹ"), message);
    }
  }

  /**
   * Log success message
   */
  success(message: string, data?: any): void {
    if (this.level >= VerbosityLevel.NORMAL) {
      if (this.jsonMode && data) {
        this.outputJson({ success: true, data });
      } else if (!this.jsonMode) {
        console.log(chalk.green("✅"), message);
      }
    }
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    if (this.level >= VerbosityLevel.NORMAL) {
      if (this.jsonMode) {
        // Warnings in JSON mode are part of metadata
        return;
      }
      console.log(chalk.yellow("⚠️ "), message);
    }
  }

  /**
   * Log error message
   */
  error(
    message: string,
    code?: string,
    details?: any,
    suggestions?: string[],
  ): void {
    if (this.level >= VerbosityLevel.QUIET) {
      if (this.jsonMode) {
        this.outputJson({
          success: false,
          error: { code: code ?? "ERROR", message, details, suggestions },
        });
      } else {
        console.error(chalk.red("❌"), message);
        if (suggestions && suggestions.length > 0) {
          console.error(chalk.yellow("\nSuggestions:"));
          suggestions.forEach((s) => console.error(chalk.yellow(`  • ${s}`)));
        }
      }
    }
  }

  /**
   * Log error message with worktree context
   * Automatically detects and displays current worktree branch if available
   */
  async errorWithContext(
    message: string,
    code?: string,
    details?: any,
    suggestions?: string[],
  ): Promise<void> {
    const worktreeBranch = await getWorktreeContext();

    if (worktreeBranch && !this.jsonMode) {
      this.log(chalk.gray(`Worktree: ${worktreeBranch}`));
    }

    // Add worktree to details if available
    const enhancedDetails = worktreeBranch
      ? { ...details, worktree: process.cwd(), worktreeBranch }
      : details;

    this.error(message, code, enhancedDetails, suggestions);
  }

  /**
   * Log debug message (only if debug level)
   */
  debug(message: string): void {
    if (this.level >= VerbosityLevel.DEBUG) {
      if (!this.jsonMode) {
        console.log(chalk.gray("🔍"), message);
      }
    }
  }

  /**
   * Log plain message
   */
  log(message: string): void {
    if (this.level >= VerbosityLevel.NORMAL && !this.jsonMode) {
      console.log(message);
    }
  }

  /**
   * Print a divider line
   */
  divider(): void {
    if (this.level >= VerbosityLevel.NORMAL && !this.jsonMode) {
      console.log(chalk.gray("─".repeat(80)));
    }
  }

  /**
   * Print a blank line
   */
  blank(): void {
    if (this.level >= VerbosityLevel.NORMAL && !this.jsonMode) {
      console.log("");
    }
  }

  /**
   * Create a section header
   */
  section(title: string): void {
    if (this.level >= VerbosityLevel.NORMAL && !this.jsonMode) {
      this.blank();
      console.log(chalk.bold.cyan(`▸ ${title}`));
      this.divider();
    }
  }

  /**
   * Output structured JSON response
   */
  private outputJson(response: Partial<JsonResponse>): void {
    const fullResponse: JsonResponse = {
      success: response.success ?? false,
      data: response.data,
      error: response.error,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: (Date.now() - this.startTime) / 1000,
        version: this.getVersion(),
      },
    };

    // Emit a single-line JSON object followed by a newline (stdout)
    process.stdout.write(JSON.stringify(fullResponse) + "\n");
  }

  /**
   * Get package version
   */
  private getVersion(): string {
    try {
      return pkg.version;
    } catch {
      return "unknown";
    }
  }

  /**
   * Output final JSON result
   */
  outputJsonResult(
    success: boolean,
    data?: any,
    error?: JsonResponse["error"],
  ): void {
    if (this.jsonMode) {
      this.outputJson({ success, data, error });
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with custom options
 */
export function createLogger(
  options: {
    verbose?: boolean;
    jsonMode?: boolean;
    level?: VerbosityLevel;
  } = {},
): Logger {
  return new Logger(options);
}
