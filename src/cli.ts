import { createCliDependencies, runCli } from './cli/index.js';

export async function main(argv: string[] = process.argv): Promise<void> {
  await runCli(argv, createCliDependencies({ cwd: process.cwd() }));
}

void main();