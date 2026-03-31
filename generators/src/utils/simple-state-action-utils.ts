import { normalize, PathFragment } from '@angular-devkit/core';
import { camelize, classify, dasherize } from '@angular-devkit/core/src/utils/strings';
import { SchematicContext, strings, Tree, UpdateRecorder } from '@angular-devkit/schematics';
import { createSourceFile, Node, ScriptTarget, SourceFile, SyntaxKind } from 'typescript';

import { findNodes, isNamedNode } from './ast-utils';
import { SchematicsUtils } from './schematics-utils';

interface ResolveActionStructureModel {
  context: SchematicContext;
  withPayload: boolean;
  rootActionNestingNodeName: string;
  topLevelActionNestingNodeName?: string;
  typeDescription: string;
  payloadActonName?: string | undefined;
  actionNodeNameToInsert: string[];
}

interface CreateEffectNodeOptions {
  context: SchematicContext;
  withPayload: boolean;
  effectName: string;
  actionName: string;
  actionPayloadModelName: string;
}

interface CreateStateActionMethodNodeOption {
  context: SchematicContext;
  withPayload: boolean;
  actionName: string;
  methodName: string;
  stateModeName: string;
  actionPayloadName: string;
  actionContent: string | undefined;
}

interface UpdateEffectOptions {
  tree: Tree;
  context: SchematicContext;
  stateFolderPath: string;
  withPayload: boolean;
  actionPayloadModelName: string;
  actionName: string;
  actionNestingNodesNames: string[];
}

interface UpdateStateOption {
  tree: Tree;
  context: SchematicContext;
  stateFolderPath: string;
  withPayload: boolean;
  actionPayloadModelName: string;
  actionName: string;
  actionNestingNodesNames: string[];
  actionContent: string | undefined;
}

export namespace SimpleStateActionUtils {
  export async function updateEffect(options: UpdateEffectOptions): Promise<void> {
    const effectTsFileName: PathFragment | undefined = SchematicsUtils.findFileInDir(
      options.tree,
      options.stateFolderPath,
      '-effects.service.ts',
    );

    if (!effectTsFileName) {
      throw new Error('*-effects.service.ts file not found!');
    }

    const effectTsFilePath: string = normalize(`${ options.stateFolderPath }/${ effectTsFileName }`);
    const effectName: string = `init${ classify(options.actionNestingNodesNames.join('-')) }Effect`;

    const effectTsFileContentToUpdate: string = SimpleStateActionUtils.createEffectNode({
      context: options.context,
      withPayload: options.withPayload,
      actionName: options.actionName,
      actionPayloadModelName: options.actionPayloadModelName,
      effectName,
    });

    const effectTsFileSourceFile: SourceFile = createSourceFile(
      effectTsFileName,
      options.tree.readText(effectTsFilePath),
      ScriptTarget.Latest,
    );

    const [rootEffectNode]: Node[] = findNodes(effectTsFileSourceFile, SyntaxKind.ClassDeclaration, 1, false);

    const effectTsFileUpdateRecorder: UpdateRecorder = options.tree.beginUpdate(effectTsFilePath);
    const effectTsFileInsertPosition: number = rootEffectNode.end - 1;

    effectTsFileUpdateRecorder.insertLeft(effectTsFileInsertPosition, '\n' + effectTsFileContentToUpdate);

    if (options.withPayload) {
      const importPosition: number = SchematicsUtils.getImportPosition(effectTsFileSourceFile);
      const importContent: string = SchematicsUtils.createImport(
        options.actionPayloadModelName,
        `./payloads/${ dasherize(options.actionPayloadModelName) }`,
      );
      effectTsFileUpdateRecorder.insertLeft(importPosition, importContent + (importPosition ? '' : '\n'));
    }

    options.tree.commitUpdate(effectTsFileUpdateRecorder);

    await SchematicsUtils.formatFile(options.tree, effectTsFilePath);
  }

