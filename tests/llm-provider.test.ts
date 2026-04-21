import { describe, expect, it, vi } from 'vitest';

import {
  buildScenarioEnhancementPrompts,
  createConfiguredLlmProvider,
  createLlmProvider,
  type LlmEnhancementInput,
  type LlmEnhancementProposal,
  type LlmProviderRequest
} from '../src/index.js';

function createInput(): LlmEnhancementInput {
  return {
    instructions: 'Prefer scenarios that expand existing deterministic coverage.',
    routes: [
      {
        path: '/checkout',
        filePath: 'app/checkout/page.tsx',
        dynamic: false,
        dynamicSegments: []
      }
    ],
    signals: [
      {
        kind: 'form',
        identifier: 'form',
        filePath: 'src/components/Checkout.tsx',
        line: 12,
        evidence: 'form'
      }
    ],
    existingScenarios: [
      {
        id: 'checkout-default',
        routePath: '/checkout',
        name: 'Checkout Default',
        priority: 'high',
        tags: ['checkout']
      }
    ]
  };
}

describe('llm provider abstraction', () => {
  it('returns the configured proposal from the mock provider', async () => {
    const proposal: LlmEnhancementProposal = {
      provider: 'mock',
      model: 'test-model',
      scenarios: [
        {
          id: 'checkout-validation',
          routePath: '/checkout',
          name: 'Checkout Validation Error',
          priority: 'medium',
          tags: ['checkout', 'form', 'validation']
        }
      ]
    };
    const provider = createLlmProvider({
      provider: 'mock',
      model: 'test-model',
      mockProposal: proposal
    });

    await expect(provider.enhanceScenarios(createInput())).resolves.toEqual(proposal);
    expect(provider.metadata).toEqual({
      name: 'mock',
      model: 'test-model',
      supportsJsonOnly: true
    });
  });

  it('builds deterministic prompts and delegates invocation for non-mock providers', async () => {
    const invoker = vi.fn(async (request: LlmProviderRequest) => ({
      rawText: '{"provider":"openai","scenarios":[]}',
      proposal: {
        provider: 'openai',
        model: 'gpt-5',
        scenarios: []
      }
    }));
    const provider = createLlmProvider({
      provider: 'openai',
      model: 'gpt-5',
      invoker
    });

    await expect(provider.enhanceScenarios(createInput())).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-5',
      scenarios: []
    });
    expect(invoker).toHaveBeenCalledTimes(1);
    expect(invoker.mock.calls[0]?.[0]).toMatchObject({
      jsonOnly: true,
      metadata: {
        name: 'openai',
        model: 'gpt-5',
        supportsJsonOnly: true
      }
    });
  });

  it('rejects invalid proposal payloads returned by an invoker-backed provider', async () => {
    const provider = createLlmProvider({
      provider: 'openai',
      model: 'gpt-5',
      invoker: async () => ({
        rawText: '{"provider":"openai","scenarios":[{"id":"bad","routePath":"/checkout","name":"Bad","priority":"urgent","tags":[]}]}',
        proposal: {
          provider: 'openai',
          scenarios: [
            {
              id: 'bad',
              routePath: '/checkout',
              name: 'Bad',
              priority: 'urgent',
              tags: []
            }
          ]
        }
      })
    });

    await expect(provider.enhanceScenarios(createInput())).rejects.toThrow('Invalid LLM proposal');
  });

  it('renders deterministic prompts from routes, signals, and existing scenarios', () => {
    expect(buildScenarioEnhancementPrompts(createInput())).toEqual({
      systemPrompt:
        'You are Spotter, a deterministic-first UX scenario planner. Return JSON only. Suggest only missing scenarios that add clear coverage value.',
      userPrompt: [
        'Routes:',
        JSON.stringify(createInput().routes, null, 2),
        '',
        'Component signals:',
        JSON.stringify(createInput().signals, null, 2),
        '',
        'Existing scenarios:',
        JSON.stringify(createInput().existingScenarios, null, 2),
        '',
        'Return JSON with shape:',
        JSON.stringify({ provider: 'provider-name', model: 'model-name', scenarios: [] }, null, 2),
        '',
        'Extra instructions: Prefer scenarios that expand existing deterministic coverage.'
      ].join('\n')
    });
  });

  it('throws a clear error when an invoker-backed provider has no invoker', async () => {
    const provider = createLlmProvider({
      provider: 'local',
      model: 'llama'
    });

    await expect(provider.enhanceScenarios(createInput())).rejects.toThrow(
      'LLM provider local requires an invoker implementation.'
    );
  });

  it('creates an OpenAI-compatible configured provider that parses JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"provider":"openai","model":"gpt-5.4","scenarios":[]}'
              }
            }
          ]
        })
      }))
    );
    process.env.OPENAI_API_KEY = 'test-key';

    const provider = createConfiguredLlmProvider({
      provider: 'openai',
      model: 'gpt-5.4'
    });

    await expect(provider.enhanceScenarios(createInput())).resolves.toEqual({
      provider: 'openai',
      model: 'gpt-5.4',
      scenarios: []
    });

    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });
});