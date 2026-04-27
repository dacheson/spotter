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

export type ManifestScenarioConfidence = ScenarioPriority | 'unknown';

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
  origin?: 'deterministic' | 'llm-fallback' | 'user-override';
  routePath: string;
  name: string;
  priority: ScenarioPriority;
  tags: string[];
}

export interface ManifestSummaryScenario {
  confidence: ManifestScenarioConfidence;
  correctionHint: string;
  executionScope: string;
  provenance: string[];
  routePath: string;
  scenarioId: string;
  scenarioName: string;
  whyIncluded: string;
}