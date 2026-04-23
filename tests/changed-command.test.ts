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

function expectedRunnerInvocation(configPath: string, cwd: string) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx', 'playwright', 'test', '--config', configPath],
      cwd
    };
  }

  return {
    command: 'npx',
    args: ['playwright', 'test', '--config', configPath],
    cwd
  };
}

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
          appUrl: 'http://127.0.0.1:4200',
          captureServer: {
            command: 'pnpm start',
            cwd: 'apps/web',
            reuseExistingServer: false,
            timeoutMs: 90000
          },
          devServer: null,
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
    expect(result.completed).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.appUrl).toBe('http://127.0.0.1:4200');
    expect(result.summary.changed).toBe(1);
    expect(result.artifactPath).toBe(path.resolve(cwd, '.generated/artifacts/changed-run.json'));
    expect(configContents).toContain('outputDir:');
    expect(configContents).toContain('  },\n  outputDir: "./playwright-results"');
    expect(configContents).toContain('testDir: "../tests"');
    expect(configContents).toContain('snapshotPathTemplate: "../baselines/{testFilePath}/{arg}{ext}"');
    expect(configContents).toContain('outputDir: "./playwright-results"');
    expect(configContents).toContain('baseURL: "http://127.0.0.1:4200"');
    expect(configContents).toContain('webServer: {');
    expect(configContents).toContain('command: "pnpm start"');
    expect(configContents).toContain('cwd: "../../apps/web"');
    expect(JSON.parse(artifactContents)).toMatchObject({
      kind: 'changed',
      completed: true,
      exitCode: 1,
      passed: false,
      resultsDir: path.resolve(cwd, '.generated/artifacts/playwright-results')
    });
    expect(runner).toHaveBeenCalledWith(expectedRunnerInvocation(result.configPath, cwd));
  });

  it('marks the changed run incomplete when Playwright fails before producing diff artifacts', async () => {
    const cwd = await createTempDir();
    await writeFixtureFile(
      cwd,
      'spotter.config.json',
      JSON.stringify(
        {
          appUrl: 'http://127.0.0.1:4200',
          devServer: null,
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

    const runner = vi.fn(async () => ({ exitCode: 1 }));

    const result = await runChangedCommand({ cwd }, { runner });
    const artifactContents = JSON.parse(await readFile(result.artifactPath, 'utf8'));

    expect(result.passed).toBe(false);
    expect(result.completed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.summary).toEqual({
      changed: 0,
      unchanged: 0,
      artifacts: []
    });
    expect(result.failureMessage).toBe('Playwright changed run failed before visual comparison completed (exit code 1).');
    expect(artifactContents).toMatchObject({
      completed: false,
      exitCode: 1,
      failureMessage: 'Playwright changed run failed before visual comparison completed (exit code 1).',
      passed: false,
      summary: {
        changed: 0,
        artifacts: []
      }
    });
  });

  it('wires the changed CLI handler to report pass or fail and changed image paths', async () => {
    const write = vi.fn<(message: string) => void>();
    const runChanged = vi.fn(async () => ({
      artifactPath: 'C:/repo/.spotter/artifacts/changed-run.json',
      appUrl: 'http://127.0.0.1:3000',
      baselineDir: 'C:/repo/.spotter/baselines',
      configPath: 'C:/repo/.spotter/artifacts/playwright.changed.config.mjs',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results',
      testDir: 'C:/repo/.spotter/tests',
      command: 'npx',
      args: ['playwright', 'test', '--config', 'config'],
      completed: true,
      exitCode: 1,
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

  it('wires the changed CLI handler to report incomplete changed runs clearly', async () => {
    const write = vi.fn<(message: string) => void>();
    const runChanged = vi.fn(async () => ({
      artifactPath: 'C:/repo/.spotter/artifacts/changed-run.json',
      appUrl: 'http://127.0.0.1:3000',
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

    expect(write).toHaveBeenCalledWith('Playwright changed run failed before visual comparison completed (exit code 1).');
    expect(write).toHaveBeenCalledWith('Changed artifact written to C:/repo/.spotter/artifacts/changed-run.json');
    expect(write).not.toHaveBeenCalledWith('Changed run failed with 0 changed screenshots.');
  });

  it('renders a Playwright config with a results output directory', () => {
    const contents = createChangedPlaywrightConfigContents({
      appUrl: 'http://127.0.0.1:3000',
      baselineDir: 'C:/repo/.spotter/baselines',
      configDir: 'C:/repo/.spotter/artifacts',
      devServer: {
        command: 'npm run dev',
        reuseExistingServer: true,
        timeoutMs: 120000
      },
      testDir: 'C:/repo/.spotter/tests',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results'
    });

    expect(contents).toContain('snapshotPathTemplate: "../baselines/{testFilePath}/{arg}{ext}"');
    expect(contents).toContain('baseURL: "http://127.0.0.1:3000"');
    expect(contents).toContain('  },\n  outputDir: "./playwright-results"');
    expect(contents).toContain('outputDir: "./playwright-results"');
  });

  it('falls back to devServer when captureServer is not configured', () => {
    const contents = createChangedPlaywrightConfigContents({
      appUrl: 'http://127.0.0.1:3000',
      baselineDir: 'C:/repo/.spotter/baselines',
      configDir: 'C:/repo/.spotter/artifacts',
      devServer: {
        command: 'npm run dev',
        reuseExistingServer: true,
        timeoutMs: 120000
      },
      testDir: 'C:/repo/.spotter/tests',
      resultsDir: 'C:/repo/.spotter/artifacts/playwright-results'
    });

    expect(contents).toContain('webServer: {');
    expect(contents).toContain('command: "npm run dev"');
  });
});