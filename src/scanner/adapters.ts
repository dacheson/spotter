import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { FrameworkName, RouteDefinition } from '../types.js';

import { detectNextRoutes } from './nextjs.js';

const sourceFileExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue']);

export interface RouteDiscoveryResult {
  framework: FrameworkName;
  routes: RouteDefinition[];
}

export interface RouteDiscoveryAdapter {
  framework: FrameworkName;
  detectRoutes(cwd: string): Promise<RouteDefinition[]>;
}

const routeDiscoveryAdapters: RouteDiscoveryAdapter[] = [
  {
    framework: 'next-app',
    detectRoutes: (cwd) => detectNextRoutes({ cwd })
  },
  {
    framework: 'remix',
    detectRoutes: detectRemixRoutes
  },
  {
    framework: 'nuxt',
    detectRoutes: detectNuxtRoutes
  },
  {
    framework: 'react-router',
    detectRoutes: detectReactRouterRoutes
  },
  {
    framework: 'vue-router',
    detectRoutes: detectVueRouterRoutes
  }
];

export async function detectRoutesWithAdapters(cwd: string): Promise<RouteDiscoveryResult> {
  for (const adapter of routeDiscoveryAdapters) {
    const routes = await adapter.detectRoutes(cwd);

    if (routes.length > 0) {
      return {
        framework: adapter.framework,
        routes
      };
    }
  }

  return {
    framework: await inferFrameworkFromWorkspace(cwd),
    routes: []
  };
}

async function detectRemixRoutes(cwd: string): Promise<RouteDefinition[]> {
  const routesDirectory = path.join(cwd, 'app', 'routes');
  const filePaths = await collectSourceFilePaths(routesDirectory);

  return filePaths
    .map((filePath) => {
      const relativePath = normalizeFilePath(path.relative(cwd, filePath));
      const routePath = createRemixRoutePath(path.relative(routesDirectory, filePath));

      if (!routePath) {
        return null;
      }

      return createRouteDefinition(routePath, relativePath);
    })
    .filter((route): route is RouteDefinition => route !== null)
    .sort(compareRoutes);
}

async function detectNuxtRoutes(cwd: string): Promise<RouteDefinition[]> {
  const pagesDirectory = path.join(cwd, 'pages');
  const filePaths = await collectSourceFilePaths(pagesDirectory);

  return filePaths
    .map((filePath) => {
      const relativePath = normalizeFilePath(path.relative(cwd, filePath));
      const routePath = createFileSystemRoutePath(path.relative(pagesDirectory, filePath));

      if (!routePath) {
        return null;
      }

      return createRouteDefinition(routePath, relativePath);
    })
    .filter((route): route is RouteDefinition => route !== null)
    .sort(compareRoutes);
}

async function detectReactRouterRoutes(cwd: string): Promise<RouteDefinition[]> {
  const routerFiles = await collectSourceFilePaths(cwd);
  const routeEntries = new Map<string, RouteDefinition>();

  for (const filePath of routerFiles) {
    const contents = await readWorkspaceFile(filePath);

    if (!contents || !/(react-router|react-router-dom)/.test(contents)) {
      continue;
    }

    const relativePath = normalizeFilePath(path.relative(cwd, filePath));

    for (const routePath of extractRouterPaths(contents, 'react')) {
      routeEntries.set(routePath, createRouteDefinition(routePath, relativePath));
    }
  }

  return [...routeEntries.values()].sort(compareRoutes);
}

async function detectVueRouterRoutes(cwd: string): Promise<RouteDefinition[]> {
  const routerFiles = await collectSourceFilePaths(cwd);
  const routeEntries = new Map<string, RouteDefinition>();

  for (const filePath of routerFiles) {
    const contents = await readWorkspaceFile(filePath);

    if (!contents || !/vue-router/.test(contents)) {
      continue;
    }

    const relativePath = normalizeFilePath(path.relative(cwd, filePath));

    for (const routePath of extractRouterPaths(contents, 'vue')) {
      routeEntries.set(routePath, createRouteDefinition(routePath, relativePath));
    }
  }

  return [...routeEntries.values()].sort(compareRoutes);
}

async function inferFrameworkFromWorkspace(cwd: string): Promise<FrameworkName> {
  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJson = await tryReadJson(packageJsonPath);
  const dependencies = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {})
  } as Record<string, string>;

  if ('next' in dependencies) {
    return 'next-app';
  }

  if ('@remix-run/react' in dependencies) {
    return 'remix';
  }

  if ('nuxt' in dependencies) {
    return 'nuxt';
  }

  if ('react-router-dom' in dependencies || 'react-router' in dependencies) {
    return 'react-router';
  }

  if ('vue-router' in dependencies) {
    return 'vue-router';
  }

  if ('vite' in dependencies && 'react' in dependencies) {
    return 'vite-react';
  }

  if ('vite' in dependencies && 'vue' in dependencies) {
    return 'vite-vue';
  }

  if ('react-scripts' in dependencies) {
    return 'cra';
  }

  return 'unknown';
}

