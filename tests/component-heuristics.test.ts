import { describe, expect, it } from 'vitest';

import { deriveComponentStateHeuristics, type ComponentSignalScanResult } from '../src/index.js';

describe('component heuristics', () => {
  it('derives deterministic loading, error, and form heuristics from scan findings', () => {
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
          kind: 'auth',
          identifier: 'user',
          filePath: 'src/Checkout.tsx',
          line: 30,
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
        }
      ],
      counts: {
        loading: 1,
        error: 1,
        form: 1
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
        form: 0
      }
    });
  });
});