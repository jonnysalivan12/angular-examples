/**
 * Reguły granic zależności — jedyne miejsce, w którym są zapisane. Osobny moduł,
 * bo czytają je niezależnie obie reguły lintu i przegląd repozytorium.
 *
 * ⚠ LUSTRO: `type:*` odpowiada liście `LIBRARY_TYPES` (`scripts/config/library.js`),
 * `context:*` — rejestrowi z `docs/standards/context.md`. Nowy typ albo kontekst
 * zmieniasz w OBU miejscach; rozjazd zgłasza `npm run validate:boundary-tags`.
 */
export const DEP_CONSTRAINTS = [
  // ── Oś scope ────────────────────────────────────────────────────
  {
    sourceTag: 'scope:shared',
    onlyDependOnLibsWithTags: ['scope:shared'],
  },
  {
    sourceTag: 'scope:frontend-app',
    onlyDependOnLibsWithTags: ['scope:frontend-app', 'scope:shared'],
  },
  // ── Oś context (zamknięty rejestr kontekstów — context.md §1) ──
  // kontekst przekrojowy: nie zna ŻADNEGO kontekstu biznesowego
  {
    sourceTag: 'context:common',
    onlyDependOnLibsWithTags: ['context:common'],
  },
  // kontekst biznesowy: widzi siebie + common
  {
    sourceTag: 'context:auth',
    onlyDependOnLibsWithTags: ['context:auth', 'context:common'],
  },
  {
    sourceTag: 'context:user',
    onlyDependOnLibsWithTags: ['context:user', 'context:common'],
  },
  {
    sourceTag: 'context:workspace',
    onlyDependOnLibsWithTags: ['context:workspace', 'context:common'],
  },
  {
    sourceTag: 'context:ado',
    onlyDependOnLibsWithTags: ['context:ado', 'context:common'],
  },
  {
    sourceTag: 'context:process',
    onlyDependOnLibsWithTags: ['context:process', 'context:common'],
  },
  {
    sourceTag: 'context:entitlement',
    onlyDependOnLibsWithTags: ['context:entitlement', 'context:common'],
  },
  {
    sourceTag: 'context:dictionary',
    onlyDependOnLibsWithTags: ['context:dictionary', 'context:common'],
  },
  // ── Oś type (przekątna dozwolona dla wszystkich typów poza asset) ──
  {
    sourceTag: 'type:app',
    onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:state', 'type:core', 'type:model', 'type:util', 'type:asset'],
  },
  {
    sourceTag: 'type:feature',
    onlyDependOnLibsWithTags: ['type:feature', 'type:state', 'type:model', 'type:core', 'type:ui', 'type:util', 'type:asset'],
  },
  {
    sourceTag: 'type:state',
    onlyDependOnLibsWithTags: ['type:state', 'type:core', 'type:model', 'type:util', 'type:ui'],
  },
  {
    sourceTag: 'type:ui',
    onlyDependOnLibsWithTags: ['type:ui', 'type:model', 'type:util', 'type:asset'],
  },
  {
    sourceTag: 'type:core',
    onlyDependOnLibsWithTags: ['type:core', 'type:model', 'type:util'],
  },
  {
    sourceTag: 'type:model',
    onlyDependOnLibsWithTags: ['type:model'],
  },
  {
    sourceTag: 'type:util',
    onlyDependOnLibsWithTags: ['type:util', 'type:model'],
  },
  {
    sourceTag: 'type:asset',
    onlyDependOnLibsWithTags: [],
  },
  // Testy przeglądarkowe sięgają do aplikacji przez jej adres, nie przez import,
  // więc dziś nie zależą od żadnej biblioteki przestrzeni roboczej. Wpis istnieje,
  // bo tag bez reguły znaczy „projekt bez ograniczeń", a nie „projekt bez zależności".
  {
    sourceTag: 'type:e2e',
    onlyDependOnLibsWithTags: [],
  },
];
