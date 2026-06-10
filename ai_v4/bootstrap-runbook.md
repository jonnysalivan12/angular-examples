# Runbook (komendowy): bootstrap `mortgage-case-retention-fe` → story-workflow

> Każdy krok = **polecenie do uruchomienia** (PowerShell, Windows). Edycje plików
> konfiguracyjnych też są komendami (patch przez `node` / here-string).
> Stack: Nx 22.7, Angular 21.2, własny DS (npm), Copilot SDK, code-index MCP.
>
> **Parametry:** repo `mortgage-case-retention-fe`, prefiks `mc` (shared) / `mcr` (app),
> aplikacja nx `frontend-app`, DS = pakiet npm (zamiast Angular Material).

## 🔧 Placeholdery — podstaw przed uruchomieniem
| Placeholder | Znaczenie | Przykład |
|---|---|---|
| `<DS_PKG>` | nazwa pakietu npm DS | `@mc/ds` |
| `<DS_VER>` | wersja DS | `1.0.0` |
| `<DsPrefix>` | prefiks nazw KLAS komponentów DS (`stripPrefix`) | `Mc` |
| `<REF>` | ścieżka repo referencyjnego (źródło `.github/`) | `C:\Workspace\Projects\temp\gdprrt-frontend` |

---

## Faza 0 — Prerekwizyty

```powershell
node --version                          # >= v22 (code-index: node:sqlite + FTS5)
npm  --version
npm i -g @github/copilot                # Copilot CLI (auth dla @github/copilot-sdk)
copilot                                 # login device-flow
$env:FIGMA_API_KEY = "figd_..."         # PAT Figmy (trwale: setx FIGMA_API_KEY "figd_...")
```

---

## Faza 1 — create-nx-workspace (pusty folder, prefiks `mcr`)

```powershell
# uruchom z KATALOGU NADRZĘDNEGO — utworzy folder mortgage-case-retention-fe
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

cd mortgage-case-retention-fe
```

---

## Faza 2 — nx.json: blok `generators` (patch-komenda)

```powershell
@'
const fs = require('fs');
const p = 'nx.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.generators = {
  ...(j.generators || {}),
  '@nx/angular:application': { e2eTestRunner: 'playwright', linter: 'eslint', style: 'scss', unitTestRunner: 'vitest-analog' },
  '@nx/angular:library':     { linter: 'eslint', unitTestRunner: 'vitest-analog' },
  '@nx/angular:component':   { style: 'scss', type: 'component', changeDetection: 'OnPush', skipTests: true, displayBlock: true, exportDefault: false },
};
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
console.log('nx.json: generators set');
'@ | Set-Content -Encoding utf8 patch-nx.cjs
node patch-nx.cjs
Remove-Item patch-nx.cjs
```

---

## Faza 3 — Instalacje (komendy)

### 3a. Angular core (BEZ Material)
```powershell
npm i --legacy-peer-deps `
  "@angular/animations@21.2.10" "@angular/common@21.2.10" "@angular/compiler@21.2.10" `
  "@angular/core@21.2.10" "@angular/forms@21.2.10" "@angular/platform-browser@21.2.10" `
  "@angular/platform-browser-dynamic@21.2.10" "@angular/router@21.2.10" `
  "rxjs@7.8.2" "zone.js@0.16.1" "tslib@2.8.1"
```
```powershell
# tylko jeśli <DS_PKG> wymaga CDK (sprawdź jego peerDependencies):
npm i --legacy-peer-deps "@angular/cdk@21.2.8"
```

### 3b. Twój DS (zamiast Material)
```powershell
npm i --legacy-peer-deps "<DS_PKG>@<DS_VER>"
```

### 3c. NGXS — wszystko z repo
```powershell
npm i --legacy-peer-deps `
  "@ngxs/store@21.0.0" "@ngxs/router-plugin@21.0.0" "@ngxs/storage-plugin@21.0.0" `
  "@ngxs/logger-plugin@21.0.0" "@ngxs/schematics@0.0.1-alpha.5" "ngxs-reset-plugin@4.0.0"
npm i -D --legacy-peer-deps "@ngxs/devtools-plugin@21.0.0"
```

