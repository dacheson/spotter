import { loadSpotterConfig } from '../config/index.js';
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