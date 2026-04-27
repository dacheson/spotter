import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { artifactSchemaVersion, writeArtifactRecord } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-artifact-storage-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('artifact storage', () => {
  it('writes artifact records into the configured artifacts directory', async () => {
    const cwd = await createTempDir();

    const written = await writeArtifactRecord(
      {
        kind: 'baseline',
        baselineDir: 'C:/repo/.spotter/baselines',
        configPath: 'C:/repo/.spotter/artifacts/playwright.baseline.config.mjs',
        testDir: 'C:/repo/.spotter/tests',
        command: 'npx',
        args: ['playwright', 'test', '--config', 'config', '--update-snapshots'],
        generatedAt: '2026-04-19T12:00:00.000Z',
        schemaVersion: artifactSchemaVersion
      },
      { cwd }
    );
    const contents = await readFile(written.artifactPath, 'utf8');

    expect(written.artifactPath).toBe(path.resolve(cwd, '.spotter/artifacts/baseline-run.json'));
    expect(JSON.parse(contents)).toEqual(written.record);
  });
});