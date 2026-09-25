---
doc-id: BPMN-004
title: "Eskalacja przeterminowanej reklamacji"
description: "Proces obsługi błędów uruchamiany timerem 14 dni w obsłudze reklamacji, który oznacza reklamację bez decyzji jako eskalowaną i powiadamia kierownika."
status: draft                                  # draft | active
bpmn-process-id: "eskalacja-reklamacji"
process-version: "1.0"                         # znacznik lub skrót zapisu pliku BPMN XML
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: SPEC-WF-010
  - type: realizes
    target: CAP-004
---

# Eskalacja przeterminowanej reklamacji

## Cel procesu

Gdy reklamacja czeka na decyzję dłużej niż 14 dni, oznaczyć ją jako
eskalowaną i powiadomić kierownika zespołu reklamacji, żeby przyspieszył
rozpatrzenie albo przydzielił zadanie innemu pracownikowi. Proces nie zapisuje
decyzji ani nie przejmuje zadania rozpatrzenia.

## Kontekst

| Pole | Wartość |
|---|---|
| System | System reklamacji (serwis complaint-service) |
| Silnik BPMN | Camunda |
| Inicjator | Timer bez przerywania 14 dni na zadaniu „Rozpatrzenie reklamacji” w procesie „Obsługa reklamacji”, który wysyła komunikat startowy z identyfikatorem reklamacji i osobą przypisaną do zadania |
| Zakres | Zmiana statusu jednej przeterminowanej reklamacji na eskalowaną i jedno powiadomienie kierownika; rozpatrzenie reklamacji trwa dalej w procesie „Obsługa reklamacji” |
| Zdolność | CAP-004 |

## Diagram procesu

| Zasób | Odnośnik |
|---|---|
| BPMN XML | `docs/project/system/workflows/bpmn/eskalacja-reklamacji.bpmn` |
| Widok w silniku | https://camunda.bank.local/camunda/app/cockpit/default/#/process-definition/eskalacja-reklamacji |
| Eksport PNG/SVG | `docs/project/system/workflows/bpmn/eskalacja-reklamacji.svg` |

## Zadania procesu

| ID zadania | Nazwa | SPEC-WF |
|---|---|---|
| powiadomienie-kierownika | Powiadomienie kierownika o eskalacji | SPEC-WF-010 |

## Bramki i warunki

Proces nie ma bramek: startowe zdarzenie komunikatu, jedno zadanie i zdarzenie
końcowe „Kierownik powiadomiony”.

## Zdarzenia graniczne

Zadanie powiadomienia nie ma zdarzeń granicznych. Niedostępność bramki e-mail
obsługują ponowienia w zadaniu; po ich wyczerpaniu silnik zgłasza incydent
do obsługi przez administratora procesu.

## Podprocesy

Proces nie wywołuje podprocesów.

## Powiązane dokumenty

- CAP-004 Obsługa reklamacji: zdolność realizowana przez proces.
- SPEC-WF-010 Powiadomienie kierownika o eskalacji: specyfikacja jedynego zadania.
- Proces „Obsługa reklamacji”, w którym działa timer uruchamiający eskalację, podany nazwą.
