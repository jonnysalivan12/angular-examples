---
doc-id: NFR-{nnn}
title: "{Nazwa}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
scope: system                                  # system | component
owner: "{Imię Nazwisko}"
relations:
  - type: contains
    target: NFRT-{KATEGORIA}-{nn}              # własny wiersz, np. NFRT-PERF-01
---

# {Nazwa}

| Pole | Wartość |
|---|---|
| Zakres | system / component / process |
| Właściciel | {Imię Nazwisko} |
| Krytyczność | {Krytyczność} |

## Cel i kontekst

{Po co są wymagania jakościowe i czego dotyczą}

## Macierz wymagań

| ID | Atrybut jakości | Metryka | Próg docelowy | Metoda pomiaru |
|---|---|---|---|---|
| NFRT-{KATEGORIA}-{nn} | {Atrybut jakości} | {Metryka} | {Próg docelowy} | {Metoda pomiaru} |

## Katalog według kategorii

### Performance

{Wymagania wydajności}

### Availability i Reliability

{Wymagania dostępności i niezawodności}

### Security i Compliance

{Wymagania bezpieczeństwa i zgodności}

### Observability i Auditability

{Wymagania obserwowalności i audytowalności}

### Operability i Maintainability

{Wymagania obsługi i utrzymania}

### Continuity (RTO/RPO)

{Wymagania ciągłości działania: RTO i RPO}

## Weryfikacja i monitorowanie

| ID | Przed wydaniem | Po wydaniu | Próg alertu |
|---|---|---|---|
| NFRT-{KATEGORIA}-{nn} | {Przed wydaniem} | {Po wydaniu} | {Próg alertu} |

## Wyjątki i odstępstwa

| ID | Powód | Akceptujący | Data wygaśnięcia |
|---|---|---|---|
| NFRT-{KATEGORIA}-{nn} | {Powód} | {Akceptujący} | {Data wygaśnięcia} |
