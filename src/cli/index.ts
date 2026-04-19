export interface CliEnvironment {
  cwd: string;
}

export interface CliCommandDefinition {
  name: string;
  description: string;
}

export const plannedCliCommands: CliCommandDefinition[] = [
  {
    name: 'init',
    description: 'Create a starter Spotter config in the current repository.'
  },
  {
    name: 'scan',
    description: 'Scan the repository and collect deterministic UX coverage signals.'
  },
  {
    name: 'scenarios',
    description: 'Inspect the scenario plan derived from route and UI-state analysis.'
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