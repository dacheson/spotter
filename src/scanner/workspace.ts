import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig } from '../config/index.js';

import { deriveComponentStateHeuristics, type ComponentStateHeuristicSummary } from './heuristics.js';
import { scanComponentSignals, type ComponentSignalScanResult } from './signals.js';
import { writeRouteManifest, type RouteManifest } from './manifest.js';

export interface ScanWorkspaceOptions {
  cwd?: string;
}

export interface ScanWorkspaceResult {
  heuristics: ComponentStateHeuristicSummary;
  heuristicsPath: string;
  routeManifest: RouteManifest;
  routeManifestPath: string;
  signals: ComponentSignalScanResult;
  signalsPath: string;
  summaryPath: string;
}

export async function scanWorkspace(options: ScanWorkspaceOptions = {}): Promise<ScanWorkspaceResult> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const routeManifestResult = await writeRouteManifest({ cwd });
  const signals = await scanComponentSignals({ cwd });
  const heuristics = deriveComponentStateHeuristics(signals);
  const signalsPath = path.join(artifactsDir, 'component-signals.json');
  const heuristicsPath = path.join(artifactsDir, 'component-heuristics.json');
  const summaryPath = path.join(artifactsDir, 'scan-summary.json');

  await mkdir(artifactsDir, { recursive: true });
  await Promise.all([
    writeJsonFile(signalsPath, signals),
    writeJsonFile(heuristicsPath, heuristics),
    writeJsonFile(summaryPath, {
      generatedAt: new Date().toISOString(),
      rootDir: routeManifestResult.manifest.rootDir,
      routeCount: routeManifestResult.manifest.routes.length,
      filesScanned: signals.filesScanned,
      signalCount: signals.findings.length,
      heuristicCounts: heuristics.counts
    })
  ]);

  return {
    heuristics,
    heuristicsPath,
    routeManifest: routeManifestResult.manifest,
    routeManifestPath: routeManifestResult.outputPath,
    signals,
    signalsPath,
    summaryPath
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}