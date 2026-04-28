#!/usr/bin/env ts-node
/**
 * extract-declarations.ts
 *
 * Uses TypeScript Compiler API to extract declarations from a target directory,
 * stripping all implementations.
 *
 * Extracted:
 *  - Class / abstract-class signatures (properties, constructors, methods, accessors)
 *  - Interface members
 *  - Exported type aliases and enums
 *  - Exported function signatures
 *  - Exported constants (name + type annotation)
 *  - JSDoc comments on any of the above
 *
 * Angular-specific structures (ProjectStructure):
 *  - @NgModule  -> modules[]
 *  - @Component -> components[]
 *  - @Injectable -> services[]
 *  - Routes variable -> routes[]
 *
 * Usage (CLI):
 *   npx ts-node extract-declarations.ts <sourceDir> [output.json] [declarations.txt]
 *
 * Usage (API):
 *   import { extractDeclarations } from './extract-declarations';
 *   const { text, structure } = extractDeclarations('./src');
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type ProjectStructure = {
  modules: NgModule[];
  components: NgComponent[];
  services: NgService[];
  routes: NgRoute[];
};

export type NgModule = {
  name: string;
  file: string;
  declarations: string[];
  imports: string[];
};

export type NgComponent = {
  name: string;
  selector?: string;
  templateUrl?: string;
  file: string;
};

export type NgService = {
  name: string;
  providedIn?: string;
};

export type NgRoute = {
  path: string;
  component?: string;
  loadChildren?: string;
};

export type ExtractionResult = {
  /** Human-readable declarations text (one block per file) */
  text: string;
  /** Structured Angular project model */
  structure: ProjectStructure;
};

// ─── File collection ──────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.github', 'coverage', 'tmp', '.cache']);

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    if (!fs.existsSync(current)) return;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.spec.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// ─── AST helpers ──────────────────────────────────────────────────────────────

/** Returns the leading JSDoc comment (/** ... *\/) for a node, if present. */
function getJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string {
  const fullText = sourceFile.getFullText();
  const trivia = fullText.substring(node.getFullStart(), node.getStart(sourceFile));
  const match = trivia.match(/\/\*\*[\s\S]*?\*\//);
  return match ? match[0].trim() : '';
}

/** Returns space-joined modifier keywords for a node. */
function getModifiersText(node: ts.Node): string {
  if (!ts.canHaveModifiers(node)) return '';
  const mods = ts.getModifiers(node);
  if (!mods) return '';

  const parts: string[] = [];
  for (const mod of mods) {
    switch (mod.kind) {
      case ts.SyntaxKind.ExportKeyword:    parts.push('export');    break;
      case ts.SyntaxKind.DefaultKeyword:   parts.push('default');   break;
      case ts.SyntaxKind.DeclareKeyword:   parts.push('declare');   break;
      case ts.SyntaxKind.AbstractKeyword:  parts.push('abstract');  break;
      case ts.SyntaxKind.PublicKeyword:    parts.push('public');    break;
      case ts.SyntaxKind.PrivateKeyword:   parts.push('private');   break;
      case ts.SyntaxKind.ProtectedKeyword: parts.push('protected'); break;
      case ts.SyntaxKind.StaticKeyword:    parts.push('static');    break;
      case ts.SyntaxKind.ReadonlyKeyword:  parts.push('readonly');  break;
      case ts.SyntaxKind.AsyncKeyword:     parts.push('async');     break;
      case ts.SyntaxKind.OverrideKeyword:  parts.push('override');  break;
    }
  }
  return parts.join(' ');
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return ts.getModifiers(node)?.some(m => m.kind === kind) ?? false;
}

/** Renders a parameter list to string. */
function getParamsText(
  params: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile,
): string {
  return params
    .map(p => {
      const rest     = p.dotDotDotToken ? '...' : '';
      const name     = p.name.getText(sourceFile);
      const optional = p.questionToken ? '?' : '';
      const type     = p.type ? ': ' + p.type.getText(sourceFile) : '';
      return `${rest}${name}${optional}${type}`;
    })
    .join(', ');
}

/** Renders generic type-parameter list (e.g. `<T extends Foo, U = Bar>`). */
function getTypeParamsText(
  typeParams: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
  sourceFile: ts.SourceFile,
): string {
  if (!typeParams?.length) return '';
  const inner = typeParams
    .map(tp => {
      let text = tp.name.getText(sourceFile);
      if (tp.constraint) text += ' extends ' + tp.constraint.getText(sourceFile);
      if (tp.default)    text += ' = '       + tp.default.getText(sourceFile);
      return text;
    })
    .join(', ');
  return `<${inner}>`;
}

/** Renders heritage clauses (extends / implements). */
function getHeritageText(
  clauses: ts.NodeArray<ts.HeritageClause> | undefined,
  sourceFile: ts.SourceFile,
): string {
  if (!clauses?.length) return '';
  return ' ' + clauses
    .map(clause => {
      const keyword = clause.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements';
      return `${keyword} ${clause.types.map(t => t.getText(sourceFile)).join(', ')}`;
    })
    .join(' ');
}

// ─── Angular decorator helpers ────────────────────────────────────────────────

function getDecorators(node: ts.ClassDeclaration): readonly ts.Decorator[] {
  if (!ts.canHaveDecorators(node)) return [];
  return ts.getDecorators(node) ?? [];
}

function getDecoratorName(decorator: ts.Decorator): string | undefined {
  const expr = decorator.expression;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) return expr.expression.text;
  if (ts.isIdentifier(expr)) return expr.text;
  return undefined;
}

