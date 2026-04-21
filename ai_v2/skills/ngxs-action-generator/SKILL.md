---
name: ngxs-action-generator
description: >
  Use when adding synchronous action to existing NGXS state.
  Triggers: add action, new action, add sync action, simple action,
  add reset action, add select action.
---

# NGXS Sync Action Generator

Do NOT explore project structure. Do NOT read other state files as examples. Follow these steps exactly.

## Input

User provides:
- `path` — existing state folder
- `action name` — e.g., `Reset`, `Select`, `SetFilter`
- `payload` — optional (e.g., `{ id: string }`)
- `effect needed?` — optional, default: no

If not provided — ask.

## Step 1 — Read existing files

Read only these files in `<path>`:
- `*-actions.ts` — to find existing namespace and action type format
- `*-state.ts` — to add @Action handler
- `*-state.service.ts` — to add dispatch method
- `*-state-effects.service.ts` — only if effect is needed

## Step 2 — Create payload file (if action has payload)

`payloads/<kebab-action>-payload.ts`:
```typescript
export interface <ActionName>Payload {
  // fields from user input
}
```

## Step 3 — Add action to `*-actions.ts`

Add inside existing `<PascalCase>Actions` namespace. Match action type format from existing actions.

Without payload:
```typescript
export const <ActionName> = ActionBuilder.define('[Context/Entity] <action verb>');
```

With payload:
```typescript
import type { <ActionName>Payload } from './payloads/<kebab-action>-payload';

export const <ActionName> = ActionBuilder.define<<ActionName>Payload>('[Context/Entity] <action verb>');
```

## Step 4 — Add @Action handler to `*-state.ts`

Without payload:
```typescript
@Action(<PascalCase>Actions.<ActionName>)
public on<ActionName>(ctx: StateContext<<Model>>): void {
  ctx.patchState({ /* state changes */ });
}
```

With payload:
```typescript
@Action(<PascalCase>Actions.<ActionName>)
public on<ActionName>(ctx: StateContext<<Model>>, { payload }: InstanceType<typeof <PascalCase>Actions.<ActionName>>): void {
  ctx.patchState({ /* use payload */ });
}
```

## Step 5 — Add dispatch method to `*-state.service.ts`

Without payload:
```typescript
public <actionName>(): void {
  this.store.dispatch(new <PascalCase>Actions.<ActionName>());
}
```

With payload:
```typescript
public <actionName>(payload: <ActionName>Payload): void {
  this.store.dispatch(new <PascalCase>Actions.<ActionName>(payload));
}
```

## Step 6 (optional) — Add effect to `*-state-effects.service.ts`

Only if user requested side effect (logging, cache invalidation, navigation, etc.).

Without payload:
```typescript
@Effect([<PascalCase>Actions.<ActionName>])
protected <namespacePath><ActionName>Effect(): Observable<unknown> {
  // side effect logic
}
```

With payload:
```typescript
@Effect([<PascalCase>Actions.<ActionName>])
protected <namespacePath><ActionName>Effect({ payload }: InstanceType<typeof <PascalCase>Actions.<ActionName>>): Observable<unknown> {
  // side effect logic using payload
}
```

## Rules

- Handler naming: `on` + action name
- Effect naming: full namespace path + `Effect`
- Payloads: named interfaces in `payloads/` — never inline types
- `patchState()` for simple, `setState()` with operators for complex/nested
- State handlers: zero logic — only state mutations
- `@Effect()` — always the primary approach (99% of cases)
- `@CustomEffect()` — rare, only when complex custom logic is needed beyond standard @Effect pattern
