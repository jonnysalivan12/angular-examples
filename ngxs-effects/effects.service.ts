import 'reflect-metadata';
import { EMPTY, Observable, Subject, isObservable, of } from 'rxjs';

import { inject } from '@angular/core';

import { concatMap, exhaustMap, mergeMap, switchMap, takeUntil } from 'rxjs/operators';

import { ActionType, Actions, ofActionSuccessful } from '@ngxs/store';

import { EFFECTS_META_KEY, EffectMeta } from '@app/core/effects/effect-decorator';

export abstract class EffectsService {
  public destroy$: Observable<void>;

  private destroyEmitter$: Subject<void>;

  public init(): void {
    if (this.destroyEmitter$) {
      this.destroy();
    }
    this.destroyEmitter$ = new Subject<void>();
    this.destroy$ = this.destroyEmitter$.asObservable();
  }

  public destroy(): void {
    this.destroyEmitter$.next();
    this.destroyEmitter$.complete();
  }
}

const RXJS_OPERATORS_MAP: Record<string, typeof switchMap> = {
  switchMap,
  concatMap,
  mergeMap,
  exhaustMap,
};

export abstract class EffectsService2 {
  protected readonly destroy$: Subject<void> = new Subject();
  protected readonly actions$: Actions = inject(Actions);

  public init(): void {
    const ctor = this.constructor as any;
    const effects: EffectMeta[] = Reflect.getMetadata(EFFECTS_META_KEY, ctor) ?? [];

    for (const effect of effects) {
      const handler = (this as any)[effect.methodName] as (action: ActionType) => Observable<unknown>;
      const mapOperator = RXJS_OPERATORS_MAP[effect.operator] ?? switchMap;

      this.actions$
        .pipe(
          ofActionSuccessful(...effect.actions),
          mapOperator((actionPayload) => {
            const handlerCall = handler.call(this, actionPayload);
            return isObservable(handlerCall) ? handlerCall : of(handlerCall);
          }),
          takeUntil(this.destroy$),
        )
        .subscribe();
    }
  }

  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected successfulSuccessAction<T extends ActionType[]>(...allowedTypes: T): Observable<unknown> {
    return this.actions$.pipe(ofActionSuccessful(...allowedTypes));
  }

  protected successfulFailureAction<T extends ActionType[]>(...allowedTypes: T): Observable<unknown> {
    return this.actions$.pipe(
      ofActionSuccessful(...allowedTypes),
      switchMap(() => EMPTY),
    );
  }
}
