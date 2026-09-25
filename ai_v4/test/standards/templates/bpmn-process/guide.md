# Proces BPMN (BPMN)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Mapa procesu systemowego realizowanego przez silnik Workflow (BPMN/BPMS).
Orkestracja: sekwencja, sterowanie, podział na User Task i Service Task. Bez
logiki kroków, która trafia do SPEC-WF.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz mapę procesu w silniku Workflow: orkestrację, nie logikę.

**Nie używaj gdy:**

- opisujesz logikę jednego zadania → [workflow-step](../workflow-step/guide.md),
- przepływ nie działa w silniku → [flow](../flow/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Silnik BPMN jest jedynym źródłem prawdy dla diagramu. Nie duplikujesz go w Mermaid ani ASCII.
- Diagram ma najwyżej 15 zadań. Większy proces dzielisz na podprocesy w osobnych plikach.
- Każde zadanie ma plik SPEC-WF: jeden task BPMN to jeden plik. Zadanie typu User Task człowiek przypisuje, odkłada i kończy przez API, a każde z tych API wskazuje krok: `API-008 consumes SPEC-WF-005`.
- `bpmn-process-id` to identyfikator procesu w BPMN XML, pod którym zna go silnik. Identyfikator zadania podajesz w kolumnie „ID zadania” tabeli „Zadania procesu”. Typ zadania podaje krok SPEC-WF w polu `task-type`.
- Każda zmiana procesu wymaga aktualizacji `process-version`.
- Pliki BPMN leżą w `docs/project/system/workflows/bpmn/{nazwa}.bpmn`, opcjonalnie z eksportem `.svg`.
- Cykl życia: analityk tworzy BPMN XML w Camunda Modeler, wypełnia specyfikację procesu, tworzy SPEC-WF dla każdego zadania i zapisuje razem specyfikację, BPMN XML i SPEC-WF.
- Źródła prawdy: katalog dokumentacji to intencja biznesowa (analityk), repozytorium kodu to implementacja (programista), Camunda to proces wdrożony (silnik). Przy rozbieżności kod jest źródłem prawdy implementacyjnej, a dokumentacja źródłem intencji biznesowej.
- Proces zawiera kroki: `BPMN-001 contains SPEC-WF-001`. Kolejność kroków wynika z procesu; graf jej nie zapisuje. Zdolność podajesz w polu „Zdolność” i wskazujesz wpisem `realizes`.
- Proces uruchamia API albo przepływ i to one zapisują relację: `API-006 consumes BPMN-001`. W polu „Inicjator” podajesz inicjatora nazwą, bez ID, bo dokument nie wymienia dokumentów, które go wskazują ([methodology.md](../../methodology.md), sekcja 7).

## 4. Warianty

- **Pełny proces.**
- **Podproces.**
- **Proces obsługi błędów.**
