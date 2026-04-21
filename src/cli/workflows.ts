import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  loadSpotterConfig,
  type SpotterLlmFallbackConfig,
  writeStarterConfig
} from '../config/index.js';
import { createConfiguredLlmProvider, enhanceScenarios, type LlmProvider, type LlmProviderName } from '../llm/index.js';
import { renderVisualReportSummary, writeVisualReportMarkdown } from '../reports/index.js';
import {
  createConfiguredScenarioPlan,
  generateDeterministicScenarios,
  mapHeuristicsToRoutes,
  mapSignalKindsToRoutes
} from '../scenarios/index.js';
import { writeGeneratedPlaywrightTests } from '../playwright/index.js';
import { scanWorkspace } from '../scanner/index.js';
import type { FrameworkName, ScenarioDefinition, ScenarioPriority } from '../types.js';

export interface WorkflowEnvironment {
  cwd: string;
}

export interface InitWorkflowResult {
  configPath: string;
}

export interface ScanWorkflowResult {
  framework: FrameworkName;
  heuristicsPath: string;
  routeCount: number;
  routeManifestPath: string;
  signalCount: number;
  signalsPath: string;
  summaryPath: string;
  warnings: string[];
}

export interface GenerateWorkflowResult {
  framework: FrameworkName;
  outputDir: string;
  planArtifactPath: string;
  scenariosArtifactPath: string;
  scenariosCount: number;
  scenarioSource: 'deterministic' | 'llm-fallback';
  testFileCount: number;
  warnings: string[];
}

export interface ReportWorkflowResult {
  artifactPath: string;
  lines: string[];
  markdownPath: string;
}

export interface GenerateWorkflowDependencies {
  llmInstructions?: string;
  llmProvider?: LlmProvider;
  maxGeneratedScenarios?: number;
}

export interface GenerateCommandOptions {
  llmApiKeyEnv?: string;
  llmBaseUrl?: string;
  llmFallback?: boolean;
  llmInstructions?: string;
  llmMaxGeneratedScenarios?: number;
  llmModel?: string;
  llmProvider?: LlmProviderName;
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
    framework: result.routeManifest.framework,
    heuristicsPath: result.heuristicsPath,
    routeCount: result.routeManifest.routes.length,
    routeManifestPath: result.routeManifestPath,
    signalCount: result.signals.findings.length,
    signalsPath: result.signalsPath,
    summaryPath: result.summaryPath,
    warnings: createNoRouteWarnings(result.routeManifest.framework, result.routeManifest.routes.length, 'scan')
  };
}

