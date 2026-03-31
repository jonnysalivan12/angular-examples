import {
  apply,
  applyTemplates,
  chain,
  FileEntry,
  forEach,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  SchematicsException,
  Source,
  strings,
  Tree,
  url,
} from '@angular-devkit/schematics';

import { EndpointOptions } from './schema';
import { SchematicsUtils } from './utils/schematics-utils';
import { ApiRequestConfig, ProcessApiRequestUtils } from './utils/process-api-request-utils';

export function chooseType(hasType: boolean, type: string, defaultType: string = 'void'): string {
  return hasType ? type : defaultType;
}

export function endpoint(endpointOptions: EndpointOptions): Rule {
  return async (tree: Tree, _context: SchematicContext): Promise<Rule> => {
    const projectNamePath: string | undefined = await SchematicsUtils.getProjectPath(tree, endpointOptions.projectName);

    if (!projectNamePath) {
      throw new SchematicsException('projectNamePath not defined but required.');
    }

    const apiRequestConfig: ApiRequestConfig = await ProcessApiRequestUtils.processApiRequest(endpointOptions, projectNamePath);

    const apiRequestSource: Source = apply(url('./files/api'), [
      applyTemplates({
        ...strings,
        name: apiRequestConfig.requestName,
        ...endpointOptions,
        ...apiRequestConfig,
        chooseType,
      }),
      forEach((fileEntry: FileEntry) => {
        const prettyFile: string = fileEntry.content.toString()
          .split(new RegExp('[\r\n]{2,}'))
          .filter(Boolean)
          .join('\r\n')
          .split('export')
          .join('\r\nexport')
          .concat('\r\n');

        return {
          path: fileEntry.path,
          content: new Buffer(prettyFile),
        };
      }),

      move(apiRequestConfig.requestPath),
    ]);

    const apiRequestRule: Rule = mergeWith(apiRequestSource);

    return chain([apiRequestRule]);
  };
}
