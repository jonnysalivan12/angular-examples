---
name: angular-template
description: >
  Use when creating or modifying Angular HTML templates.
  Triggers: create template, html template, add template, modify template,
  create view, component html.
---

# Angular HTML Template

Do NOT read existing templates as examples. Do NOT search for components in the codebase.

## Syntax

- Control flow: `@if` / `@for` / `@switch` — never `*ngIf` / `*ngFor` / `*ngSwitch`
- `@for` always requires `track`: `@for (item of items(); track item.id)`
- Styling: `[class.x]` / `[style.x]` — never `ngClass` / `ngStyle`
- Lazy sections: `@defer (on viewport) { } @placeholder { }`

## Translations

- Simple: `{{ 'feature.element.label' | translate }}`
- With params: `{{ 'feature.key' | translate: { name: value } }}`
- Split text: `{{ 'feature.key' | translate | translateCut: index }}`

## Design System

Project uses a custom design system with shared components. Do NOT guess component names or search for them — ask the user which design system components to use.

## Rules

- No business logic in templates — use `computed()` in component class
- No method calls in bindings — use signals or computed
- Keep templates declarative and clean
