---
doc-id: SPEC-WF-006
title: "Wyliczenie rekompensaty"
description: "Zadanie skryptowe, które ustala kwotę rekompensaty jako mniejszą z kwoty wpisanej przez pracownika i kwoty reklamowanej dyspozycji."
status: draft                                  # draft | active
task-type: script-task                         # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: SPEC-WF-004
  - type: consumes
    target: SPEC-WF-005
---

# Wyliczenie rekompensaty

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | silnik Camunda (skrypt zadania) |

## Cel zadania

Ustalić kwotę rekompensaty, którą proces przekazuje do korekty rozliczenia,
a po zaksięgowaniu korekty publikuje w decyzji. Rekompensata nie może
przekroczyć kwoty reklamowanej dyspozycji, nawet gdy pracownik wpisał wyższą
kwotę.

## Warunki wstępne

- Instancja przeszła bramkę decyzji ścieżką UZNANA.
- SPEC-WF-005 zapisał decision i requestedCompensation, a SPEC-WF-004 zapisał dispositionAmount.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| — | — | Zadanie nie woła zasobów |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| decision | String: UZNANA, ODRZUCONA | SPEC-WF-005 | Decyzja pracownika; skrypt liczy tylko dla UZNANA |
| requestedCompensation | Decimal | SPEC-WF-005 | Kwota rekompensaty wpisana przez pracownika |
| dispositionAmount | Decimal | SPEC-WF-004 | Kwota reklamowanej dyspozycji |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| compensation | Decimal | Kwota rekompensaty do wypłaty i korekty rozliczenia, z dwoma miejscami po przecinku |

## Reguły i logika

- Wzór: `compensation = min(requestedCompensation, dispositionAmount)`.
- Jeśli requestedCompensation jest mniejsza lub równa dispositionAmount, to compensation = requestedCompensation.
- Jeśli requestedCompensation jest większa niż dispositionAmount, to compensation = dispositionAmount.
- Jeśli decision jest inna niż UZNANA albo requestedCompensation jest pusta lub nie większa od zera, to skrypt kończy się błędem i nie zapisuje compensation.

## Scenariusze błędów

Brak którejkolwiek zmiennej wejściowej albo decyzja inna niż UZNANA przerywa
skrypt. Silnik zgłasza incydent bez ponowień, bo ponowienie z tymi samymi
zmiennymi da ten sam wynik; administrator procesu poprawia zmienne i wznawia
instancję.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych.

## Efekty uboczne

Zadanie zapisuje tylko zmienną compensation. Nie zmienia stanu reklamacji ani
dyspozycji i nie wysyła powiadomień.

## Kryteria akceptacji

### AC-01

- Given decision = UZNANA, requestedCompensation = 1200.00 i dispositionAmount = 950.00
- When silnik wykonuje skrypt wyliczenia rekompensaty
- Then instancja ma zmienną compensation = 950.00

## Powiązane dokumenty

- SPEC-WF-005 i SPEC-WF-004: źródła zmiennych wejściowych.
