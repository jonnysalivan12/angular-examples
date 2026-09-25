---
doc-id: TUC-{nnn}
title: "{Nazwa scenariusza}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: BFS-{nnn}.REQ-{nn}                 # realizowane wymaganie
  - type: realizes
    target: BFS-{nnn}.RB-{nn}                  # realizowana reguła
  - type: realizes
    target: CAP-{nnn}                          # zdolność
  - type: involves
    target: ACTOR-{nnn}.ROLE-{nn}              # rola systemowa
  - type: constrained_by
    target: NFR-{nnn}.NFRT-{KATEGORIA}-{nn}    # wiersz NFR
  - type: consumes
    target: QUE-{nnn}                          # Trigger albo Wywołanie; także API-{nnn}, INT-{nnn}
  - type: contains
    target: E{n}                               # własny błąd; wariant: A{n}
---

# {Nazwa scenariusza}

| Pole | Wartość |
|---|---|
| Aktor | ACTOR-{nnn}.ROLE-{nn} [System] |
| Trigger | {cron 02:00 / harmonogram / QUE-{nnn}} |
| BFS | BFS-{nnn} |
| Powiązane REQ | BFS-{nnn}.REQ-{nn} |
| Powiązane RB | BFS-{nnn}.RB-{nn} |
| Zdolność | CAP-{nnn} |

## Powiązanie z BFS

| Typ | ID z BFS | Jak TUC to realizuje |
|---|---|---|
| REQ | BFS-{nnn}.REQ-{nn} | {Opis} |
| RB | BFS-{nnn}.RB-{nn} | {Opis} |

## Cel

{Jaki efekt ma dać scenariusz}

## Aktorzy

- ACTOR-{nnn}.ROLE-{nn}: {udział w scenariuszu}

## Kiedy można to zrobić

- [ ] {Warunek wstępny}

## Kroki

| Nr | Akcja systemu | Wywołanie |
|---|---|---|
| 1 | {Opis akcji} | API-{nnn} |

## Co może pójść inaczej

### A1. {Nazwa wariantu}

| Nr | Akcja systemu | Wywołanie |
|---|---|---|
| 1 | {Opis akcji} | |

## Co może pójść nie tak

### E1. {Nazwa błędu}

Polityka błędu: ponowienie / eskalacja / zatrzymanie

| Nr | Akcja systemu | Wywołanie |
|---|---|---|
| 1 | {Opis akcji} | |

## Reguły biznesowe

- BFS-{nnn}.RB-{nn}: {jak reguła działa w scenariuszu}

## Ograniczenia NFR

- NFR-{nnn}.NFRT-{KATEGORIA}-{nn}

## Kryteria akceptacji

- Kiedy {sytuacja}, wtedy {oczekiwany wynik}.

## Diagram

<!-- Opcjonalny, najwyżej 15 kroków. -->

```mermaid
flowchart TD
```
