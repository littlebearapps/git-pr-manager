import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { ToolDetector } from "../../src/services/ToolDetector";
import { execSync } from "child_process";

// Mock child_process
jest.mock("child_process");
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Mock fs for package.json reading
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Import after mock is set up and type cast to mocked version
import * as fs from "fs";
const mockFs = fs as jest.Mocked<typeof fs>;

describe("ToolDetector", () => {
  let detector: ToolDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new ToolDetector();

    // Default: no lock files exist
    mockFs.existsSync.mockReturnValue(false);
  });

  describe("detectInstalledTools", () => {
    it("should detect installed required tools", async () => {
      mockExecSync
        .mockReturnValueOnce("git version 2.51.0" as any) // git
        .mockReturnValueOnce("v20.10.0" as any) // node
        .mockReturnValueOnce("11.6.0" as any) // npm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // yarn
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pnpm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // bun
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // gh
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // detect-secrets
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pip-audit
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // eslint
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // prettier
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // typescript
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }); // jest

      const tools = await detector.detectInstalledTools();

      const gitTool = tools.find((t) => t.name === "git");
      const nodeTool = tools.find((t) => t.name === "node");

      expect(gitTool).toBeDefined();
      expect(gitTool?.status).toBe("ok");
      expect(gitTool?.version).toBe("2.51.0");

      expect(nodeTool).toBeDefined();
      expect(nodeTool?.status).toBe("ok");
      expect(nodeTool?.version).toBe("20.10.0");
    });

    it("should detect missing optional tools", async () => {
      // Required tools present
      mockExecSync
        .mockReturnValueOnce("git version 2.51.0" as any) // git
        .mockReturnValueOnce("v20.10.0" as any) // node
        .mockReturnValueOnce("11.6.0" as any) // npm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // yarn
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pnpm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // bun
        .mockImplementationOnce(() => {
          throw new Error("Command not found");
        }) // gh - missing
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // detect-secrets
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pip-audit
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // eslint
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // prettier
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // typescript
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }); // jest

      const tools = await detector.detectInstalledTools();

      const ghTool = tools.find((t) => t.name === "gh");
      expect(ghTool).toBeDefined();
      expect(ghTool?.status).toBe("missing");
      expect(ghTool?.recommendedAction).toContain("https://cli.github.com/");
    });

    it("should handle tool detection errors gracefully", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Command execution failed");
      });

      const tools = await detector.detectInstalledTools();

      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((t) => t.status === "missing")).toBe(true);
    });
  });

  describe("checkToolVersion", () => {
    it("should extract version from git output", async () => {
      mockExecSync.mockReturnValue("git version 2.51.0" as any);

      const version = await detector.checkToolVersion("git");

      expect(version.installed).toBe(true);
      expect(version.version).toBe("2.51.0");
    });

    it("should extract version from node output", async () => {
      mockExecSync.mockReturnValue("v20.10.0" as any);

      const version = await detector.checkToolVersion("node");

      expect(version.installed).toBe(true);
      expect(version.version).toBe("20.10.0");
    });

    it("should handle missing tools", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Command not found");
      });

      const version = await detector.checkToolVersion("nonexistent");

      expect(version.installed).toBe(false);
      expect(version.version).toBeNull();
    });

    it("should handle version detection with npm packages", async () => {
      // Mock eslint version check
      mockExecSync.mockReturnValue("v8.57.0" as any);

      const version = await detector.checkToolVersion("eslint");

      expect(version.installed).toBe(true);
      expect(version.version).toBe("8.57.0");
    });
  });

  describe("detectPackageManager", () => {
    it("should detect npm from package-lock.json", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("package-lock.json");
      });

      const pkgMgr = await detector.detectPackageManager();

      expect(pkgMgr).toBeDefined();
      expect(pkgMgr?.type).toBe("npm");
      expect(pkgMgr?.lockFile).toBe("package-lock.json");
    });

    it("should detect yarn from yarn.lock", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("yarn.lock");
      });

      const pkgMgr = await detector.detectPackageManager();

      expect(pkgMgr).toBeDefined();
      expect(pkgMgr?.type).toBe("yarn");
      expect(pkgMgr?.lockFile).toBe("yarn.lock");
    });

    it("should detect pnpm from pnpm-lock.yaml", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("pnpm-lock.yaml");
      });

      const pkgMgr = await detector.detectPackageManager();

      expect(pkgMgr).toBeDefined();
      expect(pkgMgr?.type).toBe("pnpm");
      expect(pkgMgr?.lockFile).toBe("pnpm-lock.yaml");
    });

    it("should detect bun from bun.lockb", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("bun.lockb");
      });

      const pkgMgr = await detector.detectPackageManager();

      expect(pkgMgr).toBeDefined();
      expect(pkgMgr?.type).toBe("bun");
      expect(pkgMgr?.lockFile).toBe("bun.lockb");
    });

    it("should return null when no lock file found", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const pkgMgr = await detector.detectPackageManager();

      expect(pkgMgr).toBeNull();
    });

    it("should prioritize bun over other package managers", async () => {
      // All lock files present
      mockFs.existsSync.mockReturnValue(true);

      const pkgMgr = await detector.detectPackageManager();

      // bun should be detected first (checked before pnpm, yarn, npm)
      expect(pkgMgr?.type).toBe("bun");
    });
  });

  describe("detectLanguage", () => {
    it("should detect Node.js from package.json", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("package.json");
      });

      const language = await detector.detectLanguage();

      expect(language.primary).toBe("nodejs");
      expect(language.confidence).toBeGreaterThanOrEqual(90);
    });

    it("should detect Python from requirements.txt", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("requirements.txt");
      });

      const language = await detector.detectLanguage();

      expect(language.primary).toBe("python");
      expect(language.confidence).toBeGreaterThanOrEqual(80);
    });

    it("should detect Go from go.mod", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("go.mod");
      });

      const language = await detector.detectLanguage();

      expect(language.primary).toBe("go");
      expect(language.confidence).toBeGreaterThanOrEqual(95);
    });

    it("should detect Rust from Cargo.toml", async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.toString().includes("Cargo.toml");
      });

      const language = await detector.detectLanguage();

      expect(language.primary).toBe("rust");
      expect(language.confidence).toBeGreaterThanOrEqual(95);
    });

    it("should default to nodejs when no language markers found", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const language = await detector.detectLanguage();

      // Defaults to nodejs when no markers found
      expect(language.primary).toBe("nodejs");
      expect(language.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkPackageScripts", () => {
    it("should detect npm scripts from package.json", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          scripts: {
            test: "jest",
            lint: "eslint .",
            build: "tsc",
          },
        }),
      );

      const scripts = await detector.checkPackageScripts();

      const testScript = scripts.find((s) => s.id === "script.test");
      const lintScript = scripts.find((s) => s.id === "script.lint");
      const buildScript = scripts.find((s) => s.id === "script.build");

      expect(testScript?.status).toBe("ok");
      expect(lintScript?.status).toBe("ok");
      expect(buildScript?.status).toBe("ok");
    });

    it("should detect missing scripts", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          scripts: {
            test: "jest",
          },
        }),
      );

      const scripts = await detector.checkPackageScripts();

      const formatScript = scripts.find((s) => s.id === "script.format");
      expect(formatScript?.status).toBe("missing");
      expect(formatScript?.recommendedAction).toContain("add-script");
    });

    it("should return missing status when package.json not found", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const scripts = await detector.checkPackageScripts();

      expect(scripts).toBeInstanceOf(Array);
      expect(scripts.length).toBeGreaterThan(0);
      const packageJsonCheck = scripts.find((s) => s.id === "package.json");
      expect(packageJsonCheck?.status).toBe("missing");
    });
  });

  describe("checkGitHubToken", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should detect GITHUB_TOKEN", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token";

      const check = await detector.checkGitHubToken();

      expect(check.status).toBe("ok");
      expect(check.details).toContain("GITHUB_TOKEN");
    });

    it("should detect GH_TOKEN", async () => {
      delete process.env.GITHUB_TOKEN;
      process.env.GH_TOKEN = "ghp_test_token";

      const check = await detector.checkGitHubToken();

      expect(check.status).toBe("ok");
      expect(check.details).toContain("GH_TOKEN");
    });

    it("should return missing when no token found", async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      const check = await detector.checkGitHubToken();

      expect(check.status).toBe("missing");
      expect(check.recommendedAction).toContain("setup");
    });
  });

  describe("generateDoctorResponse", () => {
    it("should generate comprehensive doctor response", async () => {
      // Mock all tools being checked
      mockExecSync
        .mockReturnValueOnce("git version 2.51.0" as any) // git
        .mockReturnValueOnce("v20.10.0" as any) // node
        .mockReturnValueOnce("11.6.0" as any) // npm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // yarn
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pnpm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // bun
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // gh
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // detect-secrets
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pip-audit
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // eslint
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // prettier
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // typescript
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }); // jest

      // Mock package.json
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          scripts: {
            test: "jest",
            lint: "eslint .",
          },
        }),
      );

      // Mock GitHub token
      process.env.GITHUB_TOKEN = "ghp_test";

      const response = await detector.generateDoctorResponse("1.9.0");

      expect(response.status).toBeDefined();
      expect(response.checks).toBeInstanceOf(Array);
      expect(response.checks.length).toBeGreaterThan(0);

      const gitCheck = response.checks.find((c) => c.id === "tool.git");
      expect(gitCheck).toBeDefined();
      expect(gitCheck?.status).toBe("ok");
    });

    it("should include missing status when tools not found", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not found");
      });
      mockFs.existsSync.mockReturnValue(false);

      const response = await detector.generateDoctorResponse("1.9.0");

      const missingChecks = response.checks.filter(
        (c) => c.status === "missing",
      );
      expect(missingChecks.length).toBeGreaterThan(0);
    });

    it("should return warnings status when optional tools missing", async () => {
      // Required tools present, optional tools missing
      mockExecSync
        .mockReturnValueOnce("git version 2.51.0" as any) // git
        .mockReturnValueOnce("v20.10.0" as any) // node
        .mockReturnValueOnce("11.6.0" as any) // npm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // yarn
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pnpm
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // bun
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // gh
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // detect-secrets
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // pip-audit
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // eslint
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // prettier
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }) // typescript
        .mockImplementationOnce(() => {
          throw new Error("not found");
        }); // jest

      mockFs.existsSync.mockReturnValue(false);

      const response = await detector.generateDoctorResponse("1.9.0");

      expect(response.status).toBe("warnings");
    });
  });
});
