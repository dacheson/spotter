export interface DiffArtifact {
  scenarioId: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
}

export interface DiffSummary {
  changed: number;
  unchanged: number;
  artifacts: DiffArtifact[];
}