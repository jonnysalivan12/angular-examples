import { normalize, PathFragment } from '@angular-devkit/core';
import { classify } from '@angular-devkit/core/src/utils/strings';
import { SchematicContext, strings, Tree, UpdateRecorder } from '@angular-devkit/schematics';
import { createSourceFile, Node, ScriptTarget, SourceFile, SyntaxKind } from 'typescript';

import { findNodes } from './ast-utils';
import { SchematicsUtils } from './schematics-utils';

interface CreateEffectNodeOptions {
  context: SchematicContext;
  requestWithPayload: boolean;
  successWithPayload: boolean;
  failureWithPayload: boolean;
  effectName: string;
  actionName: string;
}

interface UpdateEffectOptions {
  tree: Tree;
  context: SchematicContext;
  stateFolderPath: string;
  requestWithPayload: boolean;
  successWithPayload: boolean;
  failureWithPayload: boolean;
  actionPayloadModelName: string;
  actionName: string;
  actionNestingNodesNames: string[];
}

export namespace AsyncStateActionUtils {
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
    const effectName: string = `init${ classify(options.actionNestingNodesNames.join('-')) }RequestEffect`;

    const effectTsFileContentToUpdate: string = createEffectNode({
      context: options.context,
      requestWithPayload: options.requestWithPayload,
      successWithPayload: options.successWithPayload,
      failureWithPayload: options.failureWithPayload,
      actionName: options.actionName,
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

    options.tree.commitUpdate(effectTsFileUpdateRecorder);

    await SchematicsUtils.formatFile(options.tree, effectTsFilePath);
  }

  export function createEffectNode(options: CreateEffectNodeOptions): string {
    return SchematicsUtils.resolveTemplateContent('files/add-async-state-action/async-action-effect.template', options.context, {
      camelize: strings.camelize,
      requestWithPayload: options.requestWithPayload,
      successWithPayload: options.successWithPayload,
      failureWithPayload: options.failureWithPayload,
      effectName: options.effectName,
      actionName: options.actionName,
    });
  }
}
