import { normalize, PathFragment, template } from '@angular-devkit/core';
import { classify, dasherize } from '@angular-devkit/core/src/utils/strings';
import { apply, applyTemplates, DirEntry, FileEntry, move, SchematicContext, Source, strings, Tree, url } from '@angular-devkit/schematics';
import * as prettier from 'prettier';
import { BuiltInParserName, LiteralUnion } from 'prettier';
import { Identifier, ModuleDeclaration, Node, SourceFile, SyntaxKind } from 'typescript';
import { parse } from 'url';

import { findNodeByName, findNodes, isNamedNode } from './ast-utils';

export namespace SchematicsUtils {
  export function getImportPosition(sourceFile: SourceFile): number {
    const importNodes: Node[] = findNodes(sourceFile, SyntaxKind.ImportDeclaration, 9999, false);
    const lastImport: Node | undefined = importNodes.slice().pop();
    return lastImport ? lastImport.end : 0;
  }

  export function createImport(modelName: string, path: string): string {
    return `import { ${ classify(modelName) } } from '${ path }';\n`;
  }

  export async function formatFile(tree: Tree, filepath: string, parser: LiteralUnion<BuiltInParserName> = 'typescript'): Promise<void> {
    const content: string = await prettier.format(tree.readText(filepath), {
      filepath,
      singleQuote: true,
      tabWidth: 2,
      printWidth: 140,
      semi: true,
      useTabs: false,
      arrowParens: 'always',
      trailingComma: 'all',
      bracketSpacing: true,
      bracketSameLine: false,
      singleAttributePerLine: true,
      parser,
    });

    tree.overwrite(filepath, content);
  }

  export function toPlainText(str: string): string {
    return dasherize(str).replaceAll(/-/g, ' ');
  }

  export function getPayloadModelSource(name: string, path: string, content: string | undefined, imports: string | undefined): Source {
    return apply(url('./files/common/models'), [
      applyTemplates({
        classify: strings.classify,
        dasherize: strings.dasherize,
        name,
        content,
        imports,
      }),
      move(normalize(`${ path }/payloads`)),
    ]);
  }

  export function findFileInDir(tree: Tree, folderPath: string, pattern: string): PathFragment | undefined {
    const dir: DirEntry = tree.getDir(folderPath);

    return dir.subfiles.find((fragment: PathFragment) => fragment.endsWith(pattern));
  }

  export function findActionNodeToUpdate(sourceFile: SourceFile, rootActionNodeName: string, actionNodesNames: string[]): Node {
    const fullActionNestingItems: string[] = [rootActionNodeName, ...actionNodesNames].slice().reverse().splice(1).reverse().map(classify);

    return findActionNodeToUpdatingFromSource(sourceFile, fullActionNestingItems) as ModuleDeclaration;
  }

  export function getActionNodeNameToInsert(node: Node, actionNodesNames: string[]): string[] {
    if (!isNamedNode(node)) {
      throw new Error('Node has not name, but required!');
    }

    const actionNodeName: string = (node.name as Identifier).escapedText as string;

    const index: number = actionNodesNames.map(classify).indexOf(actionNodeName) + 1;

    return actionNodesNames.slice().map(classify).splice(index);
  }

  export function createActionPayloadModelName(actionNestingNodesNames: string[]): string {
    return classify([...actionNestingNodesNames, 'payload'].join('-'));
  }

  export function resolveTemplateContent<T = unknown>(templatePath: string, context: SchematicContext, options: T): string {
    const schematicsTree: Tree = context.engine.createSourceFromUrl(parse('./'), context)(context) as Tree;
    const decoder: TextDecoder = new TextDecoder('utf-8', { fatal: true });

    const entry: FileEntry | null = schematicsTree.get(templatePath);
    if (!entry) {
      throw new Error('entry is NULL');
    }

    return template(decoder.decode(entry.content).replace(/\n/, ''))(options);
  }

  export function findActionNodeToUpdatingFromSource(node: Node, _actionsNestingNames: string[]): Node {
    const action: string | undefined = _actionsNestingNames && _actionsNestingNames[0];

    if (!action) {
      return node;
    }

    const findResult: Node | null = findNodeByName(node, SyntaxKind.ModuleDeclaration, action);
    if (findResult) {
      return findActionNodeToUpdatingFromSource(findResult, _actionsNestingNames.slice().splice(1));
    }

    return node;
  }
}
