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
      },
      {
        kind: 'success',
        identifier: 'submitted',
        filePath: 'app/checkout/page.tsx',
        line: 6,
        evidence: 'submitted'
      },
      {
        kind: 'feature',
        identifier: 'betaFlag',
        filePath: 'app/checkout/page.tsx',
        line: 7,
        evidence: 'betaFlag'
      },
      {
        kind: 'responsive',
        identifier: 'breakpoint',
        filePath: 'app/checkout/page.tsx',
        line: 8,
        evidence: "breakpoint === 'mobile'"
      },
      {
        kind: 'locale',
        identifier: 'locale',
        filePath: 'app/checkout/page.tsx',
        line: 9,
        evidence: "locale === 'ar'"
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
      },
      {
        kind: 'success',
        filePath: 'app/checkout/page.tsx',
        line: 6,
        identifier: 'submitted',
        evidence: 'submitted',
        tags: ['success'],
        recipes: ['assert-success-state']
      },
      {
        kind: 'feature',
        filePath: 'app/checkout/page.tsx',
        line: 7,
        identifier: 'betaFlag',
        evidence: 'betaFlag',
        tags: ['feature-flag'],
        recipes: ['toggle-feature-flag']
      },
      {
        kind: 'responsive',
        filePath: 'app/checkout/page.tsx',
        line: 8,
        identifier: 'breakpoint',
        evidence: "breakpoint === 'mobile'",
        tags: ['responsive'],
        recipes: ['toggle-responsive-layout']
      },
      {
        kind: 'locale',
        filePath: 'app/checkout/page.tsx',
        line: 9,
        identifier: 'locale',
        evidence: "locale === 'ar'",
        tags: ['localization'],
        recipes: ['switch-locale']
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
        id: 'checkout-feature-flag',
        routePath: '/checkout',
        name: 'Checkout Feature Flag',
        priority: 'high',
        tags: ['checkout', 'feature-flag']
      },
      {
        id: 'checkout-loading-state',
        routePath: '/checkout',
        name: 'Checkout Loading State',
        priority: 'high',
        tags: ['checkout', 'loading']
      },
      {
        id: 'checkout-localization-state',
        routePath: '/checkout',
        name: 'Checkout Localization State',
        priority: 'high',
        tags: ['checkout', 'localization']
      },
      {
        id: 'checkout-responsive-layout',
        routePath: '/checkout',
        name: 'Checkout Responsive Layout',
        priority: 'high',
        tags: ['checkout', 'responsive']
      },
      {
        id: 'checkout-success-state',
        routePath: '/checkout',
        name: 'Checkout Success State',
        priority: 'high',
        tags: ['checkout', 'success']
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