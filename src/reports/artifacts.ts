import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import type { DiffSummary } from '../diff/index.js';

export type ArtifactRunKind = 'baseline' | 'changed';

export interface BaselineArtifactRecord {
  kind: 'baseline';
  generatedAt: string;
  baselineDir: string;
  configPath: string;
  testDir: string;
  command: string;
  args: string[];
}

export interface ChangedArtifactRecord {
  kind: 'changed';
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

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  return {
    artifactPath,
    record
  };
}

function createArtifactFileName(kind: ArtifactRunKind): string {
  return `${kind}-run.json`;
}