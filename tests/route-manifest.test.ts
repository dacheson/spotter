import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { artifactSchemaVersion, createRouteManifest, writeRouteManifest } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-route-manifest-'));
  tempDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(rootDir: string, relativePath: string, contents = 'export default function Page() { return null; }\n'): Promise<void> {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('route manifest', () => {
  it('creates a deterministic manifest from the configured rootDir', async () => {
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
    await writeFixtureFile(cwd, 'apps/web/app/page.tsx');
    await writeFixtureFile(cwd, 'apps/web/app/blog/[slug]/page.tsx');

    const manifest = await createRouteManifest({ cwd });

    expect(manifest).toEqual({
      framework: 'next-app',
      rootDir: 'apps/web',
      routes: [
        {
          path: '/',
          filePath: 'app/page.tsx',
          dynamic: false,
          dynamicSegments: []
        },
        {
          path: '/blog/[slug]',
          filePath: 'app/blog/[slug]/page.tsx',
          dynamic: true,
          dynamicSegments: [
            {
              name: 'slug',
              kind: 'single',
              segment: '[slug]'
            }
          ]
        }
      ]
    });
  });

  it('writes the manifest to the configured artifacts directory by default', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'spotter.config.json',
      JSON.stringify(
        {
          paths: {
            artifactsDir: '.generated/artifacts'
          }
        },
        null,
        2
      )
    );
    await writeFixtureFile(cwd, 'app/page.tsx');

    const written = await writeRouteManifest({ cwd });
    const fileContents = await readFile(written.outputPath, 'utf8');

    expect(written.outputPath).toBe(path.resolve(cwd, '.generated/artifacts/route-manifest.json'));
    expect(JSON.parse(fileContents)).toEqual({
      framework: 'next-app',
      rootDir: '.',
      schemaVersion: artifactSchemaVersion,
      routes: [
        {
          path: '/',
          filePath: 'app/page.tsx',
          dynamic: false,
          dynamicSegments: []
        }
      ]
    });
  });

  it('supports overriding the output path', async () => {
    const cwd = await createTempDir();
    const outputPath = path.join(cwd, 'custom', 'routes.json');

    await writeFixtureFile(cwd, 'pages/docs.tsx');

    const written = await writeRouteManifest({ cwd, outputPath });
    const fileContents = await readFile(outputPath, 'utf8');

    expect(written.outputPath).toBe(outputPath);
    expect(JSON.parse(fileContents)).toEqual({
      framework: 'next-app',
      rootDir: '.',
      schemaVersion: artifactSchemaVersion,
      routes: [
        {
          path: '/docs',
          filePath: 'pages/docs.tsx',
          dynamic: false,
          dynamicSegments: []
        }
      ]
    });
  });
});