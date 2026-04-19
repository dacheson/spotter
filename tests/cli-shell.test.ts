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

    expect(helpText).toContain('spotter [options] [command]');
    expect(helpText).toContain('init');
    expect(helpText).toContain('scan');
    expect(helpText).toContain('generate');
    expect(helpText).toContain('baseline');
    expect(helpText).toContain('changed');
    expect(helpText).toContain('report');
  });

  it('routes command execution through the configured handler', async () => {
    const recorder = vi.fn<(context: CliActionContext) => void>();

    await runCli(['node', 'spotter', 'scan'], {
      environment: { cwd: '/repo' },
      handlers: createHandlers(recorder)
    });

    expect(recorder).toHaveBeenCalledWith({
      commandName: 'scan',
      environment: { cwd: '/repo' }
    });
  });
});