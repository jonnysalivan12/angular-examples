---
doc-id: CONV-004
title: "Nagłówki komunikatów"
description: "Nagłówki wspólne zdarzeń publikowanych przez brokera, zgodne z CloudEvents."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations: []
---

# Nagłówki komunikatów

## Cel

Ujednolicić nagłówki zdarzeń, żeby konsument pomijał duplikaty i łączył
komunikaty jednej sprawy bez czytania ładunku.

## Zakres

Zdarzenia, które nasze usługi publikują przez brokera komunikatów (Kafka,
RabbitMQ).

## Zasady

### Nagłówki wspólne

Nagłówki są zgodne z wytycznymi AsyncAPI 3.0 i CloudEvents.

| Pole | Opis |
|---|---|
| correlationId | Identyfikator korelacji sprawy; konsument przekazuje go dalej |
| messageId | Unikalny identyfikator komunikatu (UUID); konsument pomija po nim duplikaty |
| ce_id | Identyfikator zdarzenia CloudEvents, równy messageId |
| ce_source | Źródło zdarzenia: ścieżka usługi producenta |
| ce_time | Czas zdarzenia w UTC, format ISO 8601 |
| content-type | application/json |

### Wartości własne zdarzenia

Dokument zdarzenia podaje, który identyfikator niesie correlationId, jaką
wartość ma ce_source i jaki moment zapisuje ce_time.
