import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readVersionedJsonArtifact } from '../artifacts/versioned.js';
import { loadSpotterConfig } from '../config/index.js';
import type { ChangedArtifactRecord } from './artifacts.js';
import type { DiffArtifact } from '../diff/index.js';
import { createExecutionScopeSummaryByScenarioId, createManifestSummaryScenario, isTrustedManifestScenario } from './manifest.js';
import type { ManifestSummaryScenario, ScenarioDefinition, ScenarioPriority } from '../types.js';

export interface VisualReportDiff extends DiffArtifact {
  priority: ScenarioPriority | 'unknown';
  scenarioName: string;
}

export interface VisualReportSummary {
  artifactPath: string;
  changedScenarios: number;
  changedFileCount?: number;
  completed: boolean;
  diffs: VisualReportDiff[];
  failureMessage?: string;
  generatedAt: string;
  possibleAdditionalImpact: ManifestSummaryScenario[];
  possibleAdditionalImpactCount: number;
  passed: boolean;
  selectedScenarios?: number;
  selectionMode?: 'full' | 'impact' | 'none';
  selectionReason?: string;
  changedFiles: string[];
  totalScenarios: number;
  trustedScenarios: ManifestSummaryScenario[];
  trustedScenarioCount: number;
}

export interface ReadVisualReportSummaryOptions {
  cwd?: string;
}

export interface WriteVisualReportMarkdownOptions extends ReadVisualReportSummaryOptions {
  outputPath?: string;
}

export interface WrittenVisualReportMarkdown {
  markdown: string;
  outputPath: string;
  summary: VisualReportSummary;
}

const missingChangedArtifactMessage = "No changed-run artifact found. Run 'spotter changed' first.";

export async function readVisualReportSummary(
  options: ReadVisualReportSummaryOptions = {}
): Promise<VisualReportSummary> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const changedArtifactPath = path.join(artifactsDir, 'changed-run.json');
  const scenariosArtifactPath = path.join(artifactsDir, 'scenarios.json');
  const changedArtifact = (await readRequiredChangedArtifact(changedArtifactPath)) as ChangedArtifactRecord;
  const scenariosArtifact = (await tryReadJsonFile(scenariosArtifactPath)) as
    | { generatedAt: string; scenarios: ScenarioDefinition[] }
    | null;
  const scenarioPlanArtifactPath = path.join(artifactsDir, 'scenario-plan.json');
  const scenarioPlanArtifact = (await tryReadJsonFile(scenarioPlanArtifactPath)) as
    | { items: Array<{ scenario: { id: string }; target: { locale: { code: string }; viewport: { name: string } } }> }
    | null;
  const scenarios = scenariosArtifact?.scenarios ?? [];
  const scenariosById = Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario]));
  const scopeByScenarioId = createExecutionScopeSummaryByScenarioId(scenarioPlanArtifact?.items ?? []);
  const fallbackManifestScenarios = changedArtifact.summary.artifacts.map((artifact) =>
    createManifestSummaryScenario({
      scenarioId: artifact.scenarioId,
      ...(scopeByScenarioId[artifact.scenarioId]
        ? { executionScope: scopeByScenarioId[artifact.scenarioId] }
        : {}),
      ...(scenariosById[artifact.scenarioId]
        ? { scenario: scenariosById[artifact.scenarioId] }
        : {})
    })
  );
  const trustedScenarios = changedArtifact.selection?.trustedScenarios ?? fallbackManifestScenarios.filter((scenario) => isTrustedManifestScenario(scenario));
  const possibleAdditionalImpact = changedArtifact.selection?.possibleAdditionalImpact ?? fallbackManifestScenarios.filter((scenario) => !isTrustedManifestScenario(scenario));
  const trustedScenarioCount = changedArtifact.selectionSummary?.trustedScenarioCount ?? trustedScenarios.length;
  const possibleAdditionalImpactCount =
    changedArtifact.selectionSummary?.possibleAdditionalImpactCount ?? possibleAdditionalImpact.length;

  return {
    artifactPath: changedArtifactPath,
    changedScenarios: changedArtifact.summary.changed,
    ...(changedArtifact.selectionSummary ? { changedFileCount: changedArtifact.selectionSummary.changedFileCount } : {}),
    completed: changedArtifact.completed ?? true,
    diffs: changedArtifact.summary.artifacts.map((artifact) => {
      const scenario = scenariosById[artifact.scenarioId];

      return {
        ...artifact,
        priority: scenario?.priority ?? 'unknown',
        scenarioName: scenario?.name ?? artifact.scenarioId
      };
    }),
    generatedAt: changedArtifact.generatedAt,
    possibleAdditionalImpact,
    possibleAdditionalImpactCount,
    passed: changedArtifact.passed,
    changedFiles: changedArtifact.selection?.changedFiles ?? [],
    ...(changedArtifact.selectionSummary ? { selectedScenarios: changedArtifact.selectionSummary.selectedScenarioCount } : {}),
    ...(changedArtifact.selection ? { selectionMode: changedArtifact.selection.mode } : {}),
    ...(changedArtifact.selection ? { selectionReason: changedArtifact.selection.reason } : {}),
    totalScenarios: scenarios.length,
    ...(changedArtifact.failureMessage ? { failureMessage: changedArtifact.failureMessage } : {}),
    trustedScenarios,
    trustedScenarioCount
  };
}

