# SCSS Coding Standard
> Standard pisania stylów SCSS dla generowania kodu przez AI.  
> Wersja: 1.1 | Źródła: Sass Guidelines (sass-guidelin.es), community best practices 2025.

---

## 1. Moduły — `@use` i `@forward` zamiast `@import`

`@import` jest przestarzały i usunięty z Dart Sass. Jedynym sposobem importowania plików SCSS jest `@use` (konsumpcja) i `@forward` (reeksportowanie).

```scss
// ❌ ŹLE — @import jest deprecated
@import 'abstracts/variables';
@import 'abstracts/mixins';

// ✅ DOBRZE — @use z opcjonalnym aliasem przestrzeni nazw
@use 'abstracts/variables' as vars;
@use 'abstracts/mixins' as mix;

.button {
  color: vars.$color-primary;
  @include mix.flex-center;
}

// ✅ @use as * — importuje bez prefiksu (tylko dla własnych abstrakcji)
@use 'abstracts/variables' as *;

.button {
  color: $color-primary;
}
```

```scss
// ✅ @forward — reeksportowanie z indeksu (abstracts/_index.scss)
@forward 'variables';
@forward 'mixins';
@forward 'functions';

// Dzięki temu wystarczy jeden import:
// @use 'abstracts' as *;
```

Importuj tylko pliki bez CSS (zmienne, mixins, funkcje) — nigdy pliki generujące style CSS. Import pliku z CSS powoduje duplikację w każdym skompilowanym arkuszu, który go używa.

```scss
// ✅ DOBRZE — import tylko abstrakcji (zero CSS output)
@use 'abstracts' as *;

// ❌ ŹLE — zawiera CSS → duplikuje się w każdym pliku importującym
@use 'components/buttons';
```

---

## 2. Zmienne — SCSS vs CSS Custom Properties

Oba mechanizmy współistnieją i mają różne zastosowania. Używaj obu świadomie.

| | SCSS `$variable` | CSS `--custom-property` |
|---|---|---|
| Kiedy | Wartości compile-time: obliczenia, mixins, funkcje | Wartości runtime: theming, dark mode, dynamika |
| Widoczność | Znika po kompilacji | Widoczna w DevTools, modyfikowalna JS |
| Zasięg | Plik / moduł | Kaskadowy (dziedziczy w DOM) |

```scss
// ✅ SCSS variables — tokeny design systemu, obliczenia compile-time
$space-unit:    8px;
$space-sm:      $space-unit * 1;    // 8px
$space-md:      $space-unit * 2;    // 16px
$space-lg:      $space-unit * 3;    // 24px

$color-primary: #3a7bd5;
$radius-base:   4px;

// ✅ CSS Custom Properties — runtime, theming, dark mode
:root {
  --color-primary:  #{$color-primary};  // mostek: SCSS → CSS var
  --color-surface:  #ffffff;
  --color-text:     #1a1a1a;
  --space-md:       #{$space-md};
}

// ✅ Dark mode — nadpisanie CSS vars, nie SCSS
[data-theme='dark'] {
  --color-surface: #1a1a1a;
  --color-text:    #f0f0f0;
}
```

### Nazewnictwo zmiennych

```scss
// SCSS — kebab-case, od ogółu do szczegółu
$color-primary:       #3a7bd5;
$color-primary-hover: darken($color-primary, 10%);
$color-error:         #e53e3e;

$font-size-base:      1rem;
$font-size-sm:        0.875rem;
$font-size-lg:        1.25rem;

$space-sm:            8px;
$space-md:            16px;

$breakpoint-md:       768px;
$breakpoint-lg:       1024px;

// CSS Custom Properties — kebab-case z prefiksem kategorii
// --color-*, --space-*, --font-*, --radius-*, --shadow-*
```

---

## 3. Selektory — klasy, BEM, brak ID i `!important`

### 3.1 Zawsze klasy, nigdy ID

```scss
// ❌ ŹLE — ID ma zbyt wysoką specyficzność
#header { ... }
#submit-button { ... }

// ✅ DOBRZE
.header { ... }
.submit-button { ... }
```

### 3.2 Brak `!important`

`!important` to sygnał problemu ze specyficznością. Jedyne wyjątki: klasy utility (`u-hidden`, `u-sr-only`).

