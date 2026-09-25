---
doc-id: ENT-Consent
title: "Zgoda"
description: "Oświadczenie klienta o akceptacji regulaminu produktu albo zgodzie marketingowej, z wersją dokumentu."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: realizes
    target: DDM-002.DOM-Zgoda
---

# Zgoda

| Pole | Wartość |
|---|---|
| ID | ENT-Consent |
| Alias biznesowy | Zgoda klienta |
| Realizuje pojęcie (DDM) | DDM-002.DOM-Zgoda |

## Opis

Oświadczenie klienta złożone we wniosku o rachunek: akceptacja regulaminu
produktu albo zgoda na komunikację marketingową. Encja zapisuje decyzję
klienta, moment jej wyrażenia i wersję dokumentu, żeby bank mógł wykazać, na co
klient się zgodził. Zgoda na regulamin jest wymagana, zgoda marketingowa
opcjonalna.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| consentId | Identyfikator zgody | UUID | tak | Tak | Identyfikator oświadczenia |
| clientId | Identyfikator klienta | UUID | tak | Nie | Identyfikator klienta, który złożył oświadczenie |
| consentType | Typ zgody | Enum | tak | Nie | Rodzaj zgody; wartości w sekcji Typy wyliczeniowe |
| granted | Zgoda udzielona | Boolean | tak | Nie | true, gdy klient wyraził zgodę; false, gdy odmówił |
| grantedAt | Data udzielenia | DateTime | nie | Nie | Data i godzina wyrażenia zgody; pusta, gdy granted = false |
| documentVersion | Wersja dokumentu | String | tak | Nie | Wersja regulaminu albo klauzuli marketingowej, której dotyczy oświadczenie, np. 2026.03 |

## Typy wyliczeniowe

`consentType` — typ zgody:

- `REGULAMIN` — akceptacja regulaminu wybranego produktu, wymagana przed otwarciem rachunku,
- `MARKETING` — zgoda na komunikację marketingową, opcjonalna.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| wskazuje | Klient | N:1 | Klient, który złożył oświadczenie; klient ma wiele zgód |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Wartość grantedAt jest wypełniona wtedy i tylko wtedy, gdy granted = true. | — |

## Uwagi

Nie zmodelowano odwołania zgody. Nie zmodelowano też powiązania zgody
z produktem ani z rachunkiem: regulamin, którego dotyczy zgoda, wskazuje wersja
dokumentu.

Wymóg zgody na regulamin przed otwarciem rachunku nie jest regułą walidacyjną
encji: łączy zgodę z rachunkiem, więc zostaje regułą domenową i regułą
biznesową procesu otwarcia rachunku.
