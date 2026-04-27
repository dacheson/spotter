import { loadSpotterConfig } from '../config/index.js';

export * from './priority.js';
export * from './deterministic.js';

import type { SpotterScenarioOverridesConfig } from '../config/index.js';
import type { LocaleDefinition, ScenarioDefinition, ViewportDefinition } from '../types.js';

export interface ScenarioTarget {
  locale: LocaleDefinition;
  viewport: ViewportDefinition;
}

export interface ScenarioPlanItem {
  scenario: ScenarioDefinition;
  target: ScenarioTarget;
}

export interface ScenarioPlan {
  generatedAt: string;
  items: ScenarioPlanItem[];
}

export interface CreateScenarioPlanOptions {
  generatedAt?: string;
  locales?: LocaleDefinition[];
  viewports?: ViewportDefinition[];
}

export interface CreateConfiguredScenarioPlanOptions {
  cwd?: string;
  generatedAt?: string;
}

export function createScenarioPlan(
  scenarios: ScenarioDefinition[],
  options: CreateScenarioPlanOptions = {}
): ScenarioPlan {
  const viewports = options.viewports ?? [];
  const locales = options.locales ?? [];

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    items: scenarios.flatMap((scenario) =>
      viewports.flatMap((viewport) =>
        locales.map((locale) => ({
          scenario,
          target: {
            locale,
            viewport
          }
        }))
      )
    )
  };
}

export async function createConfiguredScenarioPlan(
  scenarios: ScenarioDefinition[],
  options: CreateConfiguredScenarioPlanOptions = {}
): Promise<ScenarioPlan> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const createOptions: CreateScenarioPlanOptions = {
    locales: config.locales,
    viewports: config.viewports
  };

  if (options.generatedAt) {
    createOptions.generatedAt = options.generatedAt;
  }

  return createScenarioPlan(scenarios, createOptions);
}

export function applyScenarioOverrides(
  scenarios: ScenarioDefinition[],
  overrides: SpotterScenarioOverridesConfig
): ScenarioDefinition[] {
  const excludedIds = new Set((overrides.exclude.ids ?? []).map(normalizeKeyPart));
  const excludedNames = new Set((overrides.exclude.names ?? []).map(normalizeKeyPart));
  const excludedRoutePaths = new Set((overrides.exclude.routePaths ?? []).map(normalizeKeyPart));
  const filteredScenarios = scenarios.filter((scenario) => {
    if (excludedIds.has(normalizeKeyPart(scenario.id))) {
      return false;
    }

    if (excludedNames.has(normalizeKeyPart(scenario.name))) {
      return false;
    }

    if (excludedRoutePaths.has(normalizeKeyPart(scenario.routePath))) {
      return false;
    }

    return true;
  });
  const mergedScenarios = [...filteredScenarios];
  const seenIds = new Set(filteredScenarios.map((scenario) => normalizeKeyPart(scenario.id)));
  const seenRouteNames = new Set(
    filteredScenarios.map((scenario) => `${normalizeKeyPart(scenario.routePath)}::${normalizeKeyPart(scenario.name)}`)
  );

  for (const includedScenario of overrides.include) {
    const normalizedScenario = normalizeScenarioOverride(includedScenario);
    const scenarioIdKey = normalizeKeyPart(normalizedScenario.id);
    const routeNameKey = `${normalizeKeyPart(normalizedScenario.routePath)}::${normalizeKeyPart(normalizedScenario.name)}`;

    if (seenIds.has(scenarioIdKey) || seenRouteNames.has(routeNameKey)) {
      continue;
    }

    seenIds.add(scenarioIdKey);
    seenRouteNames.add(routeNameKey);
    mergedScenarios.push(normalizedScenario);
  }

  return mergedScenarios.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeScenarioOverride(scenario: ScenarioDefinition): ScenarioDefinition {
  return {
    id: scenario.id.trim(),
    origin: 'user-override',
    routePath: scenario.routePath.trim(),
    name: scenario.name.trim(),
    priority: scenario.priority,
    tags: Array.from(new Set(scenario.tags.map((tag) => tag.trim()).filter(Boolean)))
  };
}

function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}