```scss
// ❌ ŹLE
.card { color: red !important; }

// ✅ DOBRZE — rozwiąż problem specyficznością lub refaktoryzacją
.card--error { color: red; }

// ✅ Jedyny akceptowany wyjątek — utility class
.u-hidden { display: none !important; }
.u-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  !important; // celowe — musi wygrać z każdym kontekstem
}
```

### 3.3 BEM — konwencja nazewnictwa

Format: `.block__element--modifier`

```scss
.card {                        // Block
  padding: $space-md;

  &__header {                  // Element
    font-size: $font-size-lg;
  }

  &__body {                    // Element
    color: var(--color-text);
  }

  &--featured {                // Modifier bloku
    border: 2px solid var(--color-primary);
  }

  &--loading {                 // Modifier bloku
    opacity: 0.6;
    pointer-events: none;
  }
}
```

### 3.4 BEM — zakaz wielokrotnego `__` w nazwie klasy

`.block__element__sub-element` jest **niedozwolone**. BEM definiuje tylko dwa poziomy: Block i Element. Element zawsze należy bezpośrednio do Bloku — nie do innego Elementu.

```scss
// ❌ ŹLE — wielokrotne __ sugeruje zagnieżdżoną strukturę, której BEM nie modeluje
.header__nav__item { ... }
.header__item__element__button { ... }

// ✅ DOBRZE — elementy na płaskim poziomie względem bloku
.header__nav { ... }
.header__nav-item { ... }      // łącznik zamiast __

// ✅ DOBRZE — jeśli element jest nowym "kontekstem", wprowadź nowy blok
.nav {                         // nowy blok
  &__item { ... }              // element bloku nav
  &__link { ... }
}

// ✅ DOBRZE — modifier na elemencie jest ok
.card__footer--highlighted { ... }   // element + modifier
```

Gdy DOM jest głęboko zagnieżdżony, a BEM prowadzi do wielokrotnych `__`, to sygnał do wydzielenia nowego bloku.

### 3.5 Selektory elementów tylko w kontekście treści

```scss
// ❌ ŹLE — element selector globalnie
div { margin: 0; }
p { color: blue; }

// ✅ DOBRZE — element selector tylko wewnątrz dedykowanego "content wrapper"
.prose {
  p { margin-bottom: $space-md; }
  h2 { font-size: $font-size-lg; }
  a { color: var(--color-primary); }
}
```

---

## 4. Zagnieżdżanie — max 3 poziomy

Głębokie zagnieżdżanie generuje długie selektory CSS, zwiększa specyficzność i utrudnia utrzymanie.

```scss
// ❌ ŹLE — 5 poziomów zagnieżdżenia
.nav {
  .nav__list {
    .nav__item {
      a {
        &:hover {
          color: red; // kompiluje do: .nav .nav__list .nav__item a:hover
        }
      }
    }
  }
}

// ✅ DOBRZE — max 3 poziomy; pseudo-klasy i pseudo-elementy nie liczą się jako poziom
.nav {
  &__list {
    display: flex;
  }

  &__item {
    padding: $space-sm;
  }

  &__link {
    color: var(--color-text);

    &:hover {         // pseudo-klasa — nie jest dodatkowym poziomem zagnieżdżenia
      color: var(--color-primary);
    }

    &::before {       // pseudo-element — nie jest dodatkowym poziomem zagnieżdżenia
      content: '';
    }
  }
}
```

---

## 5. Kolejność deklaracji wewnątrz selektora

```scss
.element {
  // 1. @extend i @include — na początku
  @extend %clearfix;
  @include flex-center;

  // 2. Pozycjonowanie
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;

  // 3. Box model
  display: flex;
  width: 100%;
  height: 48px;
  padding: $space-sm $space-md;
  margin: 0 auto;

  // 4. Typografia
  font-size: $font-size-base;
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-text);
  text-align: center;

  // 5. Wygląd (background, border, shadow)
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: $radius-base;
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);

  // 6. Transformacje i animacje
  transition: background-color 0.2s ease;
  transform: translateX(0);

  // 7. Pseudo-klasy i pseudo-elementy
  &:hover { ... }
  &:focus-visible { ... }
  &::before { ... }

  // 8. Zagnieżdżone selektory (BEM elements/modifiers)
  &__child { ... }
  &--modifier { ... }

  // 9. Media queries
  @media (min-width: $breakpoint-md) { ... }
}
```

---

## 6. Mixins, Functions i Placeholders (`%`)

