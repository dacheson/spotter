import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSpotterConfig } from '../src/config/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-config-'));

  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe('config loader', () => {
  it('returns defaults when no config file exists', async () => {
    const cwd = await createTempDir();
    const loaded = await loadSpotterConfig({ cwd });

    expect(loaded.configPath).toBeNull();
    expect(loaded.config.paths).toEqual({
      artifactsDir: '.spotter/artifacts',
      screenshotsDir: '.spotter/baselines',
      testsDir: '.spotter/tests'
    });
    expect(loaded.config.viewports).toHaveLength(2);
    expect(loaded.config.locales).toEqual([
      {
        code: 'en-US',
        label: 'English (US)',
        rtl: false
      }
    ]);
  });

  it('loads and merges JSON config values', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.json');

    await writeFile(
      configPath,
      JSON.stringify(
        {
          paths: {
            screenshotsDir: 'artifacts/screenshots'
          },
          locales: [{ code: 'en-GB', label: 'English (UK)', rtl: false }]
        },
        null,
        2
      )
    );

    const loaded = await loadSpotterConfig({ cwd });

    expect(loaded.configPath).toBe(configPath);
    expect(loaded.config.paths).toEqual({
      artifactsDir: '.spotter/artifacts',
      screenshotsDir: 'artifacts/screenshots',
      testsDir: '.spotter/tests'
    });
    expect(loaded.config.locales).toEqual([
      {
        code: 'en-GB',
        label: 'English (UK)',
        rtl: false
      }
    ]);
  });

  it('loads TypeScript config values', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.ts');

    await writeFile(
      configPath,
      [
        'export default {',
        "  rootDir: 'apps/web',",
        '  viewports: [{ name: \'tablet\', width: 1024, height: 768 }],',
        '  paths: { testsDir: \'.generated/spotter/tests\' }',
        '};',
        ''
      ].join('\n')
    );

    const loaded = await loadSpotterConfig({ cwd });

    expect(loaded.configPath).toBe(configPath);
    expect(loaded.config.rootDir).toBe('apps/web');
    expect(loaded.config.viewports).toEqual([
      {
        name: 'tablet',
        width: 1024,
        height: 768
      }
    ]);
    expect(loaded.config.paths).toEqual({
      artifactsDir: '.spotter/artifacts',
      screenshotsDir: '.spotter/baselines',
      testsDir: '.generated/spotter/tests'
    });
  });
});