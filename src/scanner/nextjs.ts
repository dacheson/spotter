import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { DynamicRouteSegment, RouteDefinition } from '../types.js';

const appPageFileNames = new Set(['page.js', 'page.jsx', 'page.ts', 'page.tsx']);
const pagesFileExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredSegmentNames = new Set(['api']);
const ignoredAppDirectoryNames = new Set(['_components', '_lib']);

export interface DetectNextRoutesOptions {
  cwd?: string;
}

export async function detectNextRoutes(options: DetectNextRoutesOptions = {}): Promise<RouteDefinition[]> {
  const cwd = options.cwd ?? process.cwd();
  const routeEntries = new Map<string, RouteDefinition>();

  await collectPagesRoutes(path.join(cwd, 'pages'), cwd, routeEntries);
  await collectAppRoutes(path.join(cwd, 'app'), cwd, routeEntries);

  return [...routeEntries.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function collectAppRoutes(
  directoryPath: string,
  cwd: string,
  routeEntries: Map<string, RouteDefinition>,
  routeSegments: string[] = []
): Promise<void> {
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredAppDirectoryNames.has(entry.name) || isRouteGroupSegment(entry.name)) {
        await collectAppRoutes(entryPath, cwd, routeEntries, routeSegments);
        continue;
      }

      if (isParallelRouteSegment(entry.name)) {
        continue;
      }

      await collectAppRoutes(entryPath, cwd, routeEntries, [...routeSegments, entry.name]);
      continue;
    }

    if (!entry.isFile() || !appPageFileNames.has(entry.name)) {
      continue;
    }

    addRoute(routeEntries, normalizeRouteSegments(routeSegments), path.relative(cwd, entryPath));
  }
}

async function collectPagesRoutes(
  directoryPath: string,
  cwd: string,
  routeEntries: Map<string, RouteDefinition>,
  routeSegments: string[] = []
): Promise<void> {
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredSegmentNames.has(entry.name)) {
        continue;
      }

      await collectPagesRoutes(entryPath, cwd, routeEntries, [...routeSegments, entry.name]);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);

    if (!pagesFileExtensions.has(extension)) {
      continue;
    }

    const baseName = path.basename(entry.name, extension);

    if (baseName.startsWith('_')) {
      continue;
    }

    const segments = baseName === 'index' ? routeSegments : [...routeSegments, baseName];
    addRoute(routeEntries, normalizeRouteSegments(segments), path.relative(cwd, entryPath));
  }
}

function addRoute(routeEntries: Map<string, RouteDefinition>, routePath: string, filePath: string): void {
  const dynamicSegments = extractDynamicRouteSegments(routePath);

  routeEntries.set(routePath, {
    path: routePath,
    filePath: normalizeFilePath(filePath),
    dynamic: dynamicSegments.length > 0,
    dynamicSegments
  });
}

function normalizeRouteSegments(routeSegments: string[]): string {
  const visibleSegments = routeSegments.filter(
    (segment) => !isRouteGroupSegment(segment) && !isParallelRouteSegment(segment)
  );

  if (visibleSegments.length === 0) {
    return '/';
  }

  return `/${visibleSegments.join('/')}`;
}

function normalizeFilePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function isRouteGroupSegment(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function isParallelRouteSegment(segment: string): boolean {
  return segment.startsWith('@');
}

function extractDynamicRouteSegments(routePath: string): DynamicRouteSegment[] {
  return routePath
    .split('/')
    .filter(Boolean)
    .map(parseDynamicRouteSegment)
    .filter((segment): segment is DynamicRouteSegment => segment !== null);
}

function parseDynamicRouteSegment(segment: string): DynamicRouteSegment | null {
  const optionalCatchAllMatch = /^\[\[\.\.\.(.+)\]\]$/.exec(segment);

  if (optionalCatchAllMatch) {
    const name = optionalCatchAllMatch[1];

    if (!name) {
      return null;
    }

    return {
      name,
      kind: 'optional-catch-all',
      segment
    };
  }

  const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(segment);

  if (catchAllMatch) {
    const name = catchAllMatch[1];

    if (!name) {
      return null;
    }

    return {
      name,
      kind: 'catch-all',
      segment
    };
  }

  const singleMatch = /^\[(.+)\]$/.exec(segment);

  if (singleMatch) {
    const name = singleMatch[1];

    if (!name) {
      return null;
    }

    return {
      name,
      kind: 'single',
      segment
    };
  }

  return null;
}