---
doc-id: ENT-Disposition
title: "Dyspozycja"
description: "Encja dyspozycji przelewu wielopozycyjnego: korzeń agregatu z pozycjami, kwotą łączną, statusem i danymi odrzucenia."
status: active                                 # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: contains
    target: RW-002
  - type: contains
    target: ENT-DispositionItem
  - type: realizes
    target: DDM-001.DOM-Dyspozycja
  - type: realizes
    target: DDM-001.RD-001
  - type: realizes
    target: DDM-001.RD-002
---

# Dyspozycja

| Pole | Wartość |
|---|---|
| ID | ENT-Disposition |
| Alias biznesowy | Dyspozycja |
| Realizuje pojęcie (DDM) | DDM-001.DOM-Dyspozycja |

## Opis

Dyspozycja przelewu wielopozycyjnego: polecenie obciążenia jednego rachunku
klienta kwotą łączną rozdzieloną na pozycje. Encja jest korzeniem agregatu,
więc to ona pilnuje liczby pozycji i zgodności ich sumy z kwotą łączną. Niesie
bieżący status z cyklu życia dyspozycji, od przyjęcia do rozliczenia albo
korekty po reklamacji.

Przebieg rozliczenia na starcie ustawia status W_ROZLICZENIU wszystkim
dyspozycjom, które wybrał; od tej chwili korekta kwot pozycji jest odrzucana.
Nieudana próba rozliczenia daje status NIEROZLICZONA i zwiększa liczbę
nieudanych prób. Dyspozycja odrzucona przy sprawdzeniu limitu jest zapisywana
z przyczyną i czasem odrzucenia.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| dispositionId | Identyfikator dyspozycji | UUID | tak | Tak | Nadawany przy przyjęciu dyspozycji |
| clientId | Identyfikator klienta | UUID | tak | Nie | Klient, który złożył dyspozycję |
| accountNumber | Rachunek obciążany | String | tak | Nie | Numer rachunku obciążanego w formacie IBAN, 28 znaków dla rachunku polskiego |
| totalAmount | Kwota łączna | Decimal | tak | Nie | Kwota dyspozycji z dokładnością do dwóch miejsc po przecinku; korekta pozycji jej nie zmienia |
| currency | Waluta | Dictionary[Waluta] | tak | Nie | Kod waluty ISO 4217, wspólny dla wszystkich pozycji |
| status | Status | Dictionary[StatusDyspozycji] | tak | Nie | Bieżący status dyspozycji ze słownika statusów dyspozycji |
| createdAt | Data przyjęcia | DateTime | tak | Nie | Chwila przyjęcia dyspozycji |
| settledAt | Data rozliczenia | DateTime | nie | Nie | Chwila zaksięgowania ostatniej pozycji; pusta, dopóki dyspozycja nie jest rozliczona |
| failedSettlementAttempts | Liczba nieudanych prób rozliczenia | Integer | nie | Nie | Pusta przed pierwszą nieudaną próbą rozliczenia; każda nieudana próba zwiększa ją o 1, a przy wartości 3 dyspozycja nie wraca do ponowień |
| rejectionReason | Przyczyna odrzucenia | Enum | nie | Nie | Przyczyna odrzucenia zapisanej dyspozycji; wartości w sekcji Typy wyliczeniowe; pusta, gdy dyspozycja nie jest odrzucona |
| rejectedAt | Data odrzucenia | DateTime | nie | Nie | Chwila odrzucenia dyspozycji; pusta, gdy dyspozycja nie jest odrzucona |

## Typy wyliczeniowe

rejectionReason:

- LIMIT_PRZEKROCZONY: kwota łączna przekracza dostępny limit klienta.
- LIMIT_NIEDOSTEPNY: system limitów nie odpowiedział w pierwszej próbie ani w ponowieniach.
- KLIENT_NIEZNANY_W_SYSTEMIE_LIMITOW: system limitów nie zna klienta.

Błąd walidacji wejścia (kod BLAD_WALIDACJI) nie ma wartości w tym typie:
dyspozycja z takim błędem nie jest zapisywana.

Status i waluta przyjmują wartości ze słowników: słownika statusów dyspozycji
StatusDyspozycji (NOWA, ZAAKCEPTOWANA, ODRZUCONA, W_ROZLICZENIU, ROZLICZONA,
NIEROZLICZONA, SKORYGOWANA) i słownika walut Waluta.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| zawiera | ENT-DispositionItem | 1:N | Dyspozycja zawiera od 1 do 50 pozycji; pozycja nie istnieje bez dyspozycji |
| wskazuje | Klient | N:1 | Dyspozycję składa jeden klient; klient może mieć wiele dyspozycji |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Suma wartości amount wszystkich pozycji jest równa totalAmount, co do grosza | DDM-001.RD-001 |
| RW-002 | Dyspozycja ma co najmniej 1 i najwyżej 50 pozycji | DDM-001.RD-002 |

## Uwagi

- Historia zmian statusu nie jest zmodelowana: encja przechowuje tylko bieżący
  status oraz daty createdAt, settledAt i rejectedAt.
- Identyfikator księgowania nie jest atrybutem dyspozycji: każda pozycja ma
  własny identyfikator księgowania w księdze głównej.
- Limit klienta i jego wykorzystanie nie są atrybutami dyspozycji.
