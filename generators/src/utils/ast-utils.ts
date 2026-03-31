/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as ts from 'typescript';

import { Change, InsertChange, NoopChange } from './change';

/**
 * Add Import `import { symbolName } from fileName` if the import doesn't exit
 * already. Assumes fileToEdit can be resolved and accessed.
 * @param fileToEdit File we want to add import to.
 * @param symbolName Item to import.
 * @param fileName Path to the file.
 * @param isDefault If true, import follows style for importing default exports.
 * @param alias Alias that the symbol should be inserted under.
 * @return Change
 */
export function insertImport(
  source: ts.SourceFile,
  fileToEdit: string,
  symbolName: string,
  fileName: string,
  isDefault = false,
  alias?: string,
): Change {
  const rootNode = source;
  const allImports = findNodes(rootNode, ts.isImportDeclaration);
  const importExpression = alias ? `${ symbolName } as ${ alias }` : symbolName;

  // get nodes that map to import statements from the file fileName
  const relevantImports = allImports.filter((node) => {
    return ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text === fileName;
  });

  if (relevantImports.length > 0) {
    const hasNamespaceImport = relevantImports.some((node) => {
      return node.importClause?.namedBindings?.kind === ts.SyntaxKind.NamespaceImport;
    });

    // if imports * from fileName, don't add symbolName
    if (hasNamespaceImport) {
      return new NoopChange();
    }

    const imports = relevantImports.flatMap((node) => {
      return node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        ? node.importClause.namedBindings.elements
        : [];
    });

    // insert import if it's not there
    if (!imports.some((node) => (node.propertyName || node.name).text === symbolName)) {
      const fallbackPos =
        findNodes(relevantImports[0], ts.SyntaxKind.CloseBraceToken)[0].getStart() ||
        findNodes(relevantImports[0], ts.SyntaxKind.FromKeyword)[0].getStart();

      return insertAfterLastOccurrence(imports, `, ${ importExpression }`, fileToEdit, fallbackPos);
    }

    return new NoopChange();
  }

  // no such import declaration existss
  const useStrict = findNodes(rootNode, ts.isStringLiteral).filter((n) => n.text === 'use strict');
  let fallbackPos = 0;
  if (useStrict.length > 0) {
    fallbackPos = useStrict[0].end;
  }
  const open = isDefault ? '' : '{ ';
  const close = isDefault ? '' : ' }';
  // if there are no imports or 'use strict' statement, insert import at beginning of file
  const insertAtBeginning = allImports.length === 0 && useStrict.length === 0;
  const separator = insertAtBeginning ? '' : ';\n';
  const toInsert = `${ separator }import ${ open }${ importExpression }${ close }` + ` from '${ fileName }'${ insertAtBeginning ? ';\n' : '' }`;

  return insertAfterLastOccurrence(allImports, toInsert, fileToEdit, fallbackPos, ts.SyntaxKind.StringLiteral);
}

export function findNodes<T extends ts.Node>(
  node: ts.Node,
  kindOrGuard: ts.SyntaxKind | ((node: ts.Node) => node is T),
  max = Infinity,
  recursive = false,
): T[] {
  if (!node || max == 0) {
    return [];
  }

  const test = typeof kindOrGuard === 'function' ? kindOrGuard : (node: ts.Node): node is T => node.kind === kindOrGuard;

  const arr: T[] = [];
  if (test(node)) {
    arr.push(node);
    max--;
  }

  if (max > 0 && (recursive || !test(node))) {
    node.forEachChild((child) => {
      findNodes(child, test, max, recursive).forEach((node) => {
        if (max > 0) {
          arr.push(node);
        }
        max--;
      });

      if (max <= 0) {
        return;
      }
    });
  }

  return arr;
}

/**
 * Get all the nodes from a source.
 * @param sourceFile The source file object.
 * @returns {Array<ts.Node>} An array of all the nodes in the source.
 */
export function getSourceNodes(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [sourceFile];
  const result: ts.Node[] = [];

  while (nodes.length > 0) {
    const node = nodes.shift();

    if (node) {
      result.push(node);
      if (node.getChildCount(sourceFile) >= 0) {
        nodes.unshift(...node.getChildren());
      }
    }
  }

  return result;
}

