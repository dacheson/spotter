export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type FrameworkName =
  | 'next-app'
  | 'next-pages'
  | 'remix'
  | 'nuxt'
  | 'react-router'
  | 'vite-react'
  | 'vite-vue'
  | 'vue-router'
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

export type DynamicRouteSegmentKind = 'single' | 'catch-all' | 'optional-catch-all';

export interface DynamicRouteSegment {
  name: string;
  kind: DynamicRouteSegmentKind;
  segment: string;
}

export interface RouteDefinition {
  path: string;
  filePath: string;
  dynamic: boolean;
  dynamicSegments: DynamicRouteSegment[];
}

export interface ScenarioDefinition {
  id: string;
  routePath: string;
  name: string;
  priority: ScenarioPriority;
  tags: string[];
}