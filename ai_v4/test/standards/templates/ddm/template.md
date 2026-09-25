---
doc-id: DDM-{nnn}
title: "{Obszar domenowy}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
source-model: "{np. EA CaseRepository / Case v4.0}"
owner: "{Imię Nazwisko}"
relations:
  - type: contains
    target: DOM-{Nazwa}                        # własne pojęcie
  - type: contains
    target: RD-{nnn}                           # własna reguła domenowa
---

# {Obszar domenowy}

| Pole | Wartość |
|---|---|
| Obszar | {Obszar} |
| Źródło domeny | {Źródło} |

## Cel i zakres

{Jaki obszar domeny opisuje model i po co}

## Źródła wymagań w górę

{Źródła modelu: EA/CaseRepository, polityki i regulacje}

## Słownik pojęć domenowych

| ID | Definicja | Synonimy | Właściciel pojęcia |
|---|---|---|---|
| DOM-{Nazwa} | {Definicja} | {Synonimy} | {Właściciel pojęcia} |

## Encje i Value Objects

| Pojęcie | Typ | Tożsamość | Odpowiedzialność |
|---|---|---|---|
| DOM-{Nazwa} | Encja / Value Object | {Tożsamość} | {Odpowiedzialność} |

## Relacje i agregaty

<!-- Opcjonalnie diagram classDiagram. -->

{Relacje między pojęciami i granice agregatów}

## Reguły i inwarianty domenowe

| ID | Reguła | Kryterium walidacji |
|---|---|---|
| RD-{nnn} | {Reguła} | {Kryterium walidacji} |

## Zakres poza dokumentem

{Czego model nie opisuje}
