import { readFile, writeFile } from 'node:fs/promises';

export const artifactSchemaVersion = 1;

export interface VersionedArtifactEnvelope {
  schemaVersion?: number;
}

export interface ReadVersionedJsonArtifactOptions {
  allowLegacyMissingVersion?: boolean;
  filePath: string;
}

export function stampArtifactSchemaVersion<T extends object>(value: T): T & { schemaVersion: number } {
  return {
    ...value,
    schemaVersion: artifactSchemaVersion
  };
}

export async function writeVersionedJsonArtifact(filePath: string, value: object): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(stampArtifactSchemaVersion(value), null, 2)}\n`, 'utf8');
}

export async function readVersionedJsonArtifact(
  options: ReadVersionedJsonArtifactOptions
): Promise<unknown> {
  const contents = await readFile(options.filePath, 'utf8');
  const parsed = JSON.parse(contents) as VersionedArtifactEnvelope;

  validateArtifactSchemaVersion(parsed, options);

  return parsed;
}

export function validateArtifactSchemaVersion(
  artifact: VersionedArtifactEnvelope,
  options: ReadVersionedJsonArtifactOptions
): void {
  if (artifact.schemaVersion === undefined) {
    if (options.allowLegacyMissingVersion ?? true) {
      return;
    }

    throw new Error(
      `Missing artifact schema version in ${options.filePath}. Expected ${artifactSchemaVersion}. Regenerate artifacts with the current Spotter version.`
    );
  }

  if (artifact.schemaVersion !== artifactSchemaVersion) {
    throw new Error(
      `Unsupported artifact schema version ${String(artifact.schemaVersion)} in ${options.filePath}. Expected ${artifactSchemaVersion}. Regenerate artifacts with the current Spotter version.`
    );
  }
}