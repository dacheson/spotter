import { access, readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createJiti } from 'jiti';

import type { LlmProviderName } from '../llm/provider.js';
import type { LocaleDefinition, ViewportDefinition } from '../types.js';

export interface SpotterDevServerConfig {
  command: string;
  cwd?: string;
  reuseExistingServer: boolean;
  timeoutMs: number;
}

export interface SpotterPathsConfig {
  artifactsDir: string;
  screenshotsDir: string;
  testsDir: string;
}

export interface SpotterLlmFallbackConfig {
  apiKeyEnvVar?: string;
  baseUrl?: string;
  enabled: boolean;
  instructions?: string;
  maxGeneratedScenarios?: number;
  model?: string;
  provider?: LlmProviderName;
}

export interface SpotterLlmConfig {
  fallback: SpotterLlmFallbackConfig | null;
}

export interface SpotterConfig {
  appUrl: string;
  devServer: SpotterDevServerConfig | null;
  llm: SpotterLlmConfig;
  rootDir: string;
  viewports: ViewportDefinition[];
  locales: LocaleDefinition[];
  paths: SpotterPathsConfig;
}

export interface SpotterLlmFallbackConfigInput {
  apiKeyEnvVar?: string;
  baseUrl?: string;
  enabled?: boolean;
  instructions?: string;
  maxGeneratedScenarios?: number;
  model?: string;
  provider?: LlmProviderName;
}

export interface SpotterLlmConfigInput {
  fallback?: SpotterLlmFallbackConfigInput | null;
}

export interface SpotterConfigInput {
  appUrl?: string;
  devServer?: Partial<SpotterDevServerConfig> | null;
  llm?: SpotterLlmConfigInput;
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

export interface WriteStarterConfigOptions {
  cwd?: string;
  fileName?: (typeof supportedConfigFileNames)[number];
}

export interface WrittenStarterConfig {
  config: SpotterConfig;
  configPath: string;
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
  appUrl: 'http://127.0.0.1:3000',
  devServer: {
    command: 'npm run dev',
    reuseExistingServer: true,
    timeoutMs: 120000
  },
  llm: {
    fallback: null
  },
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
    appUrl: config.appUrl,
    devServer: config.devServer
      ? {
          ...config.devServer
        }
      : null,
    llm: {
      fallback: config.llm.fallback
        ? {
            ...config.llm.fallback
          }
        : null
    },
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
  let devServer: SpotterDevServerConfig | null = defaults.devServer;
  let llmFallback: SpotterLlmFallbackConfig | null = defaults.llm.fallback;

  if (overrides.devServer === null) {
    devServer = null;
  } else if (overrides.devServer) {
    devServer = {
      command: overrides.devServer.command ?? defaults.devServer?.command ?? 'npm run dev',
      reuseExistingServer:
        overrides.devServer.reuseExistingServer ?? defaults.devServer?.reuseExistingServer ?? true,
      timeoutMs: overrides.devServer.timeoutMs ?? defaults.devServer?.timeoutMs ?? 120000
    };

    const devServerCwd = overrides.devServer.cwd ?? defaults.devServer?.cwd;

    if (devServerCwd) {
      devServer.cwd = devServerCwd;
    }
  }

  if (overrides.llm?.fallback === null) {
    llmFallback = null;
  } else if (overrides.llm?.fallback) {
    llmFallback = {
      enabled: overrides.llm.fallback.enabled ?? defaults.llm.fallback?.enabled ?? false
    };

    const provider = overrides.llm.fallback.provider ?? defaults.llm.fallback?.provider;

    if (provider !== undefined) {
      llmFallback.provider = provider;
    }

    const model = overrides.llm.fallback.model ?? defaults.llm.fallback?.model;

    if (model !== undefined) {
      llmFallback.model = model;
    }

    const baseUrl = overrides.llm.fallback.baseUrl ?? defaults.llm.fallback?.baseUrl;

    if (baseUrl !== undefined) {
      llmFallback.baseUrl = baseUrl;
    }

    const apiKeyEnvVar = overrides.llm.fallback.apiKeyEnvVar ?? defaults.llm.fallback?.apiKeyEnvVar;

    if (apiKeyEnvVar !== undefined) {
      llmFallback.apiKeyEnvVar = apiKeyEnvVar;
    }

    const instructions = overrides.llm.fallback.instructions ?? defaults.llm.fallback?.instructions;

    if (instructions !== undefined) {
      llmFallback.instructions = instructions;
    }

    const maxGeneratedScenarios =
      overrides.llm.fallback.maxGeneratedScenarios ?? defaults.llm.fallback?.maxGeneratedScenarios;

    if (maxGeneratedScenarios !== undefined) {
      llmFallback.maxGeneratedScenarios = maxGeneratedScenarios;
    }
  }

  return {
    appUrl: overrides.appUrl ?? defaults.appUrl,
    devServer,
    llm: {
      fallback: llmFallback
    },
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

export async function writeStarterConfig(
  options: WriteStarterConfigOptions = {}
): Promise<WrittenStarterConfig> {
  const cwd = options.cwd ?? process.cwd();
  const existingConfigPath = await findSpotterConfigFile(cwd);

  if (existingConfigPath) {
    throw new Error(`Spotter config already exists at ${existingConfigPath}.`);
  }

  const config = mergeSpotterConfig();
  const configPath = path.join(cwd, options.fileName ?? 'spotter.config.json');

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  return {
    config,
    configPath
  };
}