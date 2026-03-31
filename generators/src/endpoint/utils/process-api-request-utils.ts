import { SchematicsException } from '@angular-devkit/schematics';
import { camelize, classify, dasherize } from '@angular-devkit/core/src/utils/strings';

import { EndpointOptions, HttpMethod } from '../schema';

const requestRootFolder: string = 'app/api/request';
const pathSplitter: string = '/';
const leftBracket: string = '{';
const rightBracket: string = '}';

interface PathParamParts {
  url: string;
  params: string[];
}

export interface ApiRequestConfig {
  requestEntityPrefix: string;
  requestName: string;
  requestHandlerName: string;
  requestPath: string;
  hasPathParam: boolean;
  hasRequestBody: boolean;
  pathParams: any[];
}

export namespace ProcessApiRequestUtils {
  export async function processApiRequest(options: EndpointOptions, projectNamePath: string): Promise<ApiRequestConfig> {
    if (!options) {
      throw new SchematicsException('Options not defined but required.');
    }

    const basePath: string = `${ projectNamePath }/${ requestRootFolder }`;
    const pathParamParts: PathParamParts = replacePathParam(options.url);
    const baseUrl: string = pathParamParts.url;

    const pathSegments: string[] = baseUrl.split(pathSplitter).map(dasherize);

    const requestName: string = pathSegments.pop() || '';
    const requestUrl: string = pathSegments.join(pathSplitter);

    const requestNamePart: string = [options.method.toLowerCase(), ...pathSegments, requestName].join('_').replace('/', '');

    return {
      hasPathParam: !!pathParamParts.params.length,
      requestName,
      pathParams: pathParamParts.params,
      hasRequestBody: [HttpMethod.POST, HttpMethod.PUT].includes(options.method),
      requestEntityPrefix: classify(requestNamePart),
      requestHandlerName: camelize(requestNamePart),
      requestPath: [basePath, options.method.toLowerCase(), requestUrl, requestName]
        .join(pathSplitter)
        .replace('//', '/'),
    };
  }
}

function replacePathParam(url: string, params: any[] = []): PathParamParts {
  let pathParamParts: PathParamParts = { url, params };

  if (!url.includes(leftBracket)) {
    return pathParamParts;
  }

  const leftBracketIndex: number = url.indexOf(leftBracket);
  const rightBracketIndex: number = url.indexOf(rightBracket);

  const param: string = url.slice(leftBracketIndex + 1, rightBracketIndex);
  const replacedUrl: string = url.replace(leftBracket + param + rightBracket, param);

  pathParamParts = {
    url: replacedUrl,
    params: [...params, param],
  };

  return replacePathParam(pathParamParts.url, pathParamParts.params);
}
