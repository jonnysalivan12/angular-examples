import 'reflect-metadata';
import { ActionType } from '@ngxs/store';

export type EffectOperator = 'exhaustMap' | 'switchMap' | 'concatMap' | 'mergeMap';

export const EFFECTS_META_KEY: symbol = Symbol('EFFECTS_META_KEY');

export interface EffectMeta {
  actions: ActionType[];
  operator: EffectOperator;
  methodName: string | symbol;
}

export function Effect(
  actions: ActionType[],
  options?: { operator?: EffectOperator },
): MethodDecorator {
  const operator = options?.operator ?? 'switchMap';

  return (target, propertyKey) => {
    const ctor = target.constructor;
    const existing: EffectMeta[] = Reflect.getMetadata(EFFECTS_META_KEY, ctor) ?? [];

    Reflect.defineMetadata(EFFECTS_META_KEY, [...existing, { actions, operator, methodName: propertyKey }], ctor);
  };
}
