import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  completed: boolean;
  diffs: VisualReportDiff[];
  failureMessage?: string;
  generatedAt: string;
  passed: boolean;
  totalScenarios: number;
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
  const scenarios = scenariosArtifact?.scenarios ?? [];
  const scenariosById = Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario]));

  return {
    artifactPath: changedArtifactPath,
    changedScenarios: changedArtifact.summary.changed,
    completed: changedArtifact.completed ?? true,
    diffs: changedArtifact.summary.artifacts.map((artifact) => {
      const scenario = scenariosById[artifact.scenarioId];

      return {
        ...artifact,
        priority: scenario?.priority ?? 'unknown',
        scenarioName: scenario?.name ?? artifact.scenarioId
      };
    }),
    failureMessage: changedArtifact.failureMessage,
    generatedAt: changedArtifact.generatedAt,
    passed: changedArtifact.passed,
    totalScenarios: scenarios.length
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
    `High priority diffs: ${groupedCounts.high}.`,
    `Medium priority diffs: ${groupedCounts.medium}.`,
    `Low priority diffs: ${groupedCounts.low}.`,
    `Unknown priority diffs: ${groupedCounts.unknown}.`
  ];

  if (summary.failureMessage) {
    lines.splice(1, 0, summary.failureMessage);
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
    `| High priority diffs | ${groupedCounts.high} |`,
    `| Medium priority diffs | ${groupedCounts.medium} |`,
    `| Low priority diffs | ${groupedCounts.low} |`,
    `| Unknown priority diffs | ${groupedCounts.unknown} |`
  ];

  if (summary.failureMessage) {
    lines.splice(5, 0, `Failure: ${summary.failureMessage}`);
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

async function readJsonFile(filePath: string): Promise<unknown> {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents) as unknown;
}

async function readRequiredChangedArtifact(filePath: string): Promise<unknown> {
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(missingChangedArtifactMessage);
    }

    throw error;
  }
}

async function tryReadJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return await readJsonFile(filePath);
  } catch {
    return null;
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