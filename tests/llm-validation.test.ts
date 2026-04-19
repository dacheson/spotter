import { describe, expect, it } from 'vitest';

import {
  defaultMaxGeneratedScenarios,
  normalizeLlmEnhancementProposal,
  validateLlmEnhancementProposal
} from '../src/index.js';

describe('llm proposal validation', () => {
  it('validates and normalizes schema-compliant proposals', () => {
    expect(
      validateLlmEnhancementProposal({
        provider: ' mock ',
        model: ' gpt-5.4 ',
        scenarios: [
          {
            id: ' checkout-empty ',
            routePath: ' /checkout ',
            name: ' Checkout Empty ',
            priority: 'medium',
            tags: [' checkout ', 'empty', 'empty']
          }
        ]
      })
    ).toEqual({
      provider: 'mock',
      model: 'gpt-5.4',
      scenarios: [
        {
          id: 'checkout-empty',
          routePath: '/checkout',
          name: 'Checkout Empty',
          priority: 'medium',
          tags: ['checkout', 'empty']
        }
      ]
    });
  });

  it('rejects proposals that violate the JSON schema', () => {
    expect(() =>
      validateLlmEnhancementProposal({
        provider: 'mock',
        scenarios: [
          {
            id: 'checkout-empty',
            routePath: '/checkout',
            name: 'Checkout Empty',
            priority: 'urgent',
            tags: ['checkout']
          }
        ]
      })
    ).toThrow('Invalid LLM proposal');
  });

  it('merges deterministic scenarios before unique generated scenarios and applies the limit to additions', () => {
    expect(
      normalizeLlmEnhancementProposal({
        proposal: {
          provider: 'mock',
          scenarios: [
            {
              id: 'checkout-default-alt',
              routePath: '/checkout',
              name: 'Checkout Default',
              priority: 'low',
              tags: ['checkout']
            },
            {
              id: 'checkout-empty',
              routePath: '/checkout',
              name: 'Checkout Empty',
              priority: 'medium',
              tags: ['checkout', 'empty']
            },
            {
              id: 'checkout-payment-failure',
              routePath: '/checkout',
              name: 'Checkout Payment Failure',
              priority: 'high',
              tags: ['checkout', 'error']
            }
          ]
        },
        existingScenarios: [
          {
            id: 'checkout-default',
            routePath: '/checkout',
            name: 'Checkout Default',
            priority: 'high',
            tags: ['checkout']
          }
        ],
        maxGeneratedScenarios: 1
      })
    ).toEqual({
      provider: 'mock',
      scenarios: [
        {
          id: 'checkout-default',
          routePath: '/checkout',
          name: 'Checkout Default',
          priority: 'high',
          tags: ['checkout']
        },
        {
          id: 'checkout-empty',
          routePath: '/checkout',
          name: 'Checkout Empty',
          priority: 'medium',
          tags: ['checkout', 'empty']
        }
      ]
    });
  });

  it('uses a stable default limit for generated scenarios', () => {
    expect(defaultMaxGeneratedScenarios).toBe(25);
  });
});