---
doc-id: ENT-StatusDict
title: "Słownik statusów"
description: "Techniczna encja słownika kodów statusów z etykietami i znacznikiem statusu końcowego."
status: active                                 # draft | active
owner: "Tomasz Lewandowski"
relations: []
---

# Słownik statusów

| Pole | Wartość |
|---|---|
| ID | ENT-StatusDict |
| Alias biznesowy | Słownik statusów |
| Realizuje pojęcie (DDM) | — |

## Opis

Słownik techniczny kodów statusów. Dla każdego kodu przechowuje etykietę
wyświetlaną w kanałach i znacznik, czy status kończy cykl życia obiektu.
Jedna encja mieści wiele słowników rozróżnianych atrybutem dictionary; dziś
zawiera słownik StatusDyspozycji.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| code | Kod | String | tak | Tak | Kod statusu, np. ZAAKCEPTOWANA |
| dictionary | Słownik | String | tak | Tak | Nazwa słownika, np. StatusDyspozycji; kod jest unikalny w obrębie słownika |
| label | Etykieta | String | tak | Nie | Etykieta statusu dla klienta, np. „Zaakceptowana” |
| isFinal | Status końcowy | Boolean | tak | Nie | true, gdy status kończy cykl życia obiektu, czyli nie ma z niego dalszych przejść |

## Typy wyliczeniowe

Encja nie ma typów wyliczeniowych. Kody słownika StatusDyspozycji to dane
słownika: NOWA, ZAAKCEPTOWANA, ODRZUCONA, W_ROZLICZENIU, ROZLICZONA,
NIEROZLICZONA, SKORYGOWANA; isFinal = true mają tylko ODRZUCONA
i SKORYGOWANA. ROZLICZONA ma isFinal = false, bo uznana reklamacja przenosi
dyspozycję do SKORYGOWANA.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| — | — | — | Słownik nie zawiera innych encji |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| — | Brak reguł walidacyjnych | — |

## Uwagi

- Słownik techniczny nie realizuje pojęcia domenowego.
- Etykiety w innych językach niż polski nie są zmodelowane.
