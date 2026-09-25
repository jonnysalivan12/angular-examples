---
doc-id: ENT-{Nazwa}
title: "{Nazwa encji}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: DDM-{nnn}.DOM-{Nazwa}              # Realizuje pojęcie (DDM)
  - type: realizes
    target: DDM-{nnn}.RD-{nnn}                 # kolumna RD reguły walidacyjnej
  - type: contains
    target: ENT-{Nazwa}                        # powiązanie „zawiera”
  - type: contains
    target: RW-{nnn}                           # własna reguła walidacyjna
---

# {Nazwa encji}

| Pole | Wartość |
|---|---|
| ID | ENT-{Nazwa} |
| Alias biznesowy | {Alias} |
| Realizuje pojęcie (DDM) | DDM-{nnn}.DOM-{Nazwa} |

## Opis

{Czym jest encja i do czego służy}

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| {nazwa} | {alias} | String | tak / nie | Tak / Nie | {Opis} |

## Typy wyliczeniowe

{Typy wyliczeniowe i ich wartości}

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| zawiera | ENT-{Nazwa} | 1:N | {Opis} |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-{nnn} | {Reguła} | DDM-{nnn}.RD-{nnn} |

## Uwagi

{Jawne braki, „nie zmodelowano”}
