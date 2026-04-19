import { Command } from 'commander';

import {
  runBaselineCommand,
  runChangedCommand,
  type BaselineCommandResult,
  type ChangedCommandResult
} from '../playwright/index.js';

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
}

export interface CliCommandHandler {
  (context: CliActionContext): Promise<void>;
}

export interface CliDependencies {
  environment: CliEnvironment;
  handlers: Record<string, CliCommandHandler>;
}

export interface CreateDefaultCliHandlersOptions {
  write?: (message: string) => void;
  runBaseline?: (options: { cwd: string }) => Promise<BaselineCommandResult>;
  runChanged?: (options: { cwd: string }) => Promise<ChangedCommandResult>;
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
  const runBaseline = options.runBaseline ?? ((baselineOptions: { cwd: string }) => runBaselineCommand(baselineOptions));
  const runChanged = options.runChanged ?? ((changedOptions: { cwd: string }) => runChangedCommand(changedOptions));

  return Object.fromEntries(
    cliCommandDefinitions.map((command) => [
      command.name,
      async ({ commandName, environment }) => {
        if (commandName === 'baseline') {
          const result = await runBaseline({ cwd: environment.cwd });
          write(`Baseline screenshots stored in ${result.baselineDir}`);
          write(`Baseline artifact written to ${result.artifactPath}`);
          return;
        }

        if (commandName === 'changed') {
          const result = await runChanged({ cwd: environment.cwd });
          write(`Changed run ${result.passed ? 'passed' : 'failed'} with ${result.summary.changed} changed screenshots.`);
          write(`Changed artifact written to ${result.artifactPath}`);

          for (const artifact of result.summary.artifacts) {
            write(`Changed image: ${artifact.diffPath}`);
          }

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
    .name('spotter')
    .description(
      'Deterministic-first CLI for turning frontend UX scenarios into Playwright visual regression coverage.'
    )
    .version('0.0.0')
    .showHelpAfterError('(run with --help for usage)');

  for (const command of cliCommandDefinitions) {
    program
      .command(command.name)
      .description(command.description)
      .action(async () => {
        const handler = dependencies.handlers[command.name];

        if (!handler) {
          throw new Error(`Missing CLI handler for command: ${command.name}`);
        }

        await handler({
          commandName: command.name,
          environment: dependencies.environment
        });
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