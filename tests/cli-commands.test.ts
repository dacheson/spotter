import { describe, expect, it, vi } from 'vitest';

import { createDefaultCliHandlers, createLlmProvider } from '../src/index.js';

describe('cli command handlers', () => {
  it('formats init, scan, generate, and report command output', async () => {
    const messages: string[] = [];
    const handlers = createDefaultCliHandlers({
      write: (message) => messages.push(message),
      runInit: async () => ({
        configPath: '/repo/spotter.config.json'
      }),
      runScan: async () => ({
        framework: 'next-app',
        routeCount: 3,
        signalCount: 7,
        routeManifestPath: '/repo/.spotter/artifacts/route-manifest.json',
        signalsPath: '/repo/.spotter/artifacts/component-signals.json',
        heuristicsPath: '/repo/.spotter/artifacts/component-heuristics.json',
        summaryPath: '/repo/.spotter/artifacts/scan-summary.json',
        warnings: []
      }),
      runGenerate: async () => ({
        framework: 'next-app',
        outputDir: '/repo/.spotter/tests',
        planArtifactPath: '/repo/.spotter/artifacts/scenario-plan.json',
        scenariosArtifactPath: '/repo/.spotter/artifacts/scenarios.json',
        scenariosCount: 5,
        scenarioSource: 'deterministic',
        testFileCount: 10,
        warnings: []
      }),
      runReport: async () => ({
        artifactPath: '/repo/.spotter/artifacts/changed-run.json',
        lines: ['Changed run failed.', 'High priority diffs: 1.'],
        markdownPath: '/repo/.spotter/artifacts/visual-report.md'
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
      'Markdown report written to /repo/.spotter/artifacts/visual-report.md',
      'Report artifact read from /repo/.spotter/artifacts/changed-run.json'
    ]);
  });

  it('prints framework warnings and llm fallback usage for route-less repos', async () => {
    const messages: string[] = [];
    const handlers = createDefaultCliHandlers({
      write: (message) => messages.push(message),
      llmProvider: createLlmProvider({
        provider: 'mock',
        model: 'test-model',
        mockProposal: {
          provider: 'mock',
          model: 'test-model',
          scenarios: [
            {
              id: 'catalog-empty-state',
              routePath: '/catalog',
              name: 'Catalog Empty State',
              priority: 'low',
              tags: ['empty']
            }
          ]
        }
      }),
      runScan: async () => ({
        framework: 'vite-react',
        routeCount: 0,
        signalCount: 4,
        routeManifestPath: '/repo/.spotter/artifacts/route-manifest.json',
        signalsPath: '/repo/.spotter/artifacts/component-signals.json',
        heuristicsPath: '/repo/.spotter/artifacts/component-heuristics.json',
        summaryPath: '/repo/.spotter/artifacts/scan-summary.json',
        warnings: [
          'Detected a Vite React workspace but found no deterministic routes during scan. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.'
        ]
      }),
      runGenerate: async () => ({
        framework: 'vite-react',
        outputDir: '/repo/.spotter/tests',
        planArtifactPath: '/repo/.spotter/artifacts/scenario-plan.json',
        scenariosArtifactPath: '/repo/.spotter/artifacts/scenarios.json',
        scenariosCount: 1,
        scenarioSource: 'llm-fallback',
        testFileCount: 1,
        warnings: [
          'Detected a Vite React workspace but found no deterministic routes during generate. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.',
          'Used mock (test-model) to infer scenarios because no deterministic routes were found.'
        ]
      })
    });

    await handlers.scan?.({ commandName: 'scan', environment: { cwd: '/repo' } });
    await handlers.generate?.({ commandName: 'generate', environment: { cwd: '/repo' } });

    expect(messages).toEqual([
      'Detected 0 routes and 4 signals.',
      'Detected a Vite React workspace but found no deterministic routes during scan. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.',
      'Route manifest written to /repo/.spotter/artifacts/route-manifest.json',
      'Signal artifact written to /repo/.spotter/artifacts/component-signals.json',
      'Heuristic artifact written to /repo/.spotter/artifacts/component-heuristics.json',
      'Scan summary written to /repo/.spotter/artifacts/scan-summary.json',
      'Generated 1 Playwright test files from 1 scenarios.',
      'Scenario generation used the LLM fallback because no deterministic routes were found.',
      'Detected a Vite React workspace but found no deterministic routes during generate. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.',
      'Used mock (test-model) to infer scenarios because no deterministic routes were found.',
      'Generated tests written to /repo/.spotter/tests',
      'Scenario artifact written to /repo/.spotter/artifacts/scenarios.json',
      'Scenario plan artifact written to /repo/.spotter/artifacts/scenario-plan.json'
    ]);
  });
});