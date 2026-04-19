import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadSpotterConfig, writeStarterConfig } from '../config/index.js';
import { renderVisualReportSummary, writeVisualReportMarkdown } from '../reports/index.js';
import {
  createConfiguredScenarioPlan,
  generateDeterministicScenarios,
  mapHeuristicsToRoutes,
  mapSignalKindsToRoutes
} from '../scenarios/index.js';
import { writeGeneratedPlaywrightTests } from '../playwright/index.js';
import { scanWorkspace } from '../scanner/index.js';
import type { ScenarioDefinition, ScenarioPriority } from '../types.js';

export interface WorkflowEnvironment {
  cwd: string;
}

export interface InitWorkflowResult {
  configPath: string;
}

export interface ScanWorkflowResult {
  heuristicsPath: string;
  routeCount: number;
  routeManifestPath: string;
  signalCount: number;
  signalsPath: string;
  summaryPath: string;
}

export interface GenerateWorkflowResult {
  outputDir: string;
  planArtifactPath: string;
  scenariosArtifactPath: string;
  scenariosCount: number;
  testFileCount: number;
}

export interface ReportWorkflowResult {
  artifactPath: string;
  lines: string[];
  markdownPath: string;
}

export async function runInitWorkflow(environment: WorkflowEnvironment): Promise<InitWorkflowResult> {
  const result = await writeStarterConfig({ cwd: environment.cwd });

  return {
    configPath: result.configPath
  };
}

export async function runScanWorkflow(environment: WorkflowEnvironment): Promise<ScanWorkflowResult> {
  const result = await scanWorkspace({ cwd: environment.cwd });

  return {
    heuristicsPath: result.heuristicsPath,
    routeCount: result.routeManifest.routes.length,
    routeManifestPath: result.routeManifestPath,
    signalCount: result.signals.findings.length,
    signalsPath: result.signalsPath,
    summaryPath: result.summaryPath
  };
}

export async function runGenerateWorkflow(environment: WorkflowEnvironment): Promise<GenerateWorkflowResult> {
  const scanResult = await scanWorkspace({ cwd: environment.cwd });
  const heuristicsByRoute = mapHeuristicsToRoutes(scanResult.routeManifest.routes, scanResult.heuristics.heuristics);
  const signalKindsByRoute = mapSignalKindsToRoutes(scanResult.routeManifest.routes, scanResult.signals.findings);
  const scenarios = generateDeterministicScenarios({
    heuristicsByRoute,
    routes: scanResult.routeManifest.routes,
    signalKindsByRoute
  });
  const scenarioPlan = await createConfiguredScenarioPlan(scenarios, { cwd: environment.cwd });
  const writtenTests = await writeGeneratedPlaywrightTests(scenarioPlan, { cwd: environment.cwd });
  const { config } = await loadSpotterConfig({ cwd: environment.cwd });
  const artifactsDir = path.resolve(environment.cwd, config.paths.artifactsDir);
  const scenariosArtifactPath = path.join(artifactsDir, 'scenarios.json');
  const planArtifactPath = path.join(artifactsDir, 'scenario-plan.json');

  await mkdir(artifactsDir, { recursive: true });
  await Promise.all([
    writeJsonFile(scenariosArtifactPath, {
      generatedAt: scenarioPlan.generatedAt,
      scenarios
    }),
    writeJsonFile(planArtifactPath, scenarioPlan)
  ]);

  return {
    outputDir: writtenTests.outputDir,
    planArtifactPath,
    scenariosArtifactPath,
    scenariosCount: scenarios.length,
    testFileCount: writtenTests.files.length
  };
}

export async function runReportWorkflow(environment: WorkflowEnvironment): Promise<ReportWorkflowResult> {
  const writtenReport = await writeVisualReportMarkdown({ cwd: environment.cwd });

  return {
    artifactPath: writtenReport.summary.artifactPath,
    lines: renderVisualReportSummary(writtenReport.summary),
    markdownPath: writtenReport.outputPath
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}