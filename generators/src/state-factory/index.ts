import { normalize, PathFragment } from '@angular-devkit/core';
import { classify, dasherize } from '@angular-devkit/core/src/utils/strings';
import {
  apply,
  applyTemplates,
  chain,
  empty,
  externalSchematic,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  Source,
  strings,
  Tree,
  UpdateRecorder,
  url,
} from '@angular-devkit/schematics';
import { createSourceFile, Node, ScriptTarget, SourceFile, SyntaxKind } from 'typescript';

import { findNodes, isNamedNode } from '../utils/ast-utils';
import { AsyncStateActionUtils } from '../utils/async-state-action-utils';
import { SchematicsUtils } from '../utils/schematics-utils';
import { SimpleStateActionUtils } from '../utils/simple-state-action-utils';
import { AddAsyncStateActionSchemaModel } from './models/add-async-state-action-schema-model';
import { AddStateActionSchemaModel } from './models/add-state-action-schema-model';
import { InitStateSchemaModel } from './models/init-state-schema-model';

export function initState(options: InitStateSchemaModel): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    const templateSource: Source = apply(url('./files/init-state'), [
      applyTemplates({
        classify: strings.classify,
        dasherize: strings.dasherize,
        camelize: strings.camelize,
        name: options.name,
      }),
      move(normalize(`${ options.path }`)),
    ]);

    return chain([mergeWith(templateSource)]);
  };
}

export function addStateAction(options: AddStateActionSchemaModel): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    const normalizedStateFolderPath: string = normalize(`${ options.path }`);

    /* Add action */
    const actionTsFileName: PathFragment | undefined = SchematicsUtils.findFileInDir(tree, normalizedStateFolderPath, '-actions.ts');

    if (!actionTsFileName) {
      throw new Error('*-actions.ts file not found!');
    }

    const actionTsFilePath: string = normalize(`${ normalizedStateFolderPath }/${ actionTsFileName }`);

    /* 'a.b.c -> ['a', 'b', 'c'] */
    const actionNestingNodesNames: string[] = options.name.split('.');
    /* 'a.b.c -> a */
    const topLevelActionNestingNodeName: string | undefined = actionNestingNodesNames.slice().shift();
    const actionPayloadModelName: string = SchematicsUtils.createActionPayloadModelName(actionNestingNodesNames);

    const actionTsFileSourceFile: SourceFile = createSourceFile(actionTsFileName, tree.readText(actionTsFilePath), ScriptTarget.Latest);

    const [rootActionNestingNode]: Node[] = findNodes(actionTsFileSourceFile, SyntaxKind.ModuleDeclaration, 1, false);
    const rootActionNestingNodeName: string =
      (isNamedNode(rootActionNestingNode) && (rootActionNestingNode.name.escapedText as string)) || '';

    const actionFullName: string = [rootActionNestingNodeName, ...actionNestingNodesNames].map(classify).join('.');

    const nodeToUpdate: Node = SchematicsUtils.findActionNodeToUpdate(
      actionTsFileSourceFile,
      rootActionNestingNodeName,
      actionNestingNodesNames,
    );

    const actionNodeNameToInsert: string[] = SchematicsUtils.getActionNodeNameToInsert(nodeToUpdate, actionNestingNodesNames);

    const actionTsFileContentToUpdate: string = SimpleStateActionUtils.createActionNodes({
      actionNodeNameToInsert: actionNodeNameToInsert,
      context,
      withPayload: options.withPayload,
      rootActionNestingNodeName,
      topLevelActionNestingNodeName,
      typeDescription: SchematicsUtils.toPlainText(actionNestingNodesNames.join('-')),
      payloadActonName: options.withPayload ? actionPayloadModelName : undefined,
    });

    const actionTsFileUpdateRecorder: UpdateRecorder = tree.beginUpdate(actionTsFilePath);

    const actionTsFileInsertPosition: number = nodeToUpdate.end - 1;
    actionTsFileUpdateRecorder.insertLeft(actionTsFileInsertPosition, '\n' + actionTsFileContentToUpdate);

    /* Add payload */
    let actionPayloadModelSource: Source = empty();
    if (options.withPayload) {
      actionPayloadModelSource = SchematicsUtils.getPayloadModelSource(
        actionPayloadModelName,
        normalizedStateFolderPath,
        options.payloadContent,
        options.payloadImports,
      );

      const importPosition: number = SchematicsUtils.getImportPosition(actionTsFileSourceFile);
      const importContent: string = SchematicsUtils.createImport(actionPayloadModelName, `./payloads/${ dasherize(actionPayloadModelName) }`);
      actionTsFileUpdateRecorder.insertLeft(importPosition, importContent + (importPosition ? '' : '\n'));
    }

    tree.commitUpdate(actionTsFileUpdateRecorder);

    await SchematicsUtils.formatFile(tree, actionTsFilePath);

    /* Add state method */
    await SimpleStateActionUtils.updateState({
      tree,
      context,
      withPayload: options.withPayload,
      actionPayloadModelName,
      actionName: actionFullName,
      stateFolderPath: normalizedStateFolderPath,
      actionNestingNodesNames,
      actionContent: options.content,
    });

    /* Add action effect */
    if (options.withEffect) {
      await SimpleStateActionUtils.updateEffect({
        tree,
        context,
        withPayload: options.withPayload,
        stateFolderPath: normalizedStateFolderPath,
        actionPayloadModelName,
        actionNestingNodesNames,
        actionName: actionFullName,
      });
    }

    return chain([mergeWith(actionPayloadModelSource)]);
  };
}

export function addAsyncStateAction(options: AddAsyncStateActionSchemaModel): Rule {
  return async (tree: Tree, context: SchematicContext) => {
    const normalizedStateFolderPath: string = normalize(`${ options.path }`);

    /* Add action */
    const actionTsFileName: PathFragment | undefined = SchematicsUtils.findFileInDir(tree, normalizedStateFolderPath, '-actions.ts');

    if (!actionTsFileName) {
      throw new Error('*-actions.ts file not found!');
    }

    const actionTsFilePath: string = normalize(`${ normalizedStateFolderPath }/${ actionTsFileName }`);

    /* 'a.b.c -> ['a', 'b', 'c'] */
    const actionNestingNodesNames: string[] = options.name.split('.');
    const actionPayloadModelName: string = SchematicsUtils.createActionPayloadModelName(actionNestingNodesNames);

    const actionTsFileSourceFile: SourceFile = createSourceFile(actionTsFileName, tree.readText(actionTsFilePath), ScriptTarget.Latest);

    const [rootActionNestingNode]: Node[] = findNodes(actionTsFileSourceFile, SyntaxKind.ModuleDeclaration, 1, false);
    const rootActionNestingNodeName: string =
      (isNamedNode(rootActionNestingNode) && (rootActionNestingNode.name.escapedText as string)) || '';

    const actionFullName: string = [rootActionNestingNodeName, ...actionNestingNodesNames].map(classify).join('.');

    await AsyncStateActionUtils.updateEffect({
      tree,
      context,
      requestWithPayload: options.requestWithPayload,
      successWithPayload: options.successWithPayload,
      failureWithPayload: options.failureWithPayload,
      stateFolderPath: normalizedStateFolderPath,
      actionPayloadModelName,
      actionNestingNodesNames,
      actionName: actionFullName,
    });

    return chain([
      externalSchematic('generators', 'add-state-action', {
        name: `${ options.name }.request`,
        path: options.path,
        withPayload: options.requestWithPayload,
        withEffect: false,
      }),
      externalSchematic('generators', 'add-state-action', {
        name: `${ options.name }.success`,
        path: options.path,
        withPayload: options.successWithPayload,
        withEffect: false,
      }),
      externalSchematic('generators', 'add-state-action', {
        name: `${ options.name }.failure`,
        path: options.path,
        withPayload: options.failureWithPayload,
        withEffect: false,
      }),
    ]);
  };
}
