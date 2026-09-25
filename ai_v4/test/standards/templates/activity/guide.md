# Aktywność, Activity (ACT)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Jedna aktywność: logika biznesowa, wejście i wyjście, reguły, scenariusze
błędów. Jeden plik to jedna aktywność. Aktywność może być częścią kilku
przepływów.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** wydzielasz z przepływu logikę ze złożonym algorytmem albo logikę, której używa kilka przepływów.

**Nie używaj gdy:**

- krok jest prosty; opisujesz go w przepływie → [flow](../flow/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Aktywność nie zapisuje relacji. Wskazuje ją tylko przepływ: `FLOW-001 contains ACT-002`. Scenariusz UC ani TUC nie wskazuje aktywności. Wywołania INT, QUE i BPMN wpisuje przepływ w kolumnie „Wywołanie”.
- Matryca nie ma trójek ACT z API, INT, QUE ani BPMN, więc ID tych dokumentów w treści aktywności są błędem walidatora. Aktywność nie wymienia też przepływu, który ją zawiera ([methodology.md](../../methodology.md), sekcja 7).
- Aktywność nie opisuje kontekstu konkretnego przepływu, bo może należeć do kilku przepływów. Opisuje tylko swoje wejście, wyjście, reguły i błędy. Wejście nazywa dane, a nie krok, który je dostarczył. To, co dzieje się przed aktywnością i po niej, opisuje przepływ.

## 4. Warianty

Brak wariantów, jednolita struktura.
