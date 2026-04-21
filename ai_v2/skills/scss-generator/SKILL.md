---
name: scss-generator
description: >
  Use when writing or reviewing SCSS styles, component styling, CSS classes,
  BEM naming, responsive design, SCSS variables, mixins, placeholders,
  Angular component styles, ViewEncapsulation, :host styling.
---
 
# SCSS Standard

---

## Modules
- `@use` / `@forward` only — `@import` is forbidden
- `@use` only abstracts (variables, mixins, functions) — never files that generate CSS selectors
- `@forward` for re-export from index files
- `@use as *` only for abstracts

## Variables
- CSS Custom Properties (`--var-name`) for all output values — spacings, colors, typography, breakpoints
- SCSS `$variables` only for internal logic — mixin params, compile-time calculations
- All design tokens defined in `:root`
- No magic numbers — use CSS Custom Properties

## Selectors
- Classes only — never IDs
- BEM format: `block__element--modifier`
- Max 2 BEM levels — `block__el__el` forbidden, extract new block
- No `!important` — fix specificity through refactoring
- No inline styles

## Nesting
- Max 3 levels — pseudo-classes/elements don't count as level
- Media queries nested within selector

## Declaration Order
1. Positioning — `position`, `top`, `right`, `bottom`, `left`, `z-index`
2. Box model — `display`, `flex`, `padding`, `margin`, `width`, `height`
3. Appearance — `background`, `border`, `box-shadow`, `border-radius`
4. Typography — `font-size`, `font-weight`, `line-height`, `color`
5. Animations — `transition`, `transform`, `animation`

## Responsive
- Mobile-first: `@media (min-width: ...)`
- Breakpoints as mixin or CSS Custom Properties

## Angular Integration
- Default `ViewEncapsulation.Emulated` — never specify explicitly
- `:host` for component root element styling
- CSS Custom Properties as styling API — instead of `::ng-deep`
- UI library overrides only in global `styles.scss`

## Mixins & Placeholders
- Mixins generate CSS, accept parameters
- Functions return values, no CSS output
- Placeholders (`%`) for shared styles without class duplication
