# Krok Workflow (SPEC-WF)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Logika pojedynczego zadania procesu BPMN: przyjmowane i oddawane zmienne
procesowe, reguły, wywoływane zasoby, obsługa błędów. Jeden task BPMN to jeden
plik.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz logikę pojedynczego zadania BPMN: reguły, zmienne
procesowe, kryteria akceptacji.

**Nie używaj gdy:**

- opisujesz kontrakt API → [api](../api/guide.md),
- opisujesz logikę zdolności albo reguły globalne → [capability](../capability/guide.md), [business-functional-spec](../business-functional-spec/guide.md),
- opisujesz schemat danych domenowych → [ddm](../ddm/guide.md), [ldm-entity](../ldm-entity/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Granica odpowiedzialności:

  | SPEC-WF opisuje | SPEC-WF nie opisuje |
  |---|---|
  | Jak zadanie używa API w tym procesie | Kontraktu API (w API) |
  | Jak zadanie wywołuje zdolność i co robi z wynikiem | Logiki zdolności (w CAP) |
  | Zmienne procesowe wchodzące i wychodzące | Schematu danych domenowych (w modelu danych) |
  | Reguły specyficzne dla tego kroku | Reguł globalnych (w CAP albo BFS) |

- Krok należy do procesu, który go zawiera: `BPMN-001 contains SPEC-WF-001`. Identyfikatory procesu i zadania w silniku podaje dokument BPMN.
- `task-type` mówi, kto wykonuje zadanie: `service-task` serwis, `user-task` człowiek, który przypisuje, odkłada i kończy zadanie przez API, `script-task` skrypt w silniku, `call-activity` wywołany podproces.
- „Wywoływane zasoby” wymieniają API, INT i QUE, które krok woła sam, także publikowane zdarzenie: `SPEC-WF-001 consumes API-005`. Zdolności nie wymieniasz; wynika z wpisu `realizes` wołanego zasobu: `SPEC-WF-014 consumes INT-017`, a `INT-017 realizes CAP-022`. Krok, który niczego nie woła, ma w tabeli wiersz „—”.
- Krok user-task czeka na człowieka, który przypisuje, odkłada i kończy go tylko przez API. Relację zapisuje każde z tych API: `API-015 consumes SPEC-WF-005` przypisuje krok, a `API-008 consumes SPEC-WF-005` go kończy. Krok nie wymienia tych API ani ekranu, z którego człowiek je wywołuje.
- „Zmienne procesowe — wejście” mają kolumnę „Źródło” z ID kroku, który zmienną zapisał: `SPEC-WF-002 consumes SPEC-WF-001`.
- Krok `call-activity` odbiera też zmienne zapisane w podprocesie. „Zmienne procesowe — wyjście” mają wtedy kolumnę „Źródło” z ID kroku podprocesu: `SPEC-WF-008 consumes SPEC-WF-009`. W pozostałych krokach tabela wyjścia nie ma tej kolumny, bo zmienną zapisuje sam krok.
- Pole „aktor/serwis” w „Kontekście”: krok user-task podaje ID roli (`involves ROLE`); nazwa serwisu w kroku service-task relacji nie tworzy.
- Reguły formułujesz deterministycznie: „jeśli X, to Y”. Kryteria akceptacji w formacie Given/When/Then to wiersze kroku: `SPEC-WF-001 contains AC-01`.

## 4. Warianty

- **Service Task.**
- **User Task.**
- **Script Task.**
- **Wywołanie podprocesu.** `task-type: call-activity`. „Zmienne procesowe — wejście” podają zmienne przekazywane do podprocesu, a „wyjście” zmienne przepisywane z podprocesu, z kolumną „Źródło”.
