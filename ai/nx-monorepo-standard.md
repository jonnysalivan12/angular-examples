# Nx Monorepo Standard — Podstawy
> To jest **podstawowa konfiguracja i ogólne zasady** pracy z Nx.  
> Konkretna struktura, nazwy zakresów (scope), typy bibliotek i reguły granic dopasowane do projektu są definiowane w osobnych plikach.  
> Stosuj razem z TypeScript Standard i Angular 21 Standard.

---

## 1. Czym jest Nx i co wnosi

Nx to warstwa orkiestracji nad istniejącymi narzędziami (Angular CLI, ESLint, TypeScript). Nie zastępuje ich — dodaje:

- **Caching** — wyniki zadań (`build`, `lint`, `test`) są cachowane; to samo wejście = pomijanie ponownego uruchomienia
- **Affected** — na podstawie grafu zależności i historii Git uruchamia zadania tylko dla projektów dotkniętych zmianami
- **Enforced boundaries** — ESLint blokuje importy przekraczające zdefiniowane granice między bibliotekami
- **Generators** — scaffolding tworzący projekty zgodne ze standardem workspace (pliki konfiguracyjne, tagi, aliasy)
- **Project graph** — wizualna mapa zależności; `nx graph` w przeglądarce

---

## 2. Tagowanie projektów (`project.json`)

Każdy projekt musi mieć tagi. Tagi to jedyna metadana, na której opiera się egzekwowanie granic — brak tagów oznacza brak możliwości kontroli architektury.

Każdy projekt zawsze dostaje **dwa wymiary tagów**:
- `scope:<nazwa>` — do jakiej domeny/obszaru należy projekt
- `type:<typ>` — jaką rolę architektoniczną pełni (np. `feature`, `ui`, `data-access`, `util`)

```json
// project.json — przykład
{
  "name": "...",
  "projectType": "library",
  "tags": ["scope:foo", "type:feature"],
  "sourceRoot": "..."
}
```

Projekt może mieć wiele tagów `scope:`, ale zawsze dokładnie **jeden** `type:`.

---

## 3. Egzekwowanie granic (`@nx/enforce-module-boundaries`)

Reguła ESLint egzekwuje, które projekty mogą importować z których — na podstawie tagów. Naruszenie = błąd `nx lint`, blokuje CI.

Konfiguracja żyje w `eslint.config.js` w korzeniu workspace. Reguły `depConstraints` definiują dozwolone zależności per tag.

```javascript
// eslint.config.js (root) — szkielet, depConstraints dostosowane do projektu
import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // Reguły definiowane per projekt — patrz pliki rozszerzeń
          ],
        },
      ],
    },
  },
];
```

Przykład działania reguły:

```typescript
// ❌ BŁĄD — import z biblioteki, na którą dana reguła nie zezwala
import { SomeService } from '@org/some-lib'; // nx lint: boundary violation

// ✅ OK — import dozwolony przez regułę
import { SomeComponent } from '@org/allowed-lib';
```

---

## 4. Publiczne API biblioteki — `index.ts`

Każda biblioteka eksponuje **wyłącznie** to, co jest wylistowane w `src/index.ts`. Żaden inny plik nie jest publiczny. Deep importy są niedozwolone.

```typescript
// src/index.ts — jedyne publiczne wejście biblioteki
export { SomeService } from './lib/some.service';
export type { SomeModel } from './lib/models/some.model';

// Wewnętrzne helpery, szczegóły implementacji — NIE eksportuj
```

```typescript
// ✅ Import przez alias — publiczne API
import { SomeService } from '@org/some-lib';

// ❌ Deep import — naruszenie enkapsulacji, blokowane przez ESLint
import { SomeService } from '@org/some-lib/src/lib/some.service';
```

---

## 5. Path aliases (`tsconfig.base.json`)

Każda biblioteka ma alias w `tsconfig.base.json` wskazujący na jej `index.ts`. Alias generowany jest automatycznie przez `nx generate` — nie dodawaj go ręcznie.

```json
// tsconfig.base.json — fragment
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@org/some-lib": ["libs/some/lib/src/index.ts"]
    }
  }
}
```

Format aliasu ustalony jest per projekt — patrz pliki rozszerzeń.

---

## 6. Generatory zamiast ręcznego tworzenia plików

