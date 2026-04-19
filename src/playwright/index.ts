import type { ScenarioDefinition, ViewportDefinition } from '../types.js';

export interface PlaywrightProjectTarget {
  name: string;
  testDir: string;
  snapshotDir: string;
  viewports: ViewportDefinition[];
}

export interface GeneratedTestFile {
  filePath: string;
  scenario: ScenarioDefinition;
}