import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBaselinePlaywrightConfigContents, createDefaultCliHandlers, runBaselineCommand } from '../src/index.js';

function expectedRunnerInvocation(configPath: string, cwd: string) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx', 'playwright', 'test', '--config', configPath, '--update-snapshots'],
      cwd
    };
  }

  return {
    command: 'npx',
    args: ['playwright', 'test', '--config', configPath, '--update-snapshots'],
    cwd
  };
}

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-baseline-command-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('baseline command', () => {
  it('renders a Playwright config that points snapshots at the baseline directory', () => {
    const contents = createBaselinePlaywrightConfigContents({
      appUrl: 'http://127.0.0.1:3000',
      baselineDir: 'C:/repo/.spotter/baselines',
      configDir: 'C:/repo/.spotter/artifacts',
      devServer: {
        command: 'npm run dev',
        reuseExistingServer: true,
        timeoutMs: 120000
      },
      testDir: 'C:/repo/.spotter/tests'
    });

    expect(contents).toContain("import { defineConfig } from '@playwright/test';");
  expect(contents).toContain('testDir: "../tests"');
  expect(contents).toContain('snapshotPathTemplate: "../baselines/{testFilePath}/{arg}{ext}"');
    expect(contents).toContain('baseURL: "http://127.0.0.1:3000"');
    expect(contents).toContain('webServer: {');
    expect(contents).toContain('command: "npm run dev"');
    expect(contents).toContain('reuseExistingServer: true');
    expect(contents).toContain('timeout: 120000');
    expect(contents).toContain('url: "http://127.0.0.1:3000"');
  });

  it('writes the baseline config and invokes Playwright in update-snapshots mode', async () => {
    const cwd = await createTempDir();
    await writeFile(
      path.join(cwd, 'spotter.config.json'),
      JSON.stringify(
        {
          appUrl: 'http://127.0.0.1:4100',
          devServer: {
            command: 'pnpm dev',
            cwd: 'apps/web',
            reuseExistingServer: false,
            timeoutMs: 45000
          },
          paths: {
            artifactsDir: '.generated/artifacts',
            screenshotsDir: '.generated/baselines',
            testsDir: '.generated/tests'
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const runner = vi.fn(async () => ({ exitCode: 0 }));
    const result = await runBaselineCommand({ cwd }, { runner });
    const configContents = await readFile(result.configPath, 'utf8');
    const artifactContents = await readFile(result.artifactPath, 'utf8');

    expect(result.baselineDir).toBe(path.resolve(cwd, '.generated/baselines'));
    expect(result.appUrl).toBe('http://127.0.0.1:4100');
    expect(result.testDir).toBe(path.resolve(cwd, '.generated/tests'));
    expect(result.artifactPath).toBe(path.resolve(cwd, '.generated/artifacts/baseline-run.json'));
    expect(configContents).toContain('snapshotPathTemplate');
    expect(configContents).toContain('testDir: "../tests"');
    expect(configContents).toContain('snapshotPathTemplate: "../baselines/{testFilePath}/{arg}{ext}"');
    expect(configContents).toContain('baseURL: "http://127.0.0.1:4100"');
    expect(configContents).toContain('command: "pnpm dev"');
    expect(configContents).toContain('cwd: "../../apps/web"');
    expect(JSON.parse(artifactContents)).toMatchObject({
      kind: 'baseline',
      baselineDir: path.resolve(cwd, '.generated/baselines')
    });
    expect(runner).toHaveBeenCalledWith(expectedRunnerInvocation(result.configPath, cwd));
  });

  it('wires the default baseline CLI handler to the baseline runner', async () => {
    const write = vi.fn<(message: string) => void>();
    const runBaseline = vi.fn(async () => ({
      artifactPath: 'C:/repo/.spotter/artifacts/baseline-run.json',
      appUrl: 'http://127.0.0.1:3000',
      baselineDir: 'C:/repo/.spotter/baselines',
      configPath: 'C:/repo/.spotter/artifacts/playwright.baseline.config.mjs',
      testDir: 'C:/repo/.spotter/tests',
      command: 'npx',
      args: ['playwright', 'test', '--config', 'config', '--update-snapshots']
    }));
    const handlers = createDefaultCliHandlers({ write, runBaseline });
    const baselineHandler = handlers.baseline;

    if (!baselineHandler) {
      throw new Error('Expected baseline handler');
    }

    await baselineHandler({
      commandName: 'baseline',
      environment: { cwd: 'C:/repo' }
    });

    expect(runBaseline).toHaveBeenCalledWith({ cwd: 'C:/repo' });
    expect(write).toHaveBeenCalledWith('Baseline screenshots stored in C:/repo/.spotter/baselines');
    expect(write).toHaveBeenCalledWith('Baseline artifact written to C:/repo/.spotter/artifacts/baseline-run.json');
  });

  it('omits webServer when automatic startup is disabled', () => {
    const contents = createBaselinePlaywrightConfigContents({
      appUrl: 'http://127.0.0.1:3000',
      baselineDir: 'C:/repo/.spotter/baselines',
      configDir: 'C:/repo/.spotter/artifacts',
      devServer: null,
      testDir: 'C:/repo/.spotter/tests'
    });

    expect(contents).toContain('baseURL: "http://127.0.0.1:3000"');
    expect(contents).not.toContain('webServer: {');
  });
});