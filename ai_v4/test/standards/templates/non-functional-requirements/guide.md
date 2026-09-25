# Non-Functional Requirements (NFR)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Wymagania jakościowe: szybkość, bezpieczeństwo, niezawodność, operacyjność.
Dokument nadrzędny dla ograniczeń niefunkcjonalnych.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz wymagania jakościowe systemu lub komponentu.

**Nie używaj gdy:**

- opisujesz wymaganie funkcjonalne procesu → [business-functional-spec](../business-functional-spec/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Bazowy zestaw powstaje na etapie VISION i jest uszczegóławiany później.
- Wiersze macierzy wymagań mają prefiks NFRT: `NFRT-PERF-01`. BFS, UC, TUC, CAP, API i INT wskazują wiersz pełnym ID: `API-001 constrained_by NFR-001.NFRT-PERF-01`. Cały NFR nie jest celem relacji.
- Kod kategorii odpowiada sekcji „Katalogu według kategorii”: PERF (Performance), AVAIL (Availability i Reliability), SEC (Security i Compliance), OBS (Observability i Auditability), OPS (Operability i Maintainability), CONT (Continuity). Numer liczysz w dokumencie, osobno w każdej kategorii: po `NFRT-PERF-02` w `NFR-001` następny jest `NFRT-PERF-03`.
- Numer NFRT nie wraca do obiegu. Usunięty wiersz znika z dokumentu, historię trzyma repozytorium.

## 4. Warianty

- **NFR systemowy**: `scope: system`.
- **NFR komponentowy**: `scope: component`.
