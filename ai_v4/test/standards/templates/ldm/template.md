---
doc-id: LDM-{nnn}
title: "{Nazwa modelu}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
source: "{np. eksport XML z EA}"
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: DDM-{nnn}.DOM-{Nazwa}              # realizowane pojęcie
  - type: contains
    target: ENT-{Nazwa}                        # encja modelu
---

# {Nazwa modelu}

| Pole | Wartość |
|---|---|
| ID | LDM-{nnn} |
| Źródło DDM | DDM-{nnn} |
| Wersja | {Wersja} |
| Źródło | {Źródło} |

## Cel i zakres

{Jaki obszar danych opisuje model i po co}

## Źródło (DDM)

{Model domenowy, z którego wynika model logiczny}

## Mapowanie DDM → LDM

| Pojęcie | Encja | Uzasadnienie |
|---|---|---|
| DDM-{nnn}.DOM-{Nazwa} | ENT-{Nazwa} | {Uzasadnienie} |

## Diagram ER

<!-- Bez kluczy PK/FK, z notacją liczebności. -->

```mermaid
erDiagram
```

## Encje

- ENT-{Nazwa}

## Kluczowe relacje

{Najważniejsze relacje między encjami}

## Słowniki zewnętrzne

{Słowniki spoza modelu, z których korzystają encje}

## Zakres poza dokumentem

{Czego model nie opisuje}
