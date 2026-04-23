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
    expect(loaded.config.appUrl).toBe('http://127.0.0.1:3000');
    expect(loaded.config).not.toHaveProperty('captureServer');
    expect(loaded.config.devServer).toEqual({
      command: 'npm run dev',
      reuseExistingServer: true,
      timeoutMs: 120000
    });
    expect(loaded.config.llm).toEqual({
      fallback: null
    });
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
          appUrl: 'http://127.0.0.1:4000',
          captureServer: {
            command: 'pnpm start',
            timeoutMs: 60000
          },
          devServer: {
            command: 'pnpm dev',
            timeoutMs: 30000
          },
          llm: {
            fallback: {
              enabled: true,
              provider: 'local',
              model: 'llama3.1',
              baseUrl: 'http://127.0.0.1:11434/v1'
            }
          },
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
    expect(loaded.config.appUrl).toBe('http://127.0.0.1:4000');
    expect(loaded.config.captureServer).toEqual({
      command: 'pnpm start',
      reuseExistingServer: true,
      timeoutMs: 60000
    });
    expect(loaded.config.devServer).toEqual({
      command: 'pnpm dev',
      reuseExistingServer: true,
      timeoutMs: 30000
    });
    expect(loaded.config.llm).toEqual({
      fallback: {
        enabled: true,
        provider: 'local',
        model: 'llama3.1',
        baseUrl: 'http://127.0.0.1:11434/v1'
      }
    });
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
        "  appUrl: 'http://127.0.0.1:3100',",
        '  captureServer: { command: \'npm run start\', reuseExistingServer: false, cwd: \'apps/web\', timeoutMs: 90000 },',
        '  devServer: { command: \'npm run start\', reuseExistingServer: false, cwd: \'apps/web\', timeoutMs: 45000 },',
        '  llm: { fallback: { enabled: true, provider: \'openai\', model: \'gpt-5.4\', apiKeyEnvVar: \'OPENAI_API_KEY\' } },',
        "  rootDir: 'apps/web',",
        '  viewports: [{ name: \'tablet\', width: 1024, height: 768 }],',
        '  paths: { testsDir: \'.generated/spotter/tests\' }',
        '};',
        ''
      ].join('\n')
    );

    const loaded = await loadSpotterConfig({ cwd });

    expect(loaded.configPath).toBe(configPath);
    expect(loaded.config.appUrl).toBe('http://127.0.0.1:3100');
    expect(loaded.config.captureServer).toEqual({
      command: 'npm run start',
      reuseExistingServer: false,
      cwd: 'apps/web',
      timeoutMs: 90000
    });
    expect(loaded.config.devServer).toEqual({
      command: 'npm run start',
      reuseExistingServer: false,
      cwd: 'apps/web',
      timeoutMs: 45000
    });
    expect(loaded.config.llm).toEqual({
      fallback: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4',
        apiKeyEnvVar: 'OPENAI_API_KEY'
      }
    });
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

  it('supports disabling automatic dev server startup', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.json');

    await writeFile(
      configPath,
      JSON.stringify(
        {
          devServer: null
        },
        null,
        2
      )
    );

    const loaded = await loadSpotterConfig({ cwd });

    expect(loaded.configPath).toBe(configPath);
    expect(loaded.config.devServer).toBeNull();
  });

  it('supports disabling capture startup separately from the developer startup server', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.json');

    await writeFile(
      configPath,
      JSON.stringify(
        {
          captureServer: null,
          devServer: {
            command: 'npm run dev'
          }
        },
        null,
        2
      )
    );

    const loaded = await loadSpotterConfig({ cwd });

    expect(loaded.configPath).toBe(configPath);
    expect(loaded.config.captureServer).toBeNull();
    expect(loaded.config.devServer).toEqual({
      command: 'npm run dev',
      reuseExistingServer: true,
      timeoutMs: 120000
    });
  });
});