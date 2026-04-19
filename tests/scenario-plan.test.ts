import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createConfiguredScenarioPlan, createScenarioPlan, type ScenarioDefinition } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-scenario-plan-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function createScenarios(): ScenarioDefinition[] {
  return [
    {
      id: 'checkout-empty-cart',
      routePath: '/checkout',
      name: 'Checkout Empty Cart',
      priority: 'high',
      tags: ['checkout', 'empty']
    }
  ];
}

describe('scenario plan', () => {
  it('expands a scenario across desktop and mobile viewports', () => {
    const scenarioPlan = createScenarioPlan(createScenarios(), {
      generatedAt: '2026-04-19T12:00:00.000Z',
      locales: [{ code: 'en-US', label: 'English (US)', rtl: false }],
      viewports: [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 }
      ]
    });

    expect(scenarioPlan).toEqual({
      generatedAt: '2026-04-19T12:00:00.000Z',
      items: [
        {
          scenario: createScenarios()[0],
          target: {
            locale: { code: 'en-US', label: 'English (US)', rtl: false },
            viewport: { name: 'desktop', width: 1440, height: 900 }
          }
        },
        {
          scenario: createScenarios()[0],
          target: {
            locale: { code: 'en-US', label: 'English (US)', rtl: false },
            viewport: { name: 'mobile', width: 390, height: 844 }
          }
        }
      ]
    });
  });

  it('uses configured default viewports and locales when building a plan from cwd', async () => {
    const cwd = await createTempDir();

    await mkdir(path.join(cwd, 'config'), { recursive: true });
    await writeFile(
      path.join(cwd, 'spotter.config.json'),
      JSON.stringify(
        {
          viewports: [
            { name: 'desktop', width: 1440, height: 900 },
            { name: 'mobile', width: 390, height: 844 }
          ],
          locales: [{ code: 'en-US', label: 'English (US)', rtl: false }]
        },
        null,
        2
      ),
      'utf8'
    );

    const scenarioPlan = await createConfiguredScenarioPlan(createScenarios(), {
      cwd,
      generatedAt: '2026-04-19T12:00:00.000Z'
    });

    expect(scenarioPlan.items).toHaveLength(2);
    expect(scenarioPlan.items.map((item) => item.target.viewport.name)).toEqual(['desktop', 'mobile']);
    expect(scenarioPlan.items.map((item) => item.target.locale.code)).toEqual(['en-US', 'en-US']);
  });
});