export async function runGenerateWorkflow(
  environment: WorkflowEnvironment,
  dependencies: GenerateWorkflowDependencies = {}
): Promise<GenerateWorkflowResult> {
  const scanResult = await scanWorkspace({ cwd: environment.cwd });
  const heuristicsByRoute = mapHeuristicsToRoutes(scanResult.routeManifest.routes, scanResult.heuristics.heuristics);
  const signalKindsByRoute = mapSignalKindsToRoutes(scanResult.routeManifest.routes, scanResult.signals.findings);
  let scenarios = generateDeterministicScenarios({
    heuristicsByRoute,
    routes: scanResult.routeManifest.routes,
    signalKindsByRoute
  });
  let scenarioSource: 'deterministic' | 'llm-fallback' = 'deterministic';
  const warnings = createNoRouteWarnings(scanResult.routeManifest.framework, scanResult.routeManifest.routes.length, 'generate');

  if (scanResult.routeManifest.routes.length === 0 && dependencies.llmProvider && scanResult.signals.findings.length > 0) {
    const enhancementInput: Parameters<typeof enhanceScenarios>[0] = {
      provider: dependencies.llmProvider,
      routes: [],
      signals: scanResult.signals.findings,
      existingScenarios: scenarios
    };

    if (dependencies.llmInstructions !== undefined) {
      enhancementInput.instructions = dependencies.llmInstructions;
    }

    if (dependencies.maxGeneratedScenarios !== undefined) {
      enhancementInput.maxGeneratedScenarios = dependencies.maxGeneratedScenarios;
    }

    const enhanced = await enhanceScenarios(enhancementInput);

    if (enhanced.proposal.scenarios.length > 0) {
      scenarios = enhanced.proposal.scenarios;
      scenarioSource = 'llm-fallback';
      warnings.push(
        `Used ${formatLlmProviderLabel(dependencies.llmProvider)} to infer scenarios because no deterministic routes were found.`
      );
    }
  }

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
    framework: scanResult.routeManifest.framework,
    outputDir: writtenTests.outputDir,
    planArtifactPath,
    scenariosArtifactPath,
    scenariosCount: scenarios.length,
    scenarioSource,
    testFileCount: writtenTests.files.length,
    warnings
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

function createNoRouteWarnings(
  framework: FrameworkName,
  routeCount: number,
  commandName: 'scan' | 'generate'
): string[] {
  if (routeCount > 0) {
    return [];
  }

  const frameworkLabel = formatFrameworkLabel(framework);

  if (framework === 'unknown') {
    return [
      `No deterministic routes were found during ${commandName}. Spotter currently supports route adapters for Next.js, Remix, Nuxt, React Router, and Vue Router repositories.`
    ];
  }

  return [
    `Detected a ${frameworkLabel} workspace but found no deterministic routes during ${commandName}. Spotter scanned component UX signals, but route-based scenarios require discoverable routes or an LLM fallback.`
  ];
}

function formatFrameworkLabel(framework: FrameworkName): string {
  switch (framework) {
    case 'next-app':
      return 'Next.js app router';
    case 'next-pages':
      return 'Next.js pages router';
    case 'remix':
      return 'Remix';
    case 'nuxt':
      return 'Nuxt';
    case 'react-router':
      return 'React Router';
    case 'vite-react':
      return 'Vite React';
    case 'vite-vue':
      return 'Vite Vue';
    case 'vue-router':
      return 'Vue Router';
    case 'cra':
      return 'Create React App';
    default:
      return 'unknown';
  }
}

function formatLlmProviderLabel(provider: LlmProvider): string {
  return provider.metadata.model
    ? `${provider.metadata.name} (${provider.metadata.model})`
    : provider.metadata.name;
}

export async function createGenerateWorkflowDependencies(
  environment: WorkflowEnvironment,
  commandOptions: GenerateCommandOptions = {}
): Promise<GenerateWorkflowDependencies> {
  const { config } = await loadSpotterConfig({ cwd: environment.cwd });
  const fallbackSettings = resolveLlmFallbackSettings(config.llm.fallback, commandOptions);

  if (!fallbackSettings) {
    return {};
  }

  if (!fallbackSettings.provider) {
    throw new Error('LLM fallback is enabled but no provider was configured.');
  }

  if (!fallbackSettings.model) {
    throw new Error('LLM fallback is enabled but no model was configured.');
  }

  const dependencies: GenerateWorkflowDependencies = {
    llmProvider: createConfiguredLlmProvider(createConfiguredProviderOptions(fallbackSettings))
  };

  if (fallbackSettings.instructions !== undefined) {
    dependencies.llmInstructions = fallbackSettings.instructions;
  }

  if (fallbackSettings.maxGeneratedScenarios !== undefined) {
    dependencies.maxGeneratedScenarios = fallbackSettings.maxGeneratedScenarios;
  }

  return dependencies;
}

function resolveLlmFallbackSettings(
  configuredFallback: SpotterLlmFallbackConfig | null,
  commandOptions: GenerateCommandOptions
): SpotterLlmFallbackConfig | null {
  const hasCommandOverride =
    commandOptions.llmFallback === true ||
    commandOptions.llmProvider !== undefined ||
    commandOptions.llmModel !== undefined ||
    commandOptions.llmBaseUrl !== undefined ||
    commandOptions.llmApiKeyEnv !== undefined ||
    commandOptions.llmInstructions !== undefined ||
    commandOptions.llmMaxGeneratedScenarios !== undefined;
  const enabled = commandOptions.llmFallback === true || configuredFallback?.enabled === true || hasCommandOverride;

  if (!enabled) {
    return null;
  }

  const resolved: SpotterLlmFallbackConfig = {
    enabled: true
  };

  const provider = commandOptions.llmProvider ?? configuredFallback?.provider;

  if (provider !== undefined) {
    resolved.provider = provider;
  }

  const model = commandOptions.llmModel ?? configuredFallback?.model;

  if (model !== undefined) {
    resolved.model = model;
  }

  const baseUrl = commandOptions.llmBaseUrl ?? configuredFallback?.baseUrl;

  if (baseUrl !== undefined) {
    resolved.baseUrl = baseUrl;
  }

  const apiKeyEnvVar = commandOptions.llmApiKeyEnv ?? configuredFallback?.apiKeyEnvVar;

  if (apiKeyEnvVar !== undefined) {
    resolved.apiKeyEnvVar = apiKeyEnvVar;
  }

  const instructions = commandOptions.llmInstructions ?? configuredFallback?.instructions;

  if (instructions !== undefined) {
    resolved.instructions = instructions;
  }

  const maxGeneratedScenarios = commandOptions.llmMaxGeneratedScenarios ?? configuredFallback?.maxGeneratedScenarios;

  if (maxGeneratedScenarios !== undefined) {
    resolved.maxGeneratedScenarios = maxGeneratedScenarios;
  }

  return resolved;
}

function createConfiguredProviderOptions(fallbackSettings: SpotterLlmFallbackConfig): {
  apiKeyEnvVar?: string;
  baseUrl?: string;
  model: string;
  provider: LlmProviderName;
} {
  if (!fallbackSettings.provider || !fallbackSettings.model) {
    throw new Error('LLM fallback provider settings are incomplete.');
  }

  const configuredOptions: {
    apiKeyEnvVar?: string;
    baseUrl?: string;
    model: string;
    provider: LlmProviderName;
  } = {
    provider: fallbackSettings.provider,
    model: fallbackSettings.model
  };

  if (fallbackSettings.baseUrl !== undefined) {
    configuredOptions.baseUrl = fallbackSettings.baseUrl;
  }

  if (fallbackSettings.apiKeyEnvVar !== undefined) {
    configuredOptions.apiKeyEnvVar = fallbackSettings.apiKeyEnvVar;
  }

  return configuredOptions;
}