function getDecoratorArg(decorator: ts.Decorator): ts.ObjectLiteralExpression | undefined {
  if (!ts.isCallExpression(decorator.expression)) return undefined;
  const first = decorator.expression.arguments[0];
  return first && ts.isObjectLiteralExpression(first) ? first : undefined;
}

function getObjPropString(
  obj: ts.ObjectLiteralExpression,
  key: string,
  sourceFile: ts.SourceFile,
): string | undefined {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (prop.name.getText(sourceFile) !== key) continue;
    if (ts.isStringLiteral(prop.initializer)) return prop.initializer.text;
    // Arrow functions, identifiers, etc. — return raw text stripped of quotes.
    return prop.initializer.getText(sourceFile).replace(/^['"`]|['"`]$/g, '');
  }
  return undefined;
}

function getObjPropStringArray(
  obj: ts.ObjectLiteralExpression,
  key: string,
  sourceFile: ts.SourceFile,
): string[] {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (prop.name.getText(sourceFile) !== key) continue;
    if (ts.isArrayLiteralExpression(prop.initializer)) {
      return prop.initializer.elements
        .filter((el): el is ts.Identifier => ts.isIdentifier(el))
        .map(el => el.text);
    }
  }
  return [];
}

// ─── Routes extraction ────────────────────────────────────────────────────────

function extractRoutes(
  arr: ts.ArrayLiteralExpression,
  sourceFile: ts.SourceFile,
): NgRoute[] {
  const routes: NgRoute[] = [];

  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;

    const routePath = getObjPropString(el, 'path', sourceFile);
    if (routePath === undefined) continue;

    const component    = getObjPropString(el, 'component', sourceFile);
    const loadChildren = getObjPropString(el, 'loadChildren', sourceFile);
    routes.push({ path: routePath, component, loadChildren });

    // Recurse into children array
    for (const prop of el.properties) {
      if (
        ts.isPropertyAssignment(prop) &&
        prop.name.getText(sourceFile) === 'children' &&
        ts.isArrayLiteralExpression(prop.initializer)
      ) {
        routes.push(...extractRoutes(prop.initializer, sourceFile));
      }
    }
  }

  return routes;
}

// ─── Per-file extraction ──────────────────────────────────────────────────────

type FileResult = {
  relPath:      string;
  declarations: string;
  module?:      NgModule;
  component?:   NgComponent;
  service?:     NgService;
  routes?:      NgRoute[];
};

