import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createGenerateWorkflowDependencies,
  createLlmProvider,
  runGenerateWorkflow,
  runImportWorkflow,
  runPromptWorkflow
} from '../src/index.js';

const tempDirectories: string[] = [];
const examplesDir = fileURLToPath(new URL('../examples/', import.meta.url));

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-generate-workflow-'));
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

describe('generate workflow', () => {
  it('writes a scenario assist prompt and structured context artifact', async () => {
    const cwd = await copyFixture('fixture-react-vite');

    await writeFile(
      path.join(cwd, 'spotter.config.json'),
      JSON.stringify(
        {
          appUrl: 'http://127.0.0.1:5173',
          devServer: null,
          llm: {
            fallback: {
              enabled: true,
              provider: 'mock',
              model: 'test-model',
              instructions: 'Prefer scenarios inferred from explicit empty and modal states.'
            }
          }
        },
        null,
        2
      )
    );

    const result = await runPromptWorkflow({ cwd });
    const promptContents = await readFile(result.promptPath, 'utf8');
    const contextContents = JSON.parse(await readFile(result.contextPath, 'utf8')) as {
      routeCount: number;
      signalCount: number;
      scenarioCount: number;
      instructions: string | null;
      userPrompt: string;
      warnings: string[];
    };

    expect(result.framework).toBe('vite-react');
    expect(result.routeCount).toBe(0);
    expect(result.signalCount).toBeGreaterThan(0);
    expect(result.scenarioCount).toBe(0);
    expect(result.warnings).toEqual([
      'Detected a Vite React workspace but found no deterministic routes during prompt. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.'
    ]);
    expect(promptContents).toContain('# Spotter Scenario Assist Prompt');
    expect(promptContents).toContain('## Copy This System Prompt');
    expect(promptContents).toContain('## Copy This User Prompt');
    expect(promptContents).toContain('## Expected Response Shape');
    expect(promptContents).toContain('Extra instructions: Prefer scenarios inferred from explicit empty and modal states.');
    expect(contextContents.routeCount).toBe(0);
    expect(contextContents.signalCount).toBeGreaterThan(0);
    expect(contextContents.scenarioCount).toBe(0);
    expect(contextContents.instructions).toBe('Prefer scenarios inferred from explicit empty and modal states.');
    expect(contextContents.userPrompt).toContain('Component signals:');
    expect(contextContents.warnings).toEqual(result.warnings);
  });

  it('formats route-rich prompts and imports reviewed scenario suggestions', async () => {
    const cwd = await copyFixture('fixture-next-ux');
    const promptResult = await runPromptWorkflow({ cwd });
    const promptContents = await readFile(promptResult.promptPath, 'utf8');
    const inputPath = path.join(cwd, 'manual-response.json');

    await writeFile(
      inputPath,
      `\uFEFF${JSON.stringify(
        {
          provider: 'ide-manual',
          model: 'copilot-chat',
          scenarios: [
            {
              id: 'products-feature-flag-state',
              routePath: '/products',
              name: 'Products Feature Flag State',
              priority: 'low',
              tags: ['feature-flag']
            }
          ]
        },
        null,
        2
      )}`,
      'utf8'
    );

    const importResult = await runImportWorkflow({ cwd, inputPath });
    const importedProposal = JSON.parse(await readFile(importResult.proposalArtifactPath, 'utf8')) as {
      scenarios: Array<{ id: string; priority: string; routePath: string }>;
    };
    const scenariosArtifact = JSON.parse(await readFile(importResult.scenariosArtifactPath, 'utf8')) as {
      scenarios: Array<{ id: string; priority: string; routePath: string }>;
    };

    expect(promptResult.routeCount).toBeGreaterThan(0);
    expect(promptContents).toContain('## Route Inventory');
    expect(promptContents).toContain('## Suggested Ask');
    expect(promptContents).toContain('Use the listed routes when proposing routePath values.');
    expect(importResult.importedScenarioCount).toBe(1);
    expect(importResult.scenariosCount).toBeGreaterThan(1);
    expect(
      importedProposal.scenarios.some(
        (scenario) =>
          scenario.id === 'products-feature-flag-state' &&
          scenario.priority === 'low' &&
          scenario.routePath === '/products'
      )
    ).toBe(true);
    expect(
      scenariosArtifact.scenarios.some(
        (scenario) =>
          scenario.id === 'products-feature-flag-state' &&
          scenario.priority === 'low' &&
          scenario.routePath === '/products'
      )
    ).toBe(true);
  });

  it('uses the llm fallback when no deterministic routes are found', async () => {
    const cwd = await copyFixture('fixture-react-vite');
    const result = await runGenerateWorkflow(
      { cwd },
      {
        llmInstructions: 'Prefer scenarios inferred from explicit empty and modal states.',
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
        })
      }
    );
    const scenariosArtifact = JSON.parse(await readFile(result.scenariosArtifactPath, 'utf8')) as {
      scenarios: Array<{ id: string; routePath: string }>;
    };

    expect(result.framework).toBe('vite-react');
    expect(result.scenarioSource).toBe('llm-fallback');
    expect(result.scenariosCount).toBe(1);
    expect(result.testFileCount).toBe(2);
    expect(result.warnings).toEqual([
      'Detected a Vite React workspace but found no deterministic routes during generate. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.',
      'Used mock (test-model) to infer scenarios because no deterministic routes were found.'
    ]);
    expect(scenariosArtifact.scenarios).toEqual([
      {
        id: 'catalog-empty-state',
        name: 'Catalog Empty State',
        priority: 'low',
        routePath: '/catalog',
        tags: ['empty']
      }
    ]);
  });

  it('builds generate workflow dependencies from config-based llm fallback settings', async () => {
    const cwd = await copyFixture('fixture-react-vite');

    await writeFile(
      path.join(cwd, 'spotter.config.json'),
      JSON.stringify(
        {
          appUrl: 'http://127.0.0.1:5173',
          devServer: null,
          rootDir: '.',
          llm: {
            fallback: {
              enabled: true,
              provider: 'mock',
              model: 'test-model',
              instructions: 'Prefer states implied by explicit empty branches.',
              maxGeneratedScenarios: 2
            }
          }
        },
        null,
        2
      )
    );

    const dependencies = await createGenerateWorkflowDependencies({ cwd });

    expect(dependencies.llmInstructions).toBe('Prefer states implied by explicit empty branches.');
    expect(dependencies.maxGeneratedScenarios).toBe(2);
    expect(dependencies.llmProvider?.metadata).toEqual({
      name: 'mock',
      model: 'test-model',
      supportsJsonOnly: true
    });
  });
});