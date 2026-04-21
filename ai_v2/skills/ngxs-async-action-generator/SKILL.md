---
name: ngxs-async-action-generator
description: >
  Use when adding asynchronous action with HTTP call to existing NGXS state.
  Triggers: add async action, add request action, add API action,
  add load action, add create action, add update action, add delete action,
  request success failure, async triplet.
---

# NGXS Async Action Generator

Do NOT explore project structure. Do NOT read other state files as examples. Follow these steps exactly.

## Input

User provides:
- `path` — existing state folder
- `operation` — e.g., `Load`, `Create`, `Update`, `Delete`
- `api method name` — method in `api/*-api.service.ts` that this action will call
- `request payload` — optional (e.g., `{ filters: Filter }`)
- `success payload` — optional (e.g., `{ items: User[] }`)
- `operator` — `switchMap` (default), `exhaustMap` (submit), `concatMap` (queue), `mergeMap` (parallel)

If path or operation not provided — ask. Unknown payloads — use `{ data: unknown }`.

## Prerequisite — API method must exist

Read `<path>/api/*-api.service.ts` and verify the API method exists.

If method does NOT exist — stop and inform user:
> API method not found. Run `/ngxs-api-generator` first to add the method, then come back.

## Step 1 — Read existing files

Read only these 6 files in `<path>`:
- `api/*-api.service.ts` — to find API method signature and types
- `*-actions.ts` — to find namespace and action type format
- `*-state.ts` — to add handlers
- `*-selectors.ts` — to add selectors if operation adds new data
- `*-state-effects.service.ts` — to add effect
- `*-state.service.ts` — to add dispatch method and signals

## Step 2 — Create payload file

`payloads/<kebab-operation>-payload.ts`:
```typescript
export interface <Operation>RequestPayload {
  // request fields
}

export interface <Operation>SuccessPayload {
  // success fields
}

export interface <Operation>FailurePayload {
  // failure fields
}
```

## Step 3 — Add action triplet to `*-actions.ts`

Inside existing `<PascalCase>Actions` namespace:
```typescript
import type { <Operation>RequestPayload, <Operation>SuccessPayload, <Operation>FailurePayload } from './payloads/<kebab-operation>-payload';

export namespace <Operation> {
  export const Request = ActionBuilder.define<<Operation>RequestPayload>('[Context/Entity] <operation> request');
  export const Success = ActionBuilder.define<<Operation>SuccessPayload>('[Context/Entity] <operation> success');
  export const Failure = ActionBuilder.define<<Operation>FailurePayload>('[Context/Entity] <operation> failure');
}
```

## Step 4 — Add @Action handlers to `*-state.ts`

Do NOT add new properties to StateModel or DEFAULTS — only add handlers. State model changes must be explicitly requested by user.

```typescript
@Action(<PascalCase>Actions.<Operation>.Request)
public on<Operation>Request(ctx: StateContext<<Model>>): void {
  // TODO: Update state
  // ctx.patchState({});
}

@Action(<PascalCase>Actions.<Operation>.Success)
public on<Operation>Success(ctx: StateContext<<Model>>, { payload }: InstanceType<typeof <PascalCase>Actions.<Operation>.Success>): void {
  // TODO: Update state
  // ctx.patchState({});
}

@Action(<PascalCase>Actions.<Operation>.Failure)
public on<Operation>Failure(ctx: StateContext<<Model>>, { payload }: InstanceType<typeof <PascalCase>Actions.<Operation>.Failure>): void {
  // TODO: Update state
  // ctx.patchState({});
}
```

## Step 5 — Add @Effect to `*-state-effects.service.ts`

Use the API method name from `api/*-api.service.ts` (read in Step 1):

```typescript
@Effect([<PascalCase>Actions.<Operation>.Request])
protected <namespacePath><Operation>Effect({ payload }: InstanceType<typeof <PascalCase>Actions.<Operation>.Request>): Observable<unknown> {
  return this.api.<apiMethodName>(payload).pipe(
    tap((data) => this.store.dispatch(new <PascalCase>Actions.<Operation>.Success(data))),
    catchError((err) => {
      this.store.dispatch(new <PascalCase>Actions.<Operation>.Failure({ error: err.message }));
      return EMPTY;
    }),
  );
}
```

Non-default operator:
```typescript
@Effect([<PascalCase>Actions.<Operation>.Request], { operator: 'exhaustMap' })
```

## Step 6 — Add dispatch method to `*-state.service.ts`

Fire-and-forget:
```typescript
public <operation>(payload: <Operation>RequestPayload): void {
  this.store.dispatch(new <PascalCase>Actions.<Operation>.Request(payload));
}
```

When component needs to wait:
```typescript
public <operation>(payload: <Operation>RequestPayload): Observable<void> {
  return this.store.dispatch(new <PascalCase>Actions.<Operation>.Request(payload));
}
```

## Rules

- Always triplet: Request / Success / Failure
- Payloads: one file per operation — `<Operation>RequestPayload`, `<Operation>SuccessPayload`, `<Operation>FailurePayload`
- Effect naming: full namespace path + `Effect`
- Effect signature: `{ payload }: InstanceType<typeof Action>`
- Handler naming: `on` + operation + `Request`/`Success`/`Failure`
- State handlers: zero logic — only `patchState()`/`setState()`
- `@Effect()` — always the primary approach (99% of cases)
- `@CustomEffect()` — rare, only when complex custom logic needed
- Do NOT add StateModel properties unless user explicitly asks
- Do NOT add selectors unless user explicitly asks
- Do NOT modify API service — use `/ngxs-api-generator` for that
- Do NOT search codebase for types — ask user if type is unknown