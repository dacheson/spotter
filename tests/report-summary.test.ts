import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readVisualReportSummary, renderVisualReportSummary } from '../src/index.js';

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
  });
});