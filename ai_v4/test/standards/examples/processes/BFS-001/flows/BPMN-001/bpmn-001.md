---
doc-id: BPMN-001
title: "Rozliczenie dyspozycji"
description: "Proces silnika, który księguje dyspozycje wybrane do przebiegu rozliczenia i zamyka dzień rozliczeniowy."
status: draft                                  # draft | active
bpmn-process-id: "rozliczenie-dyspozycji"
process-version: "1.0"                         # znacznik lub skrót zapisu pliku BPMN XML
owner: "Anna Nowak"
relations:
  - type: contains
    target: SPEC-WF-001
  - type: contains
    target: SPEC-WF-002
  - type: contains
    target: SPEC-WF-003
  - type: realizes
    target: CAP-003
---

# Rozliczenie dyspozycji

## Cel procesu

Zaksięgować w księdze głównej dyspozycje wybrane do przebiegu rozliczenia
i zamknąć przebieg podsumowaniem: ile dyspozycji rozliczono, a ile zostało
nierozliczonych. Przebieg nocny kończy się przed 05:00.

## Kontekst

| Pole | Wartość |
|---|---|
| System | Rozliczenia dyspozycji (settlement-service) |
| Silnik BPMN | Camunda |
| Inicjator | Uruchomienie przebiegu rozliczenia przez punkt końcowy POST /settlement-runs: harmonogram nocny o 01:00 albo harmonogram ponowień |
| Zakres | Jeden przebieg rozliczenia typu NIGHTLY albo RETRY, od pobrania dyspozycji do zamknięcia dnia rozliczeniowego |
| Zdolność | CAP-003 |

## Diagram procesu

| Zasób | Odnośnik |
|---|---|
| BPMN XML | `docs/project/system/workflows/bpmn/rozliczenie-dyspozycji.bpmn` |
| Widok w silniku | Camunda Cockpit, definicja procesu `rozliczenie-dyspozycji`, znacznik wersji 1.0 |
| Eksport PNG/SVG | `docs/project/system/workflows/bpmn/rozliczenie-dyspozycji.svg` |

## Zadania procesu

| ID zadania | Nazwa | SPEC-WF |
|---|---|---|
| pobranie-dyspozycji | Pobranie dyspozycji do rozliczenia | SPEC-WF-001 |
| ksiegowanie-pozycji | Księgowanie pozycji | SPEC-WF-002 |
| zamkniecie-dnia | Zamknięcie dnia rozliczeniowego | SPEC-WF-003 |

## Bramki i warunki

Bramka wyłączna „Są dyspozycje do rozliczenia?” stoi za zadaniem pobrania
dyspozycji:

- jeśli lista dispositionIds nie jest pusta, proces przechodzi do księgowania pozycji;
- jeśli lista jest pusta, proces pomija księgowanie i przechodzi od razu do zamknięcia dnia rozliczeniowego.

Za księgowaniem proces nie ma bramek. Każda dyspozycja kończy przebieg ze
statusem ROZLICZONA albo NIEROZLICZONA, a nierozliczone z mniej niż trzema
nieudanymi próbami rozliczenia podejmuje kolejny przebieg typu RETRY.
Dyspozycję z trzecią nieudaną próbą rozliczenia zadanie księgowania zgłasza
do ręcznego wyjaśnienia w zespole rozliczeń.

## Zdarzenia graniczne

Proces nie ma zdarzeń granicznych. Niedostępność księgi głównej obsługuje
zadanie księgowania: dyspozycja dostaje status NIEROZLICZONA i proces idzie
dalej. Błąd techniczny zadania serwisowego po wyczerpaniu 3 ponowień tworzy
incydent w silniku; instancja czeka na operatora, który ponawia zadanie albo
przerywa przebieg. Gdy operator przerwie przebieg, settlement-service ustawia
status NIEROZLICZONA dyspozycjom z listy dispositionIds, które mają jeszcze
status W_ROZLICZENIU, bez zwiększania failedSettlementAttempts.

## Podprocesy

Proces nie wywołuje podprocesów: wszystkie trzy zadania wykonuje jedna
instancja procesu.

## Powiązane dokumenty

Zdolność CAP-003 oraz kroki SPEC-WF-001, SPEC-WF-002 i SPEC-WF-003. Stany
przebiegu opisuje maszyna stanów „Cykl życia przebiegu rozliczenia”, a stany
dyspozycji maszyna „Cykl życia dyspozycji”.
