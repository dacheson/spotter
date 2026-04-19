import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';
import type { SpotterDevServerConfig } from '../config/index.js';
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
  appUrl: string;
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
  await writeFile(
    configPath,
    createBaselinePlaywrightConfigContents({
      appUrl: config.appUrl,
      baselineDir,
      devServer: createResolvedDevServerConfig(cwd, config.devServer),
      testDir
    }),
    'utf8'
  );

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
    appUrl: config.appUrl,
    baselineDir,
    configPath,
    testDir,
    command,
    args
  };
}

export function createBaselinePlaywrightConfigContents(paths: {
  appUrl: string;
  baselineDir: string;
  devServer: SpotterDevServerConfig | null;
  testDir: string;
}): string {
  const snapshotPathTemplate = normalizeForPlaywrightPath(
    path.join(paths.baselineDir, '{testFilePath}', '{arg}{ext}')
  );
  const testDir = normalizeForPlaywrightPath(paths.testDir);
  const lines = [
    "import { defineConfig } from '@playwright/test';",
    '',
    'export default defineConfig({',
    `  testDir: ${JSON.stringify(testDir)},`,
    `  snapshotPathTemplate: ${JSON.stringify(snapshotPathTemplate)},`,
    '  use: {',
    `    baseURL: ${JSON.stringify(paths.appUrl)}`,
    '  }'
  ];

  if (paths.devServer) {
    lines.push('  ,webServer: {');
    lines.push(`    command: ${JSON.stringify(paths.devServer.command)},`);
    if (paths.devServer.cwd) {
      lines.push(`    cwd: ${JSON.stringify(normalizeForPlaywrightPath(paths.devServer.cwd))},`);
    }
    lines.push(`    reuseExistingServer: ${paths.devServer.reuseExistingServer},`);
    lines.push(`    timeout: ${paths.devServer.timeoutMs},`);
    lines.push(`    url: ${JSON.stringify(paths.appUrl)}`);
    lines.push('  }');
  }

  lines.push('});', '');

  return lines.join('\n');
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