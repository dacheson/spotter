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
    const importHelpText = program.commands.find((command) => command.name() === 'import')?.helpInformation() ?? '';

    expect(helpText).toContain('spotter [options] [command]');
    expect(helpText).toContain('init');
    expect(helpText).toContain('scan');
    expect(helpText).toContain('generate');
    expect(helpText).toContain('prompt');
    expect(helpText).toContain('import');
    expect(helpText).toContain('override');
    expect(helpText).toContain('baseline');
    expect(helpText).toContain('changed');
    expect(helpText).toContain('report');
    expect(generateHelpText).toContain('--llm-fallback');
    expect(generateHelpText).toContain('--llm-provider <provider>');
    expect(importHelpText).toContain('--input <path>');
    expect(program.commands.find((command) => command.name() === 'override')?.helpInformation() ?? '').toContain('--exclude-id <id>');
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

  it('passes import input options through the command context', async () => {
    const recorder = vi.fn<(context: CliActionContext) => void>();

    await runCli(['node', 'spotter', 'import', '--input', 'manual.json'], {
      environment: { cwd: '/repo' },
      handlers: createHandlers(recorder)
    });

    expect(recorder).toHaveBeenCalledWith({
      commandName: 'import',
      environment: { cwd: '/repo' },
      importOptions: {
        inputPath: 'manual.json'
      }
    });
  });

  it('passes override include options through the command context', async () => {
    const recorder = vi.fn<(context: CliActionContext) => void>();

    await runCli(
      [
        'node',
        'spotter',
        'override',
        '--include-id',
        'checkout-empty-state-manual',
        '--route',
        '/checkout',
        '--name',
        'Checkout Empty State',
        '--priority',
        'medium',
        '--tag',
        'checkout',
        '--tag',
        'empty'
      ],
      {
        environment: { cwd: '/repo' },
        handlers: createHandlers(recorder)
      }
    );

    expect(recorder).toHaveBeenCalledWith({
      commandName: 'override',
      environment: { cwd: '/repo' },
      overrideOptions: {
        action: 'include',
        scenario: {
          id: 'checkout-empty-state-manual',
          routePath: '/checkout',
          name: 'Checkout Empty State',
          priority: 'medium',
          tags: ['checkout', 'empty']
        }
      }
    });
  });

  it('passes override exclude options through the command context', async () => {
    const recorder = vi.fn<(context: CliActionContext) => void>();

    await runCli(['node', 'spotter', 'override', '--exclude-id', 'checkout-loading-state'], {
      environment: { cwd: '/repo' },
      handlers: createHandlers(recorder)
    });

    expect(recorder).toHaveBeenCalledWith({
      commandName: 'override',
      environment: { cwd: '/repo' },
      overrideOptions: {
        action: 'exclude',
        scenarioId: 'checkout-loading-state'
      }
    });
  });
});