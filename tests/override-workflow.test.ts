import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSpotterConfig, runOverrideWorkflow } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-override-workflow-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('override workflow', () => {
  it('writes include scenario overrides into spotter.config.json', async () => {
    const cwd = await createTempDir();

    const result = await runOverrideWorkflow({
      cwd,
      override: {
        action: 'include',
        scenario: {
          id: 'checkout-empty-state-manual',
          routePath: '/checkout',
          name: 'Checkout Empty State',
          priority: 'medium',
          tags: ['checkout', 'empty', 'empty']
        }
      }
    });
    const configPath = path.join(cwd, 'spotter.config.json');
    const configContents = JSON.parse(await readFile(configPath, 'utf8')) as {
      overrides: {
        scenarios: {
          include: Array<{ id: string; routePath: string; name: string; priority: string; tags: string[]; origin?: string }>;
        };
      };
    };
    const loaded = await loadSpotterConfig({ cwd });

    expect(result).toEqual({
      action: 'include',
      changed: true,
      configPath,
      createdConfig: true,
      scenarioId: 'checkout-empty-state-manual'
    });
    expect(configContents.overrides.scenarios.include).toEqual([
      {
        id: 'checkout-empty-state-manual',
        routePath: '/checkout',
        name: 'Checkout Empty State',
        priority: 'medium',
        tags: ['checkout', 'empty'],
        origin: 'user-override'
      }
    ]);
    expect(loaded.config.overrides.scenarios.include).toEqual([
      {
        id: 'checkout-empty-state-manual',
        routePath: '/checkout',
        name: 'Checkout Empty State',
        priority: 'medium',
        tags: ['checkout', 'empty'],
        origin: 'user-override'
      }
    ]);
  });

  it('writes exclude scenario ids without duplicating existing entries', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.json');

    await writeFile(
      configPath,
      JSON.stringify(
        {
          overrides: {
            scenarios: {
              exclude: {
                ids: ['checkout-loading-state']
              },
              include: []
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const first = await runOverrideWorkflow({
      cwd,
      override: {
        action: 'exclude',
        scenarioId: 'checkout-loading-state'
      }
    });
    const second = await runOverrideWorkflow({
      cwd,
      override: {
        action: 'exclude',
        scenarioId: 'checkout-empty-state'
      }
    });
    const loaded = await loadSpotterConfig({ cwd });

    expect(first.changed).toBe(false);
    expect(second.changed).toBe(true);
    expect(loaded.config.overrides.scenarios.exclude.ids).toEqual([
      'checkout-empty-state',
      'checkout-loading-state'
    ]);
  });

  it('fails clearly for TypeScript config mutation requests', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.ts');

    await writeFile(configPath, 'export default { rootDir: "." };\n', 'utf8');

    await expect(
      runOverrideWorkflow({
        cwd,
        override: {
          action: 'exclude',
          scenarioId: 'checkout-loading-state'
        }
      })
    ).rejects.toThrow(
      `spotter override currently only supports JSON config files. Found ${configPath}. Update overrides.scenarios manually or switch to spotter.config.json.`
    );
  });
});