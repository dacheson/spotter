import { Command } from 'commander';

import { packageVersion, projectName } from '../metadata.js';

import {
  runBaselineCommand,
  runChangedCommand,
  type BaselineCommandResult,
  type ChangedCommandResult
} from '../playwright/index.js';
import {
  createGenerateWorkflowDependencies,
  type GenerateCommandOptions,
  type ImportWorkflowResult,
  type OverrideCommandOptions,
  type OverrideWorkflowResult,
  runImportWorkflow,
  runGenerateWorkflow,
  runInitWorkflow,
  runOverrideWorkflow,
  runPromptWorkflow,
  runReportWorkflow,
  runScanWorkflow,
  type GenerateWorkflowResult,
  type InitWorkflowResult,
  type PromptWorkflowResult,
  type ReportWorkflowResult,
  type ScanWorkflowResult
} from './workflows.js';

export interface ImportCommandOptions {
  inputPath: string;
}

export interface CliEnvironment {
  cwd: string;
}

export interface CliCommandDefinition {
  name: string;
  description: string;
}

export interface CliActionContext {
  commandName: string;
  environment: CliEnvironment;
  generateOptions?: GenerateCommandOptions;
  importOptions?: ImportCommandOptions;
  overrideOptions?: OverrideCommandOptions;
}

export interface CliCommandHandler {
  (context: CliActionContext): Promise<void>;
}

export interface CliDependencies {
  environment: CliEnvironment;
  handlers: Record<string, CliCommandHandler>;
}

export interface CreateDefaultCliHandlersOptions {
  llmInstructions?: string;
  llmProvider?: import('../llm/index.js').LlmProvider;
  maxGeneratedScenarios?: number;
  runImport?: (options: { cwd: string; inputPath: string }) => Promise<ImportWorkflowResult>;
  runGenerate?: (options: { cwd: string }, dependencies?: import('./workflows.js').GenerateWorkflowDependencies) => Promise<GenerateWorkflowResult>;
  runInit?: (options: { cwd: string }) => Promise<InitWorkflowResult>;
  runPrompt?: (options: { cwd: string }) => Promise<PromptWorkflowResult>;
  write?: (message: string) => void;
  runBaseline?: (options: { cwd: string }) => Promise<BaselineCommandResult>;
  runChanged?: (options: { cwd: string }) => Promise<ChangedCommandResult>;
  runOverride?: (options: { cwd: string; override: OverrideCommandOptions }) => Promise<OverrideWorkflowResult>;
  runReport?: (options: { cwd: string }) => Promise<ReportWorkflowResult>;
  runScan?: (options: { cwd: string }) => Promise<ScanWorkflowResult>;
}

export const cliCommandDefinitions: CliCommandDefinition[] = [
  {
    name: 'init',
    description: 'Create a starter Spotter config in the current repository.'
  },
  {
    name: 'scan',
    description: 'Scan the repository and collect deterministic UX coverage signals.'
  },
  {
    name: 'generate',
    description: 'Generate Playwright coverage files from the current scenario plan.'
  },
  {
    name: 'prompt',
    description: 'Write an IDE-assist prompt for manual scenario coverage suggestions.'
  },
  {
    name: 'import',
    description: 'Import manual IDE scenario suggestions and regenerate coverage artifacts.'
  },
  {
    name: 'override',
    description: 'Write a durable scenario include or exclude correction into spotter.config.json.'
  },
  {
    name: 'baseline',
    description: 'Capture baseline screenshots for the generated coverage.'
  },
  {
    name: 'changed',
    description: 'Run impacted scenarios and compare them against the baseline.'
  },
  {
    name: 'report',
    description: 'Render a report for the latest generated visual diff artifacts.'
  }
];

export const plannedCliCommands = cliCommandDefinitions;

