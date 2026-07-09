import type { RunnerTaskResultPack as TaskResultPack, RunnerTestFile as File } from 'vitest';
import type { Reporter } from 'vitest/reporters';
import { applyTaskUpdates, collectFailedSuites, collectTests, createProgressState, renderProgress } from './test-tui-utils';

export default class TestTuiReporter implements Reporter {
  private readonly state = createProgressState();
  private timer: NodeJS.Timeout | undefined;
  private rendered = false;

  onCollected(files?: File[]): void {
    collectTests(files ?? [], this.state);
    this.startTimer();
    this.render();
  }

  onTaskUpdate(packs: TaskResultPack[]): void {
    applyTaskUpdates(packs, this.state);
    this.render();
  }

  onFinished(files?: File[]): void {
    this.stopTimer();
    this.render();
    this.renderSuiteFailures(files ?? []);

    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?25h');
    }

    process.stdout.write('\n');
  }

  private startTimer(): void {
    if (this.timer) {
      return;
    }

    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?25l');
    }

    this.timer = setInterval(() => this.render(), 100);
    this.timer.unref();
  }

  private stopTimer(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
  }

  private render(): void {
    if (process.stdout.isTTY) {
      process.stdout.write(`${this.rendered ? '\x1b[H\x1b[J' : ''}${renderProgress(this.state)}`);
      this.rendered = true;
      return;
    }

    process.stdout.write(`${renderProgress(this.state)}\n`);
  }

  private renderSuiteFailures(files: File[]): void {
    const failedSuites = collectFailedSuites(files);

    if (failedSuites.length === 0) {
      return;
    }

    process.stdout.write(['', 'Failed suites:', ...failedSuites.map((suite) => `  ✗ ${suite}`), ''].join('\n'));
  }
}
