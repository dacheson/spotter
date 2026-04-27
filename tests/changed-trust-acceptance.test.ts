import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readVisualReportSummary,
  renderVisualReportMarkdown,
  runChangedCommand,
  runGenerateWorkflow
} from '../src/index.js';

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];
const examplesDir = fileURLToPath(new URL('../examples/', import.meta.url));

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-changed-trust-acceptance-'));
  tempDirectories.push(directory);
  return directory;
}

async function copyFixture(relativePath: string): Promise<string> {
  const cwd = await createTempDir();
  await cp(path.join(examplesDir, relativePath), cwd, { recursive: true });
  return cwd;
}

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('changed trust acceptance', () => {
  it('keeps changed selection narrow and preserves manual correction provenance in the manifest summary', async () => {
    const cwd = await copyFixture('fixture-next-ux');
    const configPath = path.join(cwd, 'spotter.config.json');

    await writeFile(
      configPath,
      JSON.stringify(
        {
          appUrl: 'http://127.0.0.1:3000',
          devServer: null,
          rootDir: '.',
          viewports: [
            {
              name: 'desktop',
              width: 1440,
              height: 900
            },
            {
              name: 'mobile',
              width: 390,
              height: 844
            }
          ],
          locales: [
            {
              code: 'en-US',
              label: 'English (US)',
              rtl: false
            }
          ],
          paths: {
            artifactsDir: '.spotter/artifacts',
            screenshotsDir: '.spotter/baselines',
            testsDir: '.spotter/tests'
          },
          overrides: {
            scenarios: {
              exclude: {},
              include: [
                {
                  id: 'checkout-manual-review-state',
                  routePath: '/checkout',
                  name: 'Checkout Manual Review State',
                  priority: 'medium',
                  tags: ['checkout', 'manual-review']
                }
              ]
            }
          }
        },
        null,
        2
      )
    );

    const generateResult = await runGenerateWorkflow({ cwd });
    const scenariosArtifact = JSON.parse(await readFile(generateResult.scenariosArtifactPath, 'utf8')) as {
      scenarios: Array<{ id: string; routePath: string; origin?: string }>;
    };

    expect(
      scenariosArtifact.scenarios.some(
        (scenario) =>
          scenario.id === 'checkout-manual-review-state' &&
          scenario.routePath === '/checkout' &&
          scenario.origin === 'user-override'
      )
    ).toBe(true);

    await runGit(cwd, ['init']);
    await runGit(cwd, ['config', 'user.email', 'spotter@example.com']);
    await runGit(cwd, ['config', 'user.name', 'Spotter Test']);
    await runGit(cwd, ['add', '.']);
    await runGit(cwd, ['commit', '-m', 'baseline']);

    await writeFile(
      path.join(cwd, 'app', 'checkout', 'page.tsx'),
      [
        'export default function CheckoutPage() {',
        '  const loading = false;',
        '',
        '  if (loading) {',
        '    return <div>Loading checkout</div>;',
        '  }',
        '',
        '  return (',
        '    <form>',
        '      <h1>Checkout</h1>',
        '      <input name="email" />',
        '      <button type="submit">Complete purchase now</button>',
        '    </form>',
        '  );',
        '}'
      ].join('\n'),
      'utf8'
    );

    const changedResult = await runChangedCommand(
      { cwd },
      {
        runner: async () => {
          const resultsDir = path.join(cwd, '.spotter', 'artifacts', 'playwright-results');
          await mkdir(resultsDir, { recursive: true });
          await writeFile(path.join(resultsDir, 'checkout-manual-review-state-diff.png'), 'diff', 'utf8');
          await writeFile(path.join(resultsDir, 'checkout-manual-review-state-actual.png'), 'actual', 'utf8');
          await writeFile(path.join(resultsDir, 'checkout-manual-review-state-expected.png'), 'expected', 'utf8');
          return { exitCode: 1 };
        }
      }
    );
    const summary = await readVisualReportSummary({ cwd });
    const markdown = renderVisualReportMarkdown(summary);
    const manualScenario = changedResult.selection?.trustedScenarios.find(
      (scenario) => scenario.scenarioId === 'checkout-manual-review-state'
    );

    expect(changedResult.selection?.mode).toBe('impact');
    expect(changedResult.selection?.trustedScenarios.length ?? 0).toBeGreaterThan(0);
    expect(changedResult.selection?.trustedScenarios.length ?? 0).toBeLessThan(scenariosArtifact.scenarios.length);
    expect(changedResult.selection?.changedFiles).toEqual(['app/checkout/page.tsx']);
    expect(changedResult.selection?.trustedScenarios.every((scenario) => scenario.routePath === '/checkout')).toBe(true);
    expect(manualScenario).toEqual(
      expect.objectContaining({
        routePath: '/checkout',
        scenarioName: 'Checkout Manual Review State'
      })
    );
    expect(manualScenario?.provenance).toContain('source:user-override');
    expect(manualScenario?.provenance).toContain('changed-file:app/checkout/page.tsx');
    expect(summary.selectionMode).toBe('impact');
    expect(summary.selectionReason).toContain('Selected ');
    expect(summary.selectionReason).toContain('1 changed files');
    expect(summary.trustedScenarios).toEqual(changedResult.selection?.trustedScenarios ?? []);
    expect(markdown).toContain('## Scenario Manifest Summary');
    expect(markdown).toContain('### Trusted Scenarios');
    expect(markdown).toContain('Checkout Manual Review State');
    expect(markdown).toContain('source:user-override');
    expect(markdown).toContain('changed-file:app/checkout/page.tsx');
  });

  it('surfaces possible additional impact for shared component changes instead of running the full suite', async () => {
    const cwd = await copyFixture('fixture-next-ux');

    await mkdir(path.join(cwd, 'app', 'components', 'checkout'), { recursive: true });
    await writeFile(
      path.join(cwd, 'app', 'components', 'checkout', 'summary.tsx'),
      [
        'export function CheckoutSummary() {',
        '  return <aside>Checkout summary</aside>;',
        '}'
      ].join('\n'),
      'utf8'
    );

    const generateResult = await runGenerateWorkflow({ cwd });
    const scenariosArtifact = JSON.parse(await readFile(generateResult.scenariosArtifactPath, 'utf8')) as {
      scenarios: Array<{ id: string; routePath: string }>;
    };

    await runGit(cwd, ['init']);
    await runGit(cwd, ['config', 'user.email', 'spotter@example.com']);
    await runGit(cwd, ['config', 'user.name', 'Spotter Test']);
    await runGit(cwd, ['add', '.']);
    await runGit(cwd, ['commit', '-m', 'baseline']);

    await writeFile(
      path.join(cwd, 'app', 'components', 'checkout', 'summary.tsx'),
      [
        'export function CheckoutSummary() {',
        '  return <aside>Checkout summary updated</aside>;',
        '}'
      ].join('\n'),
      'utf8'
    );

    const changedResult = await runChangedCommand(
      { cwd },
      {
        runner: async () => {
          const resultsDir = path.join(cwd, '.spotter', 'artifacts', 'playwright-results');
          await mkdir(resultsDir, { recursive: true });
          await writeFile(path.join(resultsDir, 'checkout-default-diff.png'), 'diff', 'utf8');
          await writeFile(path.join(resultsDir, 'checkout-default-actual.png'), 'actual', 'utf8');
          await writeFile(path.join(resultsDir, 'checkout-default-expected.png'), 'expected', 'utf8');
          return { exitCode: 1 };
        }
      }
    );
    const summary = await readVisualReportSummary({ cwd });
    const markdown = renderVisualReportMarkdown(summary);

    expect(changedResult.selection?.mode).toBe('impact');
    expect(changedResult.selection?.trustedScenarios).toEqual([]);
    expect(changedResult.selection?.possibleAdditionalImpact.length ?? 0).toBeGreaterThan(0);
    expect(changedResult.selection?.changedFiles).toEqual(['app/components/checkout/summary.tsx']);
    expect(changedResult.args).toContain('--grep');
    expect(changedResult.args.join(' ')).toContain('checkout-default');
    expect((changedResult.selection?.possibleAdditionalImpact.length ?? 0)).toBeLessThan(scenariosArtifact.scenarios.length);
    expect(changedResult.selection?.possibleAdditionalImpact.some((scenario) => scenario.routePath === '/checkout')).toBe(true);
    expect(changedResult.selection?.possibleAdditionalImpact.every((scenario) => scenario.confidence === 'unknown')).toBe(true);
    expect(summary.selectionMode).toBe('impact');
    expect(summary.trustedScenarios).toEqual([]);
    expect(summary.possibleAdditionalImpact).toEqual(changedResult.selection?.possibleAdditionalImpact ?? []);
    expect(markdown).toContain('## Scenario Manifest Summary');
    expect(markdown).toContain('### Possible Additional Impact');
    expect(markdown).toContain('path-overlap:checkout');
    expect(markdown).not.toContain('running the full generated suite');
  });
});