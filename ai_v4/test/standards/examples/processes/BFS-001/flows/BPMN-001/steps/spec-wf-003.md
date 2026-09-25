---
doc-id: SPEC-WF-003
title: "Zamknięcie dnia rozliczeniowego"
description: "Zadanie skryptowe, które podsumowuje wyniki księgowania i ustala stan końcowy przebiegu rozliczenia."
status: draft                                  # draft | active
task-type: script-task                         # service-task | user-task | script-task | call-activity
owner: "Anna Nowak"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: SPEC-WF-002
---

# Zamknięcie dnia rozliczeniowego

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | Silnik Camunda, skrypt w definicji procesu |

## Cel zadania

Podsumować wyniki księgowania przebiegu i ustalić jego stan końcowy:
ZAKONCZONY, gdy wszystkie dyspozycje są rozliczone, albo ZAKONCZONY_Z_BLEDAMI,
gdy choć jedna pozostała nierozliczona. Przebieg nocny dodatkowo zamyka dzień
rozliczeniowy.

## Warunki wstępne

Zadanie księgowania pozycji się zakończyło albo bramka „Są dyspozycje do
rozliczenia?” je pominęła przy pustej liście dyspozycji. Przebieg rozliczenia
jest w stanie W_TOKU.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| — | — | Zadanie nie woła zasobów |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| postingResults | Json (lista wyników) | SPEC-WF-002 | Wynik rozliczenia każdej dyspozycji; zmiennej nie ma, gdy proces pominął księgowanie |
| runType | String | Start procesu | Rodzaj przebiegu: NIGHTLY albo RETRY |
| businessDate | Date | Start procesu | Dzień rozliczeniowy przebiegu |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| settledCount | Integer | Liczba dyspozycji z wynikiem ROZLICZONA |
| failedCount | Integer | Liczba dyspozycji z wynikiem NIEROZLICZONA |
| runStatus | String | Stan końcowy przebiegu: ZAKONCZONY albo ZAKONCZONY_Z_BLEDAMI |
| closedBusinessDate | Date | Zamknięty dzień rozliczeniowy, ustawiany tylko w przebiegu NIGHTLY |

## Reguły i logika

- Jeśli zmiennej postingResults nie ma, to zadanie przyjmuje pustą listę wyników.
- Jeśli żaden wynik w postingResults nie jest NIEROZLICZONA, także przy pustej liście, to runStatus = ZAKONCZONY.
- Jeśli choć jeden wynik to NIEROZLICZONA, to runStatus = ZAKONCZONY_Z_BLEDAMI.
- Jeśli runType = NIGHTLY, to closedBusinessDate = businessDate.
- Jeśli runType = RETRY, to zadanie nie ustawia closedBusinessDate, bo dzień zamknął przebieg nocny.

## Scenariusze błędów

Wynik w postingResults bez pola wyniku albo z wartością inną niż ROZLICZONA
i NIEROZLICZONA przerywa skrypt błędem. Silnik zatrzymuje instancję
z incydentem, a przebieg zostaje w stanie W_TOKU do decyzji operatora.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych. Skrypt liczy wyniki w pamięci silnika, bez
wywołań zewnętrznych, więc nie potrzebuje timera.

## Efekty uboczne

Zadanie nie zmienia dyspozycji ani pozycji. Po zakończeniu instancji procesu
settlement-service zapisuje w przebiegu rozliczenia runStatus, settledCount
i failedCount, a przebieg przechodzi z W_TOKU do stanu końcowego. W przebiegu
nocnym dzień businessDate zostaje oznaczony jako zamknięty.

## Kryteria akceptacji

### AC-01

- Given przebieg typu NIGHTLY za dzień 2026-09-13 i postingResults z trzema wynikami ROZLICZONA i jednym NIEROZLICZONA
- When zadanie zamknięcia dnia rozliczeniowego się wykona
- Then settledCount = 3, failedCount = 1, runStatus = ZAKONCZONY_Z_BLEDAMI, a closedBusinessDate = 2026-09-13

## Powiązane dokumenty

Krok SPEC-WF-002, który zapisuje postingResults. Stany przebiegu opisuje
maszyna stanów „Cykl życia przebiegu rozliczenia”.
