import { ExecutionTracker } from "../../src/utils/ExecutionTracker";

describe("ExecutionTracker", () => {
  it("initializes with empty steps and valid timestamps", () => {
    const tracker = new ExecutionTracker();
    const summary = tracker.getSummary();

    expect(Array.isArray(summary.steps)).toBe(true);
    expect(summary.steps.length).toBe(0);
    expect(typeof summary.totalDuration).toBe("number");
    expect(() => new Date(summary.startedAt)).not.toThrow();
    expect(() => new Date(summary.completedAt)).not.toThrow();
  });

  it("logs completed steps with optional duration", () => {
    const tracker = new ExecutionTracker();
    tracker.logCompleted("verification", 1234);
    tracker.logCompleted("create-pr");

    const { steps } = tracker.getSummary();
    expect(steps).toEqual([
      { name: "verification", status: "completed", duration: 1234 },
      { name: "create-pr", status: "completed" },
    ]);
  });

  it("logs skipped steps with reason", () => {
    const tracker = new ExecutionTracker();
    tracker.logSkipped("verification", "--skip-verify flag");

    const { steps } = tracker.getSummary();
    expect(steps[0]).toEqual({
      name: "verification",
      status: "skipped",
      reason: "--skip-verify flag",
    });
  });

  it("logs failed steps with reason", () => {
    const tracker = new ExecutionTracker();
    tracker.logFailed("unknown", "unexpected error");

    const { steps } = tracker.getSummary();
    expect(steps[0]).toEqual({
      name: "unknown",
      status: "failed",
      reason: "unexpected error",
    });
  });

  it("preserves step order", () => {
    const tracker = new ExecutionTracker();
    tracker.logCompleted("verification", 100);
    tracker.logSkipped("security", "--skip-security flag");
    tracker.logCompleted("push", 50);

    const { steps } = tracker.getSummary();
    expect(steps.map((s) => s.name)).toEqual([
      "verification",
      "security",
      "push",
    ]);
  });

  it("computes increasing totalDuration over time", async () => {
    jest.useFakeTimers();
    const tracker = new ExecutionTracker();
    const first = tracker.getSummary().totalDuration;
    jest.advanceTimersByTime(25);
    const second = tracker.getSummary().totalDuration;
    expect(second).toBeGreaterThanOrEqual(first + 20);
    jest.useRealTimers();
  });

  it("startedAt and completedAt are ISO strings", () => {
    const tracker = new ExecutionTracker();
    const { startedAt, completedAt } = tracker.getSummary();
    expect(startedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(completedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("handles multiple completed steps with durations", () => {
    const tracker = new ExecutionTracker();
    tracker.logCompleted("wait-ci", 5000);
    tracker.logCompleted("merge", 2000);
    const { steps } = tracker.getSummary();
    expect(steps.find((s) => s.name === "wait-ci")?.duration).toBe(5000);
    expect(steps.find((s) => s.name === "merge")?.duration).toBe(2000);
  });

  it("allows mixed completed/skipped/failed entries", () => {
    const tracker = new ExecutionTracker();
    tracker.logCompleted("verification");
    tracker.logSkipped("security", "--skip-security flag");
    tracker.logFailed("unknown", "error message");
    const { steps } = tracker.getSummary();
    expect(steps).toHaveLength(3);
    expect(steps[0].status).toBe("completed");
    expect(steps[1].status).toBe("skipped");
    expect(steps[2].status).toBe("failed");
  });

  it("does not mutate internal steps array on getSummary", () => {
    const tracker = new ExecutionTracker();
    tracker.logCompleted("verification");
    const summary = tracker.getSummary();
    // Mutate returned array
    (summary.steps as any).push({ name: "x", status: "completed" });
    // Fetch again and ensure original not affected
    const summary2 = tracker.getSummary();
    expect(summary2.steps).toHaveLength(1);
  });
});
