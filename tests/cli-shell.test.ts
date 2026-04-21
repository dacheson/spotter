import { describe, expect, it, vi } from 'vitest';

import {
  cliCommandDefinitions,
  createProgram,
  type CliActionContext,
  type CliCommandHandler,
  runCli
} from '../src/cli/index.js';

function createHandlers(recorder: (context: CliActionContext) => void): Record<string, CliCommandHandler> {
  return Object.fromEntries(
    cliCommandDefinitions.map((command) => [
      command.name,
      async (context: CliActionContext) => {
        recorder(context);
      }
    ])
  );
}

describe('cli shell', () => {
  it('registers the expected commands in help output', () => {
    const program = createProgram({
      environment: { cwd: '/repo' },
      handlers: createHandlers(() => undefined)
    });

    const helpText = program.helpInformation();
    const generateHelpText = program.commands.find((command) => command.name() === 'generate')?.helpInformation() ?? '';

    expect(helpText).toContain('spotter [options] [command]');
    expect(helpText).toContain('init');
    expect(helpText).toContain('scan');
    expect(helpText).toContain('generate');
    expect(helpText).toContain('baseline');
    expect(helpText).toContain('changed');
    expect(helpText).toContain('report');
    expect(generateHelpText).toContain('--llm-fallback');
    expect(generateHelpText).toContain('--llm-provider <provider>');
  });

  it('routes command execution through the configured handler', async () => {
    const recorder = vi.fn<(context: CliActionContext) => void>();

    await runCli(['node', 'spotter', 'scan'], {
      environment: { cwd: '/repo' },
      handlers: createHandlers(recorder)
    });

    expect(recorder).toHaveBeenCalledWith({
      commandName: 'scan',
      environment: { cwd: '/repo' },
      generateOptions: undefined
    });
  });

  it('passes generate llm options through the command context', async () => {
    const recorder = vi.fn<(context: CliActionContext) => void>();

    await runCli(
      [
        'node',
        'spotter',
        'generate',
        '--llm-fallback',
        '--llm-provider',
        'local',
        '--llm-model',
        'llama3.1',
        '--llm-base-url',
        'http://127.0.0.1:11434/v1',
        '--llm-max-generated-scenarios',
        '2'
      ],
      {
        environment: { cwd: '/repo' },
        handlers: createHandlers(recorder)
      }
    );

    expect(recorder).toHaveBeenCalledWith({
      commandName: 'generate',
      environment: { cwd: '/repo' },
      generateOptions: {
        llmFallback: true,
        llmProvider: 'local',
        llmModel: 'llama3.1',
        llmBaseUrl: 'http://127.0.0.1:11434/v1',
        llmMaxGeneratedScenarios: 2
      }
    });
  });
});