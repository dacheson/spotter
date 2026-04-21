import type { FrameworkName, PackageManagerName, RouteDefinition } from '../types.js';

export * from './nextjs.js';
export * from './adapters.js';
export * from './manifest.js';
export * from './signals.js';
export * from './heuristics.js';
export * from './workspace.js';

export interface RepositoryMetadata {
  rootDir: string;
  framework: FrameworkName;
  packageManager: PackageManagerName;
}

export interface RepositoryScanResult {
  metadata: RepositoryMetadata;
  routes: RouteDefinition[];
}