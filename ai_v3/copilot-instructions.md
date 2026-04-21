# Copilot Instructions

All generated code MUST conform to these rules. Standards are the source of truth — if existing code conflicts with standards, standards win.

## Project Context

<TODO którki opis projektu dla kogo i co robi>

[//]: # (Przykład: Bank XYZ — aplikacja do zarządzania produktami finansowymi dla klientów detalicznych i pracowników banku.)
[//]: # (The monorepo contains **two separate applications** consuming shared libraries:)

[//]: # ()
[//]: # (- **Client App** — application for bank customers &#40;retail&#41;, self-service for their financial products)

[//]: # (- **Employee App** — application for bank staff &#40;advisors, back-office&#41;, customer servicing and product management)

[//]: # ()
[//]: # (The applications are independent &#40;separate `project.json`, separate deployments, separate routing/state&#41; and share only `ui-*`, `data-access-*`, and `util-*` libraries. App-specific code does NOT go into shared libraries.)

---

## Workflow

- Do NOT scan or explore project structure before acting — use instructions, skills, and provided context as source of truth
- If information is missing — ask the user, do not search the codebase
- For scaffolding (state, actions, services, components, templates, scss) — invoke the matching skill / `nx generate`, never create files manually

---

## Response Style

- Respond in the language of the user's request (default: Polish); code, identifiers, commit messages: English always
- Code: always full, explicit, production-ready — never compress code
- Explanations: caveman style by default (short, no filler)
- Complex logic, architecture, debugging: switch to detailed explanations automatically

---

## Basics

- **Type**: SPA (Single Page Application)
- **Target devices**: mobile-first (priority for small screens), fully responsive up to desktop
- **Supported browsers**: evergreen only (Chrome, Firefox, Safari, Edge — last 2 versions, including Safari iOS)
- **Scale**: ~1–10k DAU (specialist application, not mass retail banking)

---

## Ubiquitous Language

Domain terms used consistently across code (EN identifiers), UI (PL), and documentation. Code: class names, field names, file names in English. UI: Polish.

**Financial products:**

- **Kredyt** / `Loan` — credit product (mortgage, cash, consumer)

**Agreements and applications:**

- **Umowa** / `Agreement` (NOT `Contract` — avoid confusion with TypeScript contracts) — signed agreement between customer and bank
- **Wniosek** / `Application` — application for a product, pre-sales process, before it becomes an Agreement

**Calculations and states:**

- **Saldo** / `Balance` — funds available on a product
- **Rata** / `Installment` — single payment in a repayment schedule
- **Oprocentowanie** / `InterestRate` — interest rate (annual unless stated otherwise)

**Roles:**

- **Klient** / `Customer` — product holder, end user in Customer App
- **Współkredytobiorca** / `CoBorrower` — additional party on a Loan Agreement, with same rights and obligations as the main Customer
- **Doradca** / `Advisor` — bank employee using Branch App to service customers and manage products

---

## Backend Contract

- Protocol: REST over HTTPS, JSON payloads, Glob if file upload needed
- Auth: JWT in header
- Error format: Unknown
- API docs: Unknown
- Type definitions: hand-written in shared lib
- Frontend does NOT define API shape — new endpoints = coordination with backend team, not a Clarifier decision

---

## TypeScript

- Always declare access modifiers — default `private`
- `readonly` on injected dependencies and immutable data
- Naming: `camelCase` (vars/functions, private fields without `_`), `PascalCase` (classes/types/enums), `UPPER_CASE` (constants), `kebab-case` (files)

---

## Angular 21

- `changeDetection: ChangeDetectionStrategy.OnPush` — always
- DI: `inject()` only — never constructor injection. Dependencies: `private readonly`
- Modifiers: `protected` for template-bound, `private` for internal, `public` for external API
- Max 400 lines/file, ~75 lines/method. No business logic in templates
- RxJS only for HTTP and complex streams — UI state → signals

---

## State Management

- **NGXS**: cross-component state, persisted data, server cache
- **Signals**: local UI state (toggles, form flags, hover, transient values)
- **Never**: `@Input`/`@Output` chains deeper than 2 levels — lift to NGXS
- Server interactions always use async action pattern — generated via state skill
- State, actions, components, services: always via skill / `nx generate`

---

## Nx Monorepo

- Every `project.json`: tags `scope:<domain>` + `type:<role>`
- Nx library types: //TODO
- Always `nx` commands, never `ng`

---

## Cross-Cutting Requirements

Apply by default to every feature — Clarifier does NOT ask about these unless stakeholder explicitly opts out.

### Accessibility
- Target: WCAG 2.1 AA
- Keyboard-navigable with visible focus, ARIA labels on icon-only buttons, labels on all inputs
- No keyboard traps; Escape closes modals

### Internationalization
- Mechanism: @ngx-translate
- Key format: `uniqueComponentName.key`
- Template strings, UI labels, error messages, i18n keys: Polish

### Responsive Design
- Breakpoints: //TODO
- Mobile-first CSS; touch targets ≥ 44×44 px

### Error Handling & UX
- Global HTTP interceptor → error screens for unexpected errors (500s, network issues)
- Form errors inline, linked via `aria-describedby`
- Every list view has designed empty / loading / error state — never blank screen
- Loading: skeletons for content, spinners for actions

### Performance Budgets
- Images: lazy, responsive `srcset`, WebP/AVIF preferred; fonts: `font-display: swap`

### Security
- No secrets in frontend code
- Token storage: state
- Justify every `[innerHTML]` / `bypassSecurityTrust*`
- CSP: strict
- Never log PII client-side

---

## Definition of Done

- [ ] Lint + typecheck + tests pass
- [ ] Unit test coverage ≥ {X}% on new code
- [ ] E2E covers happy path + primary error cases
- [ ] i18n keys added, no hardcoded user-facing strings
- [ ] a11y: keyboard + screen reader smoke test + axe-core clean
- [ ] Responsive verified on mobile + tablet + desktop
- [ ] Performance budget respected
- [ ] Empty / loading / error states implemented
- [ ] `requirements.md`, `plan.md`, `tasks.md` up to date
- [ ] Code review approved, staging smoke test passed

---
