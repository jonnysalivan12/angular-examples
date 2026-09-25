# Maszyna stanów (STM)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Cykl życia obiektu lub procesu: dozwolone stany, przejścia i warunki ich
wyzwalania, stany terminalne (sukces, błąd, rezygnacja).

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz cykl życia obiektu jako maszynę stanów.

**Nie używaj gdy:**

- opisujesz kroki procesu → [flow](../flow/guide.md), [bpmn-process](../bpmn-process/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Pole „Obiekt (pojęcie DDM)” wskazuje pojęcie, którego cykl życia opisujesz: `STM-001 realizes DDM-001.DOM-Dyspozycja`. Maszyna techniczna, np. `STM-013` z cyklem życia sesji, zostawia je puste.
- Diagram `stateDiagram-v2` powstaje z tabel stanów albo z eksportu EA.
- Zdolność podajesz w polu „Zdolność” i wskazujesz wpisem `realizes`: `STM-013 realizes CAP-020`.

## 4. Warianty

- **Diagram wyeksportowany z EA** do katalogu `assets/`.
- **Domyślny diagram Mermaid** generowany z tabel.
