import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detectRoutesWithAdapters } from '../src/index.js';

const tempDirectories: string[] = [];

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'spotter-route-adapters-'));
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

describe('route discovery adapters', () => {
  it('detects Next.js routes through the adapter registry', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(cwd, 'app/page.tsx', 'export default function Page() { return null; }\n');
    await writeFixtureFile(cwd, 'app/blog/[slug]/page.tsx', 'export default function Page() { return null; }\n');

    const result = await detectRoutesWithAdapters(cwd);

    expect(result.framework).toBe('next-app');
    expect(result.routes.map((route) => route.path)).toEqual(['/', '/blog/[slug]']);
  });

  it('detects Remix flat-file routes', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'package.json',
      JSON.stringify({ dependencies: { '@remix-run/react': '^2.0.0' } }, null, 2)
    );
    await writeFixtureFile(cwd, 'app/routes/_index.tsx', 'export default function Route() { return null; }\n');
    await writeFixtureFile(cwd, 'app/routes/blog.$slug.tsx', 'export default function Route() { return null; }\n');

    const result = await detectRoutesWithAdapters(cwd);

    expect(result.framework).toBe('remix');
    expect(result.routes).toEqual([
      {
        path: '/',
        filePath: 'app/routes/_index.tsx',
        dynamic: false,
        dynamicSegments: []
      },
      {
        path: '/blog/[slug]',
        filePath: 'app/routes/blog.$slug.tsx',
        dynamic: true,
        dynamicSegments: [
          {
            name: 'slug',
            kind: 'single',
            segment: '[slug]'
          }
        ]
      }
    ]);
  });

  it('detects Nuxt pages routes', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(cwd, 'package.json', JSON.stringify({ dependencies: { nuxt: '^3.0.0' } }, null, 2));
    await writeFixtureFile(cwd, 'pages/index.vue', '<template><div /></template>\n');
    await writeFixtureFile(cwd, 'pages/docs/[slug].vue', '<template><div /></template>\n');

    const result = await detectRoutesWithAdapters(cwd);

    expect(result.framework).toBe('nuxt');
    expect(result.routes.map((route) => route.path)).toEqual(['/', '/docs/[slug]']);
  });

  it('detects React Router route config paths', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'package.json',
      JSON.stringify({ dependencies: { 'react-router-dom': '^7.0.0' } }, null, 2)
    );
    await writeFixtureFile(
      cwd,
      'src/router.tsx',
      [
        "import { createBrowserRouter } from 'react-router-dom';",
        '',
        'export const router = createBrowserRouter([',
        "  { path: '/', element: null },",
        "  { path: '/projects/:projectId', element: null }",
        ']);',
        ''
      ].join('\n')
    );

    const result = await detectRoutesWithAdapters(cwd);

    expect(result.framework).toBe('react-router');
    expect(result.routes).toEqual([
      {
        path: '/',
        filePath: 'src/router.tsx',
        dynamic: false,
        dynamicSegments: []
      },
      {
        path: '/projects/[projectId]',
        filePath: 'src/router.tsx',
        dynamic: true,
        dynamicSegments: [
          {
            name: 'projectId',
            kind: 'single',
            segment: '[projectId]'
          }
        ]
      }
    ]);
  });

  it('detects Vue Router route config paths', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'package.json',
      JSON.stringify({ dependencies: { 'vue-router': '^4.0.0' } }, null, 2)
    );
    await writeFixtureFile(
      cwd,
      'src/router.ts',
      [
        "import { createRouter, createWebHistory } from 'vue-router';",
        '',
        'export const router = createRouter({',
        '  history: createWebHistory(),',
        '  routes: [',
        "    { path: '/', component: {} },",
        "    { path: '/blog/:slug', component: {} }",
        '  ]',
        '});',
        ''
      ].join('\n')
    );

    const result = await detectRoutesWithAdapters(cwd);

    expect(result.framework).toBe('vue-router');
    expect(result.routes.map((route) => route.path)).toEqual(['/', '/blog/[slug]']);
  });

  it('falls back to inferred framework when no deterministic routes are found', async () => {
    const cwd = await createTempDir();

    await writeFixtureFile(
      cwd,
      'package.json',
      JSON.stringify({ dependencies: { vite: '^6.0.0', react: '^19.0.0' } }, null, 2)
    );
    await writeFixtureFile(cwd, 'src/App.tsx', 'export function App() { return <div>Hello</div>; }\n');

    const result = await detectRoutesWithAdapters(cwd);

    expect(result.framework).toBe('vite-react');
    expect(result.routes).toEqual([]);
  });
});