function extractFromFile(filePath: string, rootDir: string): FileResult {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const lines: string[] = [];

  let module:    NgModule    | undefined;
  let component: NgComponent | undefined;
  let service:   NgService   | undefined;
  let routes:    NgRoute[]   | undefined;

  // ── Class member renderer ────────────────────────────────────────────────

  function renderClassMember(member: ts.ClassElement): void {
    const jsdoc = getJsDoc(member, sourceFile);
    if (jsdoc) lines.push('  ' + jsdoc.replace(/\n/g, '\n  '));

    if (ts.isConstructorDeclaration(member)) {
      const params = getParamsText(member.parameters, sourceFile);
      lines.push(`  constructor(${params});`);
      return;
    }

    if (ts.isMethodDeclaration(member) && member.name) {
      const mods       = getModifiersText(member);
      const name       = member.name.getText(sourceFile);
      const typeParams = getTypeParamsText(member.typeParameters, sourceFile);
      const params     = getParamsText(member.parameters, sourceFile);
      const retType    = member.type ? ': ' + member.type.getText(sourceFile) : '';
      const optional   = member.questionToken ? '?' : '';
      const prefix     = mods ? mods + ' ' : '';
      lines.push(`  ${prefix}${name}${optional}${typeParams}(${params})${retType};`);
      return;
    }

    if (ts.isPropertyDeclaration(member) && member.name) {
      const mods     = getModifiersText(member);
      const name     = member.name.getText(sourceFile);
      const optional = member.questionToken  ? '?' : '';
      const exclaim  = member.exclamationToken ? '!' : '';
      const type     = member.type ? ': ' + member.type.getText(sourceFile) : '';
      const prefix   = mods ? mods + ' ' : '';
      lines.push(`  ${prefix}${name}${optional}${exclaim}${type};`);
      return;
    }

    if (ts.isGetAccessorDeclaration(member) && member.name) {
      const mods    = getModifiersText(member);
      const name    = member.name.getText(sourceFile);
      const retType = member.type ? ': ' + member.type.getText(sourceFile) : '';
      const prefix  = mods ? mods + ' ' : '';
      lines.push(`  ${prefix}get ${name}()${retType};`);
      return;
    }

    if (ts.isSetAccessorDeclaration(member) && member.name) {
      const mods   = getModifiersText(member);
      const name   = member.name.getText(sourceFile);
      const params = getParamsText(member.parameters, sourceFile);
      const prefix = mods ? mods + ' ' : '';
      lines.push(`  ${prefix}set ${name}(${params});`);
      return;
    }

    if (ts.isIndexSignatureDeclaration(member)) {
      const params  = getParamsText(member.parameters, sourceFile);
      const retType = member.type ? ': ' + member.type.getText(sourceFile) : '';
      lines.push(`  [${params}]${retType};`);
      return;
    }

    if (ts.isSemicolonClassElement(member)) return;

    // Fallback: raw text (e.g. class static blocks — omit)
  }

  // ── Visitor ──────────────────────────────────────────────────────────────

  function visitNode(node: ts.Node): void {

    // ── Class declaration ──────────────────────────────────────────────────
    if (ts.isClassDeclaration(node) && node.name) {
      const jsdoc      = getJsDoc(node, sourceFile);
      const mods       = getModifiersText(node);
      const name       = node.name.getText(sourceFile);
      const typeParams = getTypeParamsText(node.typeParameters, sourceFile);
      const heritage   = getHeritageText(node.heritageClauses, sourceFile);
      const prefix     = mods ? mods + ' ' : '';

      if (jsdoc) lines.push(jsdoc);
      lines.push(`${prefix}class ${name}${typeParams}${heritage} {`);
      node.members.forEach(renderClassMember);
      lines.push('}');
      lines.push('');

      // Angular structure extraction
      for (const dec of getDecorators(node)) {
        const decName = getDecoratorName(dec);
        const decArg  = getDecoratorArg(dec);

        if (decName === 'NgModule' && decArg) {
          module = {
            name,
            file:         relPath,
            declarations: getObjPropStringArray(decArg, 'declarations', sourceFile),
            imports:      getObjPropStringArray(decArg, 'imports', sourceFile),
          };
        }

        if (decName === 'Component' && decArg) {
          component = {
            name,
            file:        relPath,
            selector:    getObjPropString(decArg, 'selector', sourceFile),
            templateUrl: getObjPropString(decArg, 'templateUrl', sourceFile),
          };
        }

        if (decName === 'Injectable') {
          service = {
            name,
            providedIn: decArg ? getObjPropString(decArg, 'providedIn', sourceFile) : undefined,
          };
        }
      }
    }

    // ── Interface declaration ──────────────────────────────────────────────
    else if (ts.isInterfaceDeclaration(node)) {
      const jsdoc      = getJsDoc(node, sourceFile);
      const mods       = getModifiersText(node);
      const name       = node.name.getText(sourceFile);
      const typeParams = getTypeParamsText(node.typeParameters, sourceFile);
      const heritage   = getHeritageText(node.heritageClauses, sourceFile);
      const prefix     = mods ? mods + ' ' : '';

      if (jsdoc) lines.push(jsdoc);
      lines.push(`${prefix}interface ${name}${typeParams}${heritage} {`);

      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          const memberName = member.name.getText(sourceFile);
          const optional   = member.questionToken ? '?' : '';
          const type       = member.type ? ': ' + member.type.getText(sourceFile) : '';
          lines.push(`  ${memberName}${optional}${type};`);
        } else if (ts.isMethodSignature(member) && member.name) {
          const memberName = member.name.getText(sourceFile);
          const typeParams = getTypeParamsText(member.typeParameters, sourceFile);
          const params     = getParamsText(member.parameters, sourceFile);
          const retType    = member.type ? ': ' + member.type.getText(sourceFile) : '';
          lines.push(`  ${memberName}${typeParams}(${params})${retType};`);
        } else if (ts.isIndexSignatureDeclaration(member)) {
          const params  = getParamsText(member.parameters, sourceFile);
          const retType = member.type ? ': ' + member.type.getText(sourceFile) : '';
          lines.push(`  [${params}]${retType};`);
        } else if (ts.isCallSignatureDeclaration(member)) {
          const typeParams = getTypeParamsText(member.typeParameters, sourceFile);
          const params     = getParamsText(member.parameters, sourceFile);
          const retType    = member.type ? ': ' + member.type.getText(sourceFile) : '';
          lines.push(`  ${typeParams}(${params})${retType};`);
        } else if (ts.isConstructSignatureDeclaration(member)) {
          const params  = getParamsText(member.parameters, sourceFile);
          const retType = member.type ? ': ' + member.type.getText(sourceFile) : '';
          lines.push(`  new(${params})${retType};`);
        }
      }

      lines.push('}');
      lines.push('');
    }

    // ── Exported type alias ────────────────────────────────────────────────
    else if (ts.isTypeAliasDeclaration(node) && hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      const jsdoc      = getJsDoc(node, sourceFile);
      const name       = node.name.getText(sourceFile);
      const typeParams = getTypeParamsText(node.typeParameters, sourceFile);

      if (jsdoc) lines.push(jsdoc);
      lines.push(`export type ${name}${typeParams} = ${node.type.getText(sourceFile)};`);
      lines.push('');
    }

    // ── Exported enum ──────────────────────────────────────────────────────
    else if (ts.isEnumDeclaration(node) && hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      const jsdoc   = getJsDoc(node, sourceFile);
      const name    = node.name.getText(sourceFile);
      const isConst = hasModifier(node, ts.SyntaxKind.ConstKeyword);

      if (jsdoc) lines.push(jsdoc);
      lines.push(`export ${isConst ? 'const ' : ''}enum ${name} {`);

      for (const member of node.members) {
        const memberName = member.name.getText(sourceFile);
        const value      = member.initializer
          ? ' = ' + member.initializer.getText(sourceFile)
          : '';
        lines.push(`  ${memberName}${value},`);
      }

      lines.push('}');
      lines.push('');
    }

    // ── Exported variable statement (const / let) ──────────────────────────
    else if (
      ts.isVariableStatement(node) &&
      hasModifier(node, ts.SyntaxKind.ExportKeyword)
    ) {
      const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
      const keyword = isConst ? 'const' : 'let';

      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;

        const name = decl.name.getText(sourceFile);
        const type = decl.type ? ': ' + decl.type.getText(sourceFile) : '';

        lines.push(`export ${keyword} ${name}${type};`);

        // Extract routes if variable is typed as Routes
        if (
          decl.type &&
          decl.type.getText(sourceFile).includes('Routes') &&
          decl.initializer &&
          ts.isArrayLiteralExpression(decl.initializer)
        ) {
          routes = extractRoutes(decl.initializer, sourceFile);
        }
      }

      lines.push('');
    }

    // ── Exported function declaration ──────────────────────────────────────
    else if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      hasModifier(node, ts.SyntaxKind.ExportKeyword)
    ) {
      const jsdoc      = getJsDoc(node, sourceFile);
      const name       = node.name.getText(sourceFile);
      const typeParams = getTypeParamsText(node.typeParameters, sourceFile);
      const params     = getParamsText(node.parameters, sourceFile);
      const retType    = node.type ? ': ' + node.type.getText(sourceFile) : '';
      const isAsync    = hasModifier(node, ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
      const isDefault  = hasModifier(node, ts.SyntaxKind.DefaultKeyword) ? 'default ' : '';

      if (jsdoc) lines.push(jsdoc);
      lines.push(`export ${isAsync}${isDefault}function ${name}${typeParams}(${params})${retType};`);
      lines.push('');
    }

    // Recurse into children (handles nested declarations, namespaces, etc.)
    ts.forEachChild(node, visitNode);
  }

  visitNode(sourceFile);

  return {
    relPath,
    declarations: lines.join('\n'),
    module,
    component,
    service,
    routes,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts declarations from all TypeScript files under `rootDir`.
 *
 * @param rootDir - Absolute or relative path to scan.
 * @returns Human-readable declarations text and an Angular ProjectStructure.
 */
export function extractDeclarations(rootDir: string): ExtractionResult {
  const absRoot = path.resolve(rootDir);
  const files   = collectTsFiles(absRoot);

  const textParts: string[]  = [];
  const structure: ProjectStructure = {
    modules:    [],
    components: [],
    services:   [],
    routes:     [],
  };

  for (const filePath of files) {
    const result = extractFromFile(filePath, absRoot);
    if (!result.declarations.trim()) continue;

    textParts.push(`// --- Plik: ${result.relPath} ---`);
    textParts.push(result.declarations);
    textParts.push('');

    if (result.module)    structure.modules.push(result.module);
    if (result.component) structure.components.push(result.component);
    if (result.service)   structure.services.push(result.service);
    if (result.routes)    structure.routes.push(...result.routes);
  }

  return {
    text:      textParts.join('\n'),
    structure,
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const [, , sourceDir, outputJson, outputText] = process.argv;

  if (!sourceDir) {
    console.error('Usage: ts-node extract-declarations.ts <sourceDir> [output.json] [declarations.txt]');
    process.exit(1);
  }

  const jsonPath  = outputJson ?? 'project-structure.json';
  const textPath  = outputText ?? 'declarations.txt';

  console.log(`Scanning: ${path.resolve(sourceDir)}`);
  const result = extractDeclarations(sourceDir);

  fs.writeFileSync(jsonPath, JSON.stringify(result.structure, null, 2), 'utf-8');
  fs.writeFileSync(textPath, result.text, 'utf-8');

  console.log(`\nDone.`);
  console.log(`  Declarations : ${textPath}`);
  console.log(`  Structure    : ${jsonPath}`);
  console.log(`  Components   : ${result.structure.components.length}`);
  console.log(`  Services     : ${result.structure.services.length}`);
  console.log(`  Modules      : ${result.structure.modules.length}`);
  console.log(`  Routes       : ${result.structure.routes.length}`);
}
