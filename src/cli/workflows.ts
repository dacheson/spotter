import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { writeVersionedJsonArtifact } from '../artifacts/versioned.js';
import {
  loadSpotterConfig,
  type SpotterLlmFallbackConfig,
  writeScenarioOverride,
  writeStarterConfig
} from '../config/index.js';
import {
  buildScenarioEnhancementPrompts,
  createConfiguredLlmProvider,
  enhanceScenarios,
  type LlmProvider,
  type LlmProviderName
} from '../llm/index.js';
import { normalizeLlmEnhancementProposal, validateLlmEnhancementProposal } from '../llm/index.js';
import { renderVisualReportSummary, writeVisualReportMarkdown } from '../reports/index.js';
import {
  applyScenarioOverrides,
  createConfiguredScenarioPlan,
  generateDeterministicScenarios,
  prioritizeScenarios,
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

export interface OverrideWorkflowResult {
  action: 'include' | 'exclude';
  changed: boolean;
  configPath: string;
  createdConfig: boolean;
  scenarioId: string;
}

export interface PromptWorkflowResult {
  contextPath: string;
  framework: FrameworkName;
  promptPath: string;
  routeCount: number;
  scenarioCount: number;
  signalCount: number;
  warnings: string[];
}

export interface ImportWorkflowResult {
  framework: FrameworkName;
  importedScenarioCount: number;
  outputDir: string;
  planArtifactPath: string;
  proposalArtifactPath: string;
  scenariosArtifactPath: string;
  scenariosCount: number;
  testFileCount: number;
  warnings: string[];
}

export interface ImportWorkflowOptions {
  cwd: string;
  inputPath: string;
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

export type OverrideCommandOptions =
  | {
      action: 'exclude';
      scenarioId: string;
    }
  | {
      action: 'include';
      scenario: ScenarioDefinition;
    };

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
  const { config } = await loadSpotterConfig({ cwd: environment.cwd });
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
      scenarios = enhanced.proposal.scenarios.map((scenario) => ({
        ...scenario,
        origin: scenario.origin ?? 'llm-fallback'
      }));
      scenarioSource = 'llm-fallback';
      warnings.push(
        `Used ${formatLlmProviderLabel(dependencies.llmProvider)} to infer scenarios because no deterministic routes were found.`
      );
    }
  }

  scenarios = applyScenarioOverrides(scenarios, config.overrides.scenarios);

  const scenarioPlan = await createConfiguredScenarioPlan(scenarios, { cwd: environment.cwd });
  const writtenTests = await writeGeneratedPlaywrightTests(scenarioPlan, { cwd: environment.cwd });
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

export async function runPromptWorkflow(environment: WorkflowEnvironment): Promise<PromptWorkflowResult> {
  const scenarioContext = await collectScenarioContext(environment.cwd, 'prompt');
  const { config } = await loadSpotterConfig({ cwd: environment.cwd });
  const artifactsDir = path.resolve(environment.cwd, config.paths.artifactsDir);
  const promptPath = path.join(artifactsDir, 'scenario-assist.prompt.md');
  const contextPath = path.join(artifactsDir, 'scenario-assist.context.json');
  const instructions = config.llm.fallback?.instructions;
  const prompts = buildScenarioEnhancementPrompts({
    routes: scenarioContext.scanResult.routeManifest.routes,
    signals: scenarioContext.scanResult.signals.findings,
    existingScenarios: scenarioContext.existingScenarios,
    ...(instructions ? { instructions } : {})
  });
  const context = {
    generatedAt: new Date().toISOString(),
    framework: scenarioContext.scanResult.routeManifest.framework,
    routeCount: scenarioContext.scanResult.routeManifest.routes.length,
    signalCount: scenarioContext.scanResult.signals.findings.length,
    scenarioCount: scenarioContext.existingScenarios.length,
    warnings: scenarioContext.warnings,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    instructions: instructions ?? null,
    routes: scenarioContext.scanResult.routeManifest.routes,
    signals: scenarioContext.scanResult.signals.findings,
    existingScenarios: scenarioContext.existingScenarios
  };

  await mkdir(artifactsDir, { recursive: true });
  await Promise.all([
    writeJsonFile(contextPath, context),
    writeFile(
      promptPath,
      `${renderScenarioAssistPromptMarkdown({
        routeCount: context.routeCount,
        signalCount: context.signalCount,
        scenarioCount: context.scenarioCount,
        routes: context.routes.map((route) => route.path),
        systemPrompt: context.systemPrompt,
        userPrompt: context.userPrompt,
        warnings: scenarioContext.warnings
      })}\n`,
      'utf8'
    )
  ]);

  return {
    contextPath,
    framework: scenarioContext.scanResult.routeManifest.framework,
    promptPath,
    routeCount: scenarioContext.scanResult.routeManifest.routes.length,
    scenarioCount: scenarioContext.existingScenarios.length,
    signalCount: scenarioContext.scanResult.signals.findings.length,
    warnings: scenarioContext.warnings
  };
}

