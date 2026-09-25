---
doc-id: ENT-Product
title: "Produkt"
description: "Pozycja katalogu produktów, według której bank otwiera rachunek osobisty albo lokatę terminową."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: realizes
    target: DDM-002.DOM-Produkt
---

# Produkt

| Pole | Wartość |
|---|---|
| ID | ENT-Product |
| Alias biznesowy | Produkt z oferty |
| Realizuje pojęcie (DDM) | DDM-002.DOM-Produkt |

## Opis

Pozycja katalogu produktów banku. Rachunek wskazuje produkt, a typ produktu
rozstrzyga, czy rachunek jest rachunkiem osobistym, czy lokatą terminową.
Waluta produktu jest walutą rachunku i lokaty otwieranych według produktu.
W domenie produkt jest Value Object bez własnego cyklu życia; model logiczny
utrwala go jako katalog, żeby rachunki nie powielały warunków oferty.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| productCode | Kod produktu | String | tak | Tak | Kod produktu w ofercie, np. KONTO-STANDARD, LOKATA-STANDARD |
| name | Nazwa produktu | String | tak | Nie | Nazwa handlowa pokazywana klientowi, np. „Konto Standard” |
| productType | Typ produktu | Enum | tak | Nie | Rodzaj rachunku otwieranego według produktu; wartości w sekcji Typy wyliczeniowe |
| currency | Waluta | Dictionary[Waluta] | tak | Nie | Waluta produktu według ISO 4217, np. PLN; rachunek i lokata otwierane według produktu dostają tę walutę |
| monthlyFee | Opłata miesięczna | Decimal | tak | Nie | Opłata za prowadzenie rachunku w PLN za miesiąc; 0 dla lokat terminowych |

## Typy wyliczeniowe

`productType` — typ produktu:

- `PERSONAL_ACCOUNT` — rachunek osobisty,
- `TERM_DEPOSIT` — lokata terminowa.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| — | — | — | Produkt nie wskazuje innych encji |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| — | Brak reguł walidacyjnych | — |

## Uwagi

Nie zmodelowano historii zmian oferty ani warunków innych niż waluta i opłata
miesięczna. Oprocentowanie lokaty nie jest atrybutem produktu: zapisuje je
encja Lokata terminowa przy otwarciu, według oferty dla okresu lokaty.
