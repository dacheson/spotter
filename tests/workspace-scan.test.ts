import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { scanWorkspace } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-workspace-scan-'));
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

describe('workspace scan', () => {
  it('writes route, signal, heuristic, and summary artifacts', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'app/checkout/page.tsx',
      [
        'export default function Page() {',
        '  const loading = true;',
        '  if (loading) return <div>Loading</div>;',
        '  return <form><input name="email" /></form>;',
        '}'
      ].join('\n')
    );

    const result = await scanWorkspace({ cwd });
    const signals = JSON.parse(await readFile(result.signalsPath, 'utf8')) as { findings: Array<{ kind: string }> };
    const heuristics = JSON.parse(await readFile(result.heuristicsPath, 'utf8')) as { counts: Record<string, number> };
    const summary = JSON.parse(await readFile(result.summaryPath, 'utf8')) as {
      framework: string;
      routeCount: number;
      signalCount: number;
    };

    expect(result.routeManifest.routes).toEqual([
      {
        path: '/checkout',
        filePath: 'app/checkout/page.tsx',
        dynamic: false,
        dynamicSegments: []
      }
    ]);
    expect(signals.findings.map((finding) => finding.kind)).toEqual(['loading', 'form']);
    expect(heuristics.counts).toEqual({
      loading: 1,
      error: 0,
      form: 1,
      success: 0,
      feature: 0,
      responsive: 0,
      locale: 0
    });
    expect(summary.routeCount).toBe(1);
    expect(summary.signalCount).toBe(2);
    expect(summary.framework).toBe('next-app');
  });
});