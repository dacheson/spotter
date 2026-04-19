import { Command } from 'commander';

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
  write: (message: string) => void = (message) => process.stdout.write(`${message}\n`)
): Record<string, CliCommandHandler> {
  return Object.fromEntries(
    cliCommandDefinitions.map((command) => [
      command.name,
      async ({ commandName, environment }) => {
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