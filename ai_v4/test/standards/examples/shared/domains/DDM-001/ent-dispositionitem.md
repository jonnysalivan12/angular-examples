---
doc-id: ENT-DispositionItem
title: "Pozycja dyspozycji"
description: "Encja pojedynczego przelewu w dyspozycji z kwotą, rachunkiem odbiorcy, tytułem oraz statusem i identyfikatorem księgowania."
status: active                                 # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: realizes
    target: DDM-001.DOM-Pozycja
  - type: realizes
    target: DDM-001.RD-004
---

# Pozycja dyspozycji

| Pole | Wartość |
|---|---|
| ID | ENT-DispositionItem |
| Alias biznesowy | Pozycja |
| Realizuje pojęcie (DDM) | DDM-001.DOM-Pozycja |

## Opis

Pojedynczy przelew w dyspozycji: rachunek odbiorcy, kwota i tytuł. Pozycje
tej samej dyspozycji są księgowane osobno, więc każda ma własny status
i identyfikator księgowania. Rachunek odbiorcy i tytuł ustala złożenie
dyspozycji. Korekta zmienia tylko kwotę pozycji, a suma kwot pozycji pozostaje
równa kwocie łącznej dyspozycji; od startu przebiegu rozliczenia, który wybrał
dyspozycję, korekta jest odrzucana.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| itemId | Identyfikator pozycji | UUID | tak | Tak | Nadawany przy przyjęciu dyspozycji |
| lineNo | Numer pozycji | Integer | tak | Nie | Kolejny numer pozycji w dyspozycji, od 1 |
| amount | Kwota | Decimal | tak | Nie | Kwota przelewu w walucie dyspozycji, z dokładnością do dwóch miejsc po przecinku; jedyny atrybut, który zmienia korekta |
| beneficiaryAccount | Rachunek odbiorcy | String | tak | Nie | Numer rachunku odbiorcy w formacie IBAN; ustalany przy złożeniu dyspozycji |
| title | Tytuł | String | tak | Nie | Tytuł przelewu, do 140 znaków; ustalany przy złożeniu dyspozycji |
| postingStatus | Status księgowania | Enum | nie | Nie | Wynik księgowania pozycji w księdze głównej; pusty, dopóki dyspozycja nie wejdzie do przebiegu rozliczenia |
| postingId | Identyfikator księgowania | String | nie | Nie | Identyfikator księgowania pozycji w księdze głównej; pusty, dopóki księga główna nie potwierdzi księgowania |

## Typy wyliczeniowe

postingStatus:

- OCZEKUJE: dyspozycja weszła do przebiegu rozliczenia, a pozycja czeka na księgowanie.
- ZAKSIEGOWANA: księga główna potwierdziła księgowanie pozycji.
- NIEZAKSIEGOWANA: księgowanie nie powiodło się i pozycja czeka na ponowienie.
- SKORYGOWANA: rozliczenie pozycji skorygowano po uznanej reklamacji.

Przed wejściem dyspozycji do przebiegu rozliczenia postingStatus jest pusty.
Pozycje dyspozycji odrzuconej zostają bez statusu księgowania.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| — | — | — | Pozycja nie zawiera innych encji ani ich nie wskazuje |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Wartość amount jest większa od 0 i nie przekracza 1 000 000,00 PLN | DDM-001.RD-004 |

## Uwagi

- Nazwa i adres odbiorcy nie są zmodelowane.
- Księgowanie korygujące po uznanej reklamacji nie ma w pozycji własnego
  identyfikatora: pozycja dostaje status SKORYGOWANA, a postingId nadal
  wskazuje księgowanie z rozliczenia.
