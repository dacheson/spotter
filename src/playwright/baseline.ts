import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import { writeArtifactRecord } from '../reports/index.js';

export interface BaselineCommandOptions {
  cwd?: string;
}

export interface BaselineCommandRunRequest {
  command: string;
  args: string[];
  cwd: string;
}

export interface BaselineCommandRunResult {
  exitCode: number;
}

export interface BaselineCommandRunner {
  (request: BaselineCommandRunRequest): Promise<BaselineCommandRunResult>;
}

export interface BaselineCommandDependencies {
  runner?: BaselineCommandRunner;
}

export interface BaselineCommandResult {
  artifactPath: string;
  baselineDir: string;
  configPath: string;
  testDir: string;
  command: string;
  args: string[];
}

export async function runBaselineCommand(
  options: BaselineCommandOptions = {},
  dependencies: BaselineCommandDependencies = {}
): Promise<BaselineCommandResult> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const baselineDir = path.resolve(cwd, config.paths.screenshotsDir);
  const testDir = path.resolve(cwd, config.paths.testsDir);
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const configPath = path.join(artifactsDir, 'playwright.baseline.config.mjs');

  await mkdir(baselineDir, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });
  await writeFile(configPath, createBaselinePlaywrightConfigContents({ baselineDir, testDir }), 'utf8');

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['playwright', 'test', '--config', configPath, '--update-snapshots'];
  const runner = dependencies.runner ?? runExternalCommand;
  const result = await runner({ command, args, cwd });

  if (result.exitCode !== 0) {
    throw new Error(`Playwright baseline run failed with exit code ${result.exitCode}.`);
  }

  const artifact = await writeArtifactRecord(
    {
      kind: 'baseline',
      generatedAt: new Date().toISOString(),
      baselineDir,
      configPath,
      testDir,
      command,
      args
    },
    { cwd }
  );

  return {
    artifactPath: artifact.artifactPath,
    baselineDir,
    configPath,
    testDir,
    command,
    args
  };
}

export function createBaselinePlaywrightConfigContents(paths: {
  baselineDir: string;
  testDir: string;
}): string {
  const snapshotPathTemplate = normalizeForPlaywrightPath(
    path.join(paths.baselineDir, '{testFilePath}', '{arg}{ext}')
  );
  const testDir = normalizeForPlaywrightPath(paths.testDir);

  return [
    "import { defineConfig } from '@playwright/test';",
    '',
    'export default defineConfig({',
    `  testDir: ${JSON.stringify(testDir)},`,
    `  snapshotPathTemplate: ${JSON.stringify(snapshotPathTemplate)}`,
    '});',
    ''
  ].join('\n');
}

async function runExternalCommand(request: BaselineCommandRunRequest): Promise<BaselineCommandRunResult> {
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