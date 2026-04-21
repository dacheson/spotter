import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { Node, Project, SyntaxKind, type SourceFile } from 'ts-morph';

import { loadSpotterConfig } from '../config/index.js';

export type ComponentSignalKind =
  | 'loading'
  | 'error'
  | 'empty'
  | 'modal'
  | 'form'
  | 'auth'
  | 'role'
  | 'success'
  | 'feature'
  | 'responsive'
  | 'locale';

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

const supportedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue']);
const ignoredDirectoryNames = new Set(['.git', '.next', '.spotter', 'dist', 'node_modules']);
const vueDirectivePattern = /(?:v-if|v-else-if|v-show)\s*=\s*(["'])([^"']+)\1/g;
const identifierPattern = /[A-Za-z_$][\w$]*/g;
const ignoredExpressionIdentifiers = new Set(['false', 'null', 'true', 'undefined']);
const responsiveLiteralPattern = /^(mobile|tablet|desktop)$/i;
const localeLiteralPattern = /^(rtl|ltr|[a-z]{2}(?:-[A-Z]{2})?)$/;
const signalMatchers: Array<{ kind: ComponentSignalKind; pattern: RegExp }> = [
  { kind: 'loading', pattern: /(is|has)?loading|pending|submitting/i },
  { kind: 'error', pattern: /error|failed|failure|iserror|haserror/i },
  { kind: 'empty', pattern: /empty|isempty|nodata|noresults/i },
  { kind: 'modal', pattern: /modal|dialog|drawer/i },
  { kind: 'form', pattern: /form|\bsubmit(?:ting)?\b|validation|field|errors/i },
  { kind: 'auth', pattern: /auth|user|session|loggedin|authenticated|unauthorized/i },
  { kind: 'role', pattern: /role|admin|permission|can[A-Z]|isAdmin/i },
  { kind: 'success', pattern: /success|succeeded|submitted|complete|completed|finished|done/i },
  { kind: 'feature', pattern: /feature|flag|experiment|variant|rollout|beta/i },
  { kind: 'responsive', pattern: /mobile|tablet|desktop|breakpoint|responsive|sidebar|nav|menu|layout/i },
  { kind: 'locale', pattern: /locale|locales|language|lang|i18n|intl|translation|rtl|ltr|direction/i }
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
  const findingsByFile = await Promise.all(
    filePaths.map(async (filePath) => {
      if (path.extname(filePath) === '.vue') {
        const rawContents = await readFile(filePath, 'utf8');
        return scanVueSourceFile(filePath, rawContents, rootDir);
      }

      const sourceFile = project.addSourceFileAtPath(filePath);
      return scanSourceFile(sourceFile, rootDir);
    })
  );
  const findings = deduplicateFindings(findingsByFile.flat());

  return {
    rootDir: normalizePath(path.relative(cwd, rootDir) || '.'),
    filesScanned: filePaths.length,
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
  const findings = scanStructuralSignals(expression, sourceFile, rootDir);

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

function scanStructuralSignals(expression: Node, sourceFile: SourceFile, rootDir: string): ComponentSignalFinding[] {
  const findings: ComponentSignalFinding[] = [];
  const emptyIdentifier = getEmptyComparisonIdentifier(expression);

  if (emptyIdentifier) {
    findings.push(
      createFinding({
        kind: 'empty',
        identifier: emptyIdentifier,
        filePath: sourceFile.getFilePath(),
        rootDir,
        node: expression,
        evidence: expression.getText()
      })
    );
  }

  const responsiveIdentifier = getResponsiveComparisonIdentifier(expression);

  if (responsiveIdentifier) {
    findings.push(
      createFinding({
        kind: 'responsive',
        identifier: responsiveIdentifier,
        filePath: sourceFile.getFilePath(),
        rootDir,
        node: expression,
        evidence: expression.getText()
      })
    );
  }

  const localeIdentifier = getLocaleComparisonIdentifier(expression);

  if (localeIdentifier) {
    findings.push(
      createFinding({
        kind: 'locale',
        identifier: localeIdentifier,
        filePath: sourceFile.getFilePath(),
        rootDir,
        node: expression,
        evidence: expression.getText()
      })
    );
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

function isExplicitEmptyComparison(expression: Node): boolean {
  if (!Node.isBinaryExpression(expression)) {
    return false;
  }

  const operator = expression.getOperatorToken().getKind();

  if (
    operator !== SyntaxKind.EqualsEqualsEqualsToken &&
    operator !== SyntaxKind.EqualsEqualsToken &&
    operator !== SyntaxKind.LessThanEqualsToken &&
    operator !== SyntaxKind.LessThanToken
  ) {
    return false;
  }

  const left = expression.getLeft();
  const right = expression.getRight();

  return (isZeroLiteral(right) && isEmptyValueExpression(left)) || (isZeroLiteral(left) && isEmptyValueExpression(right));
}

function getEmptyComparisonIdentifier(expression: Node): string | null {
  if (!Node.isBinaryExpression(expression)) {
    return null;
  }

  const left = expression.getLeft();
  const right = expression.getRight();
  const target = isEmptyValueExpression(left) ? left : isEmptyValueExpression(right) ? right : null;

  return target?.getText() ?? null;
}

function isZeroLiteral(node: Node): boolean {
  return Node.isNumericLiteral(node) && node.getLiteralValue() === 0;
}

function isEmptyValueExpression(node: Node): boolean {
  if (Node.isPropertyAccessExpression(node)) {
    const propertyName = node.getName();
    return propertyName === 'length' || propertyName === 'size' || propertyName === 'count' || propertyName === 'total';
  }

  return false;
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

function scanVueSourceFile(filePath: string, rawContents: string, rootDir: string): ComponentSignalFinding[] {
  const findings: ComponentSignalFinding[] = [];
  const relativeFilePath = normalizePath(path.relative(rootDir, filePath));
  const lines = rawContents.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    for (const expression of extractVueDirectiveExpressions(line)) {
      findings.push(...scanVueExpression(expression, relativeFilePath, lineNumber));
    }

    if (/<form\b/i.test(line)) {
      findings.push({
        kind: 'form',
        identifier: 'form',
        filePath: relativeFilePath,
        line: lineNumber,
        evidence: 'form'
      });
    }
  }

  return findings;
}

function extractVueDirectiveExpressions(line: string): string[] {
  const expressions: string[] = [];

  for (const match of line.matchAll(vueDirectivePattern)) {
    const expression = decodeVueDirectiveExpression(match[2]?.trim() ?? '');

    if (expression) {
      expressions.push(expression);
    }
  }

  return expressions;
}

function decodeVueDirectiveExpression(expression: string): string {
  return expression.replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function scanVueExpression(expression: string, filePath: string, line: number): ComponentSignalFinding[] {
  const findings = scanVueStructuralSignals(expression, filePath, line);

  for (const identifier of collectExpressionIdentifiers(expression)) {
    for (const matcher of signalMatchers) {
      if (!matcher.pattern.test(identifier)) {
        continue;
      }

      findings.push({
        kind: matcher.kind,
        identifier,
        filePath,
        line,
        evidence: expression.replace(/\s+/g, ' ').trim()
      });
    }
  }

  return findings;
}

function scanVueStructuralSignals(expression: string, filePath: string, line: number): ComponentSignalFinding[] {
  const findings: ComponentSignalFinding[] = [];
  const emptyIdentifier = extractEmptyComparisonIdentifier(expression);

  if (emptyIdentifier) {
    findings.push({
      kind: 'empty',
      identifier: emptyIdentifier,
      filePath,
      line,
      evidence: expression.replace(/\s+/g, ' ').trim()
    });
  }

  const responsiveIdentifier = extractResponsiveComparisonIdentifier(expression);

  if (responsiveIdentifier) {
    findings.push({
      kind: 'responsive',
      identifier: responsiveIdentifier,
      filePath,
      line,
      evidence: expression.replace(/\s+/g, ' ').trim()
    });
  }

  const localeIdentifier = extractLocaleComparisonIdentifier(expression);

  if (localeIdentifier) {
    findings.push({
      kind: 'locale',
      identifier: localeIdentifier,
      filePath,
      line,
      evidence: expression.replace(/\s+/g, ' ').trim()
    });
  }

  return findings;
}

function collectExpressionIdentifiers(expression: string): string[] {
  const sanitizedExpression = expression.replace(/(['"])(?:\\.|(?!\1).)*\1/g, ' ');
  const matches = sanitizedExpression.match(identifierPattern) ?? [];
  const uniqueIdentifiers = new Set<string>();

  for (const identifier of matches) {
    if (ignoredExpressionIdentifiers.has(identifier)) {
      continue;
    }

    uniqueIdentifiers.add(identifier);
  }

  return [...uniqueIdentifiers];
}

function extractEmptyComparisonIdentifier(expression: string): string | null {
  const compactExpression = expression.replace(/\s+/g, '');
  const match = /([A-Za-z_$][\w$]*(?:\.(?:length|size|count|total)))((===|==|<=|<)0)|0((===|==|>=|>)\1)/.exec(
    compactExpression
  );

  return match?.[1] ?? null;
}

function getResponsiveComparisonIdentifier(expression: Node): string | null {
  return extractBinaryComparisonIdentifier(expression, isResponsiveStringLiteral, isResponsiveIdentifier);
}

function getLocaleComparisonIdentifier(expression: Node): string | null {
  return extractBinaryComparisonIdentifier(expression, isLocaleStringLiteral, isLocaleIdentifier);
}

function extractBinaryComparisonIdentifier(
  expression: Node,
  matchesLiteral: (node: Node) => boolean,
  matchesIdentifier: (node: Node) => boolean
): string | null {
  if (!Node.isBinaryExpression(expression)) {
    return null;
  }

  const operator = expression.getOperatorToken().getKind();

  if (
    operator !== SyntaxKind.EqualsEqualsEqualsToken &&
    operator !== SyntaxKind.EqualsEqualsToken &&
    operator !== SyntaxKind.ExclamationEqualsEqualsToken &&
    operator !== SyntaxKind.ExclamationEqualsToken
  ) {
    return null;
  }

  const left = expression.getLeft();
  const right = expression.getRight();

  if (matchesLiteral(right) && matchesIdentifier(left)) {
    return left.getText();
  }

  if (matchesLiteral(left) && matchesIdentifier(right)) {
    return right.getText();
  }

  return null;
}

function isResponsiveStringLiteral(node: Node): boolean {
  return (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) && responsiveLiteralPattern.test(node.getLiteralText());
}

function isLocaleStringLiteral(node: Node): boolean {
  return (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) && localeLiteralPattern.test(node.getLiteralText());
}

function isResponsiveIdentifier(node: Node): boolean {
  return /breakpoint|viewport|screen|device|mobile|tablet|desktop|responsive|sidebar|nav|menu|layout/i.test(node.getText());
}

function isLocaleIdentifier(node: Node): boolean {
  return /locale|locales|language|lang|i18n|intl|rtl|ltr|direction|dir/i.test(node.getText());
}

function extractResponsiveComparisonIdentifier(expression: string): string | null {
  return extractStringComparisonIdentifier(expression, responsiveLiteralPattern, isResponsiveIdentifierText);
}

function extractLocaleComparisonIdentifier(expression: string): string | null {
  return extractStringComparisonIdentifier(expression, localeLiteralPattern, isLocaleIdentifierText);
}

function extractStringComparisonIdentifier(
  expression: string,
  literalPattern: RegExp,
  isMatchingIdentifier: (value: string) => boolean
): string | null {
  const comparisonPattern = /([A-Za-z_$][\w$.]*)\s*(===|==|!==|!=)\s*['"]([^'"]+)['"]|['"]([^'"]+)['"]\s*(===|==|!==|!=)\s*([A-Za-z_$][\w$.]*)/;
  const match = comparisonPattern.exec(expression);

  if (!match) {
    return null;
  }

  const identifier = match[1] ?? match[6] ?? '';
  const literalValue = match[3] ?? match[4] ?? '';

  if (!literalPattern.test(literalValue) || !isMatchingIdentifier(identifier)) {
    return null;
  }

  return identifier;
}

function isResponsiveIdentifierText(value: string): boolean {
  return /breakpoint|viewport|screen|device|mobile|tablet|desktop|responsive|sidebar|nav|menu|layout/i.test(value);
}

function isLocaleIdentifierText(value: string): boolean {
  return /locale|locales|language|lang|i18n|intl|rtl|ltr|direction|dir/i.test(value);
}