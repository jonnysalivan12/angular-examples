---
doc-id: BPMN-002
title: "Obsługa reklamacji"
description: "Proces w silniku Workflow od zarejestrowania zgłoszenia reklamacji do decyzji pracownika, a przy uznaniu do korekty rozliczenia i publikacji decyzji."
status: draft                                  # draft | active
bpmn-process-id: "obsluga-reklamacji"
process-version: "1.2"                         # znacznik lub skrót zapisu pliku BPMN XML
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: SPEC-WF-004
  - type: contains
    target: SPEC-WF-005
  - type: contains
    target: SPEC-WF-006
  - type: contains
    target: SPEC-WF-007
  - type: contains
    target: SPEC-WF-008
  - type: realizes
    target: CAP-004
---

# Obsługa reklamacji

## Cel procesu

Doprowadzić każdą zgłoszoną reklamację rozliczonej dyspozycji do decyzji
pracownika zaplecza w ciągu 14 dni. Przy uznaniu reklamacji proces wylicza
rekompensatę, koryguje rozliczenie dyspozycji i dopiero po zaksięgowaniu
korekty publikuje decyzję z kwotą dla wypłaty rekompensaty. Przy odrzuceniu
proces kończy się po zapisie decyzji, bez publikacji.

## Kontekst

| Pole | Wartość |
|---|---|
| System | System reklamacji (serwis complaint-service) |
| Silnik BPMN | Camunda |
| Inicjator | Zgłoszenie reklamacji: punkt końcowy zgłoszenia tworzy reklamację i uruchamia instancję procesu z identyfikatorem reklamacji jako kluczem biznesowym |
| Zakres | Od zarejestrowania reklamacji w procesie do zdarzenia końcowego „Reklamacja odrzucona” albo „Reklamacja uznana”; wypłatę rekompensaty i zamknięcie reklamacji wykonuje odbiorca zdarzenia ComplaintResolved poza procesem |
| Zdolność | CAP-004 |

## Diagram procesu

| Zasób | Odnośnik |
|---|---|
| BPMN XML | `docs/project/system/workflows/bpmn/obsluga-reklamacji.bpmn` |
| Widok w silniku | https://camunda.bank.local/camunda/app/cockpit/default/#/process-definition/obsluga-reklamacji |
| Eksport PNG/SVG | `docs/project/system/workflows/bpmn/obsluga-reklamacji.svg` |

## Zadania procesu

| ID zadania | Nazwa | SPEC-WF |
|---|---|---|
| rejestracja-reklamacji | Rejestracja reklamacji w procesie | SPEC-WF-004 |
| rozpatrzenie-reklamacji | Rozpatrzenie reklamacji | SPEC-WF-005 |
| wyliczenie-rekompensaty | Wyliczenie rekompensaty | SPEC-WF-006 |
| wywolanie-korekty-rozliczenia | Wywołanie korekty rozliczenia | SPEC-WF-008 |
| publikacja-decyzji | Publikacja decyzji reklamacyjnej | SPEC-WF-007 |

## Bramki i warunki

Bramka wykluczająca „Decyzja w sprawie reklamacji” stoi za zadaniem
rozpatrzenia i czyta zmienną `decision` zapisaną przy zakończeniu zadania:

- `decision = UZNANA`: wyliczenie rekompensaty, wywołanie korekty rozliczenia, publikacja decyzji i zdarzenie końcowe „Reklamacja uznana”.
- `decision = ODRZUCONA`: zdarzenie końcowe „Reklamacja odrzucona”, bez publikacji decyzji.
- Bramka nie ma ścieżki domyślnej: inna wartość `decision` zatrzymuje instancję incydentem w silniku.

## Zdarzenia graniczne

Zadanie „Rozpatrzenie reklamacji” ma timer bez przerywania `P14D`, liczony od
utworzenia zadania. Po 14 dniach proces wysyła komunikat startowy procesu
„Eskalacja przeterminowanej reklamacji” z identyfikatorem reklamacji i osobą
przypisaną do zadania. Zadanie zostaje otwarte u pracownika, a decyzję zapisuje
się jak przed terminem. Zapis decyzji przed upływem 14 dni usuwa timer.

Pozostałe zadania nie mają zdarzeń granicznych. Błędy techniczne zadań
serwisowych obsługują ponowienia i incydenty silnika opisane w specyfikacjach
zadań.

## Podprocesy

- „Korekta rozliczenia po reklamacji”: wywołuje go zadanie „Wywołanie korekty rozliczenia” (Call Activity) po wyliczeniu rekompensaty; proces czeka na zakończenie podprocesu i dopiero potem publikuje decyzję.

Proces „Eskalacja przeterminowanej reklamacji” nie jest podprocesem: uruchamia
go komunikat z timera, a obsługa reklamacji nie czeka na jego zakończenie.

## Powiązane dokumenty

- CAP-004 Obsługa reklamacji: zdolność realizowana przez proces.
- SPEC-WF-004, SPEC-WF-005, SPEC-WF-006, SPEC-WF-007, SPEC-WF-008: specyfikacje zadań procesu.
- Specyfikacje procesów „Korekta rozliczenia po reklamacji” i „Eskalacja przeterminowanej reklamacji”, podane nazwą.
- Cykl życia reklamacji: stany reklamacji od zgłoszenia do zamknięcia po wypłacie rekompensaty albo odrzucenia.
