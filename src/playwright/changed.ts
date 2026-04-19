import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import { collectDiffSummary, type DiffSummary } from '../diff/index.js';
import { writeArtifactRecord } from '../reports/index.js';
import {
  createBaselinePlaywrightConfigContents,
  type BaselineCommandRunRequest,
  type BaselineCommandRunResult,
  type BaselineCommandRunner
} from './baseline.js';

export interface ChangedCommandOptions {
  cwd?: string;
}

export interface ChangedCommandDependencies {
  runner?: BaselineCommandRunner;
}

export interface ChangedCommandResult {
  artifactPath: string;
  baselineDir: string;
  configPath: string;
  resultsDir: string;
  testDir: string;
  command: string;
  args: string[];
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
    createChangedPlaywrightConfigContents({ baselineDir, testDir, resultsDir }),
    'utf8'
  );

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['playwright', 'test', '--config', configPath];
  const runner = dependencies.runner ?? runExternalCommand;
  const runResult = await runner({ command, args, cwd });
  const summary = await collectDiffSummary(resultsDir);
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
      passed: runResult.exitCode === 0,
      summary
    },
    { cwd }
  );

  return {
    artifactPath: artifact.artifactPath,
    baselineDir,
    configPath,
    resultsDir,
    testDir,
    command,
    args,
    passed: runResult.exitCode === 0,
    summary
  };
}

export function createChangedPlaywrightConfigContents(paths: {
  baselineDir: string;
  testDir: string;
  resultsDir: string;
}): string {
  const baselineConfig = createBaselinePlaywrightConfigContents({
    baselineDir: paths.baselineDir,
    testDir: paths.testDir
  }).trimEnd();
  const outputDir = normalizeForPlaywrightPath(paths.resultsDir);

  return `${baselineConfig.slice(0, -3)}  outputDir: ${JSON.stringify(outputDir)}\n});\n`;
}

async function runExternalCommand(request: BaselineCommandRunRequest): Promise<BaselineCommandRunResult> {
  const { spawn } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1
      });
    });
  });
}

function normalizeForPlaywrightPath(value: string): string {
  return value.split(path.sep).join('/');
}