### 6.1 Mixin — generuje CSS, przyjmuje parametry

```scss
@mixin flex-center($direction: row) {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: $direction;
}

@mixin truncate($width: 100%) {
  width: $width;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// Użycie
.spinner { @include flex-center; }
.caption { @include truncate(200px); }
```

### 6.2 Function — obliczenia, zwraca wartość, nie generuje CSS

```scss
@function rem($px, $base: 16) {
  @return #{calc($px / $base)}rem;
}

@function z($layer) {
  $layers: (base: 0, dropdown: 100, modal: 200, toast: 300);
  @return map.get($layers, $layer);
}

// Użycie
.heading { font-size: rem(24); }    // 1.5rem
.modal   { z-index: z(modal); }     // 200
```

### 6.3 Placeholder `%` — współdzielone style bez duplikacji klas

```scss
%reset-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

// Kompiluje do jednego bloku CSS: .nav__list, .breadcrumb { ... }
.nav__list  { @extend %reset-list; }
.breadcrumb { @extend %reset-list; }
```

---

## 7. Responsive — mobile-first i media queries

### 7.1 Mobile-first

Pisz style dla małych ekranów jako bazowe, rozszerzaj dla większych przez `min-width`.

```scss
// ❌ ŹLE — desktop-first
.grid {
  grid-template-columns: repeat(3, 1fr);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

// ✅ DOBRZE — mobile-first
.grid {
  grid-template-columns: 1fr;

  @media (min-width: $breakpoint-md) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: $breakpoint-lg) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 7.2 Media queries zagnieżdżone przy selektorze

```scss
// ✅ Media query przy komponencie — kontekst widoczny od razu
.card {
  padding: $space-sm;

  @media (min-width: $breakpoint-md) {
    padding: $space-md;
  }
}
```

### 7.3 Mixin dla breakpointów

```scss
@mixin respond-to($breakpoint) {
  $breakpoints: (
    sm: 480px,
    md: 768px,
    lg: 1024px,
    xl: 1280px,
  );

  @if map.has-key($breakpoints, $breakpoint) {
    @media (min-width: map.get($breakpoints, $breakpoint)) {
      @content;
    }
  } @else {
    @warn 'Nieznany breakpoint: #{$breakpoint}';
  }
}

// Użycie
.sidebar {
  display: none;

  @include respond-to(lg) {
    display: block;
    width: 280px;
  }
}
```

---

## 8. Wzorce do unikania

| Antywzorzec | Właściwe podejście |
|---|---|
| `@import` | `@use` / `@forward` |
| ID jako selektory (`#id`) | Klasy (`.class`) |
| `!important` | Popraw specyficzność lub architekturę; wyjątek: utility classes |
| Zagnieżdżenie > 3 poziomów | Spłaszcz, użyj BEM |
| `.block__el__sub` — wielokrotne `__` | Płaski BEM lub nowy blok |
| Import pliku z CSS | Importuj tylko abstrakcje (zmienne, mixiny, funkcje) |
| Desktop-first media queries | Mobile-first z `min-width` |
| Magic numbers (`16px`, `#3a7bd5`) | Zmienne: `$space-md`, `$color-primary` |
| Element selectors globalnie | Tylko w dedykowanym content wrapper (`.prose`) |

---

## Szybka ściągawka dla AI

Gdy generujesz kod SCSS:

1. **`@use` / `@forward`** — nigdy `@import`; importuj tylko abstrakcje (brak CSS output)
2. **SCSS `$var` vs CSS `--var`** — SCSS dla compile-time (obliczenia, mixiny), CSS Custom Properties dla runtime (theming, dark mode)
3. **Selektory** — wyłącznie klasy; brak ID; brak `!important` (wyjątek: utility classes)
4. **BEM** — `.block__element--modifier`; tylko jeden `__` w nazwie — zakaz `.block__el__sub`
5. **Zagnieżdżenie max 3 poziomy** — pseudo-klasy/elementy (`&:hover`, `&::before`) nie liczą się
6. **Kolejność** — `@extend`/`@include` → pozycjonowanie → box model → typografia → wygląd → animacje → pseudo → zagnieżdżone → media queries
7. **Mobile-first** — style bazowe dla mobile, `min-width` dla większych breakpointów; media queries przy selektorze
8. **Zmienne zamiast magic numbers** — `$space-md` nie `16px`; `$color-primary` nie `#3a7bd5`
