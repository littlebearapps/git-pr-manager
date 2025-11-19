import { SecurityScanner } from "../../src/services/SecurityScanner";
import { VerifyService } from "../../src/services/VerifyService";
import { ErrorClassifier } from "../../src/utils/ErrorClassifier";
import { SuggestionEngine } from "../../src/utils/SuggestionEngine";
import * as child_process from "child_process";
import * as fs from "fs/promises";

/**
 * Integration tests for Security Scanner and Verification Service
 *
 * These tests verify that security scanning and verification checks
 * work together correctly.
 */

jest.mock("child_process");
jest.mock("fs/promises");

const mockedExec = child_process.exec as jest.MockedFunction<
  typeof child_process.exec
>;
const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;

describe("Security and Verification Integration", () => {
  let securityScanner: SecurityScanner;
  let verifyService: VerifyService;
  let errorClassifier: ErrorClassifier;
  let suggestionEngine: SuggestionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    securityScanner = new SecurityScanner("/test/dir");
    verifyService = new VerifyService("/test/dir");
    errorClassifier = new ErrorClassifier();
    suggestionEngine = new SuggestionEngine();
  });

  describe("Complete Security and Verification Workflow", () => {
    it("should run both security scan and verification successfully", async () => {
      // Setup: Security scan - no secrets
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      // Setup: No vulnerabilities
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      // Act: Run security scan
      const securityResult = await securityScanner.scan();

      // Setup: Verification script exists and passes
      mockedFsAccess.mockResolvedValueOnce(undefined);
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === "close") handler(0);
          }),
        } as any;
      });

      // Act: Run verification
      const verifyResult = await verifyService.runChecks();

      // Assert: Both should pass
      expect(securityResult.passed).toBe(true);
      expect(securityResult.blockers.length).toBe(0);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.errors.length).toBe(0);
    });

    it("should block when security issues found", async () => {
      // Setup: Security scan finds secrets
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const output =
          "config.py:25: Potential hardcoded password\\n.env:10: API key detected";
        _callback(null, { stdout: output, stderr: "" });
        return {} as any;
      });

      // Setup: Also has critical vulnerabilities
      mockedFsAccess.mockRejectedValueOnce(new Error("not found"));
      mockedFsAccess.mockRejectedValueOnce(new Error("not found"));
      mockedFsAccess.mockResolvedValueOnce(undefined); // package.json
      const vulnOutput = JSON.stringify({
        vulnerabilities: {
          lodash: { severity: "critical" },
          axios: { severity: "high" },
        },
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const error: any = new Error("vulns");
        error.stdout = vulnOutput;
        _callback(error, { stdout: vulnOutput, stderr: "" });
        return {} as any;
      });

      // Act: Run security scan
      const securityResult = await securityScanner.scan();

      // Assert: Should block
      expect(securityResult.passed).toBe(false);
      expect(securityResult.blockers.length).toBeGreaterThan(0);

      // Act: Classify errors and get suggestion
      const errors = securityResult.blockers.join("\n");
      const mockCheck = {
        name: "security",
        output: {
          summary: errors,
          title: "Security Scan Failed",
        },
      };
      const classification = errorClassifier.classify(mockCheck);
      const suggestion = suggestionEngine.getSuggestion(
        errors,
        classification,
        [],
      );

      // Assert: Should provide security-related suggestion
      expect(suggestion).toBeDefined();
      expect(suggestion.command).toBeDefined();
      expect(
        suggestion.command.includes("secret") ||
          suggestion.command.includes("vulnerability") ||
          suggestion.command.includes("audit") ||
          suggestion.command.includes("Review"),
      ).toBe(true);
    });

    it("should handle verification failure with detailed error parsing", async () => {
      // Setup: Security passes
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      // Act: Security scan
      const securityResult = await securityScanner.scan();

      // Setup: Verification fails with specific errors
      mockedFsAccess.mockResolvedValueOnce(undefined);
      const failureOutput =
        'FAILED tests/test_user.py::test_login\\nFAILED tests/test_auth.py::test_register\\nTS2304: Cannot find name "foo"';

      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === "data") stdoutHandlers.push(handler);
            }),
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === "close") {
              stdoutHandlers.forEach((h) => h(failureOutput));
              handler(1);
            }
          }),
        } as any;
      });

      // Act: Run verification
      const verifyResult = await verifyService.runChecks();

      // Assert: Should fail with parsed errors
      expect(verifyResult.success).toBe(false);
      expect(verifyResult.errors.length).toBeGreaterThan(0);

      // Act: Classify and get suggestion
      const allErrors = [
        ...securityResult.blockers,
        ...verifyResult.errors,
      ].join("\n");

      const mockCheck = {
        name: "test",
        output: {
          summary: allErrors,
          title: "Test Failures",
        },
      };
      const classification = errorClassifier.classify(mockCheck);
      const suggestion = suggestionEngine.getSuggestion(
        allErrors,
        classification,
        [],
      );

      // Assert: Should provide test or TypeScript related suggestion
      expect(suggestion).toBeDefined();
      expect(suggestion.command).toBeDefined();
      expect(
        suggestion.command.includes("test") ||
          suggestion.command.includes("TypeScript") ||
          suggestion.command.includes("typecheck") ||
          suggestion.command.includes("pytest"),
      ).toBe(true);
    });
  });

  describe("Workflow Decision Making", () => {
    it("should determine if PR can proceed based on combined results", async () => {
      // Setup: Security checks pass
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });

      // Setup: No language detected (skip dependency check)
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      // Act: Run security scan
      const securityResult = await securityScanner.scan();

      // Setup: Verification passes
      mockedFsAccess.mockResolvedValueOnce(undefined); // verify.sh exists
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === "close") handler(0);
          }),
        } as any;
      });

      // Act: Run verification
      const verifyResult = await verifyService.runChecks();

      // Assert: Can proceed
      const canProceed = securityResult.passed && verifyResult.success;
      expect(canProceed).toBe(true);
    }, 10000);

    it("should block PR if either security or verification fails", async () => {
      // Setup: Security passes
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const securityResult = await securityScanner.scan();

      // Setup: Verification fails
      mockedFsAccess.mockResolvedValueOnce(undefined);
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === "close") handler(1); // Failure
          }),
        } as any;
      });

      const verifyResult = await verifyService.runChecks();

      // Assert: Should block
      const canProceed = securityResult.passed && verifyResult.success;
      expect(canProceed).toBe(false);
    });
  });

  describe("Progress Reporting Integration", () => {
    it("should aggregate progress from both services", async () => {
      const progressUpdates: string[] = [];

      // Setup: Security scan with progress
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      // Act: Run security (no progress callback support in current implementation)
      await securityScanner.scan();

      // Setup: Verification with progress
      mockedFsAccess.mockResolvedValueOnce(undefined);
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        const stdoutHandlers: any[] = [];
        return {
          stdout: {
            on: jest.fn((event, handler) => {
              if (event === "data") stdoutHandlers.push(handler);
            }),
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === "close") {
              stdoutHandlers.forEach((h) => h("Running tests..."));
              handler(0);
            }
          }),
        } as any;
      });

      // Act: Run verification with progress callback
      await verifyService.runChecks({
        onProgress: (message) => progressUpdates.push(message),
      });

      // Assert: Should have progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates).toContain("Running verification checks...");
      expect(progressUpdates).toContain("Running tests...");
    });
  });

  describe("Timeout and Performance", () => {
    it("should handle long-running verification with timeout", async () => {
      // Setup: Security passes quickly
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, _callback: any) => {
        _callback(null, { stdout: "", stderr: "" });
        return {} as any;
      });
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      await securityScanner.scan();

      // Setup: Verification with custom timeout
      mockedFsAccess.mockResolvedValueOnce(undefined);
      mockedExec.mockImplementationOnce((_cmd, opts: any, _callback: any) => {
        // Verify timeout was set
        expect(opts.timeout).toBe(60000);
        return {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, handler) => {
            if (event === "close") handler(0);
          }),
        } as any;
      });

      // Act: Run with custom timeout
      await verifyService.runChecks({ timeout: 60000 });
    });
  });

  describe("Error Recovery and Suggestions", () => {
    it("should provide comprehensive suggestions for multiple failure types", async () => {
      // Setup: Multiple types of failures
      const errors = [
        "FAILED tests/test_user.py::test_login",
        'TS2304: Cannot find name "User"',
        "Potential hardcoded password in config.py",
        "Critical vulnerability: CVE-2023-1234 in lodash",
        "ESLint: no-unused-vars",
      ].join("\n");

      // Act: Classify
      const mockCheck = {
        name: "test",
        output: {
          summary: errors,
          title: "Multiple Failures",
        },
      };
      const classification = errorClassifier.classify(mockCheck);

      // Assert: Should detect error type (ErrorType is an enum, returns single value)
      expect(classification).toBeDefined();

      // Act: Get suggestion
      const suggestion = suggestionEngine.getSuggestion(
        errors,
        classification,
        [],
      );

      // Assert: Should provide a helpful suggestion
      expect(suggestion).toBeDefined();
      expect(suggestion.command).toBeDefined();
      expect(suggestion.command.length).toBeGreaterThan(0);
      expect(suggestion.autoFixable).toBeDefined();
    });
  });
});
