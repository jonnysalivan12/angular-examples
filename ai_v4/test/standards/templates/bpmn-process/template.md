---
doc-id: BPMN-{nnn}
title: "{Nazwa procesu}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
bpmn-process-id: "{id procesu w silniku}"
process-version: "1.0"                         # znacznik lub skrót zapisu pliku BPMN XML
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: CAP-{nnn}                          # zdolność
  - type: contains
    target: SPEC-WF-{nnn}                      # krok procesu
---

# {Nazwa procesu}

## Cel procesu

{Co proces ma osiągnąć}

## Kontekst

| Pole | Wartość |
|---|---|
| System | {System} |
| Silnik BPMN | {Silnik BPMN} |
| Inicjator | {Inicjator} |
| Zakres | {Zakres} |
| Zdolność | CAP-{nnn} |

## Diagram procesu

| Zasób | Odnośnik |
|---|---|
| BPMN XML | {Odnośnik} |
| Widok w silniku | {Odnośnik} |
| Eksport PNG/SVG | {Odnośnik} |

## Zadania procesu

| ID zadania | Nazwa | SPEC-WF |
|---|---|---|
| {id zadania w silniku} | {Nazwa} | SPEC-WF-{nnn} |

## Bramki i warunki

{Bramki procesu i warunki wyboru ścieżki}

## Zdarzenia graniczne

{Zdarzenia graniczne zadań i reakcja procesu}

## Podprocesy

{Podprocesy wywoływane przez proces, podane nazwą}

## Powiązane dokumenty

{Dokumenty związane z procesem}