export function renderVisualReportSummary(summary: VisualReportSummary): string[] {
  const groupedCounts = countDiffsByPriority(summary.diffs);
  const lines = [
    summary.completed
      ? `Changed run ${summary.passed ? 'passed' : 'failed'}.`
      : 'Changed run did not complete.',
    `Generated at ${summary.generatedAt}.`,
    `Total scenarios: ${summary.totalScenarios}.`,
    `Changed scenarios: ${summary.changedScenarios}.`,
    `Trusted scenarios: ${summary.trustedScenarioCount}.`,
    `Possible additional impact: ${summary.possibleAdditionalImpactCount}.`,
    `High priority diffs: ${groupedCounts.high}.`,
    `Medium priority diffs: ${groupedCounts.medium}.`,
    `Low priority diffs: ${groupedCounts.low}.`,
    `Unknown priority diffs: ${groupedCounts.unknown}.`
  ];

  if (summary.failureMessage) {
    lines.splice(1, 0, summary.failureMessage);
  }

  if (summary.selectionMode) {
    lines.splice(summary.failureMessage ? 2 : 1, 0, `Selection mode: ${summary.selectionMode}.`);
  }

  if (summary.selectionReason) {
    lines.splice(summary.failureMessage ? 3 : 2, 0, summary.selectionReason);
  }

  if (summary.trustedScenarios.length === 0) {
    lines.push('No high-confidence impact found.');
  } else {
    lines.push('Trusted scenarios:');

    for (const scenario of summary.trustedScenarios) {
      lines.push(formatManifestSummaryScenarioLine(scenario));
    }
  }

  if (summary.possibleAdditionalImpact.length > 0) {
    lines.push('Possible Additional Impact:');

    for (const scenario of summary.possibleAdditionalImpact) {
      lines.push(formatManifestSummaryScenarioLine(scenario));
    }
  }

  for (const diff of summary.diffs) {
    lines.push(`[${diff.priority}] ${diff.scenarioName}: ${diff.diffPath}`);
  }

  return lines;
}

