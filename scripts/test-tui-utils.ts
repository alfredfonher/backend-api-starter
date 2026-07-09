import type { RunnerTask as Task, RunnerTaskResultPack as TaskResultPack, RunnerTestFile as File } from 'vitest';

export type TestState = 'pending' | 'running' | 'pass' | 'fail' | 'skip' | 'todo';

export interface TestProgressEntry {
  id: string;
  label: string;
  state: TestState;
  duration?: number;
}

export interface TestMetrics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  running: number;
  elapsedMs: number;
}

export interface TestProgressState {
  startedAt: number;
  entries: Map<string, TestProgressEntry>;
}

const TERMINAL_WIDTH = 80;
const RESULT_LIMIT = 12;

export function createProgressState(startedAt = Date.now()): TestProgressState {
  return {
    startedAt,
    entries: new Map(),
  };
}

export function collectTests(files: File[], state: TestProgressState): void {
  for (const file of files) {
    collectTask(file, state, []);
  }
}

export function applyTaskUpdates(packs: TaskResultPack[], state: TestProgressState): void {
  for (const [id, result] of packs) {
    const entry = state.entries.get(id);

    if (!entry || !result) {
      continue;
    }

    if (result.state === 'pass' || result.state === 'fail' || result.state === 'skip' || result.state === 'todo') {
      entry.state = result.state;
    } else if (result.state === 'run' && result.startTime) {
      entry.state = 'running';
    }

    entry.duration = result.duration;
  }
}

export function getMetrics(state: TestProgressState, now = Date.now()): TestMetrics {
  const entries = [...state.entries.values()];

  return {
    total: entries.length,
    passed: entries.filter((entry) => entry.state === 'pass').length,
    failed: entries.filter((entry) => entry.state === 'fail').length,
    skipped: entries.filter((entry) => entry.state === 'skip' || entry.state === 'todo').length,
    running: entries.filter((entry) => entry.state === 'running').length,
    elapsedMs: Math.max(0, now - state.startedAt),
  };
}

export function renderProgress(state: TestProgressState, now = Date.now()): string {
  const metrics = getMetrics(state, now);
  const completed = metrics.passed + metrics.failed + metrics.skipped;
  const progress = metrics.total === 0 ? 0 : completed / metrics.total;
  const failedEntries = [...state.entries.values()].filter((entry) => entry.state === 'fail');
  const recentEntries = [...state.entries.values()]
    .filter((entry) => entry.state !== 'pending')
    .slice(-RESULT_LIMIT)
    .reverse();

  return [
    'Test Terminal UI',
    '',
    `Total: ${metrics.total}  Passed: ${metrics.passed}  Failed: ${metrics.failed}  Skipped: ${metrics.skipped}  Running: ${metrics.running}  Elapsed: ${formatDuration(metrics.elapsedMs)}`,
    renderProgressBar(progress),
    '',
    ...(failedEntries.length > 0 ? ['Failed tests:', ...failedEntries.map(renderEntry), ''] : []),
    'Recent progress:',
    ...(recentEntries.length > 0 ? recentEntries.map(renderEntry) : ['  Waiting for test results...']),
  ].join('\n');
}

export function renderProgressBar(progress: number, width = 32): string {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const filled = Math.round(safeProgress * width);
  const empty = width - filled;
  const percent = Math.round(safeProgress * 100).toString().padStart(3, ' ');

  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

export function collectFailedSuites(files: File[]): string[] {
  const failedSuites: string[] = [];

  for (const file of files) {
    collectFailedSuiteTask(file, [], failedSuites);
  }

  return failedSuites;
}

function collectTask(task: Task, state: TestProgressState, parents: string[]): void {
  if (task.type === 'test' || task.type === 'custom') {
    state.entries.set(task.id, {
      id: task.id,
      label: [...parents, task.name].filter(Boolean).join(' › '),
      state: task.mode === 'skip' || task.mode === 'todo' ? task.mode : 'pending',
    });
    return;
  }

  const isFile = 'filepath' in task;
  const nextParents = task.type === 'suite' && task.name && !isFile ? [...parents, task.name] : parents;

  for (const child of task.tasks) {
    collectTask(child, state, nextParents);
  }
}

function collectFailedSuiteTask(task: Task, parents: string[], failedSuites: string[]): void {
  const isFile = 'filepath' in task;
  const nextParents = task.type === 'suite' && task.name && !isFile ? [...parents, task.name] : parents;

  if (task.type === 'suite' && task.result?.state === 'fail') {
    failedSuites.push(nextParents.join(' › ') || task.name || 'Unnamed suite');
  }

  if (task.type !== 'test' && task.type !== 'custom') {
    for (const child of task.tasks) {
      collectFailedSuiteTask(child, nextParents, failedSuites);
    }
  }
}

function renderEntry(entry: TestProgressEntry): string {
  const icon = getStateIcon(entry.state);
  const duration = entry.duration === undefined ? '' : ` (${formatDuration(entry.duration)})`;
  const label = truncate(entry.label, TERMINAL_WIDTH - icon.length - duration.length - 4);

  return `  ${icon} ${label}${duration}`;
}

function getStateIcon(state: TestState): string {
  if (state === 'pass') return '✓';
  if (state === 'fail') return '✗';
  if (state === 'running') return '…';
  if (state === 'skip' || state === 'todo') return '-';
  return '·';
}

function formatDuration(ms: number): string {
  const roundedMs = Math.round(ms);

  if (ms < 1000) {
    return `${roundedMs}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
