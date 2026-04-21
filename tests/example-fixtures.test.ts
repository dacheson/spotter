import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createConfiguredScenarioPlan,
  generateDeterministicScenarios,
  mapHeuristicsToRoutes,
  mapSignalKindsToRoutes,
  scanWorkspace,
  writeGeneratedPlaywrightTests
} from '../src/index.js';

const tempDirectories: string[] = [];
const examplesDir = fileURLToPath(new URL('../examples/', import.meta.url));

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-example-fixtures-'));
  tempDirectories.push(directory);
  return directory;
}

async function copyFixture(relativePath: string): Promise<string> {
  const cwd = await createTempDir();
  await cp(path.join(examplesDir, relativePath), cwd, { recursive: true });
  return cwd;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('example fixtures', () => {
  it('generates deterministic Next.js coverage from the Next UX fixture', async () => {
    const cwd = await copyFixture('fixture-next-ux');
    const scanResult = await scanWorkspace({ cwd });
    const heuristicsByRoute = mapHeuristicsToRoutes(scanResult.routeManifest.routes, scanResult.heuristics.heuristics);
    const signalKindsByRoute = mapSignalKindsToRoutes(scanResult.routeManifest.routes, scanResult.signals.findings);
    const scenarios = generateDeterministicScenarios({
      heuristicsByRoute,
      routes: scanResult.routeManifest.routes,
      signalKindsByRoute
    });
    const scenarioPlan = await createConfiguredScenarioPlan(scenarios, { cwd, generatedAt: '2026-04-19T12:00:00.000Z' });
    const written = await writeGeneratedPlaywrightTests(scenarioPlan, { cwd });
    const generatedFiles = written.files.map((file) => path.basename(file.filePath)).sort((left, right) => left.localeCompare(right));
    const dynamicFile = written.files.find((file) => file.scenario.routePath === '/blog/[slug]');
    const productsScenario = scenarios.find((scenario) => scenario.id === 'products-empty-state');
    const dynamicContents = dynamicFile ? await readFile(path.resolve(cwd, dynamicFile.filePath), 'utf8') : '';

    expect(scanResult.routeManifest.routes.map((route) => route.path)).toEqual([
      '/',
      '/admin',
      '/blog/[slug]',
      '/checkout',
      '/pricing',
      '/products'
    ]);
    expect(scanResult.signals.findings.map((finding) => finding.kind)).toEqual(['auth', 'role', 'loading', 'form', 'empty']);
    expect(productsScenario).toBeDefined();
    expect(generatedFiles).toContain('blog-slug-blog-slug-default-desktop-en-us.spec.ts');
    expect(generatedFiles).toContain('products-products-empty-state-mobile-en-us.spec.ts');
    expect(dynamicContents).toContain("await page.goto('/blog/sample-slug');");
  });

  it('degrades cleanly on the React Vite fixture without inventing routes', async () => {
    const cwd = await copyFixture('fixture-react-vite');
    const scanResult = await scanWorkspace({ cwd });
    const heuristicsByRoute = mapHeuristicsToRoutes(scanResult.routeManifest.routes, scanResult.heuristics.heuristics);
    const signalKindsByRoute = mapSignalKindsToRoutes(scanResult.routeManifest.routes, scanResult.signals.findings);
    const scenarios = generateDeterministicScenarios({
      heuristicsByRoute,
      routes: scanResult.routeManifest.routes,
      signalKindsByRoute
    });
    const scenarioPlan = await createConfiguredScenarioPlan(scenarios, { cwd, generatedAt: '2026-04-19T12:00:00.000Z' });
    const written = await writeGeneratedPlaywrightTests(scenarioPlan, { cwd });

    expect(scanResult.routeManifest.routes).toEqual([]);
    expect(scanResult.signals.findings.map((finding) => finding.kind)).toEqual(['loading', 'error', 'modal', 'auth', 'empty', 'form']);
    expect(scenarios).toEqual([]);
    expect(written.files).toEqual([]);
  });

  it('scans Vue Vite fixtures for component state signals', async () => {
    const cwd = await copyFixture('fixture-vue-vite');
    const scanResult = await scanWorkspace({ cwd });

    expect(scanResult.routeManifest.routes).toEqual([]);
    expect(scanResult.signals.findings.map((finding) => finding.kind)).toEqual(['loading', 'empty', 'form']);
    expect(scanResult.summaryPath.endsWith(path.join('.spotter', 'artifacts', 'scan-summary.json'))).toBe(true);
  });
});