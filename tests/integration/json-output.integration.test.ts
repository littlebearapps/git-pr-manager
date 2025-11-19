// Minimal integration-style tests for JSON output contract
// Focus on commands that can run with light mocking (docs, status)

jest.mock("../../src/utils/spinner", () => ({
  spinner: {
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
    update: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("../../src/services/GitService");
jest.mock("../../src/services/ConfigService");

import { docsCommand } from "../../src/commands/docs";
import { statusCommand } from "../../src/commands/status";
import { logger } from "../../src/utils/logger";
import { GitService } from "../../src/services/GitService";
import { ConfigService } from "../../src/services/ConfigService";

describe("JSON output contract", () => {
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (logger as any).setJsonMode(true);
    writeSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true as any);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("docs (guide) emits exactly one JSON object + newline", async () => {
    await docsCommand({ guide: "README" });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const arg = writeSpy.mock.calls[0][0];
    // Single line JSON + trailing newline
    const lines = String(arg).split("\n");
    expect(lines.length).toBe(2);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it("status emits exactly one JSON object + newline", async () => {
    const mockGit = {
      getBranchInfo: jest
        .fn()
        .mockResolvedValue({ current: "feature/test", isClean: true }),
      getStatus: jest
        .fn()
        .mockResolvedValue({
          modified: [],
          created: [],
          deleted: [],
          not_added: [],
        }),
    } as any;
    (GitService as unknown as jest.Mock).mockImplementation(() => mockGit);

    const mockConfig = {
      exists: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockResolvedValue({
        ci: { waitForChecks: true, failFast: true },
        security: { scanSecrets: true },
        branchProtection: { enabled: true },
      }),
    } as any;
    (ConfigService as unknown as jest.Mock).mockImplementation(
      () => mockConfig,
    );

    await statusCommand();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const arg = writeSpy.mock.calls[0][0];
    const lines = String(arg).split("\n");
    expect(lines.length).toBe(2);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });
});
