---
doc-id: INT-{nnn}
title: "{Nazwa systemu}: {operacja}"
description: "{Krótki opis dokumentu}"
status: draft                                  # draft | active
owner: "{Imię Nazwisko}"
relations:
  - type: realizes
    target: CAP-{nnn}                          # zdolność
  - type: consumes
    target: ENT-{Nazwa}                        # Encje
  - type: constrained_by
    target: NFR-{nnn}.NFRT-{KATEGORIA}-{nn}    # Ograniczenia NFR
  - type: applies
    target: CONV-{nnn}                         # Obsługa błędów
---

# {Nazwa systemu}: {operacja}

| Pole | Wartość |
|---|---|
| Zdolność | CAP-{nnn} |

## Cel

{Po co wołamy system zewnętrzny}

## Protokół

| Pole | Wartość |
|---|---|
| Typ | REST / SOAP / gRPC / JMS |
| Właściciel | {Area / Tribe / Squad} |
| Endpoint | {Adres} |
| API Catalog | {Odnośnik} |

## Operacja

Żądanie:

| Pole | Źródło | Opis |
|---|---|---|
| {Pole} | {Źródło} | {Opis} |

Odpowiedź (tylko pola istotne dla nas):

| Pole | Opis |
|---|---|
| {Pole} | {Opis} |

## Warunek wywołania

{Kiedy wołamy operację}

## Obsługa błędów

<!-- Limit czasu i ponawianie wywołań opisuje konwencja; tu dopisujesz skutek dla procesu. Integracja, która odstępuje od konwencji, nie wskazuje jej i opisuje własną obsługę. -->

| Sytuacja | Obsługa |
|---|---|
| 404 | {Obsługa} |
| 5xx | Ponowienia według CONV-{nnn}. {Skutek, gdy ponowienia zawiodą} |
| Przekroczenie czasu | Limit czasu według CONV-{nnn}. {Obsługa} |

## Diagram sekwencji

```mermaid
sequenceDiagram
```

## Encje

- ENT-{Nazwa}: {jak występuje w operacji}

## Ograniczenia NFR

- NFR-{nnn}.NFRT-{KATEGORIA}-{nn}
