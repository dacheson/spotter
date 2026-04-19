import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { Node, Project, SyntaxKind, type SourceFile } from 'ts-morph';

import { loadSpotterConfig } from '../config/index.js';

export type ComponentSignalKind = 'loading' | 'error' | 'empty' | 'modal' | 'form' | 'auth' | 'role';

export interface ComponentSignalFinding {
  kind: ComponentSignalKind;
  identifier: string;
  filePath: string;
  line: number;
  evidence: string;
}

export interface ComponentSignalScanResult {
  rootDir: string;
  filesScanned: number;
  findings: ComponentSignalFinding[];
}

export interface ScanComponentSignalsOptions {
  cwd?: string;
}

const supportedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredDirectoryNames = new Set(['.git', '.next', '.spotter', 'dist', 'node_modules']);
const signalMatchers: Array<{ kind: ComponentSignalKind; pattern: RegExp }> = [
  { kind: 'loading', pattern: /(is|has)?loading|pending|submitting/i },
  { kind: 'error', pattern: /error|failed|failure|iserror|haserror/i },
  { kind: 'empty', pattern: /empty|isempty|nodata|noresults/i },
  { kind: 'modal', pattern: /modal|dialog|drawer/i },
  { kind: 'form', pattern: /form|submit|validation|field|errors/i },
  { kind: 'auth', pattern: /auth|user|session|loggedin|authenticated|unauthorized/i },
  { kind: 'role', pattern: /role|admin|permission|can[A-Z]|isAdmin/i }
];

export async function scanComponentSignals(
  options: ScanComponentSignalsOptions = {}
): Promise<ComponentSignalScanResult> {
  const cwd = options.cwd ?? process.cwd();
  const { config } = await loadSpotterConfig({ cwd });
  const rootDir = config.rootDir === '.' ? cwd : path.resolve(cwd, config.rootDir);
  const filePaths = await collectSourceFilePaths(rootDir);
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      jsx: 1
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: false
  });

  const sourceFiles = filePaths.map((filePath) => project.addSourceFileAtPath(filePath));
  const findings = deduplicateFindings(sourceFiles.flatMap((sourceFile) => scanSourceFile(sourceFile, rootDir)));

  return {
    rootDir: normalizePath(path.relative(cwd, rootDir) || '.'),
    filesScanned: sourceFiles.length,
    findings
  };
}

async function collectSourceFilePaths(rootDir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirectoryNames.has(entry.name)) {
          return [] as string[];
        }

        return collectSourceFilePaths(entryPath);
      }

      if (!entry.isFile()) {
        return [] as string[];
      }

      const extension = path.extname(entry.name);

      if (!supportedExtensions.has(extension) || entry.name.endsWith('.d.ts')) {
        return [] as string[];
      }

      return [entryPath];
    })
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
}

function scanSourceFile(sourceFile: SourceFile, rootDir: string): ComponentSignalFinding[] {
  const findings: ComponentSignalFinding[] = [];

  for (const node of sourceFile.getDescendants()) {
    if (Node.isIfStatement(node)) {
      findings.push(...scanExpressionForSignals(node.getExpression(), sourceFile, rootDir));
      continue;
    }

    if (Node.isConditionalExpression(node)) {
      findings.push(...scanExpressionForSignals(node.getCondition(), sourceFile, rootDir));
      continue;
    }

    if (Node.isBinaryExpression(node)) {
      const operator = node.getOperatorToken().getKind();

      if (operator === SyntaxKind.AmpersandAmpersandToken || operator === SyntaxKind.BarBarToken) {
        findings.push(...scanExpressionForSignals(node.getLeft(), sourceFile, rootDir));
      }

      continue;
    }

    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      const tagName = node.getTagNameNode().getText();

      if (tagName === 'form') {
        findings.push(
          createFinding({
            kind: 'form',
            identifier: 'form',
            filePath: sourceFile.getFilePath(),
            rootDir,
            node,
            evidence: tagName
          })
        );
      }
    }
  }

  return findings;
}

function scanExpressionForSignals(expression: Node, sourceFile: SourceFile, rootDir: string): ComponentSignalFinding[] {
  const findings: ComponentSignalFinding[] = [];

  for (const identifierNode of collectIdentifierNodes(expression)) {
    const identifier = identifierNode.getText();

    for (const matcher of signalMatchers) {
      if (!matcher.pattern.test(identifier)) {
        continue;
      }

      findings.push(
        createFinding({
          kind: matcher.kind,
          identifier,
          filePath: sourceFile.getFilePath(),
          rootDir,
          node: identifierNode,
          evidence: expression.getText()
        })
      );
    }
  }

  return findings;
}

function collectIdentifierNodes(expression: Node) {
  const identifiers = expression.getDescendantsOfKind(SyntaxKind.Identifier);

  if (Node.isIdentifier(expression)) {
    return [expression, ...identifiers];
  }

  return identifiers;
}

function createFinding(input: {
  kind: ComponentSignalKind;
  identifier: string;
  filePath: string;
  rootDir: string;
  node: Node;
  evidence: string;
}): ComponentSignalFinding {
  return {
    kind: input.kind,
    identifier: input.identifier,
    filePath: normalizePath(path.relative(input.rootDir, input.filePath)),
    line: input.node.getStartLineNumber(),
    evidence: input.evidence.replace(/\s+/g, ' ').trim()
  };
}

function deduplicateFindings(findings: ComponentSignalFinding[]): ComponentSignalFinding[] {
  const entries = new Map<string, ComponentSignalFinding>();

  for (const finding of findings) {
    const key = [finding.filePath, finding.line, finding.kind, finding.identifier].join(':');

    if (!entries.has(key)) {
      entries.set(key, finding);
    }
  }

  return [...entries.values()].sort((left, right) => {
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

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}