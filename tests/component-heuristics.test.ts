import { describe, expect, it } from 'vitest';

import { deriveComponentStateHeuristics, type ComponentSignalScanResult } from '../src/index.js';

describe('component heuristics', () => {
  it('derives deterministic state heuristics from scan findings', () => {
    const scanResult: ComponentSignalScanResult = {
      rootDir: '.',
      filesScanned: 1,
      findings: [
        {
          kind: 'loading',
          identifier: 'loading',
          filePath: 'src/Checkout.tsx',
          line: 10,
          evidence: 'loading'
        },
        {
          kind: 'error',
          identifier: 'error',
          filePath: 'src/Checkout.tsx',
          line: 12,
          evidence: 'error'
        },
        {
          kind: 'form',
          identifier: 'form',
          filePath: 'src/Checkout.tsx',
          line: 20,
          evidence: 'form'
        },
        {
          kind: 'success',
          identifier: 'submitted',
          filePath: 'src/Checkout.tsx',
          line: 24,
          evidence: 'submitted'
        },
        {
          kind: 'feature',
          identifier: 'betaFlag',
          filePath: 'src/Checkout.tsx',
          line: 26,
          evidence: 'betaFlag'
        },
        {
          kind: 'responsive',
          identifier: 'breakpoint',
          filePath: 'src/Checkout.tsx',
          line: 28,
          evidence: "breakpoint === 'mobile'"
        },
        {
          kind: 'locale',
          identifier: 'locale',
          filePath: 'src/Checkout.tsx',
          line: 30,
          evidence: "locale === 'ar'"
        },
        {
          kind: 'auth',
          identifier: 'user',
          filePath: 'src/Checkout.tsx',
          line: 34,
          evidence: 'user'
        }
      ]
    };

    expect(deriveComponentStateHeuristics(scanResult)).toEqual({
      heuristics: [
        {
          kind: 'loading',
          filePath: 'src/Checkout.tsx',
          line: 10,
          identifier: 'loading',
          evidence: 'loading',
          tags: ['loading'],
          recipes: ['wait-for-loading-state']
        },
        {
          kind: 'error',
          filePath: 'src/Checkout.tsx',
          line: 12,
          identifier: 'error',
          evidence: 'error',
          tags: ['error'],
          recipes: ['mock-error-state']
        },
        {
          kind: 'form',
          filePath: 'src/Checkout.tsx',
          line: 20,
          identifier: 'form',
          evidence: 'form',
          tags: ['form', 'validation'],
          recipes: ['submit-invalid-form']
        },
        {
          kind: 'success',
          filePath: 'src/Checkout.tsx',
          line: 24,
          identifier: 'submitted',
          evidence: 'submitted',
          tags: ['success'],
          recipes: ['assert-success-state']
        },
        {
          kind: 'feature',
          filePath: 'src/Checkout.tsx',
          line: 26,
          identifier: 'betaFlag',
          evidence: 'betaFlag',
          tags: ['feature-flag'],
          recipes: ['toggle-feature-flag']
        },
        {
          kind: 'responsive',
          filePath: 'src/Checkout.tsx',
          line: 28,
          identifier: 'breakpoint',
          evidence: "breakpoint === 'mobile'",
          tags: ['responsive'],
          recipes: ['toggle-responsive-layout']
        },
        {
          kind: 'locale',
          filePath: 'src/Checkout.tsx',
          line: 30,
          identifier: 'locale',
          evidence: "locale === 'ar'",
          tags: ['localization'],
          recipes: ['switch-locale']
        }
      ],
      counts: {
        loading: 1,
        error: 1,
        form: 1,
        success: 1,
        feature: 1,
        responsive: 1,
        locale: 1
      }
    });
  });

  it('deduplicates repeated findings for the same file, line, kind, and identifier', () => {
    const scanResult: ComponentSignalScanResult = {
      rootDir: '.',
      filesScanned: 1,
      findings: [
        {
          kind: 'loading',
          identifier: 'loading',
          filePath: 'src/Checkout.tsx',
          line: 10,
          evidence: 'loading'
        },
        {
          kind: 'loading',
          identifier: 'loading',
          filePath: 'src/Checkout.tsx',
          line: 10,
          evidence: 'loading'
        }
      ]
    };

    expect(deriveComponentStateHeuristics(scanResult)).toEqual({
      heuristics: [
        {
          kind: 'loading',
          filePath: 'src/Checkout.tsx',
          line: 10,
          identifier: 'loading',
          evidence: 'loading',
          tags: ['loading'],
          recipes: ['wait-for-loading-state']
        }
      ],
      counts: {
        loading: 1,
        error: 0,
        form: 0,
        success: 0,
        feature: 0,
        responsive: 0,
        locale: 0
      }
    });
  });
});