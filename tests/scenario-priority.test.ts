import { describe, expect, it } from 'vitest';

import { evaluateScenarioPriority, prioritizeScenarios, type ScenarioDefinition } from '../src/index.js';

describe('scenario priority engine', () => {
  it('assigns high priority to critical routes with high-risk tags and heuristics', () => {
    const scenario: ScenarioDefinition = {
      id: 'checkout-payment-error',
      routePath: '/checkout/[orderId]',
      name: 'Checkout Payment Error',
      priority: 'low',
      tags: ['checkout', 'error']
    };

    expect(
      evaluateScenarioPriority(scenario, {
        heuristics: [
          {
            kind: 'error',
            filePath: 'src/Checkout.tsx',
            line: 10,
            identifier: 'error',
            evidence: 'error',
            tags: ['error'],
            recipes: ['mock-error-state']
          }
        ],
        route: {
          path: '/checkout/[orderId]',
          filePath: 'pages/checkout/[orderId].tsx',
          dynamic: true,
          dynamicSegments: [
            {
              name: 'orderId',
              kind: 'single',
              segment: '[orderId]'
            }
          ]
        },
        signalKinds: ['auth']
      })
    ).toMatchObject({
      priority: 'high',
      score: 11
    });
  });

  it('assigns medium priority to stateful routes without critical access or checkout signals', () => {
    const scenario: ScenarioDefinition = {
      id: 'catalog-loading',
      routePath: '/catalog',
      name: 'Catalog Loading',
      priority: 'low',
      tags: ['loading']
    };

    expect(
      evaluateScenarioPriority(scenario, {
        heuristics: [
          {
            kind: 'loading',
            filePath: 'src/Catalog.tsx',
            line: 5,
            identifier: 'loading',
            evidence: 'loading',
            tags: ['loading'],
            recipes: ['wait-for-loading-state']
          }
        ],
        route: {
          path: '/catalog',
          filePath: 'pages/catalog.tsx',
          dynamic: false,
          dynamicSegments: []
        }
      })
    ).toMatchObject({
      priority: 'medium',
      score: 2
    });
  });

  it('updates scenario priorities across a list using route and heuristic lookups', () => {
    const scenarios: ScenarioDefinition[] = [
      {
        id: 'profile-auth',
        routePath: '/account/profile',
        name: 'Profile Auth Gate',
        priority: 'low',
        tags: ['auth']
      },
      {
        id: 'marketing-home',
        routePath: '/',
        name: 'Marketing Home',
        priority: 'high',
        tags: []
      }
    ];

    expect(
      prioritizeScenarios(scenarios, {
        routesByPath: {
          '/account/profile': {
            path: '/account/profile',
            filePath: 'app/account/profile/page.tsx',
            dynamic: false,
            dynamicSegments: []
          },
          '/': {
            path: '/',
            filePath: 'app/page.tsx',
            dynamic: false,
            dynamicSegments: []
          }
        },
        signalKindsByRoute: {
          '/account/profile': ['auth']
        }
      })
    ).toEqual([
      {
        id: 'profile-auth',
        routePath: '/account/profile',
        name: 'Profile Auth Gate',
        priority: 'high',
        tags: ['auth']
      },
      {
        id: 'marketing-home',
        routePath: '/',
        name: 'Marketing Home',
        priority: 'low',
        tags: []
      }
    ]);
  });
});