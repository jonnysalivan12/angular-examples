# Use Case (UC)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Scenariusz działania użytkownika: co chce osiągnąć, jak to robi krok po kroku
i co może pójść nie tak. Odpowiada na pytanie „Co użytkownik robi i czego
oczekuje?”.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz scenariusz działania użytkownika.

**Nie używaj gdy:**

- scenariusz działa bez udziału użytkownika (cron, harmonogram, zadanie nocne) → [technical-use-case](../technical-use-case/guide.md),
- zbierasz wymagania i reguły procesu → [business-functional-spec](../business-functional-spec/guide.md).

Powiązane szablony: [business-functional-spec](../business-functional-spec/guide.md), [capability](../capability/guide.md), [non-functional-requirements](../non-functional-requirements/guide.md), [api](../api/guide.md), [screen-section](../screen-section/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- UC jest podrzędny wobec BFS: wskazuje realizowane wymagania i reguły pełnym ID: `UC-001 realizes BFS-001.REQ-01`, `BFS-001.RB-01`.
- Zdolność podajesz w polu „Zdolność” i wskazujesz wpisem `realizes`, przy kilku osobnym dla każdej: `UC-002 realizes CAP-001`, `CAP-002`.
- Tabele kroków (Kroki, warianty A, błędy E) mają kolumny „Ekran” i „Wywołanie”: `UC-001 contains SCR-001`, `UC-001 consumes API-001`. Ekran bywa wspólny dla kilku scenariuszy.
- Kolumna „Sekcja” jest opcjonalna. Wpisujesz w niej sekcję ekranu, gdy krok opisuje pracę użytkownika w jednej sekcji: `UC-010 contains SCRSEC-010`.
- W kolumnie „Wywołanie” podajesz API albo QUE. Integracji INT scenariusz nie woła wprost, tylko przez API, więc nie wymienia jej w treści.
- Krok, w którym użytkownik przypisuje, odkłada albo kończy zadanie procesu, podaje w „Wywołaniu” API, które to robi: `UC-004 consumes API-015` przy otwarciu zadania i `API-008` przy zapisie decyzji. Kroku procesu SPEC-WF scenariusz nie wymienia. Krok, który woła kilka API, podaje je w jednej komórce po przecinku.
- Przy zdarzeniu krok publikuje albo odbiera QUE: `UC-001 consumes QUE-001`.
- Warianty `A1, A2…` i błędy `E1, E2…` to wiersze tego UC: `UC-001 contains A1`.
- Rolę wskazujesz pełnym ID: `UC-001 involves ACTOR-001.ROLE-01`. Progi jakości wskazujesz wierszem NFR; wiersza NFR swojej zdolności nie powtarzasz: `UC-013` podlega `NFR-001.NFRT-PERF-02` przez `CAP-014`.
- Diagram jest opcjonalny i ma najwyżej 15 kroków.

## 4. Warianty

- **Uproszczony**: jeden przepływ, bez diagramu.
- **Po BFS**: zalecany.
- **Złożony**: rozbicie na pliki, jeden UC na aktora lub kanał.
