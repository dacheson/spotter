import path from 'node:path';
import { spawn } from 'node:child_process';

import { readVersionedJsonArtifact } from '../artifacts/versioned.js';
import { loadSpotterConfig } from '../config/index.js';
import { createExecutionScopeSummaryByScenarioId, createManifestSummaryScenario, normalizeWorkspacePath } from '../reports/manifest.js';
import type { RouteDefinition, ManifestSummaryScenario, ScenarioDefinition } from '../types.js';

const genericPathSegments = new Set([
  'app',
  'apps',
  'component',
  'components',
  'lib',
  'pages',
  'routes',
  'shared',
  'src',
  'ui'
]);
const maxPossibleImpactRoutesPerFile = 2;
const maxPossibleImpactScenarios = 6;

export type ChangedSelectionMode = 'full' | 'impact' | 'none';

export interface ChangedScenarioSelection {
  changedFiles: string[];
  mode: ChangedSelectionMode;
  possibleAdditionalImpact: ManifestSummaryScenario[];
  reason: string;
  trustedScenarios: ManifestSummaryScenario[];
}

export interface SelectChangedScenariosOptions {
  cwd?: string;
}

export async function selectChangedScenarios(
  options: SelectChangedScenariosOptions = {}
): Promise<ChangedScenarioSelection> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const artifactsDir = path.resolve(cwd, config.paths.artifactsDir);
  const routeManifest = (await tryReadJsonFile(path.join(artifactsDir, 'route-manifest.json'))) as
    | { rootDir: string; routes: RouteDefinition[] }
    | null;
  const scenariosArtifact = (await tryReadJsonFile(path.join(artifactsDir, 'scenarios.json'))) as
    | { scenarios: ScenarioDefinition[] }
    | null;
  const scenarioPlanArtifact = (await tryReadJsonFile(path.join(artifactsDir, 'scenario-plan.json'))) as
    | { items: Array<{ scenario: { id: string }; target: { locale: { code: string }; viewport: { name: string } } }> }
    | null;

  if (!routeManifest || !scenariosArtifact || !scenarioPlanArtifact) {
    return {
      changedFiles: [],
      mode: 'full',
      possibleAdditionalImpact: [],
      reason: 'Missing route, scenario, or scenario-plan artifacts; running the full generated suite.',
      trustedScenarios: []
    };
  }

  const changedFiles = await getChangedFiles(cwd);

  if (changedFiles === null) {
    return {
      changedFiles: [],
      mode: 'full',
      possibleAdditionalImpact: [],
      reason: 'Git metadata was unavailable; running the full generated suite.',
      trustedScenarios: []
    };
  }

  const relevantChangedFiles = changedFiles.filter((filePath) => !isIgnoredChangedFile(filePath, config));

  if (relevantChangedFiles.length === 0) {
    return {
      changedFiles: [],
      mode: 'none',
      possibleAdditionalImpact: [],
      reason: 'No relevant source changes were found for generated scenario coverage.',
      trustedScenarios: []
    };
  }

  if (relevantChangedFiles.some((filePath) => isBroadImpactFile(filePath))) {
    return {
      changedFiles: relevantChangedFiles,
      mode: 'full',
      possibleAdditionalImpact: [],
      reason: 'Configuration or dependency changes can affect the full scenario set; running the full generated suite.',
      trustedScenarios: []
    };
  }

  const matchedRoutePaths = matchChangedFilesToRoutePaths({
    changedFiles: relevantChangedFiles,
    rootDir: routeManifest.rootDir,
    routes: routeManifest.routes
  });

  const scenarios = scenariosArtifact.scenarios.filter((scenario) => matchedRoutePaths.routePaths.includes(scenario.routePath));
  const executionScopeByScenarioId = createExecutionScopeSummaryByScenarioId(scenarioPlanArtifact.items);
  const trustedScenarios = scenarios.map((scenario) =>
    createManifestSummaryScenario(createTrustedScenarioOptions({
      matchedFiles: matchedRoutePaths.matchedFilesByRoutePath[scenario.routePath] ?? [],
      ...(executionScopeByScenarioId[scenario.id]
        ? { executionScope: executionScopeByScenarioId[scenario.id] }
        : {}),
      scenario
    }))
  );
  const possibleAdditionalImpact = createPossibleAdditionalImpactScenarios({
    executionScopeByScenarioId,
    scenarios: scenariosArtifact.scenarios,
    unmatchedFiles: matchedRoutePaths.unmatchedFiles,
    routes: routeManifest.routes
  });

  if (trustedScenarios.length === 0 && possibleAdditionalImpact.length === 0) {
    return {
      changedFiles: relevantChangedFiles,
      mode: 'full',
      possibleAdditionalImpact: [],
      reason:
        'Changed files could not be mapped deterministically to route scenarios; running the full generated suite.',
      trustedScenarios: []
    };
  }

  const reasonParts: string[] = [];

  if (trustedScenarios.length > 0) {
    reasonParts.push(`Selected ${trustedScenarios.length} trusted scenarios`);
  }

  if (possibleAdditionalImpact.length > 0) {
    reasonParts.push(`flagged ${possibleAdditionalImpact.length} possible additional impact scenarios`);
  }

  return {
    changedFiles: relevantChangedFiles,
    mode: 'impact',
    possibleAdditionalImpact,
    reason: `${reasonParts.join(' and ')} from ${relevantChangedFiles.length} changed files.`,
    trustedScenarios
  };
}

