import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collectDiffSummary,
  createChangedPlaywrightConfigContents,
  createDefaultCliHandlers,
  runChangedCommand
} from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-changed-command-'));
  tempDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(rootDir: string, relativePath: string, contents = ''): Promise<void> {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('changed command', () => {
  it('collects diff artifacts from the Playwright results directory', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(cwd, 'results/checkout-empty-cart-expected.png');
    await writeFixtureFile(cwd, 'results/checkout-empty-cart-actual.png');
    await writeFixtureFile(cwd, 'results/checkout-empty-cart-diff.png');

    const summary = await collectDiffSummary(path.join(cwd, 'results'));

    expect(summary).toEqual({
      changed: 1,
      unchanged: 0,
      artifacts: [
        {
          scenarioId: 'checkout-empty-cart',
          baselinePath: `${cwd.replace(/\\/g, '/')}/results/checkout-empty-cart-expected.png`,
          currentPath: `${cwd.replace(/\\/g, '/')}/results/checkout-empty-cart-actual.png`,
          diffPath: `${cwd.replace(/\\/g, '/')}/results/checkout-empty-cart-diff.png`
        }
      ]
    });
  });

  it('writes the changed config and reports diff artifacts after the run', async () => {
    const cwd = await createTempDir();
    await writeFixtureFile(
      cwd,
      'spotter.config.json',
      JSON.stringify(
        {
          paths: {
            artifactsDir: '.generated/artifacts',
            screenshotsDir: '.generated/baselines',
            testsDir: '.generated/tests'
          }
        },
        null,
        2
      )
    );

    const runner = vi.fn(async () => {
      await writeFixtureFile(cwd, '.generated/artifacts/playwright-results/checkout-empty-cart-diff.png');
      await writeFixtureFile(cwd, '.generated/artifacts/playwright-results/checkout-empty-cart-actual.png');
      await writeFixtureFile(cwd, '.generated/artifacts/playwright-results/checkout-empty-cart-expected.png');
      return { exitCode: 1 };
    });

    const result = await runChangedCommand({ cwd }, { runner });
    const configContents = await readFile(result.configPath, 'utf8');
    const artifactContents = await readFile(result.artifactPath, 'utf8');

    expect(result.passed).toBe(false);
    expect(result.summary.changed).toBe(1);
    expect(result.artifactPath).toBe(path.resolve(cwd, '.generated/artifacts/changed-run.json'));
    expect(configContents).toContain('outputDir:');
    expect(JSON.parse(artifactContents)).toMatchObject({
      kind: 'changed',
      passed: false,
      resultsDir: path.resolve(cwd, '.generated/artifacts/playwright-results')
    });
    expect(runner).toHaveBeenCalledWith({
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['playwright', 'test', '--config', result.configPath],
      cwd
    });
  });

  it('wires the changed CLI handler to report pass or fail and changed image paths', async () => {
    const write = vi.fn<(message: string) => void>();
    const runChanged = vi.fn(async () => ({
      artifactPath: 'C:/repo/.spotter/artifacts/changed-run.json',
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
            scenarioId: 'checkout-empty-cart',
            baselinePath: 'baseline.png',
            currentPath: 'current.png',
            diffPath: 'diff.png'
          }
        ]
      }
    }));
    const handlers = createDefaultCliHandlers({ write, runChanged });
    const changedHandler = handlers.changed;

    if (!changedHandler) {
      throw new Error('Expected changed handler');
    }

    await changedHandler({
      commandName: 'changed',
      environment: { cwd: 'C:/repo' }
    });

    expect(runChanged).toHaveBeenCalledWith({ cwd: 'C:/repo' });
    expect(write).toHaveBeenCalledWith('Changed run failed with 1 changed screenshots.');
    expect(write).toHaveBeenCalledWith('Changed artifact written to C:/repo/.spotter/artifacts/changed-run.json');
    expect(write).toHaveBeenCalledWith('Changed image: diff.png');
  });

  it('renders a Playwright config with a results output directory', () => {
    const contents = createChangedPlaywrightConfigContents({
      baselineDir: 'C:/repo/.spotter/baselines',
      testDir: 'C:/repo/.spotter/tests',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results'
    });

    expect(contents).toContain('snapshotPathTemplate: "C:/repo/.spotter/baselines/{testFilePath}/{arg}{ext}"');
    expect(contents).toContain('outputDir: "C:/repo/.spotter/artifacts/playwright-results"');
  });
});