export function findNode(node: ts.Node, kind: ts.SyntaxKind, text: string): ts.Node | null {
  if (node.kind === kind && node.getText() === text) {
    return node;
  }

  let foundNode: ts.Node | null = null;
  ts.forEachChild(node, (childNode) => {
    foundNode = foundNode || findNode(childNode, kind, text);
  });

  return foundNode;
}

export function findNodeByName(node: ts.Node, kind: ts.SyntaxKind, name: string): ts.Node | null {
  try {
    if (node.kind === kind && isNamedNode(node) && node.name.escapedText === name) {
      return node;
    }

    let foundNode: ts.Node | null = null;
    ts.forEachChild(node, (childNode) => {
      foundNode = foundNode || findNodeByName(childNode, kind, name);
    });

    return foundNode;
  } catch (e) {
    console.log(e);
  }

  return null;
}

/**
 * Helper for sorting nodes.
 * @return function to sort nodes in increasing order of position in sourceFile
 */
function nodesByPosition(first: ts.Node, second: ts.Node): number {
  return first.getStart() - second.getStart();
}

/**
 * Insert `toInsert` after the last occurence of `ts.SyntaxKind[nodes[i].kind]`
 * or after the last of occurence of `syntaxKind` if the last occurence is a sub child
 * of ts.SyntaxKind[nodes[i].kind] and save the changes in file.
 *
 * @param nodes insert after the last occurence of nodes
 * @param toInsert string to insert
 * @param file file to insert changes into
 * @param fallbackPos position to insert if toInsert happens to be the first occurence
 * @param syntaxKind the ts.SyntaxKind of the subchildren to insert after
 * @return Change instance
 * @throw Error if toInsert is first occurence but fall back is not set
 */
export function insertAfterLastOccurrence(
  nodes: ts.Node[] | ts.NodeArray<ts.Node>,
  toInsert: string,
  file: string,
  fallbackPos: number,
  syntaxKind?: ts.SyntaxKind,
): Change {
  let lastItem: ts.Node | undefined;
  for (const node of nodes) {
    if (!lastItem || lastItem.getStart() < node.getStart()) {
      lastItem = node;
    }
  }
  if (syntaxKind && lastItem) {
    lastItem = findNodes(lastItem, syntaxKind).sort(nodesByPosition).pop();
  }
  if (!lastItem && fallbackPos == undefined) {
    throw new Error(`tried to insert ${ toInsert } as first occurence with no fallback position`);
  }
  const lastItemPosition: number = lastItem ? lastItem.getEnd() : fallbackPos;

  return new InsertChange(file, lastItemPosition, toInsert);
}

/**
 * Determine if an import already exists.
 */
export function isImported(source: ts.SourceFile, classifiedName: string, importPath: string): boolean {
  const allNodes = getSourceNodes(source);
  const matchingNodes = allNodes
    .filter(ts.isImportDeclaration)
    .filter((imp) => ts.isStringLiteral(imp.moduleSpecifier) && imp.moduleSpecifier.text === importPath)
    .filter((imp) => {
      if (!imp.importClause) {
        return false;
      }
      const nodes = findNodes(imp.importClause, ts.isImportSpecifier).filter((n) => n.getText() === classifiedName);

      return nodes.length > 0;
    });

  return matchingNodes.length > 0;
}

/** Asserts if the specified node is a named declaration (e.g. class, interface). */
export function isNamedNode(node: ts.Node & { name?: ts.Node }): node is ts.Node & { name: ts.Identifier } {
  return !!node.name && ts.isIdentifier(node.name);
}

/**
 * Determines if a SourceFile has a top-level declaration whose name matches a specific symbol.
 * Can be used to avoid conflicts when inserting new imports into a file.
 * @param sourceFile File in which to search.
 * @param symbolName Name of the symbol to search for.
 * @param skipModule Path of the module that the symbol may have been imported from. Used to
 * avoid false positives where the same symbol we're looking for may have been imported.
 */
export function hasTopLevelIdentifier(sourceFile: ts.SourceFile, symbolName: string, skipModule: string | null = null): boolean {
  for (const node of sourceFile.statements) {
    if (isNamedNode(node) && node.name.text === symbolName) {
      return true;
    }

    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some((decl) => {
        return isNamedNode(decl) && decl.name.text === symbolName;
      })
    ) {
      return true;
    }

    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      node.moduleSpecifier.text !== skipModule &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some((el) => el.name.text === symbolName)
    ) {
      return true;
    }
  }

  return false;
}