export function createDefaultCliHandlers(
  options: CreateDefaultCliHandlersOptions = {}
): Record<string, CliCommandHandler> {
  const write = options.write ?? ((message: string) => process.stdout.write(`${message}\n`));
  const runInit = options.runInit ?? ((initOptions: { cwd: string }) => runInitWorkflow(initOptions));
  const runScan = options.runScan ?? ((scanOptions: { cwd: string }) => runScanWorkflow(scanOptions));
  const runGenerate =
    options.runGenerate ??
    ((generateOptions: { cwd: string }) => {
      const workflowDependencies: import('./workflows.js').GenerateWorkflowDependencies = {};

      if (options.llmInstructions !== undefined) {
        workflowDependencies.llmInstructions = options.llmInstructions;
      }

      if (options.llmProvider !== undefined) {
        workflowDependencies.llmProvider = options.llmProvider;
      }

      if (options.maxGeneratedScenarios !== undefined) {
        workflowDependencies.maxGeneratedScenarios = options.maxGeneratedScenarios;
      }

      return runGenerateWorkflow(generateOptions, workflowDependencies);
    });
  const runImport = options.runImport ?? ((importOptions: { cwd: string; inputPath: string }) => runImportWorkflow(importOptions));
  const runPrompt = options.runPrompt ?? ((promptOptions: { cwd: string }) => runPromptWorkflow(promptOptions));
  const runBaseline = options.runBaseline ?? ((baselineOptions: { cwd: string }) => runBaselineCommand(baselineOptions));
  const runChanged = options.runChanged ?? ((changedOptions: { cwd: string }) => runChangedCommand(changedOptions));
  const runOverride =
    options.runOverride ??
    ((overrideOptions: { cwd: string; override: OverrideCommandOptions }) => runOverrideWorkflow(overrideOptions));
  const runReport = options.runReport ?? ((reportOptions: { cwd: string }) => runReportWorkflow(reportOptions));

  return Object.fromEntries(
    cliCommandDefinitions.map((command) => [
      command.name,
      async ({ commandName, environment, generateOptions, importOptions, overrideOptions }) => {
        if (commandName === 'init') {
          const result = await runInit({ cwd: environment.cwd });
          write(`Starter config written to ${result.configPath}`);
          return;
        }

        if (commandName === 'scan') {
          const result = await runScan({ cwd: environment.cwd });
          write(`Detected ${result.routeCount} routes and ${result.signalCount} signals.`);
          for (const warning of result.warnings) {
            write(warning);
          }
          write(`Route manifest written to ${result.routeManifestPath}`);
          write(`Signal artifact written to ${result.signalsPath}`);
          write(`Heuristic artifact written to ${result.heuristicsPath}`);
          write(`Scan summary written to ${result.summaryPath}`);
          return;
        }

        if (commandName === 'generate') {
          const configuredDependencies = await createGenerateWorkflowDependencies(environment, generateOptions ?? {});
          const generatedDependencies: import('./workflows.js').GenerateWorkflowDependencies = {
            ...configuredDependencies
          };

          if (options.llmProvider !== undefined) {
            generatedDependencies.llmProvider = options.llmProvider;
          }

          if (options.llmInstructions !== undefined) {
            generatedDependencies.llmInstructions = options.llmInstructions;
          }

          if (options.maxGeneratedScenarios !== undefined) {
            generatedDependencies.maxGeneratedScenarios = options.maxGeneratedScenarios;
          }

          const result = await runGenerate({ cwd: environment.cwd }, generatedDependencies);
          write(`Generated ${result.testFileCount} Playwright test files from ${result.scenariosCount} scenarios.`);
          if (result.scenarioSource === 'llm-fallback') {
            write('Scenario generation used the LLM fallback because no deterministic routes were found.');
          }
          for (const warning of result.warnings) {
            write(warning);
          }
          write(`Generated tests written to ${result.outputDir}`);
          write(`Scenario artifact written to ${result.scenariosArtifactPath}`);
          write(`Scenario plan artifact written to ${result.planArtifactPath}`);
          return;
        }

        if (commandName === 'prompt') {
          const result = await runPrompt({ cwd: environment.cwd });
          write(
            `Prepared an assist prompt from ${result.routeCount} routes, ${result.signalCount} signals, and ${result.scenarioCount} deterministic scenarios.`
          );
          for (const warning of result.warnings) {
            write(warning);
          }
          write(`Scenario assist prompt written to ${result.promptPath}`);
          write(`Scenario assist context written to ${result.contextPath}`);
          return;
        }

        if (commandName === 'import') {
          if (!importOptions?.inputPath) {
            throw new Error('spotter import requires --input <path>.');
          }

          const result = await runImport({ cwd: environment.cwd, inputPath: importOptions.inputPath });
          write(
            `Imported ${result.importedScenarioCount} assisted scenarios and generated ${result.testFileCount} Playwright test files from ${result.scenariosCount} total scenarios.`
          );
          for (const warning of result.warnings) {
            write(warning);
          }
          write(`Generated tests written to ${result.outputDir}`);
          write(`Scenario import artifact written to ${result.proposalArtifactPath}`);
          write(`Scenario artifact written to ${result.scenariosArtifactPath}`);
          write(`Scenario plan artifact written to ${result.planArtifactPath}`);
          return;
        }

        if (commandName === 'override') {
          if (!overrideOptions) {
            throw new Error(
              'spotter override requires either --exclude-id <id> or --include-id <id> --route <path> --name <name> --priority <priority>.'
            );
          }

          const result = await runOverride({ cwd: environment.cwd, override: overrideOptions });
          const actionLabel = result.action === 'include' ? 'include' : 'exclude';

          if (result.changed) {
            write(`Scenario ${actionLabel} override recorded for ${result.scenarioId}.`);
          } else {
            write(`Scenario ${actionLabel} override already matched ${result.scenarioId}.`);
          }

          if (result.createdConfig) {
            write(`Created Spotter config at ${result.configPath}`);
          } else {
            write(`Updated Spotter config at ${result.configPath}`);
          }

          return;
        }

        if (commandName === 'baseline') {
          const result = await runBaseline({ cwd: environment.cwd });
          write(`Baseline screenshots stored in ${result.baselineDir}`);
          write(`Baseline artifact written to ${result.artifactPath}`);
          return;
        }

        if (commandName === 'changed') {
          const result = await runChanged({ cwd: environment.cwd });

          if (result.completed) {
            write(`Changed run ${result.passed ? 'passed' : 'failed'} with ${result.summary.changed} changed screenshots.`);
          } else {
            write(result.failureMessage ?? `Changed run failed before visual comparison completed (exit code ${result.exitCode}).`);
          }

          if ((result.selection?.possibleAdditionalImpact.length ?? 0) > 0) {
            write(
              `Possible additional impact: ${result.selection!.possibleAdditionalImpact.length} low-confidence scenarios require review in spotter report.`
            );
          }

          write(`Changed artifact written to ${result.artifactPath}`);

          for (const artifact of result.summary.artifacts) {
            write(`Changed image: ${artifact.diffPath}`);
          }

          return;
        }

        if (commandName === 'report') {
          const result = await runReport({ cwd: environment.cwd });

          for (const line of result.lines) {
            write(line);
          }

          write(`Markdown report written to ${result.markdownPath}`);
          write(`Report artifact read from ${result.artifactPath}`);
          return;
        }

        write(`spotter ${commandName} is not implemented yet. cwd=${environment.cwd}`);
      }
    ])
  );
}

