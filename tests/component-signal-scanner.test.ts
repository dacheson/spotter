import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanComponentSignals } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-component-scan-'));
  tempDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(rootDir: string, relativePath: string, contents: string): Promise<void> {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('component signal scanner', () => {
  it('finds common UI state signals in TSX source files', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'src/components/Checkout.tsx',
      [
        'export function Checkout({ loading, error, empty, modalOpen, user, isAdmin }) {',
        '  if (loading) return <Spinner />;',
        '  if (error) return <ErrorState />;',
        '  const content = empty ? <EmptyState /> : <Cart />;',
        '  return (',
        '    <div>',
        '      {modalOpen && <CheckoutModal />} ',
        '      {!user ? <Login /> : content}',
        '      {!isAdmin ? <ReadOnly /> : <AdminPanel />}',
        '      <form><input name="coupon" /></form>',
        '    </div>',
        '  );',
        '}',
        ''
      ].join('\n')
    );

    const result = await scanComponentSignals({ cwd });

    expect(result.rootDir).toBe('.');
    expect(result.filesScanned).toBe(1);
    expect(result.findings.map((finding) => finding.kind)).toEqual([
      'loading',
      'error',
      'empty',
      'modal',
      'auth',
      'role',
      'form'
    ]);
    expect(result.findings.map((finding) => finding.identifier)).toEqual([
      'loading',
      'error',
      'empty',
      'modalOpen',
      'user',
      'isAdmin',
      'form'
    ]);
  });

  it('respects the configured rootDir and ignores generated folders', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'spotter.config.json',
      JSON.stringify(
        {
          rootDir: 'apps/web'
        },
        null,
        2
      )
    );
    await writeFixtureFile(cwd, 'apps/web/src/App.tsx', 'export const App = ({ loading }) => loading ? null : null;\n');
    await writeFixtureFile(cwd, 'apps/web/.spotter/generated.tsx', 'export const x = ({ error }) => error;\n');

    const result = await scanComponentSignals({ cwd });

    expect(result.rootDir).toBe('apps/web');
    expect(result.filesScanned).toBe(1);
    expect(result.findings).toEqual([
      {
        kind: 'loading',
        identifier: 'loading',
        filePath: 'src/App.tsx',
        line: 1,
        evidence: 'loading'
      }
    ]);
  });

  it('detects empty states from array length comparisons', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'src/products/page.tsx',
      [
        'export function Products({ products }) {',
        '  if (products.length === 0) {',
        "    return <p>No products found</p>;",
        '  }',
        '',
        '  return <ProductGrid products={products} />;',
        '}',
        ''
      ].join('\n')
    );

    const result = await scanComponentSignals({ cwd });

    expect(result.findings).toEqual([
      {
        kind: 'empty',
        identifier: 'products.length',
        filePath: 'src/products/page.tsx',
        line: 2,
        evidence: 'products.length === 0'
      }
    ]);
  });

  it('detects success, feature, responsive, and localization signals from deterministic branches', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'src/settings/page.tsx',
      [
        'export function Settings({ submitted, betaFlag, breakpoint, locale }) {',
        '  if (submitted) {',
        '    return <p>Saved</p>;',
        '  }',
        '',
        '  if (betaFlag) {',
        '    return <p>Beta settings</p>;',
        '  }',
        '',
        "  if (breakpoint === 'mobile') {",
        '    return <nav>Mobile menu</nav>;',
        '  }',
        '',
        "  if (locale === 'ar') {",
        '    return <p>RTL copy</p>;',
        '  }',
        '',
        '  return null;',
        '}',
        ''
      ].join('\n')
    );

    const result = await scanComponentSignals({ cwd });

    expect(result.findings).toEqual([
      {
        kind: 'success',
        identifier: 'submitted',
        filePath: 'src/settings/page.tsx',
        line: 2,
        evidence: 'submitted'
      },
      {
        kind: 'feature',
        identifier: 'betaFlag',
        filePath: 'src/settings/page.tsx',
        line: 6,
        evidence: 'betaFlag'
      },
      {
        kind: 'responsive',
        identifier: 'breakpoint',
        filePath: 'src/settings/page.tsx',
        line: 10,
        evidence: "breakpoint === 'mobile'"
      },
      {
        kind: 'locale',
        identifier: 'locale',
        filePath: 'src/settings/page.tsx',
        line: 14,
        evidence: "locale === 'ar'"
      }
    ]);
  });

  it('finds common UI state signals in Vue single-file components', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'src/App.vue',
      [
        '<script setup>',
        'const loading = false;',
        'const items = [];',
        'const breakpoint = "mobile";',
        'const locale = "ar";',
        '</script>',
        '',
        '<template>',
        '  <main>',
        '    <p v-if="loading">Loading</p>',
        '    <p v-else-if="items.length === 0">No items found</p>',
        '    <p v-else-if="breakpoint === &quot;mobile&quot;">Mobile nav</p>',
        '    <p v-else-if="locale === &quot;ar&quot;">RTL</p>',
        '    <form>',
        '      <input name="email" />',
        '    </form>',
        '  </main>',
        '</template>',
        ''
      ].join('\n')
    );

    const result = await scanComponentSignals({ cwd });

    expect(result.findings).toEqual([
      {
        kind: 'loading',
        identifier: 'loading',
        filePath: 'src/App.vue',
        line: 10,
        evidence: 'loading'
      },
      {
        kind: 'empty',
        identifier: 'items.length',
        filePath: 'src/App.vue',
        line: 11,
        evidence: 'items.length === 0'
      },
      {
        kind: 'responsive',
        identifier: 'breakpoint',
        filePath: 'src/App.vue',
        line: 12,
        evidence: 'breakpoint === "mobile"'
      },
      {
        kind: 'locale',
        identifier: 'locale',
        filePath: 'src/App.vue',
        line: 13,
        evidence: 'locale === "ar"'
      },
      {
        kind: 'form',
        identifier: 'form',
        filePath: 'src/App.vue',
        line: 14,
        evidence: 'form'
      }
    ]);
  });
});