import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBaselinePlaywrightConfigContents, createDefaultCliHandlers, runBaselineCommand } from '../src/index.js';

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
      baselineDir: 'C:/repo/.spotter/baselines',
      testDir: 'C:/repo/.spotter/tests'
    });

    expect(contents).toContain("import { defineConfig } from '@playwright/test';");
    expect(contents).toContain('testDir: "C:/repo/.spotter/tests"');
    expect(contents).toContain('snapshotPathTemplate: "C:/repo/.spotter/baselines/{testFilePath}/{arg}{ext}"');
  });

  it('writes the baseline config and invokes Playwright in update-snapshots mode', async () => {
    const cwd = await createTempDir();
    await writeFile(
      path.join(cwd, 'spotter.config.json'),
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
      ),
      'utf8'
    );

    const runner = vi.fn(async () => ({ exitCode: 0 }));
    const result = await runBaselineCommand({ cwd }, { runner });
    const configContents = await readFile(result.configPath, 'utf8');

    expect(result.baselineDir).toBe(path.resolve(cwd, '.generated/baselines'));
    expect(result.testDir).toBe(path.resolve(cwd, '.generated/tests'));
    expect(configContents).toContain('snapshotPathTemplate');
    expect(runner).toHaveBeenCalledWith({
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['playwright', 'test', '--config', result.configPath, '--update-snapshots'],
      cwd
    });
  });

  it('wires the default baseline CLI handler to the baseline runner', async () => {
    const write = vi.fn<(message: string) => void>();
    const runBaseline = vi.fn(async () => ({
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
  });
});