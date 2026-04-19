import { readdir } from 'node:fs/promises';
import path from 'node:path';

export interface DiffArtifact {
  scenarioId: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
}

export interface DiffSummary {
  changed: number;
  unchanged: number;
  artifacts: DiffArtifact[];
}

export async function collectDiffSummary(outputDir: string): Promise<DiffSummary> {
  const diffPaths = await findDiffPaths(outputDir);
  const artifacts = diffPaths.map((diffPath) => {
    const normalizedDiffPath = normalizePath(diffPath);
    const directoryPath = path.dirname(diffPath);
    const fileName = path.basename(diffPath);
    const scenarioId = fileName.replace(/-diff\.png$/i, '');

    return {
      scenarioId,
      baselinePath: normalizePath(path.join(directoryPath, `${scenarioId}-expected.png`)),
      currentPath: normalizePath(path.join(directoryPath, `${scenarioId}-actual.png`)),
      diffPath: normalizedDiffPath
    };
  });

  return {
    changed: artifacts.length,
    unchanged: 0,
    artifacts
  };
}

async function findDiffPaths(directoryPath: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nestedPaths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return findDiffPaths(entryPath);
      }

      if (entry.isFile() && entry.name.endsWith('-diff.png')) {
        return [entryPath];
      }

      return [] as string[];
    })
  );

  return nestedPaths.flat().sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}