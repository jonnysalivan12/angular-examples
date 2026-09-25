---
doc-id: ENT-AccountSnapshot
title: "Stan dzienny rachunku"
description: "Stan rachunku na koniec dnia w hurtowni danych: produkt, saldo i status."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: realizes
    target: DDM-002.DOM-Rachunek
---

# Stan dzienny rachunku

| Pole | Wartość |
|---|---|
| ID | ENT-AccountSnapshot |
| Alias biznesowy | Stan rachunku na koniec dnia |
| Realizuje pojęcie (DDM) | DDM-002.DOM-Rachunek |

## Opis

Stan rachunku na koniec dnia w hurtowni danych. Nocne ładowanie z systemu
transakcyjnego zapisuje jeden stan dla każdego rachunku z nadanym numerem, od
dnia otwarcia do dnia zamknięcia włącznie. Zapisany stan się nie zmienia.
Encja zasila raporty sald i struktury portfela; nie zastępuje rachunku
w systemie transakcyjnym.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| snapshotDate | Data stanu | Date | tak | Tak | Dzień, na którego koniec zapisano stan rachunku |
| accountNumber | Numer rachunku | String | tak | Tak | Numer rachunku w formacie IBAN |
| productCode | Kod produktu | String | tak | Nie | Kod produktu rachunku w dniu stanu, przepisany z systemu transakcyjnego |
| balance | Saldo | Decimal | tak | Nie | Saldo księgowe rachunku na koniec dnia, w walucie rachunku |
| status | Status | Enum | tak | Nie | Status rachunku na koniec dnia; wartości w sekcji Typy wyliczeniowe |

## Typy wyliczeniowe

`status` — status rachunku na koniec dnia:

- `OTWARTY` — rachunek otwarty, jeszcze nieaktywny,
- `AKTYWNY` — rachunek aktywny,
- `ZABLOKOWANY` — rachunek zablokowany,
- `ZAMKNIETY` — rachunek zamknięty tego dnia.

Stan dzienny nie ma statusu WNIOSEK, bo rachunek bez numeru nie trafia do
hurtowni.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| — | — | — | Model hurtowni nie ma innych encji, więc stan dzienny nie wskazuje żadnej encji |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| — | Brak reguł walidacyjnych | — |

## Uwagi

Hurtownia nie waliduje danych: przyjmuje stan sprawdzony w systemie
transakcyjnym. Nie zmodelowano waluty salda ani salda przeliczonego na PLN.
