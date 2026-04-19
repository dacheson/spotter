import { describe, expect, it, vi } from 'vitest';

import { createDefaultCliHandlers } from '../src/cli/index.js';

describe('cli command handlers', () => {
  it('formats init, scan, generate, and report command output', async () => {
    const messages: string[] = [];
    const handlers = createDefaultCliHandlers({
      write: (message) => messages.push(message),
      runInit: async () => ({
        configPath: '/repo/spotter.config.json'
      }),
      runScan: async () => ({
        routeCount: 3,
        signalCount: 7,
        routeManifestPath: '/repo/.spotter/artifacts/route-manifest.json',
        signalsPath: '/repo/.spotter/artifacts/component-signals.json',
        heuristicsPath: '/repo/.spotter/artifacts/component-heuristics.json',
        summaryPath: '/repo/.spotter/artifacts/scan-summary.json'
      }),
      runGenerate: async () => ({
        outputDir: '/repo/.spotter/tests',
        planArtifactPath: '/repo/.spotter/artifacts/scenario-plan.json',
        scenariosArtifactPath: '/repo/.spotter/artifacts/scenarios.json',
        scenariosCount: 5,
        testFileCount: 10
      }),
      runReport: async () => ({
        artifactPath: '/repo/.spotter/artifacts/changed-run.json',
        lines: ['Changed run failed.', 'High priority diffs: 1.']
      })
    });

    await handlers.init?.({ commandName: 'init', environment: { cwd: '/repo' } });
    await handlers.scan?.({ commandName: 'scan', environment: { cwd: '/repo' } });
    await handlers.generate?.({ commandName: 'generate', environment: { cwd: '/repo' } });
    await handlers.report?.({ commandName: 'report', environment: { cwd: '/repo' } });

    expect(messages).toEqual([
      'Starter config written to /repo/spotter.config.json',
      'Detected 3 routes and 7 signals.',
      'Route manifest written to /repo/.spotter/artifacts/route-manifest.json',
      'Signal artifact written to /repo/.spotter/artifacts/component-signals.json',
      'Heuristic artifact written to /repo/.spotter/artifacts/component-heuristics.json',
      'Scan summary written to /repo/.spotter/artifacts/scan-summary.json',
      'Generated 10 Playwright test files from 5 scenarios.',
      'Generated tests written to /repo/.spotter/tests',
      'Scenario artifact written to /repo/.spotter/artifacts/scenarios.json',
      'Scenario plan artifact written to /repo/.spotter/artifacts/scenario-plan.json',
      'Changed run failed.',
      'High priority diffs: 1.',
      'Report artifact read from /repo/.spotter/artifacts/changed-run.json'
    ]);
  });
});