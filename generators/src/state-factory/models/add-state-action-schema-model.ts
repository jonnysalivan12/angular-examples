export interface AddStateActionSchemaModel {
  name: string;
  path: string;
  content: string | undefined;
  withPayload: boolean;
  payloadContent: string | undefined;
  payloadImports: string | undefined;
  withEffect: boolean;
}
