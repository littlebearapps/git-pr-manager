import { ConfigService } from "../../src/services/ConfigService";
import * as fs from "fs/promises";
import * as yaml from "yaml";
import * as path from "path";

// Mock dependencies
jest.mock("fs/promises");
jest.mock("yaml");

const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockedFsWriteFile = fs.writeFile as jest.MockedFunction<
  typeof fs.writeFile
>;
const mockedYamlParse = yaml.parse as jest.MockedFunction<typeof yaml.parse>;
const mockedYamlStringify = yaml.stringify as jest.MockedFunction<
  typeof yaml.stringify
>;

describe("ConfigService", () => {
  let configService: ConfigService;
  const testDir = path.resolve("/test/dir");

  beforeEach(() => {
    jest.clearAllMocks();
    configService = new ConfigService(testDir);
  });

  describe("load", () => {
    it("should return default config when file does not exist", async () => {
      mockedFsAccess.mockRejectedValue(new Error("File not found"));

      const config = await configService.load();

      expect(config.branchProtection?.enabled).toBe(false);
      expect(config.ci?.waitForChecks).toBe(true);
      expect(config.security?.scanSecrets).toBe(true);
    });

    it("should load and parse config file", async () => {
      const mockConfig = {
        branchProtection: {
          enabled: true,
          requireReviews: 2,
          requireStatusChecks: ["ci", "test"],
          enforceAdmins: true,
        },
        ci: {
          waitForChecks: true,
          failFast: false,
          retryFlaky: true,
          timeout: 60,
        },
        security: {
          scanSecrets: true,
          scanDependencies: true,
          allowedVulnerabilities: ["CVE-2023-1234"],
        },
        pr: {
          templatePath: ".github/PULL_REQUEST_TEMPLATE.md",
          autoAssign: ["reviewer1"],
          autoLabel: ["needs-review"],
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue("config content");
      mockedYamlParse.mockReturnValue(mockConfig);

      const config = await configService.load();

      expect(config.branchProtection?.enabled).toBe(true);
      expect(config.branchProtection?.requireReviews).toBe(2);
      expect(config.ci?.timeout).toBe(60);
      expect(config.security?.allowedVulnerabilities).toEqual([
        "CVE-2023-1234",
      ]);
    });

    it("should cache loaded config on subsequent calls", async () => {
      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue("config content");
      mockedYamlParse.mockReturnValue({});

      await configService.load();
      await configService.load();

      expect(mockedFsReadFile).toHaveBeenCalledTimes(1);
    });

    it("should throw error on parse failure", async () => {
      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue("invalid yaml");
      mockedYamlParse.mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      await expect(configService.load()).rejects.toThrow(
        "Failed to load config",
      );
    });

    it("should merge partial config with defaults", async () => {
      const partialConfig = {
        branchProtection: {
          enabled: true,
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue("config content");
      mockedYamlParse.mockReturnValue(partialConfig);

      const config = await configService.load();

      // Should have default values for missing fields
      expect(config.branchProtection?.enabled).toBe(true);
      expect(config.branchProtection?.requireReviews).toBe(0);
      expect(config.ci?.waitForChecks).toBe(true);
    });
  });

  describe("save", () => {
    it("should save config as YAML", async () => {
      const configToSave = {
        branchProtection: {
          enabled: true,
          requireReviews: 1,
          requireStatusChecks: ["test"],
          enforceAdmins: false,
        },
        ci: {
          waitForChecks: true,
          failFast: true,
          retryFlaky: false,
          timeout: 30,
        },
        security: {
          scanSecrets: true,
          scanDependencies: true,
          allowedVulnerabilities: [],
        },
        pr: {
          autoAssign: [],
          autoLabel: [],
        },
      };

      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.save(configToSave);

      expect(mockedYamlStringify).toHaveBeenCalledWith(configToSave, {
        indent: 2,
        lineWidth: 0,
      });
      expect(mockedFsWriteFile).toHaveBeenCalledWith(
        path.join(testDir, ".gpm.yml"),
        "yaml content",
        "utf-8",
      );
    });

    it("should throw error on write failure", async () => {
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockRejectedValue(new Error("Permission denied"));

      await expect(configService.save({} as any)).rejects.toThrow(
        "Failed to save config",
      );
    });
  });

  describe("exists", () => {
    it("should return true when config file exists", async () => {
      mockedFsAccess.mockResolvedValue(undefined);

      const exists = await configService.exists();

      expect(exists).toBe(true);
    });

    it("should return false when config file does not exist", async () => {
      mockedFsAccess.mockRejectedValue(new Error("File not found"));

      const exists = await configService.exists();

      expect(exists).toBe(false);
    });
  });

  describe("init", () => {
    it("should throw error if config already exists", async () => {
      mockedFsAccess.mockResolvedValue(undefined);

      await expect(configService.init()).rejects.toThrow(
        "Config file already exists",
      );
    });

    it("should initialize with basic template by default", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.init("basic");

      expect(mockedFsWriteFile).toHaveBeenCalled();
      // Verify YAML content contains expected values (second argument is content)
      const savedYaml = mockedFsWriteFile.mock.calls[0][1];
      expect(savedYaml).toContain("enabled: false"); // branchProtection.enabled
      expect(savedYaml).toContain("💡 AI Agent Guidance"); // Contains AI guidance comments
      expect(savedYaml).toContain("gpm ship"); // Contains workflow suggestions
    });

    it("should initialize with standard template", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.init("standard");

      // Verify YAML content contains expected values (second argument is content)
      const savedYaml = mockedFsWriteFile.mock.calls[0][1];
      expect(savedYaml).toContain("enabled: true"); // branchProtection.enabled
      expect(savedYaml).toContain("requireReviews: 0"); // branchProtection.requireReviews
      expect(savedYaml).toContain("- test"); // requireStatusChecks contains 'test'
      expect(savedYaml).toContain("💡 AI Agent Guidance"); // Contains AI guidance comments
    });

    it("should initialize with strict template", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.init("strict");

      // Verify YAML content contains expected values (second argument is content)
      const savedYaml = mockedFsWriteFile.mock.calls[0][1];
      expect(savedYaml).toContain("enabled: true"); // branchProtection.enabled
      expect(savedYaml).toContain("requireReviews: 1"); // branchProtection.requireReviews
      expect(savedYaml).toContain("enforceAdmins: true"); // branchProtection.enforceAdmins
      expect(savedYaml).toContain("retryFlaky: true"); // ci.retryFlaky
      expect(savedYaml).toContain("💡 AI Agent Guidance"); // Contains AI guidance comments
    });
  });

  describe("get", () => {
    it("should get specific config value", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const ciConfig = await configService.get("ci");

      expect(ciConfig?.waitForChecks).toBe(true);
      expect(ciConfig?.timeout).toBe(30);
    });

    it("should return undefined for non-existent key", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const value = await configService.get("unknownKey" as any);

      expect(value).toBeUndefined();
    });
  });

  describe("set", () => {
    it("should set specific config value", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.set("ci", {
        waitForChecks: false,
        failFast: false,
        retryFlaky: true,
        timeout: 60,
      });

      expect(mockedFsWriteFile).toHaveBeenCalled();
      const savedConfig = mockedYamlStringify.mock.calls[0][0];
      expect(savedConfig.ci.waitForChecks).toBe(false);
      expect(savedConfig.ci.timeout).toBe(60);
    });
  });

  describe("reset", () => {
    it("should reset config to defaults", async () => {
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.reset();

      const savedConfig = mockedYamlStringify.mock.calls[0][0];
      expect(savedConfig.branchProtection.enabled).toBe(false);
      expect(savedConfig.ci.waitForChecks).toBe(true);
      expect(savedConfig.security.scanSecrets).toBe(true);
    });
  });

  describe("validate", () => {
    it("should validate correct config", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const result = await configService.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid CI timeout (too low)", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.set("ci", {
        waitForChecks: true,
        failFast: true,
        retryFlaky: false,
        timeout: 0.5, // Less than 1 minute, but truthy
      });

      const result = await configService.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("CI timeout must be at least 1 minute");
    });

    it("should detect invalid CI timeout (too high)", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      await configService.set("ci", {
        waitForChecks: true,
        failFast: true,
        retryFlaky: false,
        timeout: 150,
      });

      const result = await configService.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("CI timeout must be at most 120 minutes");
    });

    it("should detect negative required reviews", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      await configService.set("branchProtection", {
        enabled: true,
        requireReviews: -1,
        requireStatusChecks: [],
        enforceAdmins: false,
      });

      const result = await configService.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required reviews must be non-negative");
    });

    it("should detect too many required reviews", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      await configService.set("branchProtection", {
        enabled: true,
        requireReviews: 10,
        requireStatusChecks: [],
        enforceAdmins: false,
      });

      const result = await configService.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required reviews must be at most 6");
    });

    it("should accumulate multiple errors", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      // Set CI config with invalid timeout
      await configService.set("ci", {
        waitForChecks: true,
        failFast: true,
        retryFlaky: false,
        timeout: 0.5, // Less than 1 minute, but truthy
      });

      // Get current config
      const config = await configService.getConfig();

      // Update branch protection with invalid reviews
      config.branchProtection = {
        enabled: true,
        requireReviews: -1,
        requireStatusChecks: [],
        enforceAdmins: false,
      };

      await configService.save(config);

      const result = await configService.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getConfig", () => {
    it("should return full config", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const config = await configService.getConfig();

      expect(config).toHaveProperty("branchProtection");
      expect(config).toHaveProperty("ci");
      expect(config).toHaveProperty("security");
      expect(config).toHaveProperty("pr");
    });
  });

  // Phase 1a: Multi-language verification config tests
  describe("verification config", () => {
    it("should include verification config in default config", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const config = await configService.load();

      expect(config.verification).toBeDefined();
      expect(config.verification?.detectionEnabled).toBe(true);
      expect(config.verification?.preferMakefile).toBe(true);
    });

    it("should merge verification config from file", async () => {
      const mockConfig = {
        branchProtection: {
          enabled: false,
          requireReviews: 0,
          requireStatusChecks: [],
          enforceAdmins: false,
        },
        verification: {
          detectionEnabled: false,
          preferMakefile: false,
          commands: {
            lint: "custom-lint",
            test: "custom-test",
          },
        },
      };

      mockedFsAccess.mockResolvedValue(undefined);
      mockedFsReadFile.mockResolvedValue("yaml content");
      mockedYamlParse.mockReturnValue(mockConfig);

      const config = await configService.load();

      expect(config.verification?.detectionEnabled).toBe(false);
      expect(config.verification?.preferMakefile).toBe(false);
      expect(config.verification?.commands?.lint).toBe("custom-lint");
      expect(config.verification?.commands?.test).toBe("custom-test");
    });

    it("should include verification in generated YAML", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      await configService.init("basic");

      // Verify writeFile was called
      expect(mockedFsWriteFile).toHaveBeenCalled();

      // Get the YAML content that was written
      const yamlContent = mockedFsWriteFile.mock.calls[0][1] as string;

      // Verify verification section is included
      expect(yamlContent).toContain("# Multi-Language Verification (Phase 1a)");
      expect(yamlContent).toContain("verification:");
      expect(yamlContent).toContain("detectionEnabled:");
      expect(yamlContent).toContain("preferMakefile:");
    });

    it("should allow verification config set/get", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));
      mockedYamlStringify.mockReturnValue("yaml content");
      mockedFsWriteFile.mockResolvedValue(undefined);

      // Set verification config
      await configService.set("verification", {
        detectionEnabled: false,
        preferMakefile: true,
        commands: {
          lint: "make lint",
          test: "make test",
        },
      });

      // Get verification config
      const verification = await configService.get("verification");

      expect(verification?.detectionEnabled).toBe(false);
      expect(verification?.preferMakefile).toBe(true);
      expect(verification?.commands?.lint).toBe("make lint");
    });

    it("should return full config with verification", async () => {
      mockedFsAccess.mockRejectedValue(new Error("not found"));

      const config = await configService.getConfig();

      expect(config).toHaveProperty("branchProtection");
      expect(config).toHaveProperty("ci");
      expect(config).toHaveProperty("security");
      expect(config).toHaveProperty("pr");
      expect(config).toHaveProperty("verification");
      expect(config.verification).toHaveProperty("detectionEnabled");
      expect(config.verification).toHaveProperty("preferMakefile");
    });
  });
});
