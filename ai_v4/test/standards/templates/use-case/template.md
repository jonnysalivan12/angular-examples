---
doc-id: UC-{nnn}
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
    target: ACTOR-{nnn}.ROLE-{nn}              # rola
  - type: constrained_by
    target: NFR-{nnn}.NFRT-{KATEGORIA}-{nn}    # wiersz NFR
  - type: consumes
    target: API-{nnn}                          # Wywołanie; także QUE-{nnn}
  - type: contains
    target: SCR-{nnn}                          # Ekran
  - type: contains
    target: SCRSEC-{nnn}                       # Sekcja
  - type: contains
    target: A{n}                               # własny wariant; błąd: E{n}
---

# {Nazwa scenariusza}

| Pole | Wartość |
|---|---|
| Aktor główny | ACTOR-{nnn}.ROLE-{nn} |
| Kanały | {Kanały} |
| BFS | BFS-{nnn} |
| Powiązane REQ | BFS-{nnn}.REQ-{nn} |
| Powiązane RB | BFS-{nnn}.RB-{nn} |
| Zdolność | CAP-{nnn} |
| Makiety | {Odnośnik} |

## Powiązanie z BFS

| Typ | ID z BFS | Jak UC to realizuje |
|---|---|---|
| REQ | BFS-{nnn}.REQ-{nn} | {Opis} |
| RB | BFS-{nnn}.RB-{nn} | {Opis} |

## Cel

{Co użytkownik chce osiągnąć}

## Aktorzy

- ACTOR-{nnn}.ROLE-{nn}: {udział w scenariuszu}

## Kiedy można to zrobić

- [ ] {Warunek wstępny}

## Kroki

<!-- Kolumna „Sekcja” opcjonalna: sekcja ekranu, gdy krok opisuje pracę użytkownika w jednej sekcji. -->

| Nr | Krok | Ekran | Sekcja | Wywołanie |
|---|---|---|---|---|
| 1 | {Opis kroku} | SCR-{nnn} | SCRSEC-{nnn} | API-{nnn} |

## Co może pójść inaczej

### A1. {Nazwa wariantu}

<!-- Kolumna „Sekcja” opcjonalna. -->

| Nr | Krok | Ekran | Sekcja | Wywołanie |
|---|---|---|---|---|
| 1 | {Opis kroku} | | | |

## Co może pójść nie tak

### E1. {Nazwa błędu}

<!-- Kolumna „Sekcja” opcjonalna. -->

| Nr | Krok | Ekran | Sekcja | Wywołanie |
|---|---|---|---|---|
| 1 | {Opis kroku} | | | |

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
