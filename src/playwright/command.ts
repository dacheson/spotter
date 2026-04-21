import { spawn } from 'node:child_process';

export interface ExternalCommandRequest {
  command: string;
  args: string[];
  cwd: string;
}

export interface ExternalCommandResult {
  exitCode: number;
}

export function createNpxCommand(args: string[]): ExternalCommandRequest {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx', ...args],
      cwd: process.cwd()
    };
  }

  return {
    command: 'npx',
    args,
    cwd: process.cwd()
  };
}

export async function runExternalCommand(request: ExternalCommandRequest): Promise<ExternalCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1
      });
    });
  });
}