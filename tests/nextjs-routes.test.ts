import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detectNextRoutes } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-next-routes-'));
  tempDirectories.push(directory);
  return directory;
}

async function writeFixtureFile(rootDir: string, relativePath: string): Promise<void> {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, 'export default function Page() { return null; }\n');
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('detectNextRoutes', () => {
  it('detects app router routes and ignores route groups and parallel routes', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(cwd, 'app/page.tsx');
    await writeFixtureFile(cwd, 'app/dashboard/page.tsx');
    await writeFixtureFile(cwd, 'app/blog/[slug]/page.tsx');
    await writeFixtureFile(cwd, 'app/(marketing)/pricing/page.tsx');
    await writeFixtureFile(cwd, 'app/@modal/intercepted/page.tsx');

    const routes = await detectNextRoutes({ cwd });

    expect(routes).toEqual([
      {
        path: '/',
        filePath: 'app/page.tsx',
        dynamic: false
      },
      {
        path: '/blog/[slug]',
        filePath: 'app/blog/[slug]/page.tsx',
        dynamic: true
      },
      {
        path: '/dashboard',
        filePath: 'app/dashboard/page.tsx',
        dynamic: false
      },
      {
        path: '/pricing',
        filePath: 'app/(marketing)/pricing/page.tsx',
        dynamic: false
      }
    ]);
  });

  it('detects pages router routes and skips api and underscore files', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(cwd, 'pages/index.tsx');
    await writeFixtureFile(cwd, 'pages/docs/getting-started.tsx');
    await writeFixtureFile(cwd, 'pages/blog/[slug].tsx');
    await writeFixtureFile(cwd, 'pages/_app.tsx');
    await writeFixtureFile(cwd, 'pages/api/health.ts');

    const routes = await detectNextRoutes({ cwd });

    expect(routes).toEqual([
      {
        path: '/',
        filePath: 'pages/index.tsx',
        dynamic: false
      },
      {
        path: '/blog/[slug]',
        filePath: 'pages/blog/[slug].tsx',
        dynamic: true
      },
      {
        path: '/docs/getting-started',
        filePath: 'pages/docs/getting-started.tsx',
        dynamic: false
      }
    ]);
  });

  it('merges app and pages routes without duplicate paths', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(cwd, 'app/about/page.tsx');
    await writeFixtureFile(cwd, 'pages/about.tsx');

    const routes = await detectNextRoutes({ cwd });

    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({
      path: '/about',
      filePath: 'app/about/page.tsx',
      dynamic: false
    });
  });
});