async function collectSourceFilePaths(rootDir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.nuxt' || entry.name === 'dist') {
          return [] as string[];
        }

        return collectSourceFilePaths(entryPath);
      }

      if (!entry.isFile()) {
        return [] as string[];
      }

      const extension = path.extname(entry.name);

      if (!sourceFileExtensions.has(extension) || entry.name.endsWith('.d.ts')) {
        return [] as string[];
      }

      return [entryPath];
    })
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function readWorkspaceFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function tryReadJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const contents = await readFile(filePath, 'utf8');
    return JSON.parse(contents) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createRemixRoutePath(relativeFilePath: string): string | null {
  const normalizedPath = normalizeFilePath(relativeFilePath);
  const extension = path.posix.extname(normalizedPath);
  const withoutExtension = normalizedPath.slice(0, -extension.length);
  const segments = withoutExtension.split('.');

  const routeSegments = segments.filter((segment) => segment !== 'route').flatMap((segment) => {
    if (segment === '_index') {
      return [] as string[];
    }

    if (segment.startsWith('_')) {
      return [] as string[];
    }

    return [segment];
  });

  if (routeSegments.length === 0) {
    return '/';
  }

  return normalizeParameterizedRoute(`/${routeSegments.join('/')}`);
}

function createFileSystemRoutePath(relativeFilePath: string): string | null {
  const normalizedPath = normalizeFilePath(relativeFilePath);
  const extension = path.posix.extname(normalizedPath);
  const withoutExtension = normalizedPath.slice(0, -extension.length);
  const segments = withoutExtension.split('/').filter(Boolean);

  const routeSegments = segments.filter((segment) => segment !== 'index');

  if (routeSegments.length === 0) {
    return '/';
  }

  return normalizeParameterizedRoute(`/${routeSegments.join('/')}`);
}

function extractRouterPaths(contents: string, mode: 'react' | 'vue'): string[] {
  const objectPaths = Array.from(contents.matchAll(/path\s*:\s*['"]([^'"]+)['"]/g), (match) => match[1]);
  const jsxPaths = mode === 'react'
    ? Array.from(contents.matchAll(/<Route[^>]*\spath=['"]([^'"]+)['"]/g), (match) => match[1])
    : [];

  return Array.from(new Set([...objectPaths, ...jsxPaths]))
    .filter((routePath): routePath is string => Boolean(routePath))
    .map(normalizeParameterizedRoute)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeParameterizedRoute(routePath: string): string {
  if (routePath === '/' || routePath === '') {
    return '/';
  }

  let normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  normalizedPath = normalizedPath.replace(/\$([A-Za-z0-9_]+)/g, '[$1]');
  normalizedPath = normalizedPath.replace(/:([A-Za-z0-9_]+)/g, '[$1]');
  normalizedPath = normalizedPath.replace(/\/\*$/g, '/[...splat]');
  normalizedPath = normalizedPath.replace(/^\*$/g, '/[...splat]');

  return normalizedPath.replace(/\/+/g, '/');
}

function createRouteDefinition(routePath: string, filePath: string): RouteDefinition {
  const dynamicSegments = extractDynamicRouteSegments(routePath);

  return {
    path: routePath,
    filePath,
    dynamic: dynamicSegments.length > 0,
    dynamicSegments
  };
}

function extractDynamicRouteSegments(routePath: string): RouteDefinition['dynamicSegments'] {
  return routePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const optionalCatchAllMatch = /^\[\[\.\.\.(.+)\]\]$/.exec(segment);

      if (optionalCatchAllMatch?.[1]) {
        return {
          name: optionalCatchAllMatch[1],
          kind: 'optional-catch-all' as const,
          segment
        };
      }

      const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(segment);

      if (catchAllMatch?.[1]) {
        return {
          name: catchAllMatch[1],
          kind: 'catch-all' as const,
          segment
        };
      }

      const singleMatch = /^\[(.+)\]$/.exec(segment);

      if (singleMatch?.[1]) {
        return {
          name: singleMatch[1],
          kind: 'single' as const,
          segment
        };
      }

      return null;
    })
    .filter((segment): segment is NonNullable<typeof segment> => segment !== null);
}

function compareRoutes(left: RouteDefinition, right: RouteDefinition): number {
  return left.path.localeCompare(right.path);
}

function normalizeFilePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}