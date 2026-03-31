export namespace ActionBuilder {
  export class BaseAction<T = void> {
    constructor(public payload?: T) {}
  }

  export function define<T = void>(type: string) {
    return class extends BaseAction<T> {
      static readonly type = type;
    };
  }
}