export function renderVisualReportMarkdown(summary: VisualReportSummary): string {
  const groupedCounts = countDiffsByPriority(summary.diffs);
  const lines = [
    '# Spotter Visual Report',
    '',
    `Status: **${summary.completed ? (summary.passed ? 'Passed' : 'Failed') : 'Incomplete'}**`,
    `Generated: ${summary.generatedAt}`,
    `Changed artifact: ${summary.artifactPath}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Total scenarios | ${summary.totalScenarios} |`,
    `| Changed scenarios | ${summary.changedScenarios} |`,
    `| Trusted scenarios | ${summary.trustedScenarioCount} |`,
    `| Possible additional impact | ${summary.possibleAdditionalImpactCount} |`,
    `| High priority diffs | ${groupedCounts.high} |`,
    `| Medium priority diffs | ${groupedCounts.medium} |`,
    `| Low priority diffs | ${groupedCounts.low} |`,
    `| Unknown priority diffs | ${groupedCounts.unknown} |`
  ];

  if (summary.failureMessage) {
    lines.splice(5, 0, `Failure: ${summary.failureMessage}`);
  }

  if (summary.selectionMode) {
    lines.splice(summary.failureMessage ? 6 : 5, 0, `Selection mode: ${summary.selectionMode}`);
  }

  if (summary.selectionReason) {
    lines.splice(summary.failureMessage ? 7 : 6, 0, `Selection reason: ${summary.selectionReason}`);
  }

  lines.push('', '## Scenario Manifest Summary', '');

  if (summary.trustedScenarios.length === 0) {
    lines.push('No high-confidence impact found.');
  } else {
    lines.push('### Trusted Scenarios', '', '| Route | Scenario | Why Included | Confidence | Source | Runs | Correction |', '| --- | --- | --- | --- | --- | --- | --- |');

    for (const scenario of summary.trustedScenarios) {
      lines.push(renderManifestSummaryScenarioMarkdownRow(scenario));
    }
  }

  if (summary.possibleAdditionalImpact.length > 0) {
    lines.push('', '### Possible Additional Impact', '', '| Route | Scenario | Why Included | Confidence | Source | Runs | Correction |', '| --- | --- | --- | --- | --- | --- | --- |');

    for (const scenario of summary.possibleAdditionalImpact) {
      lines.push(renderManifestSummaryScenarioMarkdownRow(scenario));
    }
  }

  if (summary.diffs.length === 0) {
    lines.push('', '## Diffs', '', 'No visual diffs were detected.');
    return lines.join('\n');
  }

  lines.push('', '## Diffs', '', '| Priority | Scenario | Diff | Baseline | Current |', '| --- | --- | --- | --- | --- |');

  for (const diff of summary.diffs) {
    lines.push(
      `| ${diff.priority} | ${escapeMarkdownCell(diff.scenarioName)} | ${escapeMarkdownCell(diff.diffPath)} | ${escapeMarkdownCell(diff.baselinePath)} | ${escapeMarkdownCell(diff.currentPath)} |`
    );
  }

  return lines.join('\n');
}

export async function writeVisualReportMarkdown(
  options: WriteVisualReportMarkdownOptions = {}
): Promise<WrittenVisualReportMarkdown> {
  const cwd = options.cwd ?? process.cwd();
  const summary = await readVisualReportSummary({ cwd });
  const { config } = await loadSpotterConfig({ cwd });
  const outputPath = options.outputPath ?? path.resolve(cwd, config.paths.artifactsDir, 'visual-report.md');
  const markdown = `${renderVisualReportMarkdown(summary)}\n`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');

  return {
    markdown,
    outputPath,
    summary
  };
}

async function readRequiredChangedArtifact(filePath: string): Promise<unknown> {
  try {
    return await readVersionedJsonArtifact({ filePath });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(missingChangedArtifactMessage);
    }

    throw error;
  }
}

async function tryReadJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return await readVersionedJsonArtifact({ filePath });
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
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

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function formatManifestSummaryScenarioLine(scenario: ManifestSummaryScenario): string {
  return `- ${scenario.routePath} | ${scenario.scenarioName} | because: ${scenario.whyIncluded} | confidence: ${scenario.confidence} | source: ${scenario.provenance.join(', ')} | runs: ${scenario.executionScope}`;
}

function renderManifestSummaryScenarioMarkdownRow(scenario: ManifestSummaryScenario): string {
  return `| ${escapeMarkdownCell(scenario.routePath)} | ${escapeMarkdownCell(scenario.scenarioName)} | ${escapeMarkdownCell(scenario.whyIncluded)} | ${escapeMarkdownCell(scenario.confidence)} | ${escapeMarkdownCell(scenario.provenance.join(', '))} | ${escapeMarkdownCell(scenario.executionScope)} | ${escapeMarkdownCell(scenario.correctionHint)} |`;
}
