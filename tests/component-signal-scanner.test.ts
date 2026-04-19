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
});