import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { createJiti } from 'jiti';

import type { LocaleDefinition, ViewportDefinition } from '../types.js';

export interface SpotterPathsConfig {
  artifactsDir: string;
  screenshotsDir: string;
  testsDir: string;
}

export interface SpotterConfig {
  rootDir: string;
  viewports: ViewportDefinition[];
  locales: LocaleDefinition[];
  paths: SpotterPathsConfig;
}

export interface SpotterConfigInput {
  rootDir?: string;
  viewports?: ViewportDefinition[];
  locales?: LocaleDefinition[];
  paths?: Partial<SpotterPathsConfig>;
}

export interface LoadSpotterConfigOptions {
  cwd?: string;
}

export interface LoadedSpotterConfig {
  config: SpotterConfig;
  configPath: string | null;
}

export const defaultViewports: ViewportDefinition[] = [
  {
    name: 'desktop',
    width: 1440,
    height: 900
  },
  {
    name: 'mobile',
    width: 390,
    height: 844
  }
];

export const defaultLocales: LocaleDefinition[] = [
  {
    code: 'en-US',
    label: 'English (US)',
    rtl: false
  }
];

export const defaultSpotterConfig: SpotterConfig = {
  rootDir: '.',
  viewports: defaultViewports,
  locales: defaultLocales,
  paths: {
    artifactsDir: '.spotter/artifacts',
    screenshotsDir: '.spotter/baselines',
    testsDir: '.spotter/tests'
  }
};

export const supportedConfigFileNames = ['spotter.config.ts', 'spotter.config.json'] as const;

function cloneSpotterConfig(config: SpotterConfig): SpotterConfig {
  return {
    rootDir: config.rootDir,
    viewports: config.viewports.map((viewport) => ({ ...viewport })),
    locales: config.locales.map((locale) => ({ ...locale })),
    paths: {
      ...config.paths
    }
  };
}

export function mergeSpotterConfig(overrides: SpotterConfigInput = {}): SpotterConfig {
  const defaults = cloneSpotterConfig(defaultSpotterConfig);

  return {
    rootDir: overrides.rootDir ?? defaults.rootDir,
    viewports: overrides.viewports ?? defaults.viewports,
    locales: overrides.locales ?? defaults.locales,
    paths: {
      ...defaults.paths,
      ...overrides.paths
    }
  };
}

export async function findSpotterConfigFile(cwd: string): Promise<string | null> {
  for (const fileName of supportedConfigFileNames) {
    const candidatePath = path.join(cwd, fileName);

    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      continue;
    }
  }

  return null;
}

async function loadJsonConfig(configPath: string): Promise<SpotterConfigInput> {
  const rawContents = await readFile(configPath, 'utf8');
  return JSON.parse(rawContents) as SpotterConfigInput;
}

async function loadTypeScriptConfig(configPath: string): Promise<SpotterConfigInput> {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false
  });

  return (await jiti.import(configPath, { default: true })) as SpotterConfigInput;
}

async function loadConfigInput(configPath: string): Promise<SpotterConfigInput> {
  if (configPath.endsWith('.json')) {
    return loadJsonConfig(configPath);
  }

  if (configPath.endsWith('.ts')) {
    return loadTypeScriptConfig(configPath);
  }

  throw new Error(`Unsupported Spotter config file: ${configPath}`);
}

export async function loadSpotterConfig(
  options: LoadSpotterConfigOptions = {}
): Promise<LoadedSpotterConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = await findSpotterConfigFile(cwd);

  if (!configPath) {
    return {
      config: mergeSpotterConfig(),
      configPath: null
    };
  }

  const loadedConfig = await loadConfigInput(configPath);

  return {
    config: mergeSpotterConfig(loadedConfig),
    configPath
  };
}