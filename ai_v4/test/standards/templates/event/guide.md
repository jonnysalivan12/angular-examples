# AsyncAPI, publikacja zdarzenia (QUE)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Kontrakt zdarzenia publikowanego asynchronicznie przez brokera. Jeden plik to
jedno zdarzenie.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz kontrakt zdarzenia publikowanego przez brokera
(Kafka, RabbitMQ).

**Nie używaj gdy:**

- opisujesz synchroniczny punkt końcowy → [api](../api/guide.md),
- opisujesz zasadę wspólną dla wielu zdarzeń, np. nagłówki komunikatu → [convention](../convention/guide.md); zdarzenie wskaże tę konwencję.

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Nagłówki wspólne dla zdarzeń, np. zgodne z AsyncAPI 3.0 i CloudEvents, opisuje konwencja: `QUE-001 applies CONV-004` w sekcji „Nagłówek komunikatu”. W tej sekcji podajesz tylko nagłówki własne zdarzenia, tekstem albo w tabeli.
- Zdolność publikującą podajesz w polu „Zdolność publikująca” i wskazujesz wpisem `realizes`: `QUE-001 realizes CAP-001`.
- Sekcja „Encje” wymienia encje, które w schemacie zdarzenia są osobnym bytem: `QUE-002 consumes ENT-Client`.
- Zdarzenie wskazują ci, którzy je publikują albo odbierają: `UC-001 consumes QUE-001` (publikacja), `TUC-010 consumes QUE-010` (odbiór). Zdolność odbierająca wskazuje zdarzenie sama: `CAP-001 consumes QUE-002`.

## 4. Warianty

- **Plik AsyncAPI wygenerowany z Enterprise Architect**: szablon pełni wtedy rolę dokumentacji uzupełniającej. Każde zdarzenie z pliku AsyncAPI ma własny dokument QUE.