export function createCliDependencies(environment: CliEnvironment = { cwd: process.cwd() }): CliDependencies {
  return {
    environment,
    handlers: createDefaultCliHandlers()
  };
}

export function createProgram(dependencies: CliDependencies): Command {
  const program = new Command();

  program
    .name(projectName)
    .description(
      'Deterministic-first CLI for turning frontend UX scenarios into Playwright visual regression coverage.'
    )
    .version(packageVersion)
    .showHelpAfterError('(run with --help for usage)');

  for (const command of cliCommandDefinitions) {
    const registeredCommand = program.command(command.name).description(command.description);

    if (command.name === 'generate') {
      registeredCommand
        .option('--llm-fallback', 'Enable the configured LLM fallback when deterministic routes are not found.')
        .option('--llm-provider <provider>', 'Override the LLM fallback provider.')
        .option('--llm-model <model>', 'Override the LLM fallback model.')
        .option('--llm-base-url <url>', 'Override the OpenAI-compatible LLM endpoint base URL.')
        .option('--llm-api-key-env <name>', 'Override the environment variable used for the LLM API key.')
        .option('--llm-instructions <text>', 'Provide extra instructions for inferred fallback scenarios.')
        .option('--llm-max-generated-scenarios <count>', 'Cap how many fallback scenarios Spotter accepts.', parseIntegerOption);
    } else if (command.name === 'import') {
      registeredCommand.requiredOption('--input <path>', 'Path to a JSON response generated from spotter prompt.');
    } else if (command.name === 'override') {
      registeredCommand
        .option('--exclude-id <id>', 'Exclude a generated scenario by scenario id.')
        .option('--include-id <id>', 'Include a hand-authored scenario by scenario id.')
        .option('--route <path>', 'Route path for an included scenario.')
        .option('--name <name>', 'Human-readable name for an included scenario.')
        .option('--priority <priority>', 'Priority for an included scenario: high, medium, or low.')
        .option('--tag <tag>', 'Tag to add to an included scenario.', collectStringOption, [] as string[]);
    }

    registeredCommand.action(async (commandOptions?: GenerateCommandOptions & { excludeId?: string; includeId?: string; input?: string; name?: string; priority?: string; route?: string; tag?: string[] }) => {
      const handler = dependencies.handlers[command.name];

      if (!handler) {
        throw new Error(`Missing CLI handler for command: ${command.name}`);
      }

      const actionContext: CliActionContext = {
        commandName: command.name,
        environment: dependencies.environment
      };

      if (command.name === 'generate') {
        const normalizedOptions = normalizeGenerateOptions(commandOptions);

        if (normalizedOptions !== undefined) {
          actionContext.generateOptions = normalizedOptions;
        }
      } else if (command.name === 'import') {
        const normalizedOptions = normalizeImportOptions(commandOptions as { input?: string } | undefined);

        if (normalizedOptions !== undefined) {
          actionContext.importOptions = normalizedOptions;
        }
      } else if (command.name === 'override') {
        const normalizedOptions = normalizeOverrideOptions(
          commandOptions as {
            excludeId?: string;
            includeId?: string;
            name?: string;
            priority?: string;
            route?: string;
            tag?: string[];
          } | undefined
        );

        if (normalizedOptions !== undefined) {
          actionContext.overrideOptions = normalizedOptions;
        }
      }

      await handler(actionContext);
    });
  }

  return program;
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = createCliDependencies()
): Promise<void> {
  const program = createProgram(dependencies);
  await program.parseAsync(argv);
}

