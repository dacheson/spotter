import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createGenerateWorkflowDependencies, createLlmProvider, runGenerateWorkflow } from '../src/index.js';

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