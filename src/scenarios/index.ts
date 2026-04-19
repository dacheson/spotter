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