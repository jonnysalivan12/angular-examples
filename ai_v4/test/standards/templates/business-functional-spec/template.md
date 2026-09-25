---
doc-id: BFS-{nnn}
title: "{Nazwa procesu}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: contains
    target: REQ-{nn}                           # własne wymaganie
  - type: contains
    target: RB-{nn}                            # własna reguła biznesowa
  - type: constrained_by
    target: NFR-{nnn}.NFRT-{KATEGORIA}-{nn}    # wiersz NFR
---

# {Nazwa procesu}

| Pole | Wartość |
|---|---|
| Proces | {Nazwa procesu} |
| Właściciel biznesowy | {Imię Nazwisko} |

## Kontekst biznesowy

{Tło biznesowe procesu}

## Cel

{Co proces ma osiągnąć i dlaczego}

## Zakres

### W zakresie

{Co proces obejmuje}

### Poza zakresem

{Czego proces nie obejmuje}

## Wymagania funkcjonalne

| ID | Wymaganie | Priorytet (MoSCoW) |
|---|---|---|
| REQ-01 | {Opis} | Must / Should / Could / Won't |

## Reguły biznesowe

| ID | Reguła | Źródło / uzasadnienie |
|---|---|---|
| RB-01 | {Opis} | {Źródło} |

## Wymagania niefunkcjonalne

- NFR-{nnn}.NFRT-{KATEGORIA}-{nn}: {czego dotyczy w procesie}

## Słownik pojęć

- **{Pojęcie}**: {definicja}

## Założenia i otwarte pytania

> Założenie: {treść}

| Pytanie | Właściciel | Termin | Status |
|---|---|---|---|
| {Pytanie} | {Właściciel} | {Termin} | {Status} |
