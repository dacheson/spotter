import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readVisualReportSummary,
  renderVisualReportMarkdown,
  renderVisualReportSummary,
  writeVisualReportMarkdown
} from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-report-summary-'));
  tempDirectories.push(directory);
  return directory;
}

async function writeJson(rootDir: string, relativePath: string, value: unknown): Promise<void> {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('visual report summary', () => {
  it('loads changed artifacts and maps diffs back to scenarios', async () => {
    const cwd = await createTempDir();

    await writeJson(cwd, '.spotter/artifacts/changed-run.json', {
      kind: 'changed',
      generatedAt: '2026-04-19T12:00:00.000Z',
      baselineDir: 'C:/repo/.spotter/baselines',
      configPath: 'C:/repo/.spotter/artifacts/playwright.changed.config.mjs',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results',
      testDir: 'C:/repo/.spotter/tests',
      command: 'npx',
      args: ['playwright', 'test', '--config', 'config'],
      passed: false,
      summary: {
        changed: 1,
        unchanged: 0,
        artifacts: [
          {
            scenarioId: 'checkout-error-state',
            baselinePath: 'baseline.png',
            currentPath: 'current.png',
            diffPath: 'diff.png'
          }
        ]
      }
    });
    await writeJson(cwd, '.spotter/artifacts/scenarios.json', {
      generatedAt: '2026-04-19T12:00:00.000Z',
      scenarios: [
        {
          id: 'checkout-error-state',
          routePath: '/checkout',
          name: 'Checkout Error State',
          priority: 'high',
          tags: ['checkout', 'error']
        }
      ]
    });

    const summary = await readVisualReportSummary({ cwd });

    expect(summary).toEqual({
      artifactPath: path.resolve(cwd, '.spotter/artifacts/changed-run.json'),
      changedScenarios: 1,
      completed: true,
      diffs: [
        {
          scenarioId: 'checkout-error-state',
          baselinePath: 'baseline.png',
          currentPath: 'current.png',
          diffPath: 'diff.png',
          priority: 'high',
          scenarioName: 'Checkout Error State'
        }
      ],
      generatedAt: '2026-04-19T12:00:00.000Z',
      failureMessage: undefined,
      passed: false,
      totalScenarios: 1
    });
    expect(renderVisualReportSummary(summary)).toEqual([
      'Changed run failed.',
      'Generated at 2026-04-19T12:00:00.000Z.',
      'Total scenarios: 1.',
      'Changed scenarios: 1.',
      'High priority diffs: 1.',
      'Medium priority diffs: 0.',
      'Low priority diffs: 0.',
      'Unknown priority diffs: 0.',
      '[high] Checkout Error State: diff.png'
    ]);
    expect(renderVisualReportMarkdown(summary)).toBe([
      '# Spotter Visual Report',
      '',
      'Status: **Failed**',
      'Generated: 2026-04-19T12:00:00.000Z',
      `Changed artifact: ${path.resolve(cwd, '.spotter/artifacts/changed-run.json')}`,
      '',
      '## Summary',
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      '| Total scenarios | 1 |',
      '| Changed scenarios | 1 |',
      '| High priority diffs | 1 |',
      '| Medium priority diffs | 0 |',
      '| Low priority diffs | 0 |',
      '| Unknown priority diffs | 0 |',
      '',
      '## Diffs',
      '',
      '| Priority | Scenario | Diff | Baseline | Current |',
      '| --- | --- | --- | --- | --- |',
      '| high | Checkout Error State | diff.png | baseline.png | current.png |'
    ].join('\n'));
  });

  it('renders incomplete changed runs as execution failures instead of no-diff reports', async () => {
    const cwd = await createTempDir();

    await writeJson(cwd, '.spotter/artifacts/changed-run.json', {
      kind: 'changed',
      generatedAt: '2026-04-19T12:00:00.000Z',
      baselineDir: 'C:/repo/.spotter/baselines',
      configPath: 'C:/repo/.spotter/artifacts/playwright.changed.config.mjs',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results',
      testDir: 'C:/repo/.spotter/tests',
      command: 'npx',
      args: ['playwright', 'test', '--config', 'config'],
      completed: false,
      exitCode: 1,
      failureMessage: 'Playwright changed run failed before visual comparison completed (exit code 1).',
      passed: false,
      summary: {
        changed: 0,
        unchanged: 0,
        artifacts: []
      }
    });
    await writeJson(cwd, '.spotter/artifacts/scenarios.json', {
      generatedAt: '2026-04-19T12:00:00.000Z',
      scenarios: []
    });

    const summary = await readVisualReportSummary({ cwd });

    expect(summary).toEqual({
      artifactPath: path.resolve(cwd, '.spotter/artifacts/changed-run.json'),
      changedScenarios: 0,
      completed: false,
      diffs: [],
      failureMessage: 'Playwright changed run failed before visual comparison completed (exit code 1).',
      generatedAt: '2026-04-19T12:00:00.000Z',
      passed: false,
      totalScenarios: 0
    });
    expect(renderVisualReportSummary(summary)).toEqual([
      'Changed run did not complete.',
      'Playwright changed run failed before visual comparison completed (exit code 1).',
      'Generated at 2026-04-19T12:00:00.000Z.',
      'Total scenarios: 0.',
      'Changed scenarios: 0.',
      'High priority diffs: 0.',
      'Medium priority diffs: 0.',
      'Low priority diffs: 0.',
      'Unknown priority diffs: 0.'
    ]);
    expect(renderVisualReportMarkdown(summary)).toBe([
      '# Spotter Visual Report',
      '',
      'Status: **Incomplete**',
      'Generated: 2026-04-19T12:00:00.000Z',
      `Changed artifact: ${path.resolve(cwd, '.spotter/artifacts/changed-run.json')}`,
      'Failure: Playwright changed run failed before visual comparison completed (exit code 1).',
      '',
      '## Summary',
      '',
      '| Metric | Value |',
      '| --- | ---: |',
      '| Total scenarios | 0 |',
      '| Changed scenarios | 0 |',
      '| High priority diffs | 0 |',
      '| Medium priority diffs | 0 |',
      '| Low priority diffs | 0 |',
      '| Unknown priority diffs | 0 |',
      '',
      '## Diffs',
      '',
      'No visual diffs were detected.'
    ].join('\n'));
  });

  it('writes a markdown report artifact by default', async () => {
    const cwd = await createTempDir();

    await writeJson(cwd, '.spotter/artifacts/changed-run.json', {
      kind: 'changed',
      generatedAt: '2026-04-19T12:00:00.000Z',
      baselineDir: 'C:/repo/.spotter/baselines',
      configPath: 'C:/repo/.spotter/artifacts/playwright.changed.config.mjs',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results',
      testDir: 'C:/repo/.spotter/tests',
      command: 'npx',
      args: ['playwright', 'test', '--config', 'config'],
      passed: true,
      summary: {
        changed: 0,
        unchanged: 0,
        artifacts: []
      }
    });
    await writeJson(cwd, '.spotter/artifacts/scenarios.json', {
      generatedAt: '2026-04-19T12:00:00.000Z',
      scenarios: []
    });

    const written = await writeVisualReportMarkdown({ cwd });

    expect(written.outputPath).toBe(path.resolve(cwd, '.spotter/artifacts/visual-report.md'));
    expect(written.markdown).toContain('# Spotter Visual Report');
    expect(written.markdown).toContain('No visual diffs were detected.');
  });

  it('reports a clear error when the changed artifact is missing', async () => {
    const cwd = await createTempDir();

    await expect(readVisualReportSummary({ cwd })).rejects.toThrow(
      "No changed-run artifact found. Run 'spotter changed' first."
    );
  });
});