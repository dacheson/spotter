import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  defaultScreenshotAssertionOptions,
  generatePlaywrightTestFiles,
  renderScreenshotAssertion,
  writeGeneratedPlaywrightTests,
  type ScenarioPlan
} from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-playwright-generator-'));
  tempDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(rootDir: string, relativePath: string, contents: string): Promise<void> {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function createScenarioPlan(): ScenarioPlan {
  return {
    generatedAt: '2026-04-19T12:00:00.000Z',
    items: [
      {
        scenario: {
          id: 'checkout-empty-cart',
          routePath: '/checkout',
          name: 'Checkout Empty Cart',
          priority: 'high',
          tags: ['checkout', 'empty']
        },
        target: {
          viewport: {
            name: 'mobile',
            width: 390,
            height: 844
          },
          locale: {
            code: 'en-US',
            label: 'English (US)',
            rtl: false
          }
        }
      }
    ]
  };
}

describe('playwright generator', () => {
  it('generates deterministic test files from a scenario plan', () => {
    const scenarioPlan = createScenarioPlan();
    const [scenarioItem] = scenarioPlan.items;

    if (!scenarioItem) {
      throw new Error('Expected scenario plan item');
    }

    const files = generatePlaywrightTestFiles(scenarioPlan);

    expect(files).toEqual([
      {
        filePath: '.spotter/tests/checkout-checkout-empty-cart.spec.ts',
        scenario: scenarioItem.scenario,
        contents: [
          "import { expect, test } from '@playwright/test';",
          '',
          "test.describe('checkout-empty-cart', () => {",
          '  test.use({ viewport: { width: 390, height: 844 } });',
          '',
          "  test('checkout-empty-cart', async ({ page }) => {",
          "    await page.goto('/checkout');",
          "    await expect(page).toHaveScreenshot('checkout-empty-cart-mobile-en-US.png', {",
          "      animations: 'disabled',",
          "      caret: 'hide',",
          '      fullPage: true,',
          "      scale: 'css'",
          '    });',
          '  });',
          '});',
          ''
        ].join('\n')
      }
    ]);
  });

  it('writes generated test files to the configured tests directory by default', async () => {
    const cwd = await createTempDir();
    await writeFixtureFile(
      cwd,
      'spotter.config.json',
      JSON.stringify(
        {
          paths: {
            testsDir: '.generated/tests'
          }
        },
        null,
        2
      )
    );

    const written = await writeGeneratedPlaywrightTests(createScenarioPlan(), { cwd });
    const filePath = path.join(written.outputDir, 'checkout-checkout-empty-cart.spec.ts');
    const contents = await readFile(filePath, 'utf8');

    expect(written.outputDir).toBe(path.resolve(cwd, '.generated/tests'));
    expect(contents).toContain("test('checkout-empty-cart', async ({ page }) => {");
    expect(contents).toContain("await expect(page).toHaveScreenshot('checkout-empty-cart-mobile-en-US.png', {");
  });

  it('supports overriding the output directory', async () => {
    const cwd = await createTempDir();
    const outputDir = path.join(cwd, 'custom-tests');

    const written = await writeGeneratedPlaywrightTests(createScenarioPlan(), { cwd, outputDir });

    expect(written.outputDir).toBe(outputDir);
    expect(written.files[0]?.filePath).toBe('custom-tests/checkout-checkout-empty-cart.spec.ts');
  });

  it('renders deterministic screenshot assertion options', () => {
    expect(defaultScreenshotAssertionOptions).toEqual({
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    });

    expect(renderScreenshotAssertion('checkout.png')).toBe([
      "await expect(page).toHaveScreenshot('checkout.png', {",
      "      animations: 'disabled',",
      "      caret: 'hide',",
      '      fullPage: true,',
      "      scale: 'css'",
      '    });'
    ].join('\n'));
  });
});