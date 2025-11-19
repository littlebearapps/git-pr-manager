import { SecurityScanner } from "../services/SecurityScanner";
import { logger } from "../utils/logger";
import { spinner } from "../utils/spinner";
import chalk from "chalk";

interface SecurityOptions {
  fix?: boolean;
}

/**
 * Run security scans
 */
export async function securityCommand(
  _options: SecurityOptions = {},
): Promise<void> {
  try {
    const scanner = new SecurityScanner(process.cwd());

    logger.section("Security Scan");

    spinner.start("Running security checks...");
    const result = await scanner.scan();
    spinner.succeed();

    // Build JSON data for structured output
    const jsonData = {
      passed: result.passed,
      secrets: {
        scanned: !result.secrets.skipped,
        found: result.secrets.found,
        count: result.secrets.secrets.length,
        secrets: result.secrets.secrets,
        reason: result.secrets.reason || null,
      },
      vulnerabilities: {
        scanned: !result.vulnerabilities.skipped,
        total: result.vulnerabilities.total || 0,
        critical: result.vulnerabilities.critical || 0,
        high: result.vulnerabilities.high || 0,
        medium: result.vulnerabilities.medium || 0,
        low: result.vulnerabilities.low || 0,
        vulnerabilities: result.vulnerabilities.vulnerabilities || [],
        reason: result.vulnerabilities.reason || null,
      },
      warnings: result.warnings,
      blockers: result.blockers,
    };

    // Output JSON if in JSON mode (will only output if jsonMode enabled)
    logger.outputJsonResult(result.passed, jsonData);

    // Human-readable output below (will only output if jsonMode disabled)
    logger.blank();

    // Display secrets scan results
    logger.info("🔐 Secret Scanning");
    if (result.secrets.skipped) {
      logger.warn(`  ⚠️  Skipped: ${result.secrets.reason}`);
    } else if (result.secrets.found) {
      logger.error(
        `  ❌ Found ${result.secrets.secrets.length} potential secret(s):`,
      );
      logger.blank();

      result.secrets.secrets.forEach((secret) => {
        logger.log(
          `     ${chalk.red("•")} ${chalk.cyan(secret.file)}:${secret.line}`,
        );
        logger.log(`       ${chalk.gray(secret.type)}`);
      });

      logger.blank();
      logger.info("   Fix:");
      logger.log("     1. Remove secrets from code");
      logger.log("     2. Use environment variables or secret management");
      logger.log("     3. Update .gitignore to prevent future commits");
      logger.log("     4. Rotate exposed secrets immediately");
    } else {
      logger.success("  ✅ No secrets detected");
    }

    logger.blank();

    // Display vulnerability scan results
    logger.info("🛡️  Dependency Vulnerabilities");
    if (result.vulnerabilities.skipped) {
      logger.warn(`  ⚠️  Skipped: ${result.vulnerabilities.reason}`);
    } else {
      const { total, critical, high, medium, low } = result.vulnerabilities;

      if (total === 0) {
        logger.success("  ✅ No vulnerabilities found");
      } else {
        logger.log(
          `  Total: ${total} vulnerabilit${total === 1 ? "y" : "ies"}`,
        );

        if (critical && critical > 0) {
          logger.error(`  ❌ Critical: ${critical}`);
        }
        if (high && high > 0) {
          logger.warn(`  ⚠️  High: ${high}`);
        }
        if (medium && medium > 0) {
          logger.log(`  ℹ️  Medium: ${medium}`);
        }
        if (low && low > 0) {
          logger.log(`  ℹ️  Low: ${low}`);
        }

        if (
          result.vulnerabilities.vulnerabilities &&
          result.vulnerabilities.vulnerabilities.length > 0
        ) {
          logger.blank();
          logger.error("  Critical Vulnerabilities:");

          result.vulnerabilities.vulnerabilities.forEach((vuln) => {
            logger.log(
              `     ${chalk.red("•")} ${chalk.cyan(vuln.package)}@${vuln.version}`,
            );
            logger.log(`       ${chalk.gray(vuln.cve)}: ${vuln.description}`);
          });
        }

        logger.blank();
        logger.info("   Fix:");
        logger.log("     # Update vulnerable dependencies");
        logger.log("     npm update     # For Node.js projects");
        logger.log("     pip install -U # For Python projects");
      }
    }

    logger.blank();

    // Overall status
    if (result.passed) {
      logger.success("✅ Security scan passed!");

      if (result.warnings.length > 0) {
        logger.blank();
        logger.warn("Warnings:");
        result.warnings.forEach((warning) => {
          logger.log(`  • ${warning}`);
        });
      }
    } else {
      logger.error("❌ Security scan failed!");
      logger.blank();
      logger.error("Blockers:");
      result.blockers.forEach((blocker) => {
        logger.log(`  • ${blocker}`);
      });

      if (result.warnings.length > 0) {
        logger.blank();
        logger.warn("Warnings:");
        result.warnings.forEach((warning) => {
          logger.log(`  • ${warning}`);
        });
      }

      process.exit(1);
    }

    logger.blank();
    logger.info("Security Tools:");
    logger.log(
      "  Secrets:         detect-secrets (pip install detect-secrets)",
    );
    logger.log("  Python deps:     pip-audit (pip install pip-audit)");
    logger.log("  Node.js deps:    npm audit (built-in)");
  } catch (error: any) {
    spinner.fail("Security scan failed");
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}
