import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import type { RouteDefinition } from '../types.js';
import { detectNextRoutes } from './nextjs.js';

export interface RouteManifest {
  rootDir: string;
  routes: RouteDefinition[];
}

export interface CreateRouteManifestOptions {
  cwd?: string;
}

export interface WriteRouteManifestOptions extends CreateRouteManifestOptions {
  outputPath?: string;
}

export interface WrittenRouteManifest {
  manifest: RouteManifest;
  outputPath: string;
}

export async function createRouteManifest(
  options: CreateRouteManifestOptions = {}
): Promise<RouteManifest> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const rootDir = config.rootDir === '.' ? cwd : path.resolve(cwd, config.rootDir);
  const routes = await detectNextRoutes({ cwd: rootDir });

  return {
    rootDir: normalizeRelativeRootDir(cwd, rootDir),
    routes
  };
}

export async function writeRouteManifest(
  options: WriteRouteManifestOptions = {}
): Promise<WrittenRouteManifest> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const manifest = await createRouteManifest({ cwd });
  const outputPath =
    options.outputPath ?? path.resolve(cwd, config.paths.artifactsDir, 'route-manifest.json');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    manifest,
    outputPath
  };
}

function normalizeRelativeRootDir(cwd: string, rootDir: string): string {
  const relativePath = path.relative(cwd, rootDir);

  if (!relativePath) {
    return '.';
  }

  return relativePath.split(path.sep).join('/');
}