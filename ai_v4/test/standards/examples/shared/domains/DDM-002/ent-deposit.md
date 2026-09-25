---
doc-id: ENT-Deposit
title: "Lokata terminowa"
description: "Parametry lokaty terminowej, rodzaju rachunku: kwota, okres, oprocentowanie, dzień zapadalności i stan umowy."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: realizes
    target: DDM-002.DOM-Rachunek
---

# Lokata terminowa

| Pole | Wartość |
|---|---|
| ID | ENT-Deposit |
| Alias biznesowy | Lokata |
| Realizuje pojęcie (DDM) | DDM-002.DOM-Rachunek |

## Opis

Lokata terminowa to rodzaj rachunku: klient składa kwotę na określony okres za
stałym oprocentowaniem. Encja przechowuje parametry lokaty i stan jej umowy.
Dane wspólne każdego rachunku, czyli właściciela, produkt, walutę i status
rachunku, przechowuje encja Rachunek, której rodzajem jest lokata. Dlatego
encja realizuje ogólne pojęcie rachunku z domeny, a nie osobne pojęcie lokaty.

Kwota i okres pochodzą z wniosku, a oprocentowanie ustala otwarcie rachunku
lokaty według oferty dla okresu lokaty. Przy otwarciu lokata dostaje też numer
rachunku i stan ZALOZONA, a dzień zapadalności przy aktywacji.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| depositId | Identyfikator lokaty | UUID | tak | Tak | Identyfikator nadawany przy zapisie wniosku o lokatę |
| accountNumber | Numer rachunku | String | nie | Nie | Numer rachunku lokaty w formacie IBAN, nadawany przy otwarciu; pusty we wniosku |
| amount | Kwota lokaty | Decimal | tak | Nie | Kapitał złożony na lokacie, w walucie rachunku; podany we wniosku |
| termMonths | Okres lokaty | Integer | tak | Nie | Okres lokaty w pełnych miesiącach; podany we wniosku |
| interestRate | Oprocentowanie | Decimal | nie | Nie | Oprocentowanie nominalne w skali roku, w procentach, ustalane przy otwarciu z oferty dla okresu lokaty i stałe przez cały okres; puste we wniosku |
| status | Stan lokaty | Enum | nie | Nie | Stan umowy lokaty; wartości w sekcji Typy wyliczeniowe; pusty we wniosku |
| maturityDate | Dzień zapadalności | Date | nie | Nie | Dzień zakończenia okresu lokaty: data startu powiększona o termMonths miesięcy; ustalany przez system centralny przy aktywacji |

## Typy wyliczeniowe

`status` — stan umowy lokaty:

- `ZALOZONA` — rachunek lokaty otwarty, warunki lokaty ustalone, kapitał jeszcze nieprzyjęty,
- `AKTYWNA` — kapitał przyjęty, odsetki naliczają się do dnia zapadalności,
- `ZERWANA` — lokata zakończona przed dniem zapadalności: zerwana przez klienta albo anulowana przed aktywacją,
- `ZAKONCZONA` — okres lokaty upłynął, kapitał z odsetkami wypłacony.

Przejścia między stanami opisuje maszyna stanów cyklu życia lokaty.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| jest rodzajem | Rachunek | 1:1 | Lokata jest rodzajem rachunku, a nie jego częścią; dane wspólne ma rachunek |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Okres lokaty (termMonths) wynosi od 1 do 24 miesięcy. | — |

## Uwagi

RW-001 wynika z warunków oferty lokat, a nie z reguły domenowej, dlatego
kolumna RD ma „—”.

Nie zmodelowano daty startu lokaty: dzień zapadalności ustala system centralny
przy aktywacji. Nie zmodelowano też kapitalizacji odsetek ani rachunku, na
który wraca kapitał po zakończeniu lokaty.
