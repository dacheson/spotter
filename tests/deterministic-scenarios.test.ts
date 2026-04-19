import { describe, expect, it } from 'vitest';

import {
  generateDeterministicScenarios,
  mapHeuristicsToRoutes,
  mapSignalKindsToRoutes,
  type ComponentSignalFinding,
  type RouteDefinition
} from '../src/index.js';

describe('deterministic scenarios', () => {
  it('creates default and state-specific scenarios from routes and findings', () => {
    const routes: RouteDefinition[] = [
      {
        path: '/checkout',
        filePath: 'app/checkout/page.tsx',
        dynamic: false,
        dynamicSegments: []
      }
    ];
    const findings: ComponentSignalFinding[] = [
      {
        kind: 'loading',
        identifier: 'loading',
        filePath: 'app/checkout/page.tsx',
        line: 3,
        evidence: 'loading'
      },
      {
        kind: 'form',
        identifier: 'form',
        filePath: 'app/checkout/page.tsx',
        line: 4,
        evidence: 'form'
      },
      {
        kind: 'auth',
        identifier: 'user',
        filePath: 'app/checkout/page.tsx',
        line: 5,
        evidence: 'user'
      }
    ];

    const heuristicsByRoute = mapHeuristicsToRoutes(routes, [
      {
        kind: 'loading',
        filePath: 'app/checkout/page.tsx',
        line: 3,
        identifier: 'loading',
        evidence: 'loading',
        tags: ['loading'],
        recipes: ['wait-for-loading-state']
      },
      {
        kind: 'form',
        filePath: 'app/checkout/page.tsx',
        line: 4,
        identifier: 'form',
        evidence: 'form',
        tags: ['form', 'validation'],
        recipes: ['submit-invalid-form']
      }
    ]);
    const signalKindsByRoute = mapSignalKindsToRoutes(routes, findings);

    expect(
      generateDeterministicScenarios({
        heuristicsByRoute,
        routes,
        signalKindsByRoute
      })
    ).toEqual([
      {
        id: 'checkout-auth-gate',
        routePath: '/checkout',
        name: 'Checkout Auth Gate',
        priority: 'high',
        tags: ['checkout', 'auth']
      },
      {
        id: 'checkout-default',
        routePath: '/checkout',
        name: 'Checkout Default',
        priority: 'high',
        tags: ['checkout']
      },
      {
        id: 'checkout-loading-state',
        routePath: '/checkout',
        name: 'Checkout Loading State',
        priority: 'high',
        tags: ['checkout', 'loading']
      },
      {
        id: 'checkout-validation-state',
        routePath: '/checkout',
        name: 'Checkout Validation State',
        priority: 'high',
        tags: ['checkout', 'form', 'validation']
      }
    ]);
  });
});