### 3d. ngx-translate — core + messageformat + cut (wszystko z repo)
```powershell
npm i --legacy-peer-deps `
  "@ngx-translate/core@17.0.0" `
  "@messageformat/core@3.4.0" "messageformat@4.0.0" `
  "ngx-translate-messageformat-compiler@7.2.0" `
  "ngx-translate-multi-http-loader@20.0.0" `
  "ngx-translate-cut@21.1.0"
```

### 3e. Narzędzia pipeline'u story-flow (dev — NIEZBĘDNE dla agentów)
```powershell
npm i -D --legacy-peer-deps `
  "@github/copilot-sdk@^1.0.0-beta.4" "@clack/prompts@^1.4.0" "js-yaml@^4.1.1" "yaml@^2.9.0"
```

---

## Faza 4 — Generowanie WSZYSTKICH typów bibliotek

> Aliasy w `tsconfig.base.json` dopisują się automatycznie przez `--importPath`.
> Dodaj `--dry-run` na końcu dowolnej komendy, by zobaczyć plan bez zapisu.

```powershell
# ── type:util / type:model / type:asset → @nx/js:library (TS, buildable=tsc) ──
npx nx g @nx/js:library shared-util  --directory=libs/shared/util  --importPath=@mc/shared/util  --tags=scope:shared,type:util,domain:shared  --bundler=tsc --unitTestRunner=vitest --no-interactive
npx nx g @nx/js:library shared-model --directory=libs/shared/model --importPath=@mc/shared/model --tags=scope:shared,type:model,domain:shared --bundler=tsc --unitTestRunner=vitest --no-interactive
npx nx g @nx/js:library shared-asset --directory=libs/shared/asset --importPath=@mc/shared/asset --tags=scope:shared,type:asset,domain:shared --bundler=tsc --unitTestRunner=none   --no-interactive

# ── type:core → @nx/angular:library (BEZ komponentu) ──
npx nx g @nx/angular:library shared-core-api   --directory=libs/shared/core/api   --importPath=@mc/shared/core/api   --tags=scope:shared,type:core,domain:shared --prefix=mc --standalone=false --skipModule --no-interactive
npx nx g @nx/angular:library shared-core-state --directory=libs/shared/core/state --importPath=@mc/shared/core/state --tags=scope:shared,type:core,domain:shared --prefix=mc --standalone=false --skipModule --no-interactive

# ── type:ui / type:state / type:feature → @nx/angular:library (app scope, prefiks mcr, domena auth) ──
npx nx g @nx/angular:library frontend-app-ui-auth      --directory=libs/apps/frontend-app/ui/auth      --importPath=@mcr/ui/auth      --tags=scope:frontend-app,type:ui,domain:auth      --prefix=mcr --standalone=false --skipModule --no-interactive
npx nx g @nx/angular:library frontend-app-state-auth   --directory=libs/apps/frontend-app/state/auth   --importPath=@mcr/state/auth   --tags=scope:frontend-app,type:state,domain:auth   --prefix=mcr --standalone=false --skipModule --no-interactive
npx nx g @nx/angular:library frontend-app-feature-auth --directory=libs/apps/frontend-app/feature/auth --importPath=@mcr/feature/auth --tags=scope:frontend-app,type:feature,domain:auth --prefix=mcr --standalone=false --skipModule --no-interactive
npx nx g @nx/angular:library frontend-app-core-auth    --directory=libs/apps/frontend-app/core/auth    --importPath=@mcr/core/auth    --tags=scope:frontend-app,type:core,domain:auth    --prefix=mcr --standalone=false --skipModule --no-interactive
```
> Pokryte typy: `util, model, asset` (JS) + `core, ui, state, feature` (Angular).

---

## Faza 5 — `@nx/enforce-module-boundaries` (nadpisanie eslint.config.mjs, 1:1 z repo)

