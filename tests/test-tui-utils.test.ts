import { describe, expect, it } from 'vitest';
import type { RunnerTestCase as Test, RunnerTestFile as File, RunnerTestSuite as Suite } from 'vitest';
import { applyTaskUpdates, collectFailedSuites, collectTests, createProgressState, getMetrics, renderProgress, renderProgressBar } from '../scripts/test-tui-utils';

describe('test TUI utilities', () => {
  it('collects tests and updates metrics from Vitest task packs', () => {
    const state = createProgressState(1_000);
    const firstTest = createTest('file_0', 'returns health status');
    const secondTest = createTest('file_1', 'rejects invalid payload');
    const file = createFile([firstTest, secondTest]);

    collectTests([file], state);
    applyTaskUpdates(
      [
        ['file_0', { state: 'pass', duration: 12 }, {}],
        ['file_1', { state: 'fail', duration: 4 }, {}],
      ],
      state,
    );

    expect(getMetrics(state, 2_500)).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      running: 0,
      elapsedMs: 1_500,
    });
  });

  it('renders a progress bar and recent result summary', () => {
    const state = createProgressState(0);
    const file = createFile([createTest('file_0', 'first test'), createTest('file_1', 'second test')]);

    collectTests([file], state);
    applyTaskUpdates([['file_0', { state: 'pass', duration: 10 }, {}]], state);

    expect(renderProgressBar(0.5, 10)).toBe('[█████░░░░░]  50%');
    expect(renderProgress(state, 1_000)).toContain('Total: 2  Passed: 1  Failed: 0  Skipped: 0  Running: 0  Elapsed: 1.0s');
    expect(renderProgress(state, 1_000)).toContain('✓ API suite › first test (10ms)');
  });

  it('collects suite-level failures from hook errors', () => {
    const file = createFile([createTest('file_0', 'first test')]);
    const suite = file.tasks[0] as Suite;

    suite.result = { state: 'fail' };

    expect(collectFailedSuites([file])).toEqual(['API suite']);
  });
});

function createFile(tasks: Test[]): File {
  return {
    id: 'file',
    name: 'api.test.ts',
    mode: 'run',
    meta: {},
    type: 'suite',
    filepath: '/project/tests/api.test.ts',
    projectName: undefined,
    file: undefined as unknown as File,
    tasks: [
      {
        id: 'suite',
        name: 'API suite',
        mode: 'run',
        meta: {},
        type: 'suite',
        file: undefined as unknown as File,
        tasks,
      } as Suite,
    ],
  };
}

function createTest(id: string, name: string): Test {
  return {
    id,
    name,
    mode: 'run',
    meta: {},
    type: 'test',
    context: undefined as unknown as Test['context'],
    file: undefined as unknown as File,
  };
}
