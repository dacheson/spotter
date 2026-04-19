import { describe, expect, it } from 'vitest';

import { createLlmProvider, enhanceScenarios } from '../src/index.js';

describe('scenario enhancer', () => {
  it('merges validated provider scenarios with existing scenarios', async () => {
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
            id: 'catalog-default',
            routePath: '/catalog',
            name: 'Catalog Default',
            priority: 'low',
            tags: []
          },
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

  it('deduplicates provider suggestions against deterministic scenarios and caps generated additions', async () => {
    const provider = createLlmProvider({
      provider: 'mock',
      mockProposal: {
        provider: 'mock',
        scenarios: [
          {
            id: 'catalog-default-copy',
            routePath: '/catalog',
            name: 'Catalog Default',
            priority: 'low',
            tags: ['  empty  ', 'empty']
          },
          {
            id: 'catalog-empty-state',
            routePath: '/catalog',
            name: 'Catalog Empty State',
            priority: 'low',
            tags: ['empty']
          },
          {
            id: 'catalog-filter-reset',
            routePath: '/catalog',
            name: 'Catalog Filter Reset',
            priority: 'medium',
            tags: ['filters']
          },
          {
            id: 'catalog-mobile-grid',
            routePath: '/catalog',
            name: 'Catalog Mobile Grid',
            priority: 'medium',
            tags: ['mobile']
          }
        ]
      }
    });

    const result = await enhanceScenarios({
      provider,
      maxGeneratedScenarios: 2,
      routes: [
        {
          path: '/catalog',
          filePath: 'app/catalog/page.tsx',
          dynamic: false,
          dynamicSegments: []
        }
      ],
      signals: [],
      existingScenarios: [
        {
          id: 'catalog-default',
          routePath: '/catalog',
          name: 'Catalog Default',
          priority: 'low',
          tags: []
        }
      ]
    });

    expect(result).toEqual({
      proposal: {
        provider: 'mock',
        scenarios: [
          {
            id: 'catalog-default',
            routePath: '/catalog',
            name: 'Catalog Default',
            priority: 'low',
            tags: []
          },
          {
            id: 'catalog-empty-state',
            routePath: '/catalog',
            name: 'Catalog Empty State',
            priority: 'low',
            tags: ['empty']
          },
          {
            id: 'catalog-filter-reset',
            routePath: '/catalog',
            name: 'Catalog Filter Reset',
            priority: 'low',
            tags: ['filters']
          }
        ]
      }
    });
  });
});