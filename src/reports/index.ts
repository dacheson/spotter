import type { DiffArtifact } from '../diff/index.js';

export * from './artifacts.js';
export * from './manifest.js';
export * from './summary.js';

export interface ReportSummary {
  generatedAt: string;
  totalScenarios: number;
  changedScenarios: number;
  diffs: DiffArtifact[];
}