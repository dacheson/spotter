import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { stampArtifactSchemaVersion } from '../artifacts/versioned.js';
export { artifactSchemaVersion } from '../artifacts/versioned.js';
import { loadSpotterConfig } from '../config/index.js';
import type { ManifestSummaryScenario } from '../types.js';
import type { DiffSummary } from '../diff/index.js';

export type ArtifactRunKind = 'baseline' | 'changed';

export type ChangedSelectionMode = 'full' | 'impact' | 'none';

export interface ChangedSelectionSummary {
  changedFileCount: number;
  mode: ChangedSelectionMode;
  possibleAdditionalImpactCount: number;
  selectedScenarioCount: number;
  trustedScenarioCount: number;
}

export interface ChangedScenarioSelection {
  changedFiles: string[];
  mode: ChangedSelectionMode;
  possibleAdditionalImpact: ManifestSummaryScenario[];
  reason: string;
  trustedScenarios: ManifestSummaryScenario[];
}

export interface BaselineArtifactRecord {
  kind: 'baseline';
  schemaVersion?: number;
  generatedAt: string;
  baselineDir: string;
  configPath: string;
  testDir: string;
  command: string;
  args: string[];
}

export interface ChangedArtifactRecord {
  kind: 'changed';
  schemaVersion?: number;
  generatedAt: string;
  baselineDir: string;
  configPath: string;
  resultsDir: string;
  testDir: string;
  command: string;
  args: string[];
  completed: boolean;
  exitCode: number;
  failureMessage?: string;
  passed: boolean;
  selection?: ChangedScenarioSelection;
  selectionSummary?: ChangedSelectionSummary;
  summary: DiffSummary;
}

export type ArtifactRecord = BaselineArtifactRecord | ChangedArtifactRecord;

export interface WriteArtifactRecordOptions {
  cwd?: string;
}

export interface WrittenArtifactRecord {
  artifactPath: string;
  record: ArtifactRecord;
}

export async function writeArtifactRecord(
  record: ArtifactRecord,
  options: WriteArtifactRecordOptions = {}
): Promise<WrittenArtifactRecord> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const artifactPath = path.join(artifactsDir, createArtifactFileName(record.kind));
  const versionedRecord = withArtifactSchemaVersion(record);

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(versionedRecord, null, 2)}\n`, 'utf8');

  return {
    artifactPath,
    record: versionedRecord
  };
}

function createArtifactFileName(kind: ArtifactRunKind): string {
  return `${kind}-run.json`;
}

function withArtifactSchemaVersion(record: ArtifactRecord): ArtifactRecord {
  return stampArtifactSchemaVersion(record);
}