# API Endpoint (API)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Opis jednego punktu końcowego: cel, parametry, zachowanie, model odpowiedzi.
Jeden punkt końcowy to jeden plik. Opisuje to, co nie wynika z OpenAPI
(Swagger).

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz jeden punkt końcowy API.

**Nie używaj gdy:**

- opisujesz połączenie z systemem zewnętrznym → [integration](../integration/guide.md),
- opisujesz kontrakt zdarzenia w brokerze → [event](../event/guide.md),
- opisujesz część przebiegu, która jest złożona albo wspólna dla kilku API → [flow](../flow/guide.md); API wskaże ten przepływ,
- opisujesz zasadę wspólną dla wielu kontraktów, np. model odpowiedzi błędnej → [convention](../convention/guide.md); API wskaże tę konwencję.

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Nie kopiujesz kontraktu OpenAPI.
- Zdolność podajesz w polu „Zdolność” i wskazujesz wpisem `realizes`: `API-001 realizes CAP-001`.
- Sekcja „Encje” wymienia encje, które w żądaniu lub odpowiedzi są osobnym bytem: `API-001 consumes ENT-Disposition`, `ENT-StatusDict`. Część zagnieżdżona w całości dochodzi przez `ENT contains ENT`: `POST /dispositions` z pozycjami w środku wskazuje tylko `ENT-Disposition`, a odpowiedź `{ disposition, dispositionItems }` wskazuje obie encje.
- Prosty przebieg opisujesz w „Zachowanie” bez przepływu. Przepływ wydzielasz, gdy część przebiegu jest złożona albo wspólna dla kilku API.
- „Zachowanie” wskazuje przepływy, które opisują część przebiegu, i procesy BPMN, które punkt końcowy uruchamia: `API-001 consumes FLOW-001`, `FLOW-002`, `API-006 consumes BPMN-001`. Jedno API może korzystać z kilku przepływów, a jeden przepływ może być częścią kilku API.
- „Zachowanie” wskazuje też kroki user-task, które punkt końcowy przypisuje, odkłada albo kończy: `API-015 consumes SPEC-WF-005`, `API-008 consumes SPEC-WF-005`. Człowiek wykonuje te operacje tylko przez API, więc krok nie wymienia punktu końcowego.
- „Zależności” wskazują integracje, które punkt końcowy woła poza przepływami: `API-003 consumes INT-010`. Wywołań zapisanych w przepływie nie powtarzasz: FLOW-001 woła INT-001, więc API-001 nie wymienia INT-001.
- Punkt końcowy nie woła innego punktu końcowego. Część przebiegu wspólną dla kilku API opisuje jeden przepływ, a każde z tych API go wskazuje.
- „Ograniczenia NFR” wskazują wiersze NFR: `API-001 constrained_by NFR-001.NFRT-PERF-01`. Wiersza NFR swojej zdolności nie powtarzasz: `API-020` podlega `NFR-002.NFRT-SEC-02` przez `CAP-020`.
- „Autentykacja” i „Struktura odpowiedzi błędnej” wskazują konwencję, która opisuje sposób autentykacji i model odpowiedzi błędnej: `API-009 applies CONV-001`. W tych sekcjach dopisujesz tylko to, co własne: wymaganą rolę i kody błędów punktu końcowego. Nagłówków opisanych w konwencji nie powtarzasz w „Parametrach wejściowych”.
- Punkt końcowy, który odstępuje od konwencji, nie wskazuje jej i sam opisuje swoje zachowanie w tej sekcji.

## 4. Warianty

Brak wariantów.
