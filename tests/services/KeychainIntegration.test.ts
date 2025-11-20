import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import {
  KeychainIntegration,
  StorageMethod,
} from "../../src/services/KeychainIntegration";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";

// Mock child_process
jest.mock("child_process");
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Mock fs
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
}));
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<
  typeof writeFileSync
>;

// Mock os
jest.mock("os", () => ({
  homedir: () => "/mock/home",
}));

describe("KeychainIntegration", () => {
  let integration: KeychainIntegration;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new KeychainIntegration();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
  });

  describe("detectAvailableMethods", () => {
    it("should detect macOS Keychain on darwin platform", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });

      const methods = await integration.detectAvailableMethods();

      const macOSKeychain = methods.find(
        (m) => m.method === StorageMethod.KEYCHAIN_MACOS,
      );
      expect(macOSKeychain).toBeDefined();
      expect(macOSKeychain?.available).toBe(true);
      expect(macOSKeychain?.security).toBe("high");
      expect(macOSKeychain?.priority).toBe(1);
    });

    it("should not detect macOS Keychain on non-darwin platforms", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
      });

      const methods = await integration.detectAvailableMethods();

      const macOSKeychain = methods.find(
        (m) => m.method === StorageMethod.KEYCHAIN_MACOS,
      );
      expect(macOSKeychain).toBeUndefined();
    });

    it("should detect keychain helper when script exists", async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes("bin/kc.sh");
      });

      const methods = await integration.detectAvailableMethods();

      const keychainHelper = methods.find(
        (m) => m.method === StorageMethod.KEYCHAIN_HELPER,
      );
      expect(keychainHelper).toBeDefined();
      expect(keychainHelper?.available).toBe(true);
      expect(keychainHelper?.security).toBe("high");
    });

    it("should detect direnv when command exists", async () => {
      mockExecSync.mockReturnValueOnce(Buffer.from("/usr/bin/direnv"));

      const methods = await integration.detectAvailableMethods();

      const direnv = methods.find((m) => m.method === StorageMethod.DIRENV);
      expect(direnv).toBeDefined();
      expect(direnv?.available).toBe(true);
      expect(direnv?.security).toBe("medium");
    });

    it("should always include env file and shell profile options", async () => {
      const methods = await integration.detectAvailableMethods();

      const envFile = methods.find((m) => m.method === StorageMethod.ENV_FILE);
      const shellProfile = methods.find(
        (m) => m.method === StorageMethod.SHELL_PROFILE,
      );

      expect(envFile).toBeDefined();
      expect(envFile?.available).toBe(true);
      expect(shellProfile).toBeDefined();
      expect(shellProfile?.available).toBe(true);
    });

    it("should always include session option", async () => {
      const methods = await integration.detectAvailableMethods();

      const session = methods.find((m) => m.method === StorageMethod.SESSION);
      expect(session).toBeDefined();
      expect(session?.available).toBe(true);
      expect(session?.security).toBe("low");
    });

    it("should sort methods by priority", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue(Buffer.from("/usr/bin/direnv"));

      const methods = await integration.detectAvailableMethods();

      // First method should be highest priority (macOS Keychain = 1)
      expect(methods[0].priority).toBeLessThanOrEqual(methods[1].priority);
    });
  });

  describe("validateToken", () => {
    it("should validate a valid GitHub token", async () => {
      // Mock successful GitHub API response (first call gets user data)
      mockExecSync
        .mockReturnValueOnce(
          JSON.stringify({
            login: "testuser",
          }) as any,
        )
        // Second call gets scopes from headers
        .mockReturnValueOnce("x-oauth-scopes: repo, workflow" as any);

      const result = await integration.validateToken("ghp_validtoken123");

      expect(result.valid).toBe(true);
      expect(result.scopes).toEqual(["repo", "workflow"]);
    });

    it("should reject invalid tokens", async () => {
      // Mock failed API call
      mockExecSync.mockImplementation(() => {
        throw new Error("HTTP 401 Unauthorized");
      });

      const result = await integration.validateToken("invalid_token");

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Token validation failed");
    });

    it("should handle network errors gracefully", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Network error");
      });

      const result = await integration.validateToken("ghp_token");

      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe("retrieveToken", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should retrieve token from GITHUB_TOKEN env var", async () => {
      process.env.GITHUB_TOKEN = "ghp_env_token";

      const token = await integration.retrieveToken();

      expect(token).toBe("ghp_env_token");
    });

    it("should retrieve token from GH_TOKEN env var", async () => {
      process.env.GH_TOKEN = "ghp_gh_token";

      const token = await integration.retrieveToken();

      expect(token).toBe("ghp_gh_token");
    });

    it("should prioritize GITHUB_TOKEN over GH_TOKEN", async () => {
      process.env.GITHUB_TOKEN = "ghp_github_token";
      process.env.GH_TOKEN = "ghp_gh_token";

      const token = await integration.retrieveToken();

      expect(token).toBe("ghp_github_token");
    });

    it("should try macOS Keychain on darwin", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });
      // keychain helper doesn't exist, so it tries macOS Keychain
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockReturnValueOnce("ghp_keychain_token" as any);

      const token = await integration.retrieveToken();

      expect(token).toBe("ghp_keychain_token");
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("security find-generic-password"),
        expect.any(Object),
      );
    });

    it("should try keychain helper when available", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
      });
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes("bin/kc.sh");
      });
      mockExecSync.mockReturnValueOnce("ghp_helper_token" as any);

      const token = await integration.retrieveToken();

      expect(token).toBe("ghp_helper_token");
    });

    it("should try .env file when available", async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes(".env");
      });
      mockReadFileSync.mockReturnValue('GITHUB_TOKEN="ghp_env_file_token"');

      const token = await integration.retrieveToken();

      expect(token).toBe("ghp_env_file_token");
    });

    it("should return null when no token found", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
      });

      const token = await integration.retrieveToken();

      expect(token).toBeNull();
    });
  });

  describe("storeToken", () => {
    it("should store token in macOS Keychain", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });
      mockExecSync.mockReturnValue(Buffer.from(""));

      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.KEYCHAIN_MACOS,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(StorageMethod.KEYCHAIN_MACOS);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("security add-generic-password"),
        expect.any(Object),
      );
    });

    it("should handle keychain storage errors", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });
      mockExecSync.mockImplementation(() => {
        throw new Error("Keychain error");
      });

      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.KEYCHAIN_MACOS,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed");
    });

    it("should store token using keychain helper", async () => {
      mockExistsSync.mockImplementation((path: any) => {
        return path.toString().includes("bin/kc.sh");
      });
      mockExecSync.mockReturnValue(Buffer.from(""));

      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.KEYCHAIN_HELPER,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(StorageMethod.KEYCHAIN_HELPER);
    });

    it("should store token in direnv", async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue(Buffer.from(""));

      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.DIRENV,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(StorageMethod.DIRENV);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("should store token in .env file", async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.ENV_FILE,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(StorageMethod.ENV_FILE);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining(".env"),
        expect.stringContaining("GITHUB_TOKEN="),
      );
    });

    it("should store token in shell profile", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("");

      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.SHELL_PROFILE,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(StorageMethod.SHELL_PROFILE);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("should handle session storage", async () => {
      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.SESSION,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(StorageMethod.SESSION);
      expect(result.instructions).toBeDefined();
      expect(result.instructions?.length).toBeGreaterThan(0);
    });

    it("should provide instructions for session storage", async () => {
      const result = await integration.storeToken(
        "ghp_test",
        StorageMethod.SESSION,
      );

      expect(result.instructions).toContainEqual(
        expect.stringContaining("export GITHUB_TOKEN="),
      );
    });
  });

  describe("generateSetupInstructions", () => {
    it("should generate instructions for available methods", async () => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
      });

      const methods = await integration.detectAvailableMethods();
      const instructions = integration.generateSetupInstructions(methods);

      expect(instructions).toBeInstanceOf(Array);
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some((i) => i.includes("macOS Keychain"))).toBe(true);
    });

    it("should prioritize high-security methods", async () => {
      const methods = await integration.detectAvailableMethods();
      const instructions = integration.generateSetupInstructions(methods);

      // Should properly rank methods by security (high > medium > low)
      const instructionText = instructions.join("\n");

      // Find first security level mentioned (should be the highest available)
      const highIndex = instructionText.indexOf("Security: high");
      const mediumIndex = instructionText.indexOf("Security: medium");
      const lowIndex = instructionText.indexOf("Security: low");

      // If high security exists, it should come before medium and low
      if (highIndex !== -1) {
        if (mediumIndex !== -1) {
          expect(highIndex).toBeLessThan(mediumIndex);
        }
        if (lowIndex !== -1) {
          expect(highIndex).toBeLessThan(lowIndex);
        }
      }

      // Medium should come before low (both are always available)
      if (mediumIndex !== -1 && lowIndex !== -1) {
        expect(mediumIndex).toBeLessThan(lowIndex);
      }
    });

    it("should include token generation instructions", async () => {
      const methods = await integration.detectAvailableMethods();
      const instructions = integration.generateSetupInstructions(methods);

      const hasTokenGeneration = instructions.some((i) =>
        i.includes("github.com/settings/tokens"),
      );
      expect(hasTokenGeneration).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty token gracefully", async () => {
      const result = await integration.validateToken("");

      expect(result.valid).toBe(false);
    });

    it("should handle very long tokens", async () => {
      const longToken = "ghp_" + "a".repeat(1000);
      mockExecSync.mockReturnValue(Buffer.from(JSON.stringify({ scopes: [] })));

      const result = await integration.validateToken(longToken);

      expect(result).toBeDefined();
    });

    it("should handle special characters in tokens", async () => {
      const specialToken = "ghp_test!@#$%^&*()";
      mockExecSync.mockImplementation(() => {
        throw new Error("Invalid");
      });

      const result = await integration.validateToken(specialToken);

      expect(result.valid).toBe(false);
    });
  });
});
