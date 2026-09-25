---
doc-id: ENT-Account
title: "Rachunek"
description: "Rachunek klienta w systemie transakcyjnym z danymi wspólnymi rachunku osobistego i lokaty terminowej."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: realizes
    target: DDM-002.DOM-Rachunek
---

# Rachunek

| Pole | Wartość |
|---|---|
| ID | ENT-Account |
| Alias biznesowy | Rachunek bankowy |
| Realizuje pojęcie (DDM) | DDM-002.DOM-Rachunek |

## Opis

Rachunek bankowy klienta w systemie transakcyjnym. Encja przechowuje dane
wspólne obu rodzajów rachunku: właściciela, produkt, walutę, status i datę
otwarcia. Rodzaj rachunku wynika z typu produktu: rachunek osobisty albo lokata
terminowa, której parametry opisuje encja Lokata terminowa.

Rachunek powstaje przy zapisie wniosku, w statusie WNIOSEK i bez numeru. Numer
rachunku i datę otwarcia dostaje przy otwarciu. Odrzucony wniosek przechodzi do
statusu ZAMKNIETY bez numeru i daty otwarcia.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| accountId | Identyfikator rachunku | UUID | tak | Tak | Identyfikator nadawany przy zapisie wniosku, niezmienny przez cały cykl życia rachunku |
| applicationId | Identyfikator wniosku | UUID | tak | Nie | Identyfikator nadawany przy złożeniu wniosku, stały przez cały cykl życia rachunku |
| accountNumber | Numer rachunku | String | nie | Nie | Numer w formacie IBAN (PL i 26 cyfr), nadawany przy otwarciu; pusty w statusie WNIOSEK i po odrzuceniu wniosku |
| clientId | Identyfikator klienta | UUID | tak | Nie | Identyfikator klienta, który jest właścicielem rachunku |
| productCode | Kod produktu | String | tak | Nie | Kod produktu z oferty, np. KONTO-STANDARD; typ produktu rozstrzyga rodzaj rachunku |
| currency | Waluta | Dictionary[Waluta] | tak | Nie | Waluta rachunku według ISO 4217, np. PLN; przepisana z produktu |
| status | Status | Enum | tak | Nie | Bieżący status rachunku; wartości w sekcji Typy wyliczeniowe |
| openedAt | Data otwarcia | DateTime | nie | Nie | Data i godzina otwarcia rachunku; pusta w statusie WNIOSEK i po odrzuceniu wniosku |

## Typy wyliczeniowe

`status` — status rachunku:

- `WNIOSEK` — wniosek zapisany, rachunek czeka na weryfikację tożsamości klienta,
- `OTWARTY` — rachunek ma numer i czeka na aktywację w systemie centralnym,
- `AKTYWNY` — rachunek działa, klient może z niego korzystać,
- `ZABLOKOWANY` — bank wstrzymał operacje na rachunku,
- `ZAMKNIETY` — rachunek zamknięty albo wniosek odrzucony.

Przejścia między statusami opisuje maszyna stanów cyklu życia rachunku.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| wskazuje | Klient | N:1 | Właściciel rachunku; klient może mieć wiele rachunków |
| wskazuje | Produkt | N:1 | Produkt z oferty, według którego otwarto rachunek |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Wartość accountNumber jest pusta w statusie WNIOSEK i wypełniona w formacie IBAN PL (28 znaków) w pozostałych statusach, z wyjątkiem statusu ZAMKNIETY po odrzuceniu wniosku, gdy openedAt jest puste. | — |

## Uwagi

Nie zmodelowano salda, operacji na rachunku ani daty zamknięcia. Nie
zmodelowano rachunków wspólnych: rachunek ma dokładnie jednego właściciela.
Nie zmodelowano przyczyny odrzucenia wniosku: odrzucony wniosek ma tylko
status ZAMKNIETY.

Pełnoletność właściciela nie jest regułą walidacyjną encji: wymaga daty
urodzenia klienta, więc zostaje regułą domenową i regułą biznesową procesu
otwarcia rachunku.
