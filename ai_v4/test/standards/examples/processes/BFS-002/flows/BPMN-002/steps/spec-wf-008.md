---
doc-id: SPEC-WF-008
title: "Wywołanie korekty rozliczenia"
description: "Wywołanie podprocesu korekty rozliczenia po uznaniu reklamacji, z przekazaniem identyfikatora reklamacji i kwoty rekompensaty, przed publikacją decyzji."
status: draft                                  # draft | active
task-type: call-activity                       # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: SPEC-WF-006
  - type: consumes
    target: SPEC-WF-009
---

# Wywołanie korekty rozliczenia

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | silnik Camunda (wywołanie podprocesu) |

## Cel zadania

Uruchomić podproces „Korekta rozliczenia po reklamacji” dla uznanej reklamacji
i poczekać, aż korekta rozliczenia dyspozycji zostanie zaksięgowana. Dopiero
potem proces publikuje decyzję o uznaniu reklamacji.

## Warunki wstępne

- Instancja przeszła bramkę decyzji ścieżką UZNANA.
- SPEC-WF-006 zapisał zmienną compensation.
- Definicja podprocesu „Korekta rozliczenia po reklamacji” jest wdrożona razem z procesem nadrzędnym.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| — | — | Zadanie nie woła zasobów; uruchamia podproces „Korekta rozliczenia po reklamacji” |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| compensation | Decimal | SPEC-WF-006 | Kwota rekompensaty przekazywana do podprocesu pod tą samą nazwą |
| businessKey | String | Start procesu (zgłoszenie reklamacji) | Identyfikator reklamacji przekazywany do podprocesu jako complaintId i klucz biznesowy |

### Wyjście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| postingId | String | SPEC-WF-009 | Identyfikator księgowania korygującego, przepisany z podprocesu |
| postingStatus | String | SPEC-WF-009 | Status księgowania korygującego, przepisany z podprocesu |

## Reguły i logika

- Zadanie wywołuje proces o identyfikatorze `korekta-rozliczenia` w wersji wdrożonej razem z procesem nadrzędnym.
- Mapowanie wejścia: complaintId przyjmuje wartość businessKey, compensation przechodzi bez zmian.
- Jeśli podproces kończy się zdarzeniem końcowym „Korekta zaksięgowana”, to zadanie przepisuje postingId i postingStatus zapisane przez SPEC-WF-009 do instancji nadrzędnej, a instancja przechodzi do publikacji decyzji.
- Jeśli podproces zatrzyma się incydentem, to zadanie czeka; proces nadrzędny nie publikuje decyzji przed zaksięgowaniem korekty.

## Scenariusze błędów

Brak wdrożonej definicji podprocesu: silnik zgłasza incydent przy wywołaniu,
a instancja zostaje na tym zadaniu. Incydent wewnątrz podprocesu, np. księga
główna niedostępna po ponowieniach: zadanie czeka na zakończenie podprocesu
po obsłużeniu incydentu, a decyzja nie jest publikowana.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych.

## Efekty uboczne

Podproces księguje korektę rozliczenia dyspozycji w księdze głównej. Samo
zadanie nie zmienia stanu reklamacji ani dyspozycji.

## Kryteria akceptacji

### AC-01

- Given instancja na ścieżce UZNANA ma compensation = 950.00 z wyliczenia rekompensaty
- When silnik wykonuje wywołanie korekty rozliczenia
- Then powstaje instancja podprocesu „Korekta rozliczenia po reklamacji” ze zmiennymi complaintId i compensation = 950.00, a po jej zakończeniu instancja nadrzędna ma postingId i postingStatus i przechodzi do publikacji decyzji

## Powiązane dokumenty

- SPEC-WF-006: źródło zmiennej compensation.
- SPEC-WF-009: krok podprocesu, który zapisuje postingId i postingStatus.
- Podproces „Korekta rozliczenia po reklamacji”, podany nazwą.
