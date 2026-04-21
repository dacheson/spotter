export * from './baseline.js';
export * from './changed.js';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import type { ScenarioPlan, ScenarioPlanItem } from '../scenarios/index.js';
import type { ScenarioDefinition, ViewportDefinition } from '../types.js';

export interface PlaywrightProjectTarget {
  name: string;
  testDir: string;
  snapshotDir: string;
  viewports: ViewportDefinition[];
}

export interface GeneratedTestFile {
  filePath: string;
  scenario: ScenarioDefinition;
  contents: string;
}

export interface ScreenshotAssertionOptions {
  animations: 'allow' | 'disabled';
  caret: 'hide' | 'initial';
  fullPage: boolean;
  scale: 'css' | 'device';
}

export const defaultScreenshotAssertionOptions: ScreenshotAssertionOptions = {
  animations: 'disabled',
  caret: 'hide',
  fullPage: true,
  scale: 'css'
};

export interface GeneratePlaywrightTestsOptions {
  testDir?: string;
}

export interface WriteGeneratedPlaywrightTestsOptions {
  cwd?: string;
  outputDir?: string;
}

export interface WrittenGeneratedPlaywrightTests {
  outputDir: string;
  files: GeneratedTestFile[];
}

export function generatePlaywrightTestFiles(
  scenarioPlan: ScenarioPlan,
  options: GeneratePlaywrightTestsOptions = {}
): GeneratedTestFile[] {
  const testDir = normalizePath(options.testDir ?? '.spotter/tests');

  return scenarioPlan.items.map((item) => {
    const filePath = `${testDir}/${buildScenarioFileName(item)}.spec.ts`;

    return {
      filePath,
      scenario: item.scenario,
      contents: renderPlaywrightTestFile(item)
    };
  });
}

export async function writeGeneratedPlaywrightTests(
  scenarioPlan: ScenarioPlan,
  options: WriteGeneratedPlaywrightTestsOptions = {}
): Promise<WrittenGeneratedPlaywrightTests> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const outputDir = options.outputDir ?? path.resolve(cwd, config.paths.testsDir);
  const relativeOutputDir = normalizePath(path.relative(cwd, outputDir) || '.');
  const files = generatePlaywrightTestFiles(scenarioPlan, {
    testDir: relativeOutputDir
  });

  await mkdir(outputDir, { recursive: true });

  await Promise.all(
    files.map(async (file) => {
      const absolutePath = path.resolve(cwd, file.filePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.contents, 'utf8');
    })
  );

  return {
    outputDir,
    files
  };
}

function renderPlaywrightTestFile(item: ScenarioPlanItem): string {
  const screenshotName = `${item.scenario.id}-${item.target.viewport.name}-${item.target.locale.code}.png`;
  const testName = escapeSingleQuotedString(item.scenario.id);
  const routePath = escapeSingleQuotedString(createExecutableRoutePath(item.scenario.routePath));
  const screenshotAssertion = renderScreenshotAssertion(screenshotName);

  return [
    "import { expect, test } from '@playwright/test';",
    '',
    `test.describe('${testName}', () => {`,
    `  test.use({ viewport: { width: ${item.target.viewport.width}, height: ${item.target.viewport.height} } });`,
    '',
    `  test('${testName}', async ({ page }) => {`,
    `    await page.goto('${routePath}');`,
    `    ${screenshotAssertion}`,
    '  });',
    '});',
    ''
  ].join('\n');
}

export function renderScreenshotAssertion(
  screenshotName: string,
  assertionOptions: ScreenshotAssertionOptions = defaultScreenshotAssertionOptions
): string {
  return [
    `await expect(page).toHaveScreenshot('${escapeSingleQuotedString(screenshotName)}', {`,
    `      animations: '${assertionOptions.animations}',`,
    `      caret: '${assertionOptions.caret}',`,
    `      fullPage: ${assertionOptions.fullPage},`,
    `      scale: '${assertionOptions.scale}'`,
    '    });'
  ].join('\n');
}

function buildScenarioFileName(item: ScenarioPlanItem): string {
  const routePrefix = normalizeRouteForFilePath(item.scenario.routePath);
  const viewportSuffix = slugify(item.target.viewport.name);
  const localeSuffix = slugify(item.target.locale.code);

  return `${routePrefix}-${slugify(item.scenario.id)}-${viewportSuffix}-${localeSuffix}`;
}

function normalizeRouteForFilePath(routePath: string): string {
  if (routePath === '/') {
    return 'root';
  }

  return slugify(routePath.replace(/^\//, ''));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[(?:\.\.\.)?([^\]]+)\]/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function escapeSingleQuotedString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function createExecutableRoutePath(routePath: string): string {
  if (routePath === '/') {
    return routePath;
  }

  return routePath.replace(/\[\[?\.\.\.(.+?)\]\]?|\[(.+?)\]/g, (_match, catchAllName, singleName) => {
    const dynamicName = catchAllName ?? singleName;
    return `sample-${slugify(dynamicName)}`;
  });
}