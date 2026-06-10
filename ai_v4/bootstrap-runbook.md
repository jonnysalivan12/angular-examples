# Runbook: bootstrap repo `mortgage-case-retention-fe` (Nx + Angular + story-flow)

> Cel: **odtwarzalna, krok-po-kroku** check-lista od pustego folderu do uruchomienia
> agentów `story-flow`. Stack pinowany: Nx 22.7, Angular 21.2, Copilot SDK,
> code-index MCP, Figma, Storybook 10.4. Komendy w składni **PowerShell**
> (Windows); w bashu różni się tylko składnia zmiennych env (`export VAR=...`).
>
> **Parametry tego repo:** nazwa `mortgage-case-retention-fe`, prefiks `mc`
> (reużywalne) / `mcr` (aplikacja), własny **DS jako pakiet npm** (zamiast Angular
> Material), aplikacja nx = `frontend-app`.

---

## 🔧 Do uzupełnienia (placeholdery)

Zanim odpalisz Fazę 2 i 7, ustal i podstaw wszędzie poniższe wartości:

| Placeholder | Znaczenie | Przykład |
|---|---|---|
| `<DS_PKG>` | nazwa pakietu npm Twojego DS | `@mc/ds` |
| `<DS_VER>` | wersja pakietu DS | `1.0.0` |
| `<DsPrefix>` | prefiks NAZW KLAS komponentów DS (do `stripPrefix`) | `Mc` (dla `McButtonComponent`) |

`<DsPrefix>` + `stripSuffix:'Component|Directive'` dają `join_key` rejestru:
`McButtonComponent` → zdjęte `Mc`+`Component` → `button`. Zajrzyj do `.d.ts`
pakietu `<DS_PKG>`, by potwierdzić realne nazwy klas.

---

## Faza 0 — Prerekwizyty (toolchain + sekrety)

- [ ] **Node ≥ 22** (weryfikowane na v24 — wymóg `code-index`: `node:sqlite` + FTS5).
  ```powershell
  node --version    # >= v22
  npm --version
  ```
- [ ] **GitHub Copilot** — aktywna subskrypcja + uwierzytelniony Copilot CLI.
  `@github/copilot-sdk` (`new CopilotClient`) bierze auth z runtime CLI, nie z kodu;
  model domyślny `gpt-5`.
  ```powershell
  npm i -g @github/copilot
  copilot                       # login device-flow
  ```
- [ ] **Figma PAT** → env `FIGMA_API_KEY` (design-extract / Figma MCP; bez niej fail-soft).
  ```powershell
  $env:FIGMA_API_KEY = "figd_..."        # per-sesja; trwale: setx FIGMA_API_KEY "figd_..."
  ```
- [ ] **Dostęp do rejestru npm `<DS_PKG>`** — jeśli prywatny: `npm login --scope=@<scope>`
  lub `.npmrc` z tokenem rejestru.

---

## Faza 1 — Wygenerowanie workspace Nx (pusty folder, prefiks `mcr`)

- [ ] Z **katalogu nadrzędnego** — create-nx-workspace sam utworzy folder:
  ```powershell
  npx create-nx-workspace@22.7.0 mortgage-case-retention-fe `
    --preset=angular-monorepo `
    --appName=frontend-app `
    --style=scss `
    --bundler=esbuild `
    --unitTestRunner=vitest `
    --e2eTestRunner=playwright `
    --prefix=mcr `
    --ssr=false `
    --packageManager=npm `
    --nxCloud=skip `
    --no-interactive
  ```
  > `--prefix=mcr` → selektory aplikacji `mcr-*` i alias `@mcr/...`. Nazwa projektu
  > nx `frontend-app` jest rozłączna z prefiksem (model app-agnostyczny). Jeśli pusty
  > folder już istnieje a CLI protestuje: usuń go (jest pusty) i ponów, albo wejdź do
  > środka i `npx nx@22.7.0 init`.
- [ ] ⚠ Pisownia: `mortgage-case-retention-fe` (z „t"), nie „morgage".

---

## Faza 2 — Zależności (runtime + dev)

> ⚠ Angular 21 świeży → instaluj z `--legacy-peer-deps`. Najpewniejsza reprodukcja:
> wklej pinowane wersje do `package.json` i `npm install --legacy-peer-deps`.

- [ ] **Angular core** (BEZ Material):
  ```powershell
  npm i --legacy-peer-deps `
    "@angular/animations@21.2.10" "@angular/common@21.2.10" "@angular/compiler@21.2.10" `
    "@angular/core@21.2.10" "@angular/forms@21.2.10" "@angular/platform-browser@21.2.10" `
    "@angular/platform-browser-dynamic@21.2.10" "@angular/router@21.2.10" `
    "rxjs@7.8.2" "zone.js@0.16.1" "tslib@2.8.1"
  ```
  > `@angular/cdk@21.2.8` — dodaj TYLKO jeśli `<DS_PKG>` go wymaga (sprawdź jego
  > `peerDependencies`; typowe dla overlay/a11y/portal).
- [ ] **Twój DS (zamiast Material)**:
  ```powershell
  npm i --legacy-peer-deps "<DS_PKG>@<DS_VER>"
  ```
- [ ] **NGXS / i18n / UI / utils** — jak w referencyjnym `package.json`:
  `@ngxs/*@21` (+ `ngxs-reset-plugin`, `@ngxs/devtools-plugin` jako dev),
  `@ngx-translate/core@17` + `@messageformat/core` + `ngx-translate-messageformat-compiler`
  + `ngx-translate-multi-http-loader`, oraz UI/utils wg potrzeb domeny
  (`@swimlane/ngx-charts`, `chart.js`, `luxon`, `lodash`, `jwt-decode`, `file-saver`,
  `validator`, `socket.io-client`, …).
- [ ] **Narzędzia pipeline'u story-flow (dev) — NIEZBĘDNE, by agenci wstali**:
  ```powershell
  npm i -D --legacy-peer-deps `
    "@github/copilot-sdk@^1.0.0-beta.4" "@clack/prompts@^1.4.0" "js-yaml@^4.1.1" "yaml@^2.9.0"
  ```
- [ ] **Nx / build / test / lint (dev)** — `@nx/*@22.7.0`, `@angular-devkit/*@21.2.8`,
  `@angular-eslint/*@21.3.1`, `vitest@4` + `@analogjs/vite-plugin-angular`,
  `@playwright/test`, `eslint@10`, `prettier@3.8`, `typescript@~5.9` (większość z presetu Fazy 1).

---

## Faza 3 — Struktura bibliotek (`type:*`, aliasy `@mc` / `@mcr`)

> Konwencja (SSOT `.github/standards/nx.md`): reużywalne `@mc/shared/<type>/<name>`,
> app-owe `@mcr/<type>/<name>`. Katalogi `libs/shared/...` i `libs/apps/frontend-app/...`.
> Tagi `scope:*, type:*, domain:*`. Biblioteki Angulara generuj BEZ komponentu
> (`--standalone=false --skipModule`) — to konwencja scaffold-handlera codera.

- [ ] **Shared (prefiks `mc`)**:
  ```powershell
  npx nx g @nx/js:library shared-util  --directory=libs/shared/util  --importPath=@mc/shared/util  --tags="scope:shared,type:util,domain:shared"  --unitTestRunner=vitest
  npx nx g @nx/js:library shared-model --directory=libs/shared/model --importPath=@mc/shared/model --tags="scope:shared,type:model,domain:shared" --unitTestRunner=vitest
  npx nx g @nx/js:library shared-asset --directory=libs/shared/asset --importPath=@mc/shared/asset --tags="scope:shared,type:asset,domain:shared" --unitTestRunner=none
  npx nx g @nx/angular:library shared-core-api   --directory=libs/shared/core/api   --importPath=@mc/shared/core/api   --tags="scope:shared,type:core,domain:shared" --prefix=mc --standalone=false --skipModule
  npx nx g @nx/angular:library shared-core-state --directory=libs/shared/core/state --importPath=@mc/shared/core/state --tags="scope:shared,type:core,domain:shared" --prefix=mc --standalone=false --skipModule
  ```
- [ ] **`libs/shared/asset` = TYLKO tokeny `component`-level workspace** (bridge).
  Tokeny `primitive`+`semantic`+`style` przychodzą z `<DS_PKG>` (globalne CSS vars —
  konsumpcja przez `var()` bez importu; `@use` tylko helpery SCSS; `@import` nigdy).
  Zgodne z modelem „zewn. DS dostarcza bazę, workspace dodaje component-tokeny".
- [ ] **App (prefiks `mcr`, scope `frontend-app`)** — pilot domeny `auth`:
  ```powershell
  npx nx g @nx/angular:library frontend-app-core-auth    --directory=libs/apps/frontend-app/core/auth    --importPath=@mcr/core/auth    --tags="scope:frontend-app,type:core,domain:auth"    --prefix=mcr --standalone=false --skipModule
  npx nx g @nx/angular:library frontend-app-ui-auth      --directory=libs/apps/frontend-app/ui/auth      --importPath=@mcr/ui/auth      --tags="scope:frontend-app,type:ui,domain:auth"      --prefix=mcr --standalone=false --skipModule
  npx nx g @nx/angular:library frontend-app-state-auth   --directory=libs/apps/frontend-app/state/auth   --importPath=@mcr/state/auth   --tags="scope:frontend-app,type:state,domain:auth"   --prefix=mcr --standalone=false --skipModule
  npx nx g @nx/angular:library frontend-app-feature-auth --directory=libs/apps/frontend-app/feature/auth --importPath=@mcr/feature/auth --tags="scope:frontend-app,type:feature,domain:auth" --prefix=mcr --standalone=false --skipModule
  ```
  > Te app-liby docelowo tworzy sam coder (skill `nx-library-generator`). Powyższe =
  > bootstrap, by aliasy/graf istniały przed odpaleniem agentów.

---

## Faza 4 — Konfiguracja nx / tsconfig / eslint

- [ ] **`nx.json`**: `workspaceLayout {appsDir:"apps", libsDir:"libs"}`; generators
  defaults (`@nx/angular:application` → playwright/eslint/scss/vitest-analog;
  `@nx/angular:component` → scss/OnPush/skipTests/displayBlock/exportDefault:false);
  plugins (`@nx/playwright`, `@nx/eslint`, `@nx/docker`, `@nx/vite`, `@nx/vitest`);
  `analytics:false`, `neverConnectToCloud:true`.
- [ ] **`tsconfig.base.json`** `paths` — `@mc/shared/*` i `@mcr/*`;
  `moduleResolution:"bundler"`, `target:es2022`, dekoratory on.
- [ ] **`eslint.config.mjs`** — `@nx/enforce-module-boundaries` (izolacja `type:ui` od
  `state`/`feature`, app-od-app).
  ```powershell
  npx nx lint frontend-app
  npx nx graph
  ```

---

## Faza 5 — Bootstrap DS / NGXS / i18n (BEZ Material)

- [ ] **Twój DS** — setup wg dokumentacji `<DS_PKG>`: w `app.config.ts` providery
  wymagane przez DS (np. `provideAnimations()`), w globalnych stylach załaduj bazowe
  tokeny DS (CSS vars). **Nie ma `ng add @angular/material`.**
- [ ] **NGXS** w `app.config.ts`:
  `provideStore([...], withNgxsRouterPlugin(), withNgxsStoragePlugin(), withNgxsLoggerPlugin())`.
- [ ] **ngx-translate v17**: `provideTranslateService({ lang, fallbackLang, loader })`.
  ```powershell
  npm run start:frontend-app:local   # sanity (skrypt dodaj do package.json wg referencji)
  ```

---

## Faza 6 — Storybook (katalog UI + baza a11y/wizualnych)

> Pełny runbook pułapek (webpack-nie-Vite, brak `--dry-run`, injekcja tokenów, cache
> webpacka): wzór `docs/storybook-setup-runbook.md` w repo referencyjnym.

- [ ] (Zalecane) `.npmrc` → `legacy-peer-deps=true`.
- [ ] Generator na jednej bibliotece `type:ui`:
  ```powershell
  $env:NPM_CONFIG_LEGACY_PEER_DEPS = "true"
  npx nx g @nx/angular:storybook-configuration frontend-app-ui-auth `
    --interactionTests=false --generateStories=true --configureStaticServe=false --tsConfiguration=true --no-interactive
  # pin: storybook 10.4.2, @storybook/angular 10.4.2, @nx/storybook 22.7.0
  ```
- [ ] **Injekcja tokenów** w `.storybook` przez `staticDirs` + `preview-head.html`:
  załaduj BAZOWE CSS vars z `<DS_PKG>` (z `node_modules/<DS_PKG>/…/*.css`) ORAZ
  component-tokeny z `libs/shared/asset`. Providery stories: `applicationConfig` +
  `provideTranslateService` (fix `NG0201`).
  ```powershell
  npx nx build-storybook frontend-app-ui-auth
  npx nx storybook frontend-app-ui-auth        # http://localhost:4400
  ```

---

## Faza 7 — Tooling `.github/` (story-flow) + MCP + DS registry

- [ ] **Skopiuj drzewo `.github/`** z repo referencyjnego: `copilot-instructions.md`,
  `standards/*`, `skills/*`, `scripts/*` (`copilot.js`, `code-index/`, `figma/`, `mcp/`,
  `ngxs-generators/`, ekstraktory), `agents/story-flow/*`.
- [ ] **`.vscode/mcp.json`** — serwer `code-index` (stdio, zero-dep). Sekrety jako `${env:NAZWA}`.
  ```jsonc
  { "servers": { "code-index": { "type": "stdio", "command": "node",
    "args": [".github/scripts/code-index/code-index-mcp-server.js"] } } }
  ```
  > `.gitignore` ignoruje `.vscode/*` poza whitelistą — dopisz `!.vscode/mcp.json`
  > albo trzymaj świadomie poza gitem.
- [ ] **`.github/agents/story-flow/config/global-config.js` → blok `PROJECT`** — JEDYNE
  miejsce z założeniami stack-owymi:
  ```js
  libraryNaming: {
    sharedScope: 'shared',
    sharedPrefix: 'mc',                 // ← było 'gdprrt'
    appsBase: 'libs/apps',
    sharedBase: 'libs/shared',
    appProjectsBase: 'apps',
  },
  // DS jako pakiet npm — skan deklaracji Ivy z .d.ts (origin: ds):
  dsLibraries: [
    { path: 'node_modules/<DS_PKG>', library: '<DS_PKG>',
      stripPrefix: '<DsPrefix>',        // ← prefiks nazw KLAS, np. 'Mc' dla McButtonComponent
      stripSuffix: 'Component|Directive' },
  ],
  figmaVariables: { mode: 'export-file', exportPath: './node_modules/.cache/figma/variables.json' },
  story: { clarifierInput: 'specs/story/<twoja-story>.md' },
  ```
  > join_key: `McButtonComponent` → `Mc`+`Component` zdjęte → `button`. Potwierdź realne
  > nazwy klas eksportowane przez `<DS_PKG>` (jego `.d.ts`).
- [ ] **Figma Variables → cache**: mini-plugin `.github/scripts/figma/variables-plugin`
  (uruchom w Figmie, zapisz JSON jako `node_modules/.cache/figma/variables.json`).
  `/nodes` nigdy nie niesie nazw zmiennych — ta mapa jest wymagana do rozwiązywania tokenów.
- [ ] **code-index** buduje się sam przy 1. uruchomieniu MCP/agenta (różnicowy sync,
  DB w `node_modules/.cache`, niekomitowana). Sanity-graf:
  ```powershell
  npm run code-index:graph
  ```

---

## Faza 8 — Weryfikacja i uruchomienie agentów

- [ ] **Pre-flight**:
  ```powershell
  node --version; $env:FIGMA_API_KEY; copilot
  npx nx graph
  Test-Path node_modules/<DS_PKG>/package.json                       # DS zainstalowany
  Test-Path node_modules/.cache/figma/variables.json                 # (jeśli design-bearing)
  ```
- [ ] **Test silnika decomposera** (offline, golden-evale — jeśli skonfigurowane):
  ```powershell
  npm run test
  ```
- [ ] **Uruchom orchestrator story-flow** (clarifier → decomposer → architect → planner → coder):
  ```powershell
  node .github/agents/story-flow/runner.js
  ```
  > Pojedynczy stage osobno: `node .github/agents/story-flow/<stage>/runner.js <featureId>`
  > (`story-clarifier | story-decomposer | system-architect | planner | coder`).

---

## Świadome granice / uwagi

- **`./generators` (`generators-prepare`, `init-state`, `endpoint`)** to OSOBNY pakiet
  schematics — story-flow go NIE wymaga (coder scaffoluje przez `npx nx generate
  @nx/angular:…` + lokalny `.github/scripts/ngxs-generators/index.js`). Pomiń, chyba że
  celowo używasz tych generatorów.
- **Auth Copilot SDK** — jedyny krok nieweryfikowalny z kodu (token bierze runtime CLI);
  potwierdź wg dokumentacji beta `@github/copilot-sdk`.
- **Storybook = drugi toolchain** (webpack obok Vite/Vitest) — świadomy koszt;
  `storybook ai setup` działa tylko dla React+Vite, nie Angular+webpack.

---

## Tabela zmian vs repo referencyjne (gdprrt-frontend)

| Obszar | gdprrt | mortgage-case-retention-fe |
|---|---|---|
| Repo/folder | gdprrt-frontend | **mortgage-case-retention-fe** (pusty → create-nx-workspace) |
| Prefiks shared | `gdprrt` → `@gdprrt/shared` | **`mc` → `@mc/shared`**, selektory `mc-*` |
| Prefiks app | `@gdprrt-app` | **`mcr` → `@mcr/...`**, selektory `mcr-*` |
| DS | Angular Material (`ng add`) | **`<DS_PKG>` z npm**; `dsLibraries`→`node_modules/<DS_PKG>`; brak `ng add` |
| Tokeny | własna `shared/asset` (interim) | **baza z `<DS_PKG>`** + component-tokeny w `shared/asset` |
