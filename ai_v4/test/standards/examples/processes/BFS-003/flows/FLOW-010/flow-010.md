---
doc-id: FLOW-010
title: "Automatyczna weryfikacja tożsamości — przebieg podstawowy"
description: "Przebieg podstawowy weryfikacji automatycznej: przyjęcie żądania, rejestr PESEL, lista sankcyjna i ocena zgodności danych."
status: draft                                  # draft | active
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: ACT-010
  - type: realizes
    target: CAP-011
  - type: consumes
    target: INT-010
  - type: consumes
    target: INT-012
---

# Automatyczna weryfikacja tożsamości — przebieg podstawowy

| Pole | Wartość |
|---|---|
| Zdolność | CAP-011 |

## Warunki wstępne

- Wniosek o rachunek jest zapisany, a proces otwarcia rachunku w silniku doszedł do kroku automatycznej weryfikacji tożsamości.
- Żądanie zawiera identyfikator wniosku, PESEL, imię, nazwisko i datę urodzenia wnioskodawcy.
- Wołający krok procesu ma token techniczny uprawniający do weryfikacji tożsamości.

## Diagram

<!-- Mermaid, najwyżej 10–15 uczestników lub kroków. -->

```mermaid
sequenceDiagram
    participant Krok as Krok procesu otwarcia rachunku
    participant Usluga as Usługa weryfikacji tożsamości
    participant Rejestr as Rejestr PESEL
    participant Sankcje as Lista sankcyjna
    Krok->>Usluga: Żądanie weryfikacji z danymi wnioskodawcy
    Usluga->>Rejestr: Weryfikacja numeru PESEL
    Rejestr-->>Usluga: Status numeru PESEL i dane osoby z rejestru
    Usluga->>Sankcje: Sprawdzenie osoby
    Sankcje-->>Usluga: NO_MATCH / POSSIBLE_MATCH / MATCH
    Usluga->>Usluga: Ocena zgodności danych tożsamości
    Usluga-->>Krok: Identyfikator i wynik weryfikacji
```

## Opis przepływu

| Nr | Krok | Aktywność | Wywołanie |
|---|---|---|---|
| 1 | Przyjmuje żądanie weryfikacji, sprawdza kompletność danych wnioskodawcy i zakłada rekord weryfikacji | — | — |
| 2 | Sprawdza numer PESEL w rejestrze i pobiera status numeru oraz imię, nazwisko i datę urodzenia osoby | — | INT-010 |
| 3 | Sprawdza imię, nazwisko i datę urodzenia wnioskodawcy na liście sankcyjnej | — | INT-012 |
| 4 | Sprawdza status numeru PESEL (status inny niż AKTYWNY to rozbieżność PESEL), porównuje dane z wniosku z danymi z rejestru, łączy wynik z wynikiem listy sankcyjnej i zwraca wynik weryfikacji w odpowiedzi | ACT-010 | — |

## Scenariusze błędów

Osobny przepływ obsługi błędów nie powstaje. Gdy rejestr PESEL albo lista
sankcyjna nie odpowie po ponowieniach, przepływ przerywa weryfikację i zwraca
błąd niedostępności usługi z identyfikatorem rekordu weryfikacji, bez wyniku
weryfikacji. Błąd obsługuje krok procesu
„Automatyczna weryfikacja tożsamości” w procesie otwarcia rachunku: kieruje
wniosek do ręcznej weryfikacji przez pracownika zaplecza. Niekompletne dane
w żądaniu kończą przepływ w kroku 1 błędem walidacji, zanim przepływ zawoła
rejestr PESEL.
