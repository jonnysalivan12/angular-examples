---
doc-id: FLOW-{nnn}
title: "{Nazwa przepływu}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: CAP-{nnn}                          # zdolność
  - type: contains
    target: ACT-{nnn}                          # aktywność
  - type: consumes
    target: INT-{nnn}                          # Wywołanie; także QUE-{nnn}, BPMN-{nnn}
---

# {Nazwa przepływu}

| Pole | Wartość |
|---|---|
| Zdolność | CAP-{nnn} |

## Warunki wstępne

{Co musi być spełnione przed startem przepływu}

## Diagram

<!-- Mermaid, najwyżej 10–15 uczestników lub kroków. -->

{Diagram przepływu w Mermaid}

## Opis przepływu

| Nr | Krok | Aktywność | Wywołanie |
|---|---|---|---|
| 1 | {Opis kroku} | ACT-{nnn} | INT-{nnn} |

## Scenariusze błędów

{Sytuacje błędne i reakcja przepływu}