Zawsze używaj `nx generate` do tworzenia aplikacji, bibliotek, komponentów i serwisów. Generator tworzy `project.json`, rejestruje alias w `tsconfig.base.json`, konfiguruje tagi i ustawia `tsconfig` projektu.

```bash
# Nowa biblioteka Angular
nx generate @nx/angular:library <nazwa> \
  --directory=<ścieżka> \
  --standalone \
  --tags="scope:<s>,type:<t>"

# Biblioteka TypeScript (bez Angular)
nx generate @nx/js:library <nazwa> \
  --directory=<ścieżka> \
  --tags="scope:<s>,type:<t>"

# Komponent wewnątrz biblioteki
nx generate @nx/angular:component <nazwa> \
  --project=<projekt> \
  --standalone

# Serwis wewnątrz biblioteki
nx generate @nx/angular:service <nazwa> \
  --project=<projekt>
```

---

## 7. Konfiguracja `nx.json` — caching i task pipeline

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/nx.json"
    ],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/src/test-setup.ts"
    ]
  },
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "lint": {
      "cache": true,
      "inputs": ["default", "{workspaceRoot}/eslint.config.js"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production"]
    }
  }
}
```

Zasady:
- `cache: true` — obowiązkowo dla `build`, `lint`, `test`; **nigdy** dla `serve` i `e2e`
- `dependsOn: ["^build"]` — build projektu czeka na build jego zależności
- `namedInputs` — definiuj raz w `nx.json`, referuj po nazwie w `project.json`; nie duplikuj list plików
- `defaultBase: "main"` — baza dla `nx affected` to gałąź `main`

---

## 8. Komendy — codzienna praca

```bash
# Uruchom target dla konkretnego projektu
nx <target> <projekt>

# Uruchom target dla wszystkich projektów
nx run-many -t <target>
nx run-many -t lint test

# Tylko projekty dotknięte zmianami — UŻYWAJ NA CI
nx affected -t build lint test --base=origin/main

# Wizualizacja grafu zależności
nx graph

# Pełna konfiguracja projektu (z inferred targets)
nx show project <projekt> --json

# Wyczyść lokalny cache
nx reset

# Pomiń cache jednorazowo
nx build <projekt> --skip-nx-cache
```

Zawsze używaj `nx` zamiast bezpośrednio `ng` — `ng build/test/lint` pomija caching i affected.

```bash
# ❌ Pomija caching i affected
ng build my-app
ng test my-lib

# ✅ Zawsze przez Nx
nx build my-app
nx test my-lib
```

---

## 9. Wzorce do unikania

| Antywzorzec | Właściwe podejście |
|---|---|
| Brak tagów w `project.json` | Zawsze `scope:` + `type:` |
| Deep import z biblioteki | Import tylko przez alias (przez `src/index.ts`) |
| Brak `src/index.ts` w bibliotece | Każda biblioteka musi mieć jawne publiczne API |
| Ręczne tworzenie plików bibliotek | Używaj `nx generate` |
| `ng build/test/lint` zamiast `nx` | Zawsze `nx build/test/lint` |
| `cache: false` dla `build/lint/test` | Zawsze `cache: true` |
| Circular dependency między bibliotekami | Wyciągnij wspólną logikę do dedykowanej biblioteki |

---

## Szybka ściągawka dla AI

Gdy generujesz kod w Nx monorepo:

1. **Tagi** — każdy `project.json` ma `scope:<nazwa>` i `type:<typ>`; brak tagów = brak kontroli architektury
2. **Granice** — `@nx/enforce-module-boundaries` w `eslint.config.js` egzekwuje `depConstraints` per tag
3. **Publiczne API** — każda biblioteka eksponuje tylko to co jest w `src/index.ts`; zero deep importów
4. **Aliasy** — importuj przez `@org/<alias>`; alias wskazuje na `index.ts`; nie używaj ścieżek relatywnych między bibliotekami
5. **Generatory** — `nx generate` do tworzenia bibliotek i komponentów; nie twórz plików ręcznie
6. **Komendy** — `nx` zamiast `ng`; `nx affected` na CI
7. **Cache** — `cache: true` dla `build`, `lint`, `test`; nigdy dla `serve` i `e2e`
8. **Szczegóły projektu** — konkretne scope, typy bibliotek i reguły granic są w plikach rozszerzeń
