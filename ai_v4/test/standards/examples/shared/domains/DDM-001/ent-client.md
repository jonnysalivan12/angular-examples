---
doc-id: ENT-Client
title: "Klient"
description: "Encja klienta detalicznego z numerem PESEL, imieniem, nazwiskiem, datą urodzenia i adresem."
status: active                                 # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: realizes
    target: DDM-001.DOM-Klient
---

# Klient

| Pole | Wartość |
|---|---|
| ID | ENT-Client |
| Alias biznesowy | Klient |
| Realizuje pojęcie (DDM) | DDM-001.DOM-Klient |

## Opis

Osoba fizyczna, która składa dyspozycje i reklamacje w swoim imieniu. Encja
przechowuje dane identyfikacyjne potrzebne do weryfikacji tożsamości oraz
adres korespondencyjny.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| clientId | Identyfikator klienta | UUID | tak | Tak | Nadawany przez bank przy założeniu klienta |
| pesel | PESEL | String | tak | Nie | Numer PESEL, 11 cyfr |
| firstName | Imię | String | tak | Nie | Imię zgodne z dokumentem tożsamości |
| lastName | Nazwisko | String | tak | Nie | Nazwisko zgodne z dokumentem tożsamości |
| birthDate | Data urodzenia | Date | tak | Nie | Data urodzenia klienta |
| address | Adres korespondencyjny | String | tak | Nie | Ulica, numer budynku i lokalu, kod pocztowy, miejscowość |

## Typy wyliczeniowe

Encja nie ma typów wyliczeniowych.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| — | — | — | Klient nie zawiera innych encji ani ich nie wskazuje |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Wartość pesel ma 11 cyfr, a ostatnia cyfra jest zgodna z sumą kontrolną liczoną z pierwszych 10 cyfr z wagami 1, 3, 7, 9 | — |

## Uwagi

- Klienci bez numeru PESEL, np. cudzoziemcy, nie są zmodelowani.
- Dane dokumentu tożsamości (numer, zdjęcie) i wynik weryfikacji tożsamości
  nie są atrybutami tej encji i nie są zmodelowane.
- Adres zameldowania i dane kontaktowe (telefon, e-mail) nie są zmodelowane.
