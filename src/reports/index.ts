import type { DiffArtifact } from '../diff/index.js';

export interface ReportSummary {
  generatedAt: string;
  totalScenarios: number;
  changedScenarios: number;
  diffs: DiffArtifact[];
}