# Copilot Instructions

# Context
This file defines the coding standards and architectural guidelines for the project. It serves as the primary reference for all code generation and implementation decisions. The instructions are organized into core directives, architectural constraints, technical priorities, and interaction protocols to ensure consistency and maintainability across the codebase.

## Core Directives
1. **Source of Truth**: All coding decisions MUST be based on the files in the `standards/` directory.
2. **Minimalist Skills**: Use Skills only for execution (CLI, file creation). Use `standards/` for implementation details (logic, styling, state).
3. **Task Strategy**: Before implementing any task, identify which standards are relevant:
  - Logic/Class structure -> `standards/angular.md`
  - Data/NGXS -> `standards/state.md`
  - UI/HTML/SCSS -> `standards/ui.md`
  - Monorepo/Imports -> `standards/domain.md`
  - Translations/WCAG -> `standards/i18n.md`

## Architectural Constraints (from standards/domain.md)
- **Multi projects structure**: The codebase is organized into multiple projects (projects and src) within a monorepo structure.
- **Import Rule**: Always use Path Aliases (e.g., `@app/ui`). Never use deep imports. Cross-library imports must go through `index.ts`.
- **Strict Isolation**: `ui` libs (presentational) cannot import from `states` or `features`.

## Technical Priorities
- **Angular**: `inject()` only, Signals for state, `OnPush` detection, `@if/@for` flow.
- **NGXS**: Always use the Async Triplet (Request/Success/Failure). Use Facade Pattern (`*-state.service.ts`). Dumb handlers only.
- **UI**: BEM naming, max 2 levels. WCAG AA compliance (aria-labels, semantic HTML).
- **i18n**: No hardcoded text. Use `@ngxs-translate` with the `component.element.type` key format.

## Interaction Protocol
- If a task is ambiguous, ask for clarification based on `standards/domain.md` (e.g., "In which library group should this reside?").
- When generating code, follow the "Declaration Order" specified in `standards/angular.md`.
- Ensure all new async actions follow the file structure in `standards/state.md` (payloads/, api/).

## Response Style
- Respond in the language of the user's request (default: Polish); code, identifiers, commit messages: English always
- Code: always full, explicit, production-ready — never compress code
- Explanations: caveman style by default (short, no filler)
- Complex logic, architecture, debugging: switch to detailed explanations automatically