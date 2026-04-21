import { describe, expect, it } from 'vitest';

import packageMetadata from '../package.json' with { type: 'json' };

import {
  defaultSpotterConfig,
  formatIsoTimestamp,
  packageVersion,
  plannedCliCommands,
  projectName,
  supportedConfigFileNames,
  systemTimestampSource
} from '../src/index.js';

describe('project structure', () => {
  it('exports the baseline package surface', () => {
    expect(projectName).toBe('spotter');
    expect(packageVersion).toBe(packageMetadata.version);
    expect(plannedCliCommands.map((command) => command.name)).toEqual([
      'init',
      'scan',
      'generate',
      'baseline',
      'changed',
      'report'
    ]);
    expect(supportedConfigFileNames).toEqual(['spotter.config.ts', 'spotter.config.json']);
  });

  it('provides deterministic defaults for future modules', () => {
    expect(defaultSpotterConfig.paths).toEqual({
      artifactsDir: '.spotter/artifacts',
      screenshotsDir: '.spotter/baselines',
      testsDir: '.spotter/tests'
    });
    expect(defaultSpotterConfig.viewports).toEqual([
      {
        name: 'desktop',
        width: 1440,
        height: 900
      },
      {
        name: 'mobile',
        width: 390,
        height: 844
      }
    ]);
    expect(formatIsoTimestamp(systemTimestampSource.now())).toMatch(/Z$/);
  });
});