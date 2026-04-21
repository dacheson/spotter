import path from 'node:path';

import type {
  ComponentStateHeuristic,
  ComponentStateHeuristicKind,
  ComponentSignalFinding,
  ComponentSignalKind
} from '../scanner/index.js';
import { prioritizeScenarios, type PrioritizeScenariosOptions } from './priority.js';
import type { RouteDefinition, ScenarioDefinition } from '../types.js';

export interface GenerateDeterministicScenariosOptions {
  heuristicsByRoute?: Record<string, ComponentStateHeuristic[]>;
  routes: RouteDefinition[];
  signalKindsByRoute?: Record<string, ComponentSignalKind[]>;
}

const signalScenarioDefinitions: Array<{
  kind: ComponentSignalKind;
  suffix: string;
  label: string;
  tags: string[];
}> = [
  { kind: 'loading', suffix: 'loading-state', label: 'Loading State', tags: ['loading'] },
  { kind: 'error', suffix: 'error-state', label: 'Error State', tags: ['error'] },
  { kind: 'empty', suffix: 'empty-state', label: 'Empty State', tags: ['empty'] },
  { kind: 'modal', suffix: 'modal-state', label: 'Modal State', tags: ['modal'] },
  { kind: 'form', suffix: 'validation-state', label: 'Validation State', tags: ['form', 'validation'] },
  { kind: 'auth', suffix: 'auth-gate', label: 'Auth Gate', tags: ['auth'] },
  { kind: 'role', suffix: 'role-gate', label: 'Role Gate', tags: ['role'] },
  { kind: 'success', suffix: 'success-state', label: 'Success State', tags: ['success'] },
  { kind: 'feature', suffix: 'feature-flag', label: 'Feature Flag', tags: ['feature-flag'] },
  { kind: 'responsive', suffix: 'responsive-layout', label: 'Responsive Layout', tags: ['responsive'] },
  { kind: 'locale', suffix: 'localization-state', label: 'Localization State', tags: ['localization'] }
];

export function generateDeterministicScenarios(
  options: GenerateDeterministicScenariosOptions
): ScenarioDefinition[] {
  const scenarios = new Map<string, ScenarioDefinition>();

  for (const route of options.routes) {
    const routeSlug = slugifyRoute(route.path);
    const routeLabel = createRouteLabel(route.path);
    const routeTags = createRouteTags(route.path);

    addScenario(scenarios, {
      id: `${routeSlug}-default`,
      routePath: route.path,
      name: `${routeLabel} Default`,
      priority: 'low',
      tags: routeTags
    });

    const signalKinds = new Set<ComponentSignalKind>([
      ...(options.signalKindsByRoute?.[route.path] ?? []),
      ...mapHeuristicsToKinds(options.heuristicsByRoute?.[route.path] ?? [])
    ]);

    for (const definition of signalScenarioDefinitions) {
      if (!signalKinds.has(definition.kind)) {
        continue;
      }

      addScenario(scenarios, {
        id: `${routeSlug}-${definition.suffix}`,
        routePath: route.path,
        name: `${routeLabel} ${definition.label}`,
        priority: 'low',
        tags: [...routeTags, ...definition.tags]
      });
    }
  }

  const routesByPath = Object.fromEntries(options.routes.map((route) => [route.path, route]));
  const prioritizeOptions: PrioritizeScenariosOptions = {
    routesByPath
  };

  if (options.heuristicsByRoute) {
    prioritizeOptions.heuristicsByRoute = options.heuristicsByRoute;
  }

  if (options.signalKindsByRoute) {
    prioritizeOptions.signalKindsByRoute = options.signalKindsByRoute;
  }

  return prioritizeScenarios([...scenarios.values()], prioritizeOptions).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

export function mapHeuristicsToRoutes(
  routes: RouteDefinition[],
  heuristics: ComponentStateHeuristic[]
): Record<string, ComponentStateHeuristic[]> {
  return mapEntriesToRoutes(routes, heuristics, (heuristic) => heuristic.filePath);
}

export function mapSignalKindsToRoutes(
  routes: RouteDefinition[],
  findings: ComponentSignalFinding[]
): Record<string, ComponentSignalKind[]> {
  const grouped = mapEntriesToRoutes(routes, findings, (finding) => finding.filePath);

  return Object.fromEntries(
    Object.entries(grouped).map(([routePath, routeFindings]) => [
      routePath,
      Array.from(new Set(routeFindings.map((finding) => finding.kind))).sort((left, right) => left.localeCompare(right))
    ])
  );
}

function mapEntriesToRoutes<T>(
  routes: RouteDefinition[],
  entries: T[],
  getFilePath: (entry: T) => string
): Record<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const entry of entries) {
    const route = findBestMatchingRoute(routes, getFilePath(entry));

    if (!route) {
      continue;
    }

    const routeEntries = grouped.get(route.path) ?? [];
    routeEntries.push(entry);
    grouped.set(route.path, routeEntries);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([routePath, routeEntries]) => [routePath, routeEntries])
  );
}

function findBestMatchingRoute(routes: RouteDefinition[], filePath: string): RouteDefinition | null {
  const normalizedFilePath = normalizePath(filePath);
  let bestMatch: RouteDefinition | null = null;
  let bestScore = -1;

  for (const route of routes) {
    const routeFilePath = normalizePath(route.filePath);
    const routeDirectory = normalizePath(path.posix.dirname(routeFilePath));
    let score = -1;

    if (normalizedFilePath === routeFilePath) {
      score = routeFilePath.length + 1;
    } else if (routeDirectory !== '.' && normalizedFilePath.startsWith(`${routeDirectory}/`)) {
      score = routeDirectory.length;
    }

    if (score > bestScore) {
      bestMatch = route;
      bestScore = score;
    }
  }

  return bestMatch;
}

function mapHeuristicsToKinds(heuristics: ComponentStateHeuristic[]): ComponentSignalKind[] {
  return heuristics.map((heuristic) => mapHeuristicKindToSignalKind(heuristic.kind));
}

function mapHeuristicKindToSignalKind(kind: ComponentStateHeuristicKind): ComponentSignalKind {
  return kind;
}

function addScenario(entries: Map<string, ScenarioDefinition>, scenario: ScenarioDefinition): void {
  if (!entries.has(scenario.id)) {
    entries.set(scenario.id, scenario);
  }
}

function createRouteLabel(routePath: string): string {
  if (routePath === '/') {
    return 'Home';
  }

  return routePath
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/\[(?:\.\.\.)?(.+?)\]/g, '$1'))
    .map((segment) => segment.replace(/[-_]+/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function createRouteTags(routePath: string): string[] {
  if (routePath === '/') {
    return ['home'];
  }

  return Array.from(
    new Set(
      routePath
        .split('/')
        .filter(Boolean)
        .map((segment) => segment.replace(/\[(?:\.\.\.)?(.+?)\]/g, '$1'))
        .map((segment) => segment.toLowerCase())
    )
  );
}

function slugifyRoute(routePath: string): string {
  if (routePath === '/') {
    return 'home';
  }

  return routePath
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/\[(?:\.\.\.)?(.+?)\]/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}