async function getChangedFiles(cwd: string): Promise<string[] | null> {
  const output = await runGitStatus(cwd);

  if (output === null) {
    return null;
  }

  return Array.from(
    new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .map((line) => line.slice(3))
        .map((entry) => entry.includes(' -> ') ? entry.split(' -> ').at(-1) ?? entry : entry)
        .map((entry) => normalizeWorkspacePath(entry))
    )
  ).sort((left, right) => left.localeCompare(right));
}

function runGitStatus(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const chunks: Buffer[] = [];

    child.stdout.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on('error', () => resolve(null));
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        resolve(null);
        return;
      }

      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

function matchChangedFilesToRoutePaths(options: {
  changedFiles: string[];
  rootDir: string;
  routes: RouteDefinition[];
}): {
  matchedFilesByRoutePath: Record<string, string[]>;
  routePaths: string[];
  unmatchedFiles: string[];
} {
  const rootPrefix = options.rootDir === '.' ? '' : `${normalizeWorkspacePath(options.rootDir)}/`;
  const matchedFilesByRoutePath = new Map<string, string[]>();
  const unmatchedFiles: string[] = [];

  for (const filePath of options.changedFiles) {
    const matchedRoute = findBestMatchingRoute(
      options.routes.map((route) => ({
        ...route,
        filePath: `${rootPrefix}${normalizeWorkspacePath(route.filePath)}`
      })),
      filePath
    );

    if (!matchedRoute) {
      unmatchedFiles.push(filePath);
      continue;
    }

    const routeFiles = matchedFilesByRoutePath.get(matchedRoute.path) ?? [];
    routeFiles.push(filePath);
    matchedFilesByRoutePath.set(matchedRoute.path, routeFiles);
  }

  return {
    matchedFilesByRoutePath: Object.fromEntries(
      [...matchedFilesByRoutePath.entries()].map(([routePath, files]) => [
        routePath,
        files.sort((left, right) => left.localeCompare(right))
      ])
    ),
    routePaths: [...matchedFilesByRoutePath.keys()].sort((left, right) => left.localeCompare(right)),
    unmatchedFiles: unmatchedFiles.sort((left, right) => left.localeCompare(right))
  };
}

