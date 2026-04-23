import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig, resolveCaptureServerConfig } from '../config/index.js';
import type { SpotterDevServerConfig } from '../config/index.js';
import { collectDiffSummary, type DiffSummary } from '../diff/index.js';
import { writeArtifactRecord } from '../reports/index.js';
import {
  createBaselinePlaywrightConfigContents,
  type BaselineCommandRunRequest,
  type BaselineCommandRunResult,
  type BaselineCommandRunner
} from './baseline.js';
import { createNpxCommand, runExternalCommand } from './command.js';

export interface ChangedCommandOptions {
  cwd?: string;
}

export interface ChangedCommandDependencies {
  runner?: BaselineCommandRunner;
}

export interface ChangedCommandResult {
  artifactPath: string;
  appUrl: string;
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

export async function runChangedCommand(
  options: ChangedCommandOptions = {},
  dependencies: ChangedCommandDependencies = {}
): Promise<ChangedCommandResult> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const baselineDir = path.resolve(cwd, config.paths.screenshotsDir);
  const testDir = path.resolve(cwd, config.paths.testsDir);
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const resultsDir = path.join(artifactsDir, 'playwright-results');
  const configPath = path.join(artifactsDir, 'playwright.changed.config.mjs');

  await mkdir(resultsDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });
  await writeFile(
    configPath,
    createChangedPlaywrightConfigContents({
      appUrl: config.appUrl,
      baselineDir,
      configDir: artifactsDir,
      devServer: createResolvedDevServerConfig(cwd, resolveCaptureServerConfig(config)),
      testDir,
      resultsDir
    }),
    'utf8'
  );

  const externalCommand = createNpxCommand(['playwright', 'test', '--config', configPath]);
  const command = externalCommand.command;
  const args = externalCommand.args;
  const runner = dependencies.runner ?? runExternalCommand;
  const runResult = await runner({ command, args, cwd });
  const summary = await collectDiffSummary(resultsDir);
  const completed = runResult.exitCode === 0 || summary.changed > 0;
  const failureMessage = completed
    ? undefined
    : `Playwright changed run failed before visual comparison completed (exit code ${runResult.exitCode}).`;
  const artifact = await writeArtifactRecord(
    {
      kind: 'changed',
      generatedAt: new Date().toISOString(),
      baselineDir,
      configPath,
      resultsDir,
      testDir,
      command,
      args,
      completed,
      exitCode: runResult.exitCode,
      failureMessage,
      passed: runResult.exitCode === 0,
      summary
    },
    { cwd }
  );

  return {
    artifactPath: artifact.artifactPath,
    appUrl: config.appUrl,
    baselineDir,
    configPath,
    resultsDir,
    testDir,
    command,
    args,
    completed,
    exitCode: runResult.exitCode,
    failureMessage,
    passed: runResult.exitCode === 0,
    summary
  };
}

export function createChangedPlaywrightConfigContents(paths: {
  appUrl: string;
  baselineDir: string;
  configDir: string;
  devServer: SpotterDevServerConfig | null;
  testDir: string;
  resultsDir: string;
}): string {
  const baselineConfig = createBaselinePlaywrightConfigContents({
    appUrl: paths.appUrl,
    baselineDir: paths.baselineDir,
    configDir: paths.configDir,
    devServer: paths.devServer,
    testDir: paths.testDir
  }).trimEnd();
  const outputDir = createConfigRelativePlaywrightPath(paths.configDir, paths.resultsDir);

  return baselineConfig.replace(/\n\}\);\n?$/, `,\n  outputDir: ${JSON.stringify(outputDir)}\n});\n`);
}

function createConfigRelativePlaywrightPath(configDir: string, targetPath: string): string {
  const relativePath = path.relative(configDir, targetPath);
  const normalizedPath = relativePath.split(path.sep).join('/') || '.';

  if (normalizedPath === '.' || normalizedPath.startsWith('../')) {
    return normalizedPath;
  }

  return `./${normalizedPath}`;
}

function createResolvedDevServerConfig(
  cwd: string,
  devServer: SpotterDevServerConfig | null
): SpotterDevServerConfig | null {
  if (!devServer) {
    return null;
  }

  const resolvedDevServer: SpotterDevServerConfig = {
    command: devServer.command,
    reuseExistingServer: devServer.reuseExistingServer,
    timeoutMs: devServer.timeoutMs
  };

  if (devServer.cwd) {
    resolvedDevServer.cwd = path.resolve(cwd, devServer.cwd);
  }

  return resolvedDevServer;
}