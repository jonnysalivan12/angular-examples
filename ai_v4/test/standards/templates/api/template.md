---
doc-id: API-{nnn}
title: "{METODA} /{zasób}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: CAP-{nnn}                          # zdolność
  - type: consumes
    target: ENT-{Nazwa}                        # Encje
  - type: consumes
    target: INT-{nnn}                          # Zależności
  - type: consumes
    target: FLOW-{nnn}                         # Zachowanie; także BPMN-{nnn}, SPEC-WF-{nnn}
  - type: constrained_by
    target: NFR-{nnn}.NFRT-{KATEGORIA}-{nn}    # Ograniczenia NFR
  - type: applies
    target: CONV-{nnn}                         # Autentykacja; Struktura odpowiedzi błędnej
---

# {METODA} /{zasób}

| Pole | Wartość |
|---|---|
| Zdolność | CAP-{nnn} |

## Cel

{Po co istnieje punkt końcowy}

## Parametry wejściowe

<!-- Nagłówków opisanych w konwencji nie powtarzasz. -->

| Parametr | Typ | Wymagany | Źródło |
|---|---|---|---|
| {nazwa} | {typ} | tak / nie | query / header / path / body |

## Walidacja pól wejściowych

| Reguła | Kod błędu HTTP | Komunikat zwracany przez system |
|---|---|---|
| {Reguła} | {Kod błędu HTTP} | {Komunikat zwracany przez system} |

## Złożone parametry wejściowe

<!-- Opcjonalnie, np. zaszyfrowany token zawierający kilka informacji. -->

{Budowa złożonego parametru}

## Autentykacja

<!-- Sposób autentykacji opisuje konwencja. Bez konwencji albo przy odstępstwie od niej opisujesz go tutaj. -->

Według CONV-{nnn}. {Wymagana rola}

## Zachowanie

### Przebieg podstawowy

{Co robi punkt końcowy w typowym wywołaniu}

- FLOW-{nnn}: {którą część przebiegu opisuje przepływ}
- BPMN-{nnn}: {kiedy punkt końcowy uruchamia proces}
- SPEC-WF-{nnn}: {który krok user-task punkt końcowy przypisuje, odkłada albo kończy}

### Przypadek brzegowy

{Zachowanie w przypadku brzegowym}

## Model odpowiedzi

<!-- Opcjonalnie: classDiagram i tabela pól, bez kopiowania OpenAPI. -->

```mermaid
classDiagram
```

| Pole | Typ | Opis |
|---|---|---|
| {Pole} | {Typ} | {Opis} |

## Struktura odpowiedzi błędnej

<!-- Model odpowiedzi błędnej i kody wspólne opisuje konwencja. Bez konwencji albo przy odstępstwie od niej opisujesz format tutaj. -->

Według CONV-{nnn}. {Kody błędów własnych punktu końcowego i warunki, w których występują}

## Encje

- ENT-{Nazwa}: {jak występuje w żądaniu lub odpowiedzi}

## Zależności

<!-- Tylko integracje wołane poza przepływami; wywołań zapisanych w przepływie nie powtarzasz. -->

- INT-{nnn}: {po co punkt końcowy go woła}

## Ograniczenia NFR

- NFR-{nnn}.NFRT-{KATEGORIA}-{nn}
