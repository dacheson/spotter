import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { writeVersionedJsonArtifact } from '../artifacts/versioned.js';
import { loadSpotterConfig } from '../config/index.js';
import { detectRoutesWithAdapters } from './adapters.js';

export interface RouteManifest {
  framework: import('../types.js').FrameworkName;
  rootDir: string;
  routes: import('../types.js').RouteDefinition[];
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
  const { framework, routes } = await detectRoutesWithAdapters(rootDir);

  return {
    framework,
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
  await writeVersionedJsonArtifact(outputPath, manifest);

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