function normalizeGenerateOptions(commandOptions: GenerateCommandOptions | undefined): GenerateCommandOptions | undefined {
  if (!commandOptions) {
    return undefined;
  }

  const normalizedOptions: GenerateCommandOptions = {};

  if (commandOptions.llmFallback === true) {
    normalizedOptions.llmFallback = true;
  }

  if (commandOptions.llmProvider !== undefined) {
    normalizedOptions.llmProvider = commandOptions.llmProvider;
  }

  if (commandOptions.llmModel !== undefined) {
    normalizedOptions.llmModel = commandOptions.llmModel;
  }

  if (commandOptions.llmBaseUrl !== undefined) {
    normalizedOptions.llmBaseUrl = commandOptions.llmBaseUrl;
  }

  if (commandOptions.llmApiKeyEnv !== undefined) {
    normalizedOptions.llmApiKeyEnv = commandOptions.llmApiKeyEnv;
  }

  if (commandOptions.llmInstructions !== undefined) {
    normalizedOptions.llmInstructions = commandOptions.llmInstructions;
  }

  if (commandOptions.llmMaxGeneratedScenarios !== undefined) {
    normalizedOptions.llmMaxGeneratedScenarios = commandOptions.llmMaxGeneratedScenarios;
  }

  return Object.keys(normalizedOptions).length > 0 ? normalizedOptions : undefined;
}

function normalizeImportOptions(
  commandOptions: { input?: string } | undefined
): ImportCommandOptions | undefined {
  if (!commandOptions?.input) {
    return undefined;
  }

  return {
    inputPath: commandOptions.input
  };
}

function parseIntegerOption(value: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Expected an integer value, received: ${value}`);
  }

  return parsedValue;
}

function normalizeOverrideOptions(
  commandOptions:
    | {
        excludeId?: string;
        includeId?: string;
        name?: string;
        priority?: string;
        route?: string;
        tag?: string[];
      }
    | undefined
): OverrideCommandOptions | undefined {
  if (!commandOptions) {
    return undefined;
  }

  if (commandOptions.excludeId) {
    if (commandOptions.includeId || commandOptions.route || commandOptions.name || commandOptions.priority || (commandOptions.tag?.length ?? 0) > 0) {
      throw new Error('spotter override exclude mode only accepts --exclude-id <id>.');
    }

    return {
      action: 'exclude',
      scenarioId: commandOptions.excludeId
    };
  }

  if (!commandOptions.includeId) {
    return undefined;
  }

  if (!commandOptions.route || !commandOptions.name || !commandOptions.priority) {
    throw new Error(
      'spotter override include mode requires --include-id <id> --route <path> --name <name> --priority <priority>.'
    );
  }

  return {
    action: 'include',
    scenario: {
      id: commandOptions.includeId,
      routePath: commandOptions.route,
      name: commandOptions.name,
      priority: parseScenarioPriorityOption(commandOptions.priority),
      tags: commandOptions.tag ?? []
    }
  };
}

function parseScenarioPriorityOption(value: string): import('../types.js').ScenarioPriority {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  throw new Error(`Expected a scenario priority of high, medium, or low. Received: ${value}`);
}

function collectStringOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}