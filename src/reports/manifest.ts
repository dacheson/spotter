import path from 'node:path';

import type { ManifestScenarioConfidence, ManifestSummaryScenario, ScenarioDefinition } from '../types.js';

export function createManifestSummaryScenario(options: {
  scenarioId: string;
  executionScope?: string;
  scenario?: ScenarioDefinition;
  whyIncluded?: string;
  provenance?: string[];
  correctionHint?: string;
  confidence?: ManifestScenarioConfidence;
}): ManifestSummaryScenario {
  const scenario = options.scenario;
  const routePath = scenario?.routePath ?? 'Unknown route';
  const scenarioName = scenario?.name ?? options.scenarioId;
  const whyIncluded = options.whyIncluded ?? createWhyIncludedSummary(scenario);
  const confidence = options.confidence ?? createManifestScenarioConfidence(scenario);
  const provenance = options.provenance ?? createManifestProvenance(scenario);

  return {
    confidence,
    correctionHint:
      options.correctionHint ??
      'Adjust Spotter config overrides if this scenario should be included, excluded, or reclassified.',
    executionScope: options.executionScope ?? 'Execution scope unknown.',
    provenance,
    routePath,
    scenarioId: options.scenarioId,
    scenarioName,
    whyIncluded
  };
}

export function createExecutionScopeSummaryByScenarioId(
  items: Array<{ scenario: { id: string }; target: { locale: { code: string }; viewport: { name: string } } }>
): Record<string, string> {
  const grouped = new Map<string, Array<{ localeCode: string; viewportName: string }>>();

  for (const item of items) {
    const targets = grouped.get(item.scenario.id) ?? [];
    targets.push({
      localeCode: item.target.locale.code,
      viewportName: item.target.viewport.name
    });
    grouped.set(item.scenario.id, targets);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([scenarioId, targets]) => [scenarioId, summarizeExecutionScope(targets)])
  );
}

export function isTrustedManifestScenario(scenario: ManifestSummaryScenario): boolean {
  return (
    scenario.routePath.length > 0 &&
    scenario.scenarioName.length > 0 &&
    scenario.whyIncluded.length > 0 &&
    scenario.provenance.length > 0 &&
    scenario.confidence !== 'unknown'
  );
}

function createWhyIncludedSummary(scenario?: ScenarioDefinition): string {
  if (!scenario) {
    return 'Included because the changed run reported a diff for this scenario, but Spotter could not load the scenario manifest entry.';
  }

  const stateTags = scenario.tags.filter((tag) => isDecisionTag(tag));

  if (scenario.id.endsWith('-default')) {
    return `Default route coverage for ${scenario.routePath}.`;
  }

  if (stateTags.length === 0) {
    return `Scenario coverage for ${scenario.routePath} based on the current generated scenario manifest.`;
  }

  return `Included because Spotter inferred ${stateTags.join(', ')} coverage for ${scenario.routePath}.`;
}

function createManifestScenarioConfidence(scenario?: ScenarioDefinition): ManifestScenarioConfidence {
  if (!scenario) {
    return 'unknown';
  }

  if (scenario.id.endsWith('-default')) {
    return 'high';
  }

  return scenario.priority;
}

function createManifestProvenance(scenario?: ScenarioDefinition): string[] {
  if (!scenario) {
    return [];
  }

  const stateTags = scenario.tags.filter((tag) => isDecisionTag(tag));
  const provenance = [`route:${scenario.routePath}`, `scenario:${scenario.id}`];

  if (scenario.origin === 'user-override') {
    provenance.push('source:user-override');
  }

  for (const tag of stateTags) {
    provenance.push(`tag:${tag}`);
  }

  return provenance;
}

function summarizeExecutionScope(targets: Array<{ localeCode: string; viewportName: string }>): string {
  if (targets.length === 0) {
    return 'Execution scope unknown.';
  }

  if (targets.length === 1) {
    const target = targets[0]!;
    return `1 target: ${target.viewportName}/${target.localeCode}`;
  }

  const localeCount = new Set(targets.map((target) => target.localeCode)).size;
  const viewportCount = new Set(targets.map((target) => target.viewportName)).size;

  return `${targets.length} targets across ${viewportCount} viewport${viewportCount === 1 ? '' : 's'} and ${localeCount} locale${localeCount === 1 ? '' : 's'}`;
}

function isDecisionTag(tag: string): boolean {
  return new Set([
    'auth',
    'empty',
    'error',
    'feature-flag',
    'form',
    'loading',
    'localization',
    'modal',
    'responsive',
    'role',
    'success',
    'validation'
  ]).has(tag);
}

export function normalizeWorkspacePath(value: string): string {
  return value.split(path.sep).join('/');
}