export interface AddAsyncStateActionSchemaModel {
  name: string;
  path: string;
  requestWithPayload: boolean;
  successWithPayload: boolean;
  failureWithPayload: boolean;
}