export async function runImportWorkflow(options: ImportWorkflowOptions): Promise<ImportWorkflowResult> {
  const scenarioContext = await collectScenarioContext(options.cwd, 'import');
  const { config } = await loadSpotterConfig({ cwd: options.cwd });
  const artifactsDir = path.resolve(options.cwd, config.paths.artifactsDir);
  const proposalArtifactPath = path.join(artifactsDir, 'scenario-import.json');
  const scenariosArtifactPath = path.join(artifactsDir, 'scenarios.json');
  const planArtifactPath = path.join(artifactsDir, 'scenario-plan.json');
  const inputPath = path.resolve(options.cwd, options.inputPath);
  const importedProposal = validateLlmEnhancementProposal(await readJsonFile(inputPath));
  const mergedProposal = normalizeLlmEnhancementProposal({
    existingScenarios: scenarioContext.existingScenarios,
    maxGeneratedScenarios: Number.MAX_SAFE_INTEGER,
    proposal: importedProposal
  });
  const routesByPath = Object.fromEntries(
    scenarioContext.scanResult.routeManifest.routes.map((route) => [route.path, route])
  );
  const scenarios = prioritizeScenarios(mergedProposal.scenarios, {
    heuristicsByRoute: scenarioContext.heuristicsByRoute,
    routesByPath,
    signalKindsByRoute: scenarioContext.signalKindsByRoute
  }).sort((left, right) => left.id.localeCompare(right.id));
  const overriddenScenarios = applyScenarioOverrides(scenarios, config.overrides.scenarios);
  const scenarioPlan = await createConfiguredScenarioPlan(overriddenScenarios, { cwd: options.cwd });
  const writtenTests = await writeGeneratedPlaywrightTests(scenarioPlan, { cwd: options.cwd });

  await mkdir(artifactsDir, { recursive: true });
  await Promise.all([
    writeJsonFile(proposalArtifactPath, mergedProposal),
    writeJsonFile(scenariosArtifactPath, {
      generatedAt: scenarioPlan.generatedAt,
      scenarios: overriddenScenarios
    }),
    writeJsonFile(planArtifactPath, scenarioPlan)
  ]);

  return {
    framework: scenarioContext.scanResult.routeManifest.framework,
    importedScenarioCount: Math.max(0, overriddenScenarios.length - scenarioContext.existingScenarios.length),
    outputDir: writtenTests.outputDir,
    planArtifactPath,
    proposalArtifactPath,
    scenariosArtifactPath,
    scenariosCount: overriddenScenarios.length,
    testFileCount: writtenTests.files.length,
    warnings: scenarioContext.warnings
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

export async function runOverrideWorkflow(options: {
  cwd: string;
  override: OverrideCommandOptions;
}): Promise<OverrideWorkflowResult> {
  const result = await writeScenarioOverride({
    cwd: options.cwd,
    ...(options.override.action === 'exclude'
      ? { excludeScenarioId: options.override.scenarioId }
      : { includeScenario: options.override.scenario })
  });

  return {
    action: result.action,
    changed: result.changed,
    configPath: result.configPath,
    createdConfig: result.createdConfig,
    scenarioId: result.scenarioId
  };
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeVersionedJsonArtifact(filePath, value as object);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents.replace(/^\uFEFF/, '')) as unknown;
}

async function collectScenarioContext(
  cwd: string,
  commandName: 'prompt' | 'import'
): Promise<{
  existingScenarios: ScenarioDefinition[];
  heuristicsByRoute: Record<string, import('../scanner/index.js').ComponentStateHeuristic[]>;
  scanResult: Awaited<ReturnType<typeof scanWorkspace>>;
  signalKindsByRoute: Record<string, import('../scanner/index.js').ComponentSignalKind[]>;
  warnings: string[];
}> {
  const scanResult = await scanWorkspace({ cwd });
  const { config } = await loadSpotterConfig({ cwd });
  const heuristicsByRoute = mapHeuristicsToRoutes(scanResult.routeManifest.routes, scanResult.heuristics.heuristics);
  const signalKindsByRoute = mapSignalKindsToRoutes(scanResult.routeManifest.routes, scanResult.signals.findings);
  const existingScenarios = applyScenarioOverrides(
    generateDeterministicScenarios({
      heuristicsByRoute,
      routes: scanResult.routeManifest.routes,
      signalKindsByRoute
    }),
    config.overrides.scenarios
  );

  return {
    existingScenarios,
    heuristicsByRoute,
    scanResult,
    signalKindsByRoute,
    warnings: createNoRouteWarnings(scanResult.routeManifest.framework, scanResult.routeManifest.routes.length, commandName)
  };
}

function createNoRouteWarnings(
  framework: FrameworkName,
  routeCount: number,
  commandName: 'scan' | 'generate' | 'prompt' | 'import'
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

function renderScenarioAssistPromptMarkdown(input: {
  routeCount: number;
  routes: string[];
  scenarioCount: number;
  signalCount: number;
  systemPrompt: string;
  userPrompt: string;
  warnings: string[];
}): string {
  const lines = [
    '# Spotter Scenario Assist Prompt',
    '',
    'Use this prompt with an IDE agent chat to suggest additional scenario coverage.',
    'Return JSON only and review suggestions before adopting them into the repo.'
  ];

  if (input.routes.length > 0) {
    lines.push(
      '',
      '## Suggested Ask',
      '',
      'Ask the agent to propose only missing states for the listed routes and avoid inventing new route paths unless the context strongly supports them.'
    );
  }

  lines.push(
    '',
    '## Coverage Snapshot',
    '',
    `- Routes discovered: ${input.routeCount}`,
    `- Signals discovered: ${input.signalCount}`,
    `- Deterministic scenarios already covered: ${input.scenarioCount}`
  );

  if (input.routes.length > 0) {
    lines.push('', '## Route Inventory', '');

    for (const route of input.routes.slice(0, 12)) {
      lines.push(`- ${route}`);
    }

    if (input.routes.length > 12) {
      lines.push(`- ...and ${input.routes.length - 12} more routes in the JSON context artifact.`);
    }
  }

  if (input.warnings.length > 0) {
    lines.push('', '## Notes', '');

    for (const warning of input.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    '',
    '## Copy This System Prompt',
    '',
    '```text',
    input.systemPrompt,
    '```',
    '',
    '## Copy This User Prompt',
    '',
    '```text',
    input.userPrompt,
    '```',
    '',
    '## Expected Response Shape',
    '',
    '```json',
    JSON.stringify(
      {
        provider: 'ide-manual',
        model: 'your-ide-agent',
        scenarios: [
          {
            id: 'scenario-id',
            routePath: '/route',
            name: 'Human Readable Name',
            priority: 'high',
            tags: ['tag']
          }
        ]
      },
      null,
      2
    ),
    '```'
  );

  return lines.join('\n');
}