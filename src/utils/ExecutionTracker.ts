export interface ExecutionStep {
  name: string;
  status: 'completed' | 'skipped' | 'failed';
  duration?: number;
  reason?: string; // For skipped/failed steps
}

export class ExecutionTracker {
  private steps: ExecutionStep[] = [];
  private startTime: number = Date.now();

  logCompleted(name: string, duration?: number): void {
    this.steps.push({ name, status: 'completed', duration });
  }

  logSkipped(name: string, reason: string): void {
    this.steps.push({ name, status: 'skipped', reason });
  }

  logFailed(name: string, reason: string): void {
    this.steps.push({ name, status: 'failed', reason });
  }

  getSummary(): {
    steps: ExecutionStep[];
    totalDuration: number;
    startedAt: string; // ISO format
    completedAt: string; // ISO format
  } {
    const completedAt = Date.now();
    return {
      steps: [...this.steps],
      totalDuration: completedAt - this.startTime,
      startedAt: new Date(this.startTime).toISOString(),
      completedAt: new Date(completedAt).toISOString()
    };
  }
}

