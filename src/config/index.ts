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
    screenshotsDir: '.spotter/screenshots',
    testsDir: '.spotter/tests'
  }
};

export const supportedConfigFileNames = ['spotter.config.ts', 'spotter.config.json'] as const;