  export async function updateState(options: UpdateStateOption): Promise<void> {
    const stateTsFileName: PathFragment | undefined = SchematicsUtils.findFileInDir(options.tree, options.stateFolderPath, '-state.ts');

    if (!stateTsFileName) {
      throw new Error('*-state.ts file not found!');
    }

    const stateTsFilePath: string = normalize(`${ options.stateFolderPath }/${ stateTsFileName }`);

    const stateTsFileSourceFile: SourceFile = createSourceFile(
      stateTsFileName,
      options.tree.readText(stateTsFilePath),
      ScriptTarget.Latest,
    );

    const [rootStateNode]: Node[] = findNodes(stateTsFileSourceFile, SyntaxKind.ClassDeclaration, 1, false);

    if (!isNamedNode(rootStateNode)) {
      throw new Error('Node has not name, but required!');
    }

    const stateName: string = rootStateNode.name.escapedText as string;

    const methodName: string = camelize(options.actionNestingNodesNames.join('-'));

    const stateTsFileContentToUpdate: string = SimpleStateActionUtils.createStateActionMethodNode({
      context: options.context,
      withPayload: options.withPayload,
      actionName: options.actionName,
      stateModeName: `${ stateName }Model`,
      methodName,
      actionPayloadName: options.actionPayloadModelName,
      actionContent: options.actionContent,
    });

    const stateTsFileUpdateRecorder: UpdateRecorder = options.tree.beginUpdate(stateTsFilePath);
    const stateTsFileInsertPosition: number = rootStateNode.end - 1;

    stateTsFileUpdateRecorder.insertLeft(stateTsFileInsertPosition, '\n' + stateTsFileContentToUpdate);

    options.tree.commitUpdate(stateTsFileUpdateRecorder);

    await SchematicsUtils.formatFile(options.tree, stateTsFilePath);
  }

  export function createActionNodes(options: ResolveActionStructureModel): string {
    const currentFragmentName: string | undefined = options.actionNodeNameToInsert[0];
    const nextFragmentName: string | undefined = options.actionNodeNameToInsert[1];

    if (nextFragmentName) {
      const content: string = createActionNodes({
        context: options.context,
        withPayload: options.withPayload,
        rootActionNestingNodeName: options.rootActionNestingNodeName,
        topLevelActionNestingNodeName: options.topLevelActionNestingNodeName,
        typeDescription: options.typeDescription,
        payloadActonName: options.payloadActonName,
        actionNodeNameToInsert: options.actionNodeNameToInsert.slice().splice(1),
      });

      return SchematicsUtils.resolveTemplateContent('files/common/namespace.template', options.context, {
        classify: strings.classify,
        name: currentFragmentName,
        content,
      });
    }

    return SchematicsUtils.resolveTemplateContent('files/add-state-action/simple-action.template', options.context, {
      classify: strings.classify,
      dasherize: strings.dasherize,
      withPayload: options.withPayload,
      name: currentFragmentName,
      rootActionNestingNodeName: options.rootActionNestingNodeName,
      topLevelActionNestingNodeName: options.topLevelActionNestingNodeName,
      typeDescription: options.typeDescription,
      payloadActonName: options.payloadActonName,
    });
  }

  export function createEffectNode(options: CreateEffectNodeOptions): string {
    return SchematicsUtils.resolveTemplateContent('files/add-state-action/simple-action-effect.template', options.context, {
      camelize: strings.camelize,
      withPayload: options.withPayload,
      effectName: options.effectName,
      actionName: options.actionName,
      actionPayloadName: options.actionPayloadModelName,
    });
  }

  export function createStateActionMethodNode(options: CreateStateActionMethodNodeOption): string {
    return SchematicsUtils.resolveTemplateContent('files/add-state-action/simple-action-patch-state-method.template', options.context, {
      camelize: strings.camelize,
      withPayload: options.withPayload,
      actionName: options.actionName,
      methodName: options.methodName,
      stateModeName: options.stateModeName,
      actionPayloadName: options.actionPayloadName,
      actionContent: options.actionContent,
    });
  }
}
