import { WorkflowError } from "./errors";

export class JsonOutput {
  /**
   * Write success result to stdout
   */
  static write(data: unknown): void {
    process.stdout.write(JSON.stringify(data) + "\n");
  }

  /**
   * Write error result to stdout
   */
  static writeError(error: WorkflowError): void {
    process.stdout.write(
      JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: (error as any).details,
          suggestions: (error as any).suggestions,
        },
      }) + "\n",
    );
  }
}
