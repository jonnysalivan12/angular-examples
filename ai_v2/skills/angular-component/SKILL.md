---
name: angular-component
description: >
  Use when creating new Angular component.
  Triggers: create component, new component, generate component, add component.
---

# Angular Component Generation

Do NOT explore project structure. Do NOT read existing components as examples. All rules are in this skill — follow these steps exactly.

## Step 1 — Generate via CLI

Ask user for name and project if not provided.

```bash
nx generate @nx/angular:component --name=<n> --project=<project> --standalone
```

## Step 2 — Apply project rules

- `changeDetection: ChangeDetectionStrategy.OnPush`
- DI via `inject()` only — `private readonly`
- Modifiers: `protected` for template-bound, `private` for internal, `public` for external API

### Declaration order:
1. `inject()` dependencies
2. `input()` / `output()`
3. Signals (`signal()`)
4. Computed (`computed()`)
5. Constructor (effects only)
6. Lifecycle hooks
7. `public` methods
8. `protected` methods (template handlers)
9. `private` methods

### Translations:
- TypeScript: `TranslateService` via `inject(TranslateService)`

## Step 3 — Implement requested logic

Add only what the user asked for. Do not add placeholder methods or TODO comments.
If unsure about project-specific imports (translation modules, shared components, utilities) — ask the user, do not search the codebase.
