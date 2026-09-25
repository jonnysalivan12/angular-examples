---
doc-id: CONV-003
title: "Ponawianie wywołań integracji"
description: "Limit czasu, ponowienia i klucz idempotencji przy wywołaniach systemów zewnętrznych."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations: []
---

# Ponawianie wywołań integracji

## Cel

Ujednolicić obsługę chwilowych awarii systemów zewnętrznych: proces nie
zatrzymuje się po pojedynczym błędzie, a ponowienie nie wykonuje operacji dwa
razy.

## Zakres

Integracje, które nasze usługi wołają synchronicznie (REST, SOAP, gRPC).
Integracja, która działa inaczej, np. podpowiada dane w trakcie wpisywania, nie
stosuje konwencji i opisuje własną obsługę błędów.

## Zasady

### Limit czasu i ponowienia

| Sytuacja | Obsługa |
|---|---|
| 4xx, w tym 404 | Bez ponowień: ponowienie dałoby ten sam wynik |
| 5xx | Najwyżej 3 ponowienia z rosnącym odstępem |
| Przekroczenie czasu | Limit 3 s na wywołanie, potem jak przy 5xx |

Gdy ponowienia zawiodą, integracja opisuje skutek dla procesu w swojej sekcji
„Obsługa błędów”.

### Klucz idempotencji

Ponowienie wysyła ten sam klucz idempotencji co pierwsze wywołanie, żeby system
zewnętrzny nie wykonał operacji dwa razy. Integracja, która zmienia dane
w systemie zewnętrznym, podaje swój klucz w sekcji „Obsługa błędów”, np.
identyfikator dyspozycji.
