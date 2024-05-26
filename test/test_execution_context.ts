import { ExecutionContext } from 'hono';

export class TestExecutionContext implements ExecutionContext {
  private readonly trackedPromises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.trackedPromises.push(promise);
  }

  passThroughOnException(): void {
    return;
  }

  async waitForComplete(): Promise<void> {
    console.log('Waiting for promises', this.trackedPromises.length);
    await Promise.all(this.trackedPromises);
  }
}
