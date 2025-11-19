import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import {
  SecretScanResult,
  SecretFinding,
  VulnerabilityResult,
  Vulnerability,
  SecurityScanResult,
} from "../types";

const execAsync = promisify(exec);

/**
 * SecurityScanner - Pre-commit security checks (secrets, vulnerabilities)
 */
export class SecurityScanner {
  constructor(private workingDir: string = process.cwd()) {}

  /**
   * Run complete security scan
   */
  async scan(): Promise<SecurityScanResult> {
    const secrets = await this.scanForSecrets();
    const vulnerabilities = await this.checkDependencies();

    const blockers: string[] = [];
    const warnings: string[] = [];

    // Secrets are always blockers
    if (secrets.found && !secrets.skipped) {
      blockers.push(`Found ${secrets.secrets.length} potential secret(s)`);
    }

    // Critical vulnerabilities are blockers
    if (vulnerabilities.shouldBlock) {
      blockers.push(
        `Found ${vulnerabilities.critical} critical vulnerabilit${vulnerabilities.critical === 1 ? "y" : "ies"}`,
      );
    }

    // High vulnerabilities are warnings
    if (vulnerabilities.high && vulnerabilities.high > 0) {
      warnings.push(
        `Found ${vulnerabilities.high} high severity vulnerabilit${vulnerabilities.high === 1 ? "y" : "ies"}`,
      );
    }

    // Add skip warnings
    if (secrets.skipped) {
      warnings.push(
        `Secret scanning skipped: ${secrets.reason || "tool not installed"}`,
      );
    }

    if (vulnerabilities.skipped) {
      warnings.push(
        `Vulnerability scanning skipped: ${vulnerabilities.reason || "tool not installed"}`,
      );
    }

    return {
      secrets,
      vulnerabilities,
      passed: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  /**
   * Scan for secrets in uncommitted changes
   */
  async scanForSecrets(): Promise<SecretScanResult> {
    try {
      // Check if detect-secrets is installed
      try {
        await execAsync("which detect-secrets", { cwd: this.workingDir });
      } catch {
        return {
          found: false,
          secrets: [],
          skipped: true,
          reason: "detect-secrets not installed (pip install detect-secrets)",
        };
      }

      // Save original baseline file to prevent timestamp-only changes
      // (detect-secrets scan updates the generated_at timestamp on every run)
      const baselinePath = `${this.workingDir}/.secrets.baseline`;
      let originalBaseline: string | null = null;

      try {
        originalBaseline = await fs.readFile(baselinePath, "utf-8");
      } catch {
        // Baseline file doesn't exist yet - that's OK
      }

      try {
        // Run detect-secrets scan
        const { stdout, stderr } = await execAsync(
          "detect-secrets scan --baseline .secrets.baseline 2>&1 || true",
          { cwd: this.workingDir },
        );

        const output = stdout + stderr;

        // Parse output for potential secrets
        const secrets = this.parseSecrets(output);

        if (secrets.length > 0) {
          return {
            found: true,
            secrets,
            blocked: true,
          };
        }

        return { found: false, secrets: [] };
      } finally {
        // Restore original baseline file to prevent timestamp-only changes
        if (originalBaseline !== null) {
          try {
            await fs.writeFile(baselinePath, originalBaseline, "utf-8");
          } catch (error: any) {
            // Log warning but don't fail the scan
            if (process.env.DEBUG) {
              console.warn(
                `Warning: Failed to restore .secrets.baseline: ${error.message}`,
              );
            }
          }
        }
      }
    } catch (error: any) {
      // If detect-secrets errors out, warn but don't block
      return {
        found: false,
        secrets: [],
        skipped: true,
        reason: `Secret scanning error: ${error.message}`,
      };
    }
  }

  /**
   * Check for dependency vulnerabilities
   */
  async checkDependencies(): Promise<VulnerabilityResult> {
    try {
      // Detect language
      const language = await this.detectLanguage();

      if (language === "unknown") {
        return {
          skipped: true,
          reason: "Unsupported language (no package.json or requirements.txt)",
        };
      }

      let vulns: any[] = [];

      if (language === "python") {
        try {
          await execAsync("which pip-audit", { cwd: this.workingDir });
        } catch {
          return {
            skipped: true,
            reason: "pip-audit not installed (pip install pip-audit)",
          };
        }

        try {
          const { stdout } = await execAsync("pip-audit --format json", {
            cwd: this.workingDir,
          });
          vulns = JSON.parse(stdout).vulnerabilities || [];
        } catch (error: any) {
          // pip-audit may exit with error code if vulnerabilities found
          if (error.stdout) {
            try {
              vulns = JSON.parse(error.stdout).vulnerabilities || [];
            } catch {
              return {
                skipped: true,
                reason: "Failed to parse pip-audit output",
              };
            }
          } else {
            return {
              skipped: true,
              reason: `pip-audit error: ${error.message}`,
            };
          }
        }
      } else if (language === "node") {
        try {
          const { stdout } = await execAsync("npm audit --json", {
            cwd: this.workingDir,
          });
          const auditData = JSON.parse(stdout);
          // Convert npm audit format to our format
          vulns = Object.values(auditData.vulnerabilities || {});
        } catch (error: any) {
          // npm audit exits with error if vulnerabilities found
          if (error.stdout) {
            try {
              const auditData = JSON.parse(error.stdout);
              vulns = Object.values(auditData.vulnerabilities || {});
            } catch {
              return {
                skipped: true,
                reason: "Failed to parse npm audit output",
              };
            }
          } else {
            return {
              skipped: true,
              reason: `npm audit error: ${error.message}`,
            };
          }
        }
      }

      const critical = this.filterCritical(vulns);
      const high = this.filterHigh(vulns);
      const medium = this.filterMedium(vulns);
      const low = this.filterLow(vulns);

      return {
        total: vulns.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
        shouldBlock: critical.length > 0,
        vulnerabilities: critical,
      };
    } catch (error: any) {
      return {
        skipped: true,
        reason: `Dependency scanning error: ${error.message}`,
      };
    }
  }

  /**
   * Detect project language
   */
  private async detectLanguage(): Promise<"python" | "node" | "unknown"> {
    try {
      await fs.access(`${this.workingDir}/requirements.txt`);
      return "python";
    } catch {
      // Not Python
    }

    try {
      await fs.access(`${this.workingDir}/setup.py`);
      return "python";
    } catch {
      // Not Python
    }

    try {
      await fs.access(`${this.workingDir}/package.json`);
      return "node";
    } catch {
      // Not Node
    }

    return "unknown";
  }

  /**
   * Parse detect-secrets output
   */
  private parseSecrets(output: string): SecretFinding[] {
    const secrets: SecretFinding[] = [];

    // Pattern: filename:line: description
    const lines = output.split("\n");

    for (const line of lines) {
      // Match patterns like:
      // test.py:10: Base64 High Entropy String
      // config.js:25: Potential hardcoded password
      const match = line.match(/^([^:]+):(\d+):\s*(.+)$/);
      if (match) {
        secrets.push({
          file: match[1],
          line: parseInt(match[2]),
          type: match[3].trim(),
        });
      }
    }

    return secrets;
  }

  /**
   * Filter critical vulnerabilities
   */
  private filterCritical(vulns: any[]): Vulnerability[] {
    return vulns
      .filter((v) => {
        const severity = (v.severity || "").toLowerCase();
        return severity === "critical";
      })
      .map((v) => ({
        package: v.package || v.name || "unknown",
        version: v.version || "unknown",
        severity: "critical" as const,
        cve: v.cve || v.id || "N/A",
        description: v.description || v.title || "No description",
      }));
  }

  /**
   * Filter high vulnerabilities
   */
  private filterHigh(vulns: any[]): Vulnerability[] {
    return vulns.filter((v) => {
      const severity = (v.severity || "").toLowerCase();
      return severity === "high";
    });
  }

  /**
   * Filter medium vulnerabilities
   */
  private filterMedium(vulns: any[]): Vulnerability[] {
    return vulns.filter((v) => {
      const severity = (v.severity || "").toLowerCase();
      return severity === "medium" || severity === "moderate";
    });
  }

  /**
   * Filter low vulnerabilities
   */
  private filterLow(vulns: any[]): Vulnerability[] {
    return vulns.filter((v) => {
      const severity = (v.severity || "").toLowerCase();
      return severity === "low";
    });
  }
}
