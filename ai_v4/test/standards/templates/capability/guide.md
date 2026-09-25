# Capability (CAP)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Zakres odpowiedzialności komponentu, modułu lub domeny, podobnie jak kontrakt
komponentu. Spina szczegóły z UC, TUC, NFR, API i integracji, ale ich nie
duplikuje.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz zakres odpowiedzialności komponentu (mapę artefaktów).

**Nie używaj gdy:**

- opisujesz kroki scenariusza → [use-case](../use-case/guide.md), [technical-use-case](../technical-use-case/guide.md),
- opisujesz kontrakt punktu końcowego → [api](../api/guide.md),
- opisujesz połączenie z systemem zewnętrznym → [integration](../integration/guide.md),
- opisujesz wymagania jakościowe → [non-functional-requirements](../non-functional-requirements/guide.md),
- opisujesz reguły biznesowe → [business-functional-spec](../business-functional-spec/guide.md), który jest ich domem.

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- UC, TUC, API, INT, QUE, FLOW, BPMN i STM wskazują zdolność wpisem `realizes`: `UC-001 realizes CAP-001`. Zdolność nie wymienia tych dokumentów; ich listę wylicza graf.
- Zdarzenia odbierane wskazujesz ID: `CAP-001 consumes QUE-002`. Zdolność publikującą wskazuje samo zdarzenie: `QUE-001 realizes CAP-001`.
- Progi jakości wskazujesz wierszem NFR: `CAP-002 constrained_by NFR-001.NFRT-SEC-01`.
- Zdolność nie wskazuje wymagań BFS. Wymaganie łączy się ze zdolnością przez scenariusz, który realizuje jedno i drugie: `UC-001 realizes BFS-001.REQ-01` i `CAP-001`.

## 4. Warianty

- **Minimalny**: Cel biznesowy, Zakres odpowiedzialności, Poza zakresem.
- **Pełny**: zalecany.
