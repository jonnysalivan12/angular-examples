# Przepływ (FLOW)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Sekwencja kroków procesu biznesowego lub technicznego, z wariantami, bez
schodzenia do implementacji. Przepływ może opisywać część przebiegu API.
Jedno API może korzystać z kilku przepływów, a jeden przepływ może być
częścią kilku API.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz przepływ biznesowy lub techniczny.

**Nie używaj gdy:**

- krok ma złożony algorytm i wymaga osobnej specyfikacji → [activity](../activity/guide.md),
- proces wykonuje silnik Workflow → [bpmn-process](../bpmn-process/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Diagram ma najwyżej 10–15 uczestników lub kroków; większy dzielisz na poddiagramy.
- Opis przepływu ma kolumnę „Wywołanie” z ID INT, QUE albo BPMN: `FLOW-001 consumes INT-001`, `QUE-001`. Proces BPMN wskazujesz, gdy przepływ go uruchamia.
- Przepływ nie wymienia API, które z niego korzystają, i nie woła API. Relację zapisuje API: `API-001 consumes FLOW-001`. ID API w treści przepływu to błąd walidatora ([methodology.md](../../methodology.md), sekcja 7).
- Aktywność, która wymaga osobnej specyfikacji, dostaje czytelny tytuł i ID: `FLOW-001 contains ACT-002`. Kolejność aktywności wynika z przepływu; graf jej nie zapisuje.
- Zdolność podajesz w polu „Zdolność” i wskazujesz wpisem `realizes`.

## 4. Warianty

Warianty są osobnymi plikami: przebieg podstawowy oraz obsługa błędów.
