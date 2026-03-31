export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export interface EndpointOptions {
  projectName: string;
  url: string;
  method: HttpMethod;
  queryParam: boolean;
  hasQueryParam: boolean;
  hasResponseBody: boolean;
}
