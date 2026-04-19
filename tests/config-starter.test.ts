import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeStarterConfig } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-config-starter-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('starter config writer', () => {
  it('writes a starter config file when none exists', async () => {
    const cwd = await createTempDir();

    const written = await writeStarterConfig({ cwd });
    const contents = await readFile(written.configPath, 'utf8');

    expect(path.basename(written.configPath)).toBe('spotter.config.json');
    expect(JSON.parse(contents)).toEqual(written.config);
  });

  it('does not overwrite an existing config file', async () => {
    const cwd = await createTempDir();
    const configPath = path.join(cwd, 'spotter.config.json');

    await writeFile(configPath, '{"rootDir":"apps/web"}\n', 'utf8');

    await expect(writeStarterConfig({ cwd })).rejects.toThrow(`Spotter config already exists at ${configPath}.`);
  });
});