> Single-quoted here-string (`@'…'@`) zapisuje treść DOSŁOWNIE — apostrofy bez escapowania.
```powershell
@'
import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@angular-eslint/no-output-native': 'off',
      '@angular-eslint/directive-selector': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'scope:frontend-app', onlyDependOnLibsWithTags: ['scope:frontend-app', 'scope:shared'] },
            { sourceTag: 'type:app',     onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:state', 'type:core', 'type:model', 'type:util', 'type:asset'] },
            { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:state', 'type:model', 'type:core', 'type:ui', 'type:util', 'type:asset'] },
            { sourceTag: 'type:state',   onlyDependOnLibsWithTags: ['type:core', 'type:model', 'type:util', 'type:ui'] },
            { sourceTag: 'type:ui',      onlyDependOnLibsWithTags: ['type:model', 'type:util', 'type:asset'] },
            { sourceTag: 'type:core',    onlyDependOnLibsWithTags: ['type:model', 'type:util'] },
            { sourceTag: 'type:model',   onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:util',    onlyDependOnLibsWithTags: ['type:model'] },
            { sourceTag: 'type:asset',   onlyDependOnLibsWithTags: [] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {},
  },
];
'@ | Set-Content -Encoding utf8 eslint.config.mjs

npx nx lint frontend-app          # sanity: granice egzekwowane
npx nx graph                      # sanity: graf libów
```

---

## Faza 6 — Providery aplikacji (DS / NGXS / i18n) — zapis pliku

```powershell
@'
import { ApplicationConfig } from '@angular/core';
import { provideStore } from '@ngxs/store';
import { withNgxsRouterPlugin } from '@ngxs/router-plugin';
import { withNgxsStoragePlugin } from '@ngxs/storage-plugin';
import { withNgxsLoggerPlugin } from '@ngxs/logger-plugin';
import { provideTranslateService, TranslateCompiler } from '@ngx-translate/core';
import { TranslateMessageFormatCompiler } from 'ngx-translate-messageformat-compiler';

// Providery do WMERGOWANIA w apps/frontend-app/src/app/app.config.ts (pole providers).
// NGXS plugins (router/storage/logger) + ngx-translate z kompilatorem messageformat.
export const appProviders: ApplicationConfig['providers'] = [
  provideStore([], withNgxsRouterPlugin(), withNgxsStoragePlugin(), withNgxsLoggerPlugin()),
  provideTranslateService({
    lang: 'pl', fallbackLang: 'pl',
    compiler: { provide: TranslateCompiler, useClass: TranslateMessageFormatCompiler },
  }),
];
'@ | Set-Content -Encoding utf8 apps\frontend-app\src\app\app.providers.ts
```
> Następnie w `apps/frontend-app/src/app/app.config.ts`: `providers: [...appProviders]`
> (jedyny ręczny merge — `app.config.ts` ma już importy z generatora). DS: setup wg
> dokumentacji `<DS_PKG>` (providery + globalne CSS vars), bez `ng add`.

---

## Faza 7 — Storybook (komendy)

```powershell
'legacy-peer-deps=true' | Set-Content -Encoding utf8 .npmrc

$env:NPM_CONFIG_LEGACY_PEER_DEPS = "true"
npx nx g @nx/angular:storybook-configuration frontend-app-ui-auth `
  --interactionTests=false --generateStories=true --configureStaticServe=false --tsConfiguration=true --no-interactive
# pin: storybook 10.4.2, @storybook/angular 10.4.2, @nx/storybook 22.7.0

npx nx build-storybook frontend-app-ui-auth
npx nx storybook frontend-app-ui-auth        # http://localhost:4400
```
> Injekcja tokenów (`staticDirs` + `preview-head.html`): bazowe CSS vars z `<DS_PKG>`
> + component-tokeny z `libs/shared/asset`. Providery stories: `applicationConfig` +
> `provideTranslateService` (fix `NG0201`).

---

# ════════════════════════════════════════════════════════════
# SEKCJA: Przygotowanie story-workflow do pracy (komendy)
# ════════════════════════════════════════════════════════════

### S1. Skopiuj silnik `.github/` z repo referencyjnego
```powershell
$REF = "C:\Workspace\Projects\temp\gdprrt-frontend"   # <REF>
New-Item -ItemType Directory -Force .github | Out-Null
Copy-Item "$REF\.github\agents"                 .github\agents    -Recurse -Force
Copy-Item "$REF\.github\scripts"                .github\scripts   -Recurse -Force
Copy-Item "$REF\.github\skills"                 .github\skills    -Recurse -Force
Copy-Item "$REF\.github\standards"              .github\standards -Recurse -Force
Copy-Item "$REF\.github\copilot-instructions.md" .github\copilot-instructions.md -Force
```

### S2. Zarejestruj MCP `code-index` (+ whitelista w .gitignore)
```powershell
New-Item -ItemType Directory -Force .vscode | Out-Null
@'
{
  "servers": {
    "code-index": {
      "type": "stdio",
      "command": "node",
      "args": [".github/scripts/code-index/code-index-mcp-server.js"]
    }
  }
}
'@ | Set-Content -Encoding utf8 .vscode\mcp.json
Add-Content .gitignore "`n!.vscode/mcp.json"
```

### S3. Skonfiguruj projekt w `global-config.js` (prefiks `mc` + DS + story input)
> ⚠ Podstaw `<DS_PKG>` i `<DsPrefix>` w treści poniżej PRZED uruchomieniem.
```powershell
@'
const fs = require('fs');
const p = '.github/agents/story-flow/config/global-config.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/sharedPrefix:\s*'[^']*'/, "sharedPrefix:    'mc'");
s = s.replace(/dsLibraries:\s*\[[\s\S]*?\],/,
  "dsLibraries: [\n    { path: 'node_modules/<DS_PKG>', library: '<DS_PKG>', stripPrefix: '<DsPrefix>', stripSuffix: 'Component|Directive' },\n  ],");
s = s.replace(/clarifierInput:\s*'[^']*'/, "clarifierInput: 'specs/story/story.md'");
fs.writeFileSync(p, s);
console.log('global-config.js: sharedPrefix=mc, dsLibraries=<DS_PKG>, clarifierInput set');
'@ | Set-Content -Encoding utf8 patch-cfg.cjs
node patch-cfg.cjs
Remove-Item patch-cfg.cjs
```

### S4. Cache Figma Variables (mapa tokenów)
```powershell
New-Item -ItemType Directory -Force node_modules\.cache\figma | Out-Null
# uruchom plugin w Figmie: .github/scripts/figma/variables-plugin (zaimportuj manifest.json),
# zapisz wyeksportowany JSON jako:  node_modules\.cache\figma\variables.json
```

### S5. Skróty npm (run + graf)
```powershell
npm pkg set "scripts.story-flow=node .github/agents/story-flow/runner.js"
npm pkg set "scripts.code-index:graph=node .github/scripts/code-index/code-index-graph.js --open"
```

### S6. Pierwsze wejście (story) + sanity code-index
```powershell
New-Item -ItemType Directory -Force specs\story | Out-Null
# umieść treść story w specs\story\story.md (ścieżka z S3 clarifierInput)
node .github/scripts/code-index/code-index-graph.js     # baza buduje się sama (node_modules/.cache)
```

### S7. Pre-flight i uruchomienie agentów
```powershell
node --version; $env:FIGMA_API_KEY; copilot
npx nx graph
Test-Path node_modules\<DS_PKG>\package.json                 # DS zainstalowany
Test-Path node_modules\.cache\figma\variables.json           # mapa tokenów (jeśli design-bearing)

npm run story-flow        # === orchestrator: clarifier → decomposer → architect → planner → coder ===
# pojedynczy stage: node .github/agents/story-flow/<stage>/runner.js <featureId>
```

---

## Uwagi
- `./generators` (`generators-prepare`, `init-state`, `endpoint`) to OSOBNY pakiet —
  story-flow go NIE wymaga (coder scaffoluje przez `npx nx generate` + lokalny
  `.github/scripts/ngxs-generators/index.js`).
- Auth Copilot SDK bierze runtime CLI (krok 0 `copilot`) — niewidoczny w kodzie.
- Storybook = webpack (drugi toolchain obok Vite/Vitest); `storybook ai setup` tylko React+Vite.
