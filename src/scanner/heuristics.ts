import type { ComponentSignalFinding, ComponentSignalKind, ComponentSignalScanResult } from './signals.js';

export type ComponentStateHeuristicKind = 'loading' | 'error' | 'form';

export interface ComponentStateHeuristic {
  kind: ComponentStateHeuristicKind;
  filePath: string;
  line: number;
  identifier: string;
  evidence: string;
  tags: string[];
  recipes: string[];
}

export interface ComponentStateHeuristicSummary {
  heuristics: ComponentStateHeuristic[];
  counts: Record<ComponentStateHeuristicKind, number>;
}

const heuristicKinds = new Set<ComponentStateHeuristicKind>(['loading', 'error', 'form']);

export function deriveComponentStateHeuristics(
  scanResult: ComponentSignalScanResult
): ComponentStateHeuristicSummary {
  const heuristics = deduplicateHeuristics(
    scanResult.findings
      .filter((finding): finding is ComponentSignalFinding & { kind: ComponentStateHeuristicKind } =>
        heuristicKinds.has(finding.kind as ComponentStateHeuristicKind)
      )
      .map(createHeuristic)
  );

  return {
    heuristics,
    counts: {
      loading: heuristics.filter((heuristic) => heuristic.kind === 'loading').length,
      error: heuristics.filter((heuristic) => heuristic.kind === 'error').length,
      form: heuristics.filter((heuristic) => heuristic.kind === 'form').length
    }
  };
}

function createHeuristic(
  finding: ComponentSignalFinding & { kind: ComponentStateHeuristicKind }
): ComponentStateHeuristic {
  return {
    kind: finding.kind,
    filePath: finding.filePath,
    line: finding.line,
    identifier: finding.identifier,
    evidence: finding.evidence,
    tags: getHeuristicTags(finding.kind),
    recipes: getHeuristicRecipes(finding.kind)
  };
}

function getHeuristicTags(kind: ComponentSignalKind): string[] {
  switch (kind) {
    case 'loading':
      return ['loading'];
    case 'error':
      return ['error'];
    case 'form':
      return ['form', 'validation'];
    default:
      return [];
  }
}

function getHeuristicRecipes(kind: ComponentSignalKind): string[] {
  switch (kind) {
    case 'loading':
      return ['wait-for-loading-state'];
    case 'error':
      return ['mock-error-state'];
    case 'form':
      return ['submit-invalid-form'];
    default:
      return [];
  }
}

function deduplicateHeuristics(heuristics: ComponentStateHeuristic[]): ComponentStateHeuristic[] {
  const unique = new Map<string, ComponentStateHeuristic>();

  for (const heuristic of heuristics) {
    const key = [heuristic.filePath, heuristic.line, heuristic.kind, heuristic.identifier].join(':');

    if (!unique.has(key)) {
      unique.set(key, heuristic);
    }
  }

  return [...unique.values()].sort((left, right) => {
    const fileComparison = left.filePath.localeCompare(right.filePath);

    if (fileComparison !== 0) {
      return fileComparison;
    }

    const lineComparison = left.line - right.line;

    if (lineComparison !== 0) {
      return lineComparison;
    }

    return left.kind.localeCompare(right.kind);
  });
}