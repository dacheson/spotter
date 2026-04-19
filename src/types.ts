export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type FrameworkName =
  | 'next-app'
  | 'next-pages'
  | 'react-router'
  | 'vite-react'
  | 'cra'
  | 'unknown';

export type ScenarioPriority = 'high' | 'medium' | 'low';

export interface ViewportDefinition {
  name: string;
  width: number;
  height: number;
}

export interface LocaleDefinition {
  code: string;
  label?: string;
  rtl?: boolean;
}

export interface RouteDefinition {
  path: string;
  filePath: string;
  dynamic: boolean;
}

export interface ScenarioDefinition {
  id: string;
  routePath: string;
  name: string;
  priority: ScenarioPriority;
  tags: string[];
}