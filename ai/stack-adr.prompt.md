# Utwórz ADR dla stacku technologicznego

Przeanalizuj `package.json` i utwórz ADR dokumentujący stack technologiczny projektu.

## Krok 1 — Odczytaj zależności

Przeczytaj `package.json` (i jeśli istnieje `package-lock.json` lub `yarn.lock` — użyj go do weryfikacji faktycznych wersji).

Zbierz wszystkie pozycje z:
- `dependencies`
- `devDependencies`
- `peerDependencies` (jeśli istnieją)

## Krok 2 — Pogrupuj biblioteki

Przypisz każdą bibliotekę do jednej z poniższych kategorii:

- **Framework** — Angular, React, Vue i ich core paczki
- **Monorepo** — NX, Turborepo, Lerna i pluginy
- **State management** — NgRx, NGXS, Akita, Zustand itp.
- **UI / komponenty** — Angular Material, PrimeNG, biblioteki ikon
- **Formularze** — Angular Forms, React Hook Form, Zod, Yup
- **HTTP / API** — HttpClient, Axios, Apollo, tRPC
- **Routing** — Angular Router, React Router itp.
- **Testy** — Jest, Cypress, Playwright, Testing Library
- **Linting / formatowanie** — ESLint, Prettier, Stylelint i ich pluginy
- **Budowanie** — Webpack, Vite, esbuild, pluginy kompilatora
- **Narzędzia deweloperskie** — husky, lint-staged, commitlint
- **Typy** — paczki `@types/*`
- **Pozostałe** — wszystko co nie pasuje wyżej

Pomiń paczki które są wyłącznie zależnościami pośrednimi (nie wymienionymi wprost w `package.json`).

## Krok 3 — Ustal numer ADR

Sprawdź jakie pliki istnieją w `.github/adr/` i dobierz kolejny numer.
Jeśli folder nie istnieje — utwórz go i zacznij od `001`.

## Krok 4 — Zapisz plik

Utwórz `.github/adr/NNN-stack.md` według poniższego szablonu:

```markdown
# ADR-NNN: Stack technologiczny

**Status:** Accepted
**Data:** YYYY-MM-DD
**Dotyczy:** cały monorepo

---

## Kontekst

[1-2 zdania — czym jest projekt i dlaczego ten stack został wybrany.
Jeśli nie masz tych informacji, napisz: "Do uzupełnienia przez zespół."]

---

## Stack

### Framework
| Biblioteka | Wersja | Opis |
|---|---|---|
| `nazwa` | `x.x.x` | krótki opis roli w projekcie |

### Monorepo
| Biblioteka | Wersja | Opis |
|---|---|---|

### State management
| Biblioteka | Wersja | Opis |
|---|---|---|

[... kolejne kategorie które mają co najmniej jedną bibliotekę ...]

---

## Decyzje i uzasadnienia

[Dla każdej kluczowej decyzji (wybór frameworka, state management, narzędzi testowych)
napisz 1-2 zdania uzasadnienia. Jeśli uzasadnienie jest nieznane, napisz "Do uzupełnienia."]

---

## Zadania do wykonania

- [ ] Uzupełnić sekcję "Kontekst" o opis projektu
- [ ] Zweryfikować uzasadnienia decyzji z zespołem
- [ ] Zaktualizować przy każdej istotnej zmianie zależności

---
*Wygenerowano automatycznie z package.json. Wymaga weryfikacji przez zespół.*
```

## Zasady

- Wersje przepisuj dokładnie z `package.json` — bez zgadywania
- Pomijaj kategorie które są puste
- Pomijaj paczki `@types/*` jeśli jest ich więcej niż 5 — zamiast tego napisz "Standardowe typy TypeScript dla użytych bibliotek"
- Opisy w tabeli: maksymalnie 8 słów, konkretne (np. "zarządzanie stanem aplikacji" nie "popularna biblioteka")
- Jeśli biblioteka jest tylko w `devDependencies` — dodaj znacznik `dev` w kolumnie Opis
