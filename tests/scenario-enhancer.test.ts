import { describe, expect, it } from 'vitest';

import { createLlmProvider, enhanceScenarios } from '../src/index.js';

describe('scenario enhancer', () => {
  it('passes routes, signals, and existing scenarios to the provider and returns the proposal', async () => {
    const provider = createLlmProvider({
      provider: 'mock',
      mockProposal: {
        provider: 'mock',
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
    });

    await expect(
      enhanceScenarios({
        provider,
        routes: [
          {
            path: '/catalog',
            filePath: 'app/catalog/page.tsx',
            dynamic: false,
            dynamicSegments: []
          }
        ],
        signals: [
          {
            kind: 'empty',
            identifier: 'empty',
            filePath: 'src/Catalog.tsx',
            line: 12,
            evidence: 'empty'
          }
        ],
        existingScenarios: [
          {
            id: 'catalog-default',
            routePath: '/catalog',
            name: 'Catalog Default',
            priority: 'low',
            tags: []
          }
        ]
      })
    ).resolves.toEqual({
      proposal: {
        provider: 'mock',
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
    });
  });

  it('reprioritizes returned scenarios using route heuristics and access signals', async () => {
    const provider = createLlmProvider({
      provider: 'mock',
      mockProposal: {
        provider: 'mock',
        model: 'test-model',
        scenarios: [
          {
            id: 'account-role-check',
            routePath: '/account',
            name: 'Account Role Check',
            priority: 'low',
            tags: ['auth']
          }
        ]
      }
    });

    const result = await enhanceScenarios({
      provider,
      routes: [
        {
          path: '/account',
          filePath: 'app/account/page.tsx',
          dynamic: false,
          dynamicSegments: []
        }
      ],
      signals: [],
      heuristicsByRoute: {
        '/account': [
          {
            kind: 'form',
            filePath: 'src/Account.tsx',
            line: 22,
            identifier: 'form',
            evidence: 'form',
            tags: ['form', 'validation'],
            recipes: ['submit-invalid-form']
          }
        ]
      },
      signalKindsByRoute: {
        '/account': ['role']
      }
    });

    expect(result).toEqual({
      proposal: {
        provider: 'mock',
        model: 'test-model',
        scenarios: [
          {
            id: 'account-role-check',
            routePath: '/account',
            name: 'Account Role Check',
            priority: 'high',
            tags: ['auth']
          }
        ]
      }
    });
  });
});