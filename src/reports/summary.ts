import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import type { ChangedArtifactRecord } from './artifacts.js';
import type { DiffArtifact } from '../diff/index.js';
import type { ScenarioDefinition, ScenarioPriority } from '../types.js';

export interface VisualReportDiff extends DiffArtifact {
  priority: ScenarioPriority | 'unknown';
  scenarioName: string;
}

export interface VisualReportSummary {
  artifactPath: string;
  changedScenarios: number;
  diffs: VisualReportDiff[];
  generatedAt: string;
  passed: boolean;
  totalScenarios: number;
}

export interface ReadVisualReportSummaryOptions {
  cwd?: string;
}

export async function readVisualReportSummary(
  options: ReadVisualReportSummaryOptions = {}
): Promise<VisualReportSummary> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const changedArtifactPath = path.join(artifactsDir, 'changed-run.json');
  const scenariosArtifactPath = path.join(artifactsDir, 'scenarios.json');
  const changedArtifact = (await readJsonFile(changedArtifactPath)) as ChangedArtifactRecord;
  const scenariosArtifact = (await tryReadJsonFile(scenariosArtifactPath)) as
    | { generatedAt: string; scenarios: ScenarioDefinition[] }
    | null;
  const scenarios = scenariosArtifact?.scenarios ?? [];
  const scenariosById = Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario]));

  return {
    artifactPath: changedArtifactPath,
    changedScenarios: changedArtifact.summary.changed,
    diffs: changedArtifact.summary.artifacts.map((artifact) => {
      const scenario = scenariosById[artifact.scenarioId];

      return {
        ...artifact,
        priority: scenario?.priority ?? 'unknown',
        scenarioName: scenario?.name ?? artifact.scenarioId
      };
    }),
    generatedAt: changedArtifact.generatedAt,
    passed: changedArtifact.passed,
    totalScenarios: scenarios.length
  };
}

export function renderVisualReportSummary(summary: VisualReportSummary): string[] {
  const groupedCounts = countDiffsByPriority(summary.diffs);
  const lines = [
    `Changed run ${summary.passed ? 'passed' : 'failed'}.`,
    `Generated at ${summary.generatedAt}.`,
    `Total scenarios: ${summary.totalScenarios}.`,
    `Changed scenarios: ${summary.changedScenarios}.`,
    `High priority diffs: ${groupedCounts.high}.`,
    `Medium priority diffs: ${groupedCounts.medium}.`,
    `Low priority diffs: ${groupedCounts.low}.`,
    `Unknown priority diffs: ${groupedCounts.unknown}.`
  ];

  for (const diff of summary.diffs) {
    lines.push(`[${diff.priority}] ${diff.scenarioName}: ${diff.diffPath}`);
  }

  return lines;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents) as unknown;
}

async function tryReadJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return await readJsonFile(filePath);
  } catch {
    return null;
  }
}

function countDiffsByPriority(diffs: VisualReportDiff[]): Record<ScenarioPriority | 'unknown', number> {
  return diffs.reduce<Record<ScenarioPriority | 'unknown', number>>(
    (counts, diff) => ({
      ...counts,
      [diff.priority]: counts[diff.priority] + 1
    }),
    {
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    }
  );
}