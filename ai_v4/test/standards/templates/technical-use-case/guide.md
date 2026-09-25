# Technical Use Case (TUC)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Scenariusz uruchamiany automatycznie przez system, bez udziału człowieka.
Odpowiada na pytanie „Co system wykonuje automatycznie i jakiego efektu
oczekujemy?”. Podrzędny wobec BFS.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz scenariusz działania systemu bez udziału użytkownika
(cron, harmonogram, zadanie nocne).

**Nie używaj gdy:**

- w scenariuszu uczestniczy użytkownik → [use-case](../use-case/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Sekcje są jak w UC. Tabela nagłówkowa ma aktora systemowego i Trigger: `cron 02:00`, zdarzenie albo harmonogram.
- Kroki opisują akcje systemu. Tabele kroków mają kolumnę „Wywołanie” z ID API, INT albo QUE.
- Trigger może wskazać zdarzenie: `TUC-010 consumes QUE-010`.
- TUC nie ma ekranów.
- Sytuacja błędna wskazuje politykę błędu: ponowienie, eskalację albo zatrzymanie.
- Wymagania, rola, progi NFR i zdolność jak w UC: `TUC-001 realizes BFS-001.REQ-04`, `TUC-001 involves ACTOR-001.ROLE-03`.

## 4. Warianty

- **Uproszczony**: jeden przepływ, bez diagramu.
- **Po BFS**: zalecany.
- **Złożony**: jeden TUC na wariant; warianty zestawia mapa [use-case-technical-map](../use-case-technical-map/guide.md).
