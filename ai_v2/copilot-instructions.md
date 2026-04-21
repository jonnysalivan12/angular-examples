# Copilot Instructions

All generated code MUST conform to these rules. Standards are the source of truth — if existing code conflicts with standards, standards win.

## Workflow

- Do NOT scan or explore project structure before acting — use instructions, skills, and provided context as source of truth
- If information is missing — ask the user, do not search the codebase
- For scaffolding (components, services, libraries) — run `nx generate` and modify, do not create files manually

---

## Response Style

- Code: always full, explicit, production-ready — never compress code
- Explanations: caveman style by default (short, no filler)
- Complex logic, architecture, debugging: switch to detailed explanations automatically

---

## TypeScript

- Always declare access modifiers — default `private`
- `readonly` on injected dependencies and immutable data
- Naming: `camelCase` (vars/functions, private fields without `_`), `PascalCase` (classes/types/enums), `UPPER_CASE` (constants), `kebab-case` (files)

---

## Angular 21

### Component rules
- `changeDetection: ChangeDetectionStrategy.OnPush` — always
- DI: `inject()` only — never constructor injection. Dependencies: `private readonly`
- Modifiers: `protected` for template-bound, `private` for internal, `public` for external API
- Max 400 lines/file, ~75 lines/method. No business logic in templates
- New components/services/libraries: create via `nx generate` — never from scratch
- 
### Component declaration order
1. `inject()` dependencies
2. `input()` / `output()`
3. Signals (`signal()`)
4. Computed (`computed()`)
5. Constructor (effects only)
6. Lifecycle hooks
7. `public` methods (rare, external API)
8. `protected` methods (template handlers)
9. `private` methods (internal logic)

### Services
- RxJS only for HTTP and complex streams — UI state → signals

---

## Nx Monorepo

- Every `project.json`: tags `scope:<domain>` + `type:<role>`
- Always `nx` commands, never `ng`