function findBestMatchingRoute(routes: RouteDefinition[], filePath: string): RouteDefinition | null {
  const normalizedFilePath = normalizeWorkspacePath(filePath);
  let bestMatch: RouteDefinition | null = null;
  let bestScore = -1;

  for (const route of routes) {
    const routeFilePath = normalizeWorkspacePath(route.filePath);
    const routeDirectory = normalizeWorkspacePath(path.posix.dirname(routeFilePath));
    let score = -1;

    if (normalizedFilePath === routeFilePath) {
      score = routeFilePath.length + 1;
    } else if (
      routeDirectory !== '.' &&
      !isBroadRouteContainer(route.path, routeDirectory) &&
      normalizedFilePath.startsWith(`${routeDirectory}/`)
    ) {
      score = routeDirectory.length;
    }

    if (score > bestScore) {
      bestMatch = route;
      bestScore = score;
    }
  }

  return bestMatch;
}

function isBroadRouteContainer(routePath: string, routeDirectory: string): boolean {
  return routePath === '/' || routeDirectory === 'app' || routeDirectory === 'pages' || routeDirectory === 'routes';
}

function isBroadImpactFile(filePath: string): boolean {
  return /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|spotter\.config\.(json|ts))$/i.test(filePath);
}

function isIgnoredChangedFile(
  filePath: string,
  config: Awaited<ReturnType<typeof loadSpotterConfig>>['config']
): boolean {
  const normalizedFilePath = normalizeWorkspacePath(filePath);
  const ignoredPrefixes = [config.paths.artifactsDir, config.paths.screenshotsDir, config.paths.testsDir].map((value) => {
    const normalized = normalizeWorkspacePath(value);
    return normalized === '.' ? '' : `${normalized}/`;
  });

  return ignoredPrefixes.some((prefix) => prefix.length > 0 && normalizedFilePath.startsWith(prefix));
}

async function tryReadJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return await readVersionedJsonArtifact({ filePath });
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function createTrustedScenarioOptions(options: {
  executionScope?: string;
  matchedFiles: string[];
  scenario: ScenarioDefinition;
}): Parameters<typeof createManifestSummaryScenario>[0] {
  const changedFileProvenance = options.matchedFiles.map((filePath) => `changed-file:${filePath}`);
  const scenarioProvenance = [`route:${options.scenario.routePath}`, `scenario:${options.scenario.id}`];

  if (options.scenario.origin === 'user-override') {
    scenarioProvenance.push('source:user-override');
  }

  return {
    scenarioId: options.scenario.id,
    ...(options.executionScope ? { executionScope: options.executionScope } : {}),
    scenario: options.scenario,
    provenance: [...scenarioProvenance, ...changedFileProvenance],
    whyIncluded: `Included because ${options.matchedFiles.join(', ')} changed and maps to ${options.scenario.routePath}.`
  };
}

function createPossibleAdditionalImpactScenarios(options: {
  executionScopeByScenarioId: Record<string, string>;
  scenarios: ScenarioDefinition[];
  unmatchedFiles: string[];
  routes: RouteDefinition[];
}): ManifestSummaryScenario[] {
  if (options.unmatchedFiles.length === 0) {
    return [];
  }

  const scenariosByRoutePath = new Map<string, ScenarioDefinition[]>();

  for (const scenario of options.scenarios) {
    const routeScenarios = scenariosByRoutePath.get(scenario.routePath) ?? [];
    routeScenarios.push(scenario);
    scenariosByRoutePath.set(scenario.routePath, routeScenarios);
  }

  const routeMatches = new Map<string, { changedFile: string; overlapSegment: string; score: number }>();

  for (const unmatchedFile of options.unmatchedFiles) {
    for (const candidate of findPossibleImpactRoutes(options.routes, unmatchedFile)) {
      const existing = routeMatches.get(candidate.route.path);

      if (!existing || candidate.score > existing.score) {
        routeMatches.set(candidate.route.path, {
          changedFile: unmatchedFile,
          overlapSegment: candidate.overlapSegment,
          score: candidate.score
        });
      }
    }
  }

  const possibleScenarios: ManifestSummaryScenario[] = [];
  const seenScenarioIds = new Set<string>();

  for (const [routePath, match] of [...routeMatches.entries()].sort((left, right) => right[1].score - left[1].score || left[0].localeCompare(right[0]))) {
    const routeScenarios = (scenariosByRoutePath.get(routePath) ?? [])
      .slice()
      .sort(compareScenarioPriority)
      .slice(0, Math.max(1, Math.ceil(maxPossibleImpactScenarios / Math.max(1, routeMatches.size))));

    for (const scenario of routeScenarios) {
      if (seenScenarioIds.has(scenario.id)) {
        continue;
      }

      seenScenarioIds.add(scenario.id);
      possibleScenarios.push(
        createManifestSummaryScenario({
          confidence: 'unknown',
          correctionHint:
            'Review this low-confidence scenario. Keep it as-is, add an explicit override, or exclude it if the shared change is not user-visible here.',
          ...(options.executionScopeByScenarioId[scenario.id]
            ? { executionScope: options.executionScopeByScenarioId[scenario.id] }
            : {}),
          scenarioId: scenario.id,
          scenario,
          provenance: createPossibleScenarioProvenance(scenario, match),
          whyIncluded:
            `Possible additional impact because ${match.changedFile} overlaps with ${routePath} via path segment "${match.overlapSegment}".`
        })
      );

      if (possibleScenarios.length >= maxPossibleImpactScenarios) {
        return possibleScenarios;
      }
    }
  }

  return possibleScenarios;
}

function findPossibleImpactRoutes(
  routes: RouteDefinition[],
  filePath: string
): Array<{ overlapSegment: string; route: RouteDefinition; score: number }> {
  const fileSegments = createComparablePathSegments(filePath);
  const routeScores = routes
    .map((route) => {
      const routeSegments = createComparablePathSegments(route.filePath);
      const sharedSegments = routeSegments.filter((segment) => fileSegments.includes(segment));

      if (sharedSegments.length === 0) {
        return null;
      }

      const overlapSegment = sharedSegments.sort((left, right) => right.length - left.length || left.localeCompare(right))[0]!;
      const score = sharedSegments.reduce((total, segment) => total + segment.length, 0);

      return {
        overlapSegment,
        route,
        score
      };
    })
    .filter((entry): entry is { overlapSegment: string; route: RouteDefinition; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score || left.route.path.localeCompare(right.route.path));

  return routeScores.slice(0, maxPossibleImpactRoutesPerFile);
}

function createComparablePathSegments(filePath: string): string[] {
  return Array.from(
    new Set(
      normalizeWorkspacePath(filePath)
        .split('/')
        .flatMap((segment) => segment.split('.'))
        .map((segment) => segment.trim().toLowerCase())
        .map((segment) => segment.replace(/\[(?:\.\.\.)?(.+?)\]/g, '$1'))
        .filter((segment) => segment.length > 1 && !genericPathSegments.has(segment) && !/^page|layout|index$/.test(segment))
    )
  );
}

function createPossibleScenarioProvenance(
  scenario: ScenarioDefinition,
  match: { changedFile: string; overlapSegment: string }
): string[] {
  const provenance = [`route:${scenario.routePath}`, `scenario:${scenario.id}`];

  if (scenario.origin === 'user-override') {
    provenance.push('source:user-override');
  }

  provenance.push(`changed-file:${match.changedFile}`);
  provenance.push(`path-overlap:${match.overlapSegment}`);

  return provenance;
}

function compareScenarioPriority(left: ScenarioDefinition, right: ScenarioDefinition): number {
  const priorityRank = (priority: ScenarioDefinition['priority']): number => {
    switch (priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      default:
        return 1;
    }
  };

  return priorityRank(right.priority) - priorityRank(left.priority) || left.id.localeCompare(right.id);
}