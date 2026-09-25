---
doc-id: BPMN-003
title: "Korekta rozliczenia po reklamacji"
description: "Podproces wywoływany z obsługi reklamacji, który księguje w księdze głównej korektę rozliczenia dyspozycji na kwotę rekompensaty."
status: draft                                  # draft | active
bpmn-process-id: "korekta-rozliczenia"
process-version: "1.0"                         # znacznik lub skrót zapisu pliku BPMN XML
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: SPEC-WF-009
  - type: realizes
    target: CAP-004
---

# Korekta rozliczenia po reklamacji

## Cel procesu

Po uznaniu reklamacji zaksięgować w księdze głównej korektę rozliczenia
reklamowanej dyspozycji na kwotę rekompensaty i oddać procesowi nadrzędnemu
identyfikator oraz status księgowania korygującego, zanim proces nadrzędny
opublikuje decyzję o uznaniu reklamacji.

## Kontekst

| Pole | Wartość |
|---|---|
| System | System reklamacji (serwis complaint-service) |
| Silnik BPMN | Camunda |
| Inicjator | Proces nadrzędny „Obsługa reklamacji”: zadanie „Wywołanie korekty rozliczenia” (Call Activity) przekazuje identyfikator reklamacji i kwotę rekompensaty |
| Zakres | Jedno księgowanie korygujące dla jednej uznanej reklamacji; publikacja decyzji po zakończeniu podprocesu i wypłata rekompensaty leżą poza podprocesem |
| Zdolność | CAP-004 |

## Diagram procesu

| Zasób | Odnośnik |
|---|---|
| BPMN XML | `docs/project/system/workflows/bpmn/korekta-rozliczenia.bpmn` |
| Widok w silniku | https://camunda.bank.local/camunda/app/cockpit/default/#/process-definition/korekta-rozliczenia |
| Eksport PNG/SVG | `docs/project/system/workflows/bpmn/korekta-rozliczenia.svg` |

## Zadania procesu

| ID zadania | Nazwa | SPEC-WF |
|---|---|---|
| korekta-ksiegowania | Korekta księgowania dyspozycji | SPEC-WF-009 |

## Bramki i warunki

Podproces nie ma bramek: zdarzenie startowe, jedno zadanie i zdarzenie końcowe
„Korekta zaksięgowana”.

## Zdarzenia graniczne

Zadanie korekty księgowania nie ma zdarzeń granicznych. Niedostępność księgi
głównej obsługują ponowienia w zadaniu; po ich wyczerpaniu silnik zgłasza
incydent, status dyspozycji się nie zmienia, a proces nadrzędny czeka na
zakończenie podprocesu i do tego czasu nie publikuje decyzji.

## Podprocesy

Podproces nie wywołuje kolejnych podprocesów.

## Powiązane dokumenty

- CAP-004 Obsługa reklamacji: zdolność realizowana przez podproces.
- SPEC-WF-009 Korekta księgowania dyspozycji: specyfikacja jedynego zadania.
- Proces nadrzędny „Obsługa reklamacji”, podany nazwą.
