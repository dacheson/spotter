import type { FrameworkName, PackageManagerName, RouteDefinition } from '../types.js';

export interface RepositoryMetadata {
  rootDir: string;
  framework: FrameworkName;
  packageManager: PackageManagerName;
}

export interface RepositoryScanResult {
  metadata: RepositoryMetadata;
  routes: RouteDefinition[];
}