#!/usr/bin/env node

/**
 * Setup command - guided setup and configuration for gpm
 * Provides interactive setup for GitHub tokens, tool installation, and configuration
 */

import prompts from "prompts";
import {
  KeychainIntegration,
  StorageMethod,
} from "../services/KeychainIntegration";
import { SetupOrchestrator } from "../services/SetupOrchestrator";
import { logger } from "../utils/logger";

interface SetupOptions {
  json?: boolean;
  method?: string;
  token?: string;
  skipValidation?: boolean;
  update?: boolean; // Phase 4.1: Re-run setup for existing projects
}

/**
 * GitHub token setup subcommand
 */
export async function githubTokenSetup(
  options: SetupOptions = {},
): Promise<void> {
  const keychain = new KeychainIntegration();

  try {
    // Check if token is already configured
    const existingToken = await keychain.retrieveToken();
    if (existingToken && !options.token) {
      logger.info("✅ GitHub token is already configured!");

      if (!options.json) {
        const { reconfigure } = await prompts({
          type: "confirm",
          name: "reconfigure",
          message: "Do you want to reconfigure it?",
          initial: false,
        });

        if (!reconfigure) {
          logger.info("Setup complete - no changes made.");
          return;
        }
      } else {
        console.log(
          JSON.stringify(
            {
              success: true,
              configured: true,
              message: "Token already configured",
            },
            null,
            2,
          ),
        );
        return;
      }
    }

    // Get available storage methods
    const availableMethods = await keychain.detectAvailableMethods();

    // Interactive mode
    if (!options.json && !options.method) {
      logger.section("🔐 GitHub Token Setup");
      logger.blank();

      // Show instructions
      const instructions = keychain.generateSetupInstructions(availableMethods);
      for (const line of instructions) {
        logger.log(line);
      }
      logger.blank();

      // Get token from user
      let token = options.token;
      if (!token) {
        const { userToken } = await prompts({
          type: "password",
          name: "userToken",
          message: "Paste your GitHub token (hidden):",
          validate: (value: string) => {
            if (!value) return "Token is required";
            if (!value.startsWith("ghp_") && !value.startsWith("github_pat_")) {
              return "Invalid token format (should start with ghp_ or github_pat_)";
            }
            return true;
          },
        });

        if (!userToken) {
          logger.warn("Setup cancelled.");
          return;
        }
        token = userToken;
      }

      // Validate token unless skipped
      if (!options.skipValidation && token) {
        logger.info("Validating token...");
        const validation = await keychain.validateToken(token);

        if (!validation.valid) {
          logger.error(`Token validation failed: ${validation.message}`);
          logger.info("Please check your token and try again.");
          return;
        }

        logger.success(`✅ Token validated! ${validation.message}`);
        if (validation.scopes && validation.scopes.length > 0) {
          logger.info(`Scopes: ${validation.scopes.join(", ")}`);
        }
      }

      // Ensure we have a token at this point
      if (!token) {
        logger.error("No token provided");
        return;
      }

      // Let user choose storage method
      const methodChoices = availableMethods.map((m) => ({
        title: `${m.description} (${m.security} security)`,
        value: m.method,
        description: `Security: ${m.security}`,
      }));

      const { selectedMethod } = await prompts({
        type: "select",
        name: "selectedMethod",
        message: "Choose storage method:",
        choices: methodChoices,
        initial: 0,
      });

      if (!selectedMethod) {
        logger.warn("Setup cancelled.");
        return;
      }

      // Store the token (we know token is defined here from the check above)
      logger.info("Storing token...");
      const result = await keychain.storeToken(token!, selectedMethod);

      if (result.success) {
        logger.success(`✅ ${result.message}`);
        if (result.instructions) {
          logger.blank();
          for (const instruction of result.instructions) {
            logger.info(instruction);
          }
        }
      } else {
        logger.error(`Failed to store token: ${result.message}`);
      }
    } else {
      // JSON mode or automated mode
      const token = options.token;
      let method = options.method as StorageMethod;

      if (!token) {
        if (options.json) {
          console.log(
            JSON.stringify(
              {
                success: false,
                error: "Token required in non-interactive mode",
              },
              null,
              2,
            ),
          );
        } else {
          logger.error("Token required when using --method flag");
        }
        return;
      }

      if (!method) {
        // Use highest priority available method
        method = availableMethods[0].method;
      }

      // Validate token unless skipped
      if (!options.skipValidation) {
        const validation = await keychain.validateToken(token);
        if (!validation.valid) {
          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  success: false,
                  error: `Token validation failed: ${validation.message}`,
                },
                null,
                2,
              ),
            );
          } else {
            logger.error(`Token validation failed: ${validation.message}`);
          }
          return;
        }
      }

      // Store the token
      const result = await keychain.storeToken(token, method);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: result.success,
              method: result.method,
              location: result.location,
              message: result.message,
              instructions: result.instructions,
            },
            null,
            2,
          ),
        );
      } else {
        if (result.success) {
          logger.success(`✅ ${result.message}`);
          if (result.instructions) {
            for (const instruction of result.instructions) {
              logger.info(instruction);
            }
          }
        } else {
          logger.error(`Failed to store token: ${result.message}`);
        }
      }
    }
  } catch (error: any) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: error.message || "Unknown error",
          },
          null,
          2,
        ),
      );
    } else {
      logger.error(`Setup failed: ${error.message || error}`);
    }
    process.exit(1);
  }
}

/**
 * Main setup command
 */
export async function setupCommand(
  subcommand?: string,
  options: SetupOptions = {},
): Promise<void> {
  // If no subcommand, run the full setup wizard
  if (!subcommand) {
    const orchestrator = new SetupOrchestrator();

    if (options.json) {
      // Run automated setup with JSON output
      const report = await orchestrator.runAutomatedSetup();
      console.log(JSON.stringify(report, null, 2));
    } else {
      // Phase 4.1: --update flag for re-running setup
      if (options.update) {
        logger.info(
          "🔄 Re-running setup wizard to update your configuration...",
        );
        logger.blank();
        await orchestrator.runInteractiveSetup();
        return;
      }

      // Check if user wants to run the wizard or see subcommands
      const { choice } = await prompts({
        type: "select",
        name: "choice",
        message: "What would you like to do?",
        choices: [
          { title: "Run complete setup wizard (recommended)", value: "wizard" },
          { title: "Configure GitHub token only", value: "token" },
          { title: "Show all setup commands", value: "help" },
        ],
        initial: 0,
      });

      if (choice === "wizard") {
        await orchestrator.runInteractiveSetup();
      } else if (choice === "token") {
        await githubTokenSetup(options);
      } else if (choice === "help") {
        logger.section("🚀 gpm Setup");
        logger.blank();
        logger.log("Available setup commands:");
        logger.log("");
        logger.log("  gpm setup              Run complete setup wizard");
        logger.log(
          "  gpm setup --update     Re-run setup to update configuration",
        );
        logger.log(
          "  gpm setup github-token Configure GitHub personal access token",
        );
        logger.log("");
        logger.log("Options:");
        logger.log(
          "  --json                 Output JSON format (automated mode)",
        );
        logger.log(
          "  --update               Re-run setup for existing projects",
        );
        logger.log("");
      } else {
        // User cancelled
        logger.info("Setup cancelled.");
      }
    }
    return;
  }

  // Route to specific setup command
  switch (subcommand) {
    case "github-token":
      await githubTokenSetup(options);
      break;

    default:
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: false,
              error: `Unknown setup command: ${subcommand}`,
            },
            null,
            2,
          ),
        );
      } else {
        logger.error(`Unknown setup command: ${subcommand}`);
        logger.info("Run 'gpm setup' to see available commands.");
      }
      process.exit(1);
  }
}
