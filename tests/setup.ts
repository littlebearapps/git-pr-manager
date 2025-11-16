/**
 * Global test setup file
 * Ensures proper cleanup of timers and resources after each test
 */

// Global afterEach hook to clean up timers and prevent memory leaks
afterEach(() => {
  // Clear all timers to prevent hanging processes
  jest.clearAllTimers();

  // Restore real timers if fake timers were used
  // This is safe to call even if fake timers weren't used
  jest.useRealTimers();

  // Clear all mocks to prevent state leakage between tests
  jest.clearAllMocks();
});
