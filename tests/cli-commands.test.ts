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
      runPrompt: async () => ({
        contextPath: '/repo/.spotter/artifacts/scenario-assist.context.json',
        framework: 'next-app',
        promptPath: '/repo/.spotter/artifacts/scenario-assist.prompt.md',
        routeCount: 3,
        scenarioCount: 5,
        signalCount: 7,
        warnings: []
      }),
      runImport: async () => ({
        framework: 'next-app',
        importedScenarioCount: 2,
        outputDir: '/repo/.spotter/tests',
        planArtifactPath: '/repo/.spotter/artifacts/scenario-plan.json',
        proposalArtifactPath: '/repo/.spotter/artifacts/scenario-import.json',
        scenariosArtifactPath: '/repo/.spotter/artifacts/scenarios.json',
        scenariosCount: 7,
        testFileCount: 14,
        warnings: []
      }),
      runReport: async () => ({
        artifactPath: '/repo/.spotter/artifacts/changed-run.json',
        lines: ['Changed run failed.', 'High priority diffs: 1.'],
        markdownPath: '/repo/.spotter/artifacts/visual-report.md'
      }),
      runChanged: async () => ({
        artifactPath: '/repo/.spotter/artifacts/changed-run.json',
        appUrl: 'http://127.0.0.1:3000',
        baselineDir: '/repo/.spotter/baselines',
        configPath: '/repo/.spotter/artifacts/playwright.changed.config.mjs',
        resultsDir: '/repo/.spotter/artifacts/playwright-results',
        testDir: '/repo/.spotter/tests',
        command: 'npx',
        args: ['playwright', 'test', '--config', 'config'],
        completed: true,
        exitCode: 1,
        passed: false,
        selection: {
          changedFiles: ['app/components/checkout/summary.tsx'],
          mode: 'impact',
          possibleAdditionalImpact: [
            {
              confidence: 'unknown',
              correctionHint: 'Review this low-confidence scenario. Keep it as-is, add an explicit override, or exclude it if the shared change is not user-visible here.',
              executionScope: '2 targets across 2 viewports and 1 locale',
              provenance: ['route:/checkout', 'scenario:checkout-default', 'changed-file:app/components/checkout/summary.tsx', 'path-overlap:checkout'],
              routePath: '/checkout',
              scenarioId: 'checkout-default',
              scenarioName: 'Checkout Default',
              whyIncluded:
                'Possible additional impact because app/components/checkout/summary.tsx overlaps with /checkout via path segment "checkout".'
            }
          ],
          reason: 'Flagged 1 possible additional impact scenarios from 1 changed files.',
          trustedScenarios: []
        },
        summary: {
          changed: 0,
          unchanged: 0,
          artifacts: []
        }
      }),
      runOverride: async () => ({
        action: 'exclude',
        changed: true,
        configPath: '/repo/spotter.config.json',
        createdConfig: false,
        scenarioId: 'checkout-loading-state'
      })
    });

    await handlers.init?.({ commandName: 'init', environment: { cwd: '/repo' } });
    await handlers.scan?.({ commandName: 'scan', environment: { cwd: '/repo' } });
    await handlers.generate?.({ commandName: 'generate', environment: { cwd: '/repo' } });
    await handlers.prompt?.({ commandName: 'prompt', environment: { cwd: '/repo' } });
    await handlers.import?.({ commandName: 'import', environment: { cwd: '/repo' }, importOptions: { inputPath: 'manual.json' } });
    await handlers.override?.({
      commandName: 'override',
      environment: { cwd: '/repo' },
      overrideOptions: {
        action: 'exclude',
        scenarioId: 'checkout-loading-state'
      }
    });
    await handlers.changed?.({
      commandName: 'changed',
      environment: { cwd: '/repo' }
    });
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
      'Prepared an assist prompt from 3 routes, 7 signals, and 5 deterministic scenarios.',
      'Scenario assist prompt written to /repo/.spotter/artifacts/scenario-assist.prompt.md',
      'Scenario assist context written to /repo/.spotter/artifacts/scenario-assist.context.json',
      'Imported 2 assisted scenarios and generated 14 Playwright test files from 7 total scenarios.',
      'Generated tests written to /repo/.spotter/tests',
      'Scenario import artifact written to /repo/.spotter/artifacts/scenario-import.json',
      'Scenario artifact written to /repo/.spotter/artifacts/scenarios.json',
      'Scenario plan artifact written to /repo/.spotter/artifacts/scenario-plan.json',
      'Scenario exclude override recorded for checkout-loading-state.',
      'Updated Spotter config at /repo/spotter.config.json',
      'Changed run failed with 0 changed screenshots.',
      'Possible additional impact: 1 low-confidence scenarios require review in spotter report.',
      'Changed artifact written to /repo/.spotter/artifacts/changed-run.json',
      'Changed run failed.',
      'High priority diffs: 1.',
      'Markdown report written to /repo/.spotter/artifacts/visual-report.md',
      'Report artifact read from /repo/.spotter/artifacts/changed-run.json'
    ]);
  });

  it('prints override idempotency and config creation status', async () => {
    const messages: string[] = [];
    const handlers = createDefaultCliHandlers({
      write: (message) => messages.push(message),
      runOverride: async () => ({
        action: 'include',
        changed: false,
        configPath: '/repo/spotter.config.json',
        createdConfig: true,
        scenarioId: 'checkout-empty-state-manual'
      })
    });

    await handlers.override?.({
      commandName: 'override',
      environment: { cwd: '/repo' },
      overrideOptions: {
        action: 'include',
        scenario: {
          id: 'checkout-empty-state-manual',
          routePath: '/checkout',
          name: 'Checkout Empty State',
          priority: 'medium',
          tags: ['checkout', 'empty']
        }
      }
    });

    expect(messages).toEqual([
      'Scenario include override already matched checkout-empty-state-manual.',
      'Created Spotter config at /repo/spotter.config.json'
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

  it('prints warnings for prompt generation in route-less repos', async () => {
    const messages: string[] = [];
    const handlers = createDefaultCliHandlers({
      write: (message) => messages.push(message),
      runPrompt: async () => ({
        contextPath: '/repo/.spotter/artifacts/scenario-assist.context.json',
        framework: 'vite-react',
        promptPath: '/repo/.spotter/artifacts/scenario-assist.prompt.md',
        routeCount: 0,
        scenarioCount: 0,
        signalCount: 4,
        warnings: [
          'Detected a Vite React workspace but found no deterministic routes during prompt. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.'
        ]
      })
    });

    await handlers.prompt?.({ commandName: 'prompt', environment: { cwd: '/repo' } });

    expect(messages).toEqual([
      'Prepared an assist prompt from 0 routes, 4 signals, and 0 deterministic scenarios.',
      'Detected a Vite React workspace but found no deterministic routes during prompt. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.',
      'Scenario assist prompt written to /repo/.spotter/artifacts/scenario-assist.prompt.md',
      'Scenario assist context written to /repo/.spotter/artifacts/scenario-assist.context.json'
    ]);
  });

  it('prints warnings and artifact paths for imported scenario suggestions', async () => {
    const messages: string[] = [];
    const handlers = createDefaultCliHandlers({
      write: (message) => messages.push(message),
      runImport: async () => ({
        framework: 'vite-react',
        importedScenarioCount: 1,
        outputDir: '/repo/.spotter/tests',
        planArtifactPath: '/repo/.spotter/artifacts/scenario-plan.json',
        proposalArtifactPath: '/repo/.spotter/artifacts/scenario-import.json',
        scenariosArtifactPath: '/repo/.spotter/artifacts/scenarios.json',
        scenariosCount: 1,
        testFileCount: 2,
        warnings: [
          'Detected a Vite React workspace but found no deterministic routes during import. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.'
        ]
      })
    });

    await handlers.import?.({ commandName: 'import', environment: { cwd: '/repo' }, importOptions: { inputPath: 'manual.json' } });

    expect(messages).toEqual([
      'Imported 1 assisted scenarios and generated 2 Playwright test files from 1 total scenarios.',
      'Detected a Vite React workspace but found no deterministic routes during import. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.',
      'Generated tests written to /repo/.spotter/tests',
      'Scenario import artifact written to /repo/.spotter/artifacts/scenario-import.json',
      'Scenario artifact written to /repo/.spotter/artifacts/scenarios.json',
      'Scenario plan artifact written to /repo/.spotter/artifacts/scenario-plan.json'
    ]);
  });
});