import ora, { Ora } from "ora";

/**
 * Spinner utility for showing progress
 */
export class Spinner {
  private spinner: Ora | null = null;

  /**
   * Start a spinner with a message
   */
  start(message: string): void {
    this.spinner = ora(message).start();
  }

  /**
   * Update spinner text
   */
  update(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Mark spinner as succeeded
   */
  succeed(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Mark spinner as failed
   */
  fail(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Mark spinner as warned
   */
  warn(message?: string): void {
    if (this.spinner) {
      this.spinner.warn(message);
      this.spinner = null;
    }
  }

  /**
   * Mark spinner as info
   */
  info(message?: string): void {
    if (this.spinner) {
      this.spinner.info(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without any symbol
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Check if spinner is active
   */
  isActive(): boolean {
    return this.spinner !== null && this.spinner.isSpinning;
  }
}

/**
 * Global spinner instance
 */
export const spinner = new Spinner();

/**
 * Create a new spinner instance
 */
export function createSpinner(): Spinner {
  return new Spinner();
}

/**
 * Execute a task with a spinner
 */
export async function withSpinner<T>(
  message: string,
  task: () => Promise<T>,
  successMessage?: string,
  errorMessage?: string,
): Promise<T> {
  const s = createSpinner();
  s.start(message);

  try {
    const result = await task();
    s.succeed(successMessage || message);
    return result;
  } catch (error) {
    s.fail(errorMessage || `${message} failed`);
    throw error;
  }
}
