---
doc-id: STM-{nnn}
title: "{Nazwa maszyny stanów}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: DDM-{nnn}.DOM-{Nazwa}              # Obiekt (pojęcie DDM)
  - type: realizes
    target: CAP-{nnn}                          # zdolność
---

# {Nazwa maszyny stanów}

| Pole | Wartość |
|---|---|
| Obiekt (pojęcie DDM) | DDM-{nnn}.DOM-{Nazwa} |
| Zdolność | CAP-{nnn} |

## Warunki wstępne

{Co musi być spełnione, zanim obiekt wejdzie w cykl życia}

## Diagram maszyny stanów

<!-- Generowany z tabel poniżej albo eksportowany z EA do katalogu assets/. -->

```mermaid
stateDiagram-v2
```

## Stany — opis

### Słownik statusów

| Kod | Status | Opis | Czy końcowy |
|---|---|---|---|
| {Kod} | {Status} | {Opis} | tak / nie |

### Stany procesowe

| Stan z | Stan do | Opis przejścia | Typ przepływu |
|---|---|---|---|
| {Stan z} | {Stan do} | {Opis przejścia} | MAIN / ALTERNATIVE / ERROR |

## Kluczowe elementy

- Główna ścieżka sukcesu: {Opis}
- Przejścia alternatywne: {Opis}
- Przekroczenie czasu: {Opis}
- Odrzucenia i rezygnacje: {Opis}

## Scenariusze błędów

{Sytuacje błędne i stany, do których prowadzą}
