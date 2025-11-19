// Mock dependencies first
jest.mock("fs");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    outputJsonResult: jest.fn(),
    isJsonMode: jest.fn(() => false),
  },
}));

// Import after mocks
import { docsCommand } from "../../src/commands/docs";
import { logger } from "../../src/utils/logger";
import { existsSync, readFileSync } from "fs";

describe("docs command", () => {
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.log for output
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    // Mock process.exit
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`Process.exit called with code ${code}`);
    }) as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("index mode (no --guide option)", () => {
    it("should display documentation index", async () => {
      await docsCommand({});

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          version: expect.any(String),
          installationPath: expect.any(String),
          availableGuides: expect.arrayContaining([
            expect.objectContaining({
              name: "AI-AGENT-INTEGRATION",
              description: expect.any(String),
              command: expect.any(String),
            }),
          ]),
          paths: expect.objectContaining({
            guides: expect.any(String),
            quickrefs: expect.any(String),
            docs: expect.any(String),
          }),
          links: expect.objectContaining({
            npm: expect.any(String),
            github: expect.any(String),
            issues: expect.any(String),
          }),
        }),
      );
    });

    it("should include all available guides in index", async () => {
      await docsCommand({});

      const callArgs = (logger.outputJsonResult as jest.Mock).mock.calls[0];
      const data = callArgs[1] as any;

      expect(data.availableGuides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "AI-AGENT-INTEGRATION" }),
          expect.objectContaining({ name: "GITHUB-ACTIONS-INTEGRATION" }),
          expect.objectContaining({ name: "JSON-OUTPUT-SCHEMAS" }),
          expect.objectContaining({ name: "CONFIGURATION" }),
          expect.objectContaining({ name: "README" }),
        ]),
      );
    });
  });

  describe("guide mode (with --guide option)", () => {
    it("should display specific guide when found", async () => {
      const mockContent = "# Test Guide\n\nThis is a test guide content.";
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(mockContent);

      await docsCommand({ guide: "README" });

      expect(existsSync).toHaveBeenCalled();
      expect(readFileSync).toHaveBeenCalled();
      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          guide: "README",
          path: expect.any(String),
          found: true,
          contentLength: mockContent.length,
          contentPreview: expect.any(String),
        }),
      );
    });

    it("should include content preview for large guides", async () => {
      const longContent = "a".repeat(1000);
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(longContent);

      await docsCommand({ guide: "AI-AGENT-INTEGRATION" });

      const callArgs = (logger.outputJsonResult as jest.Mock).mock.calls[0];
      const data = callArgs[1] as any;

      expect(data.contentPreview.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(data.contentLength).toBe(1000);
    });

    it("should not truncate short content", async () => {
      const shortContent = "Short guide";
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(shortContent);

      await docsCommand({ guide: "README" });

      const callArgs = (logger.outputJsonResult as jest.Mock).mock.calls[0];
      const data = callArgs[1] as any;

      expect(data.contentPreview).toBe(shortContent);
      expect(data.contentPreview).not.toContain("...");
    });

    it("should error when guide not found", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      await expect(docsCommand({ guide: "NONEXISTENT" })).rejects.toThrow(
        "Process.exit called with code",
      );

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        false,
        null,
        expect.objectContaining({
          code: "ERROR",
          message: expect.stringContaining("Guide not found"),
          suggestions: expect.arrayContaining([
            expect.stringContaining("Available guides"),
          ]),
        }),
      );
    });

    it("should output JSON error with available guides list", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      await expect(docsCommand({ guide: "INVALID" })).rejects.toThrow(
        "Process.exit called with code",
      );

      const callArgs = (logger.outputJsonResult as jest.Mock).mock.calls[0];
      const error = callArgs[2] as any;

      expect(error.suggestions[0]).toContain("AI-AGENT-INTEGRATION");
      expect(error.suggestions[0]).toContain("GITHUB-ACTIONS-INTEGRATION");
      expect(error.suggestions[0]).toContain("JSON-OUTPUT-SCHEMAS");
      expect(error.suggestions[0]).toContain("CONFIGURATION");
      expect(error.suggestions[0]).toContain("README");
    });
  });

  describe("path resolution", () => {
    it("should try multiple possible paths for guides", async () => {
      (existsSync as jest.Mock)
        .mockReturnValueOnce(false) // First path
        .mockReturnValueOnce(true); // Second path

      (readFileSync as jest.Mock).mockReturnValue("Content");

      await docsCommand({ guide: "README" });

      expect(existsSync).toHaveBeenCalledTimes(2);
    });

    it("should check docs/guides directory first", async () => {
      (existsSync as jest.Mock).mockImplementation(((checkPath: any) => {
        // Check for both Unix (docs/guides) and Windows (docs\guides) paths
        const pathStr = String(checkPath);
        return pathStr.includes("docs") && pathStr.includes("guides");
      }) as any);
      (readFileSync as jest.Mock).mockReturnValue("Content");

      await docsCommand({ guide: "AI-AGENT-INTEGRATION" });

      const firstCall = (existsSync as jest.Mock).mock.calls[0][0];
      const firstCallStr = String(firstCall);
      expect(
        firstCallStr.includes("docs") && firstCallStr.includes("guides"),
      ).toBe(true);
    });
  });

  describe("JSON output format", () => {
    it("should include all required fields in guide response", async () => {
      const mockContent = "Test content";
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(mockContent);

      await docsCommand({ guide: "README" });

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          guide: expect.any(String),
          path: expect.any(String),
          found: expect.any(Boolean),
          contentLength: expect.any(Number),
          contentPreview: expect.any(String),
        }),
      );
    });

    it("should include all required fields in index response", async () => {
      await docsCommand({});

      expect(logger.outputJsonResult).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          version: expect.any(String),
          installationPath: expect.any(String),
          availableGuides: expect.any(Array),
          paths: expect.any(Object),
          links: expect.any(Object),
        }),
      );
    });
  });
});
