---
doc-id: SPEC-WF-007
title: "Publikacja decyzji reklamacyjnej"
description: "Zadanie serwisowe, które po zaksięgowaniu korekty rozliczenia publikuje zdarzenie o uznaniu reklamacji z kwotą rekompensaty dla wypłaty i rozliczania dyspozycji."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: QUE-003
  - type: consumes
    target: SPEC-WF-004
  - type: consumes
    target: SPEC-WF-005
  - type: consumes
    target: SPEC-WF-006
---

# Publikacja decyzji reklamacyjnej

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | complaint-service |

## Cel zadania

Ogłosić decyzję o uznaniu reklamacji z kwotą rekompensaty, gdy korekta
rozliczenia jest już zaksięgowana. Na zdarzenie reagują wypłata rekompensaty
i rozliczanie dyspozycji, więc proces nie woła ich bezpośrednio.

## Warunki wstępne

- Instancja przeszła bramkę decyzji ścieżką UZNANA, a podproces „Korekta rozliczenia po reklamacji” zakończył się zdarzeniem „Korekta zaksięgowana”.
- SPEC-WF-004 zapisał complaintId i dispositionId, SPEC-WF-005 zapisał resolvedAt, a SPEC-WF-006 zapisał compensation.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| Zdarzenie | QUE-003 | Publikuje zdarzenie z identyfikatorem reklamacji, identyfikatorem reklamowanej dyspozycji, decyzją UZNANA, kwotą rekompensaty i datą decyzji; kluczem komunikatu jest identyfikator reklamacji |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| complaintId | UUID | SPEC-WF-004 | Identyfikator reklamacji: pole identyfikatora i klucz komunikatu w zdarzeniu |
| dispositionId | UUID | SPEC-WF-004 | Identyfikator reklamowanej dyspozycji, po którym rozliczanie dyspozycji wskazuje skorygowaną dyspozycję |
| resolvedAt | DateTime | SPEC-WF-005 | Data i godzina zapisu decyzji umieszczana w zdarzeniu |
| compensation | Decimal | SPEC-WF-006 | Kwota rekompensaty umieszczana w zdarzeniu |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| resolutionEventId | UUID | Identyfikator komunikatu opublikowanego zdarzenia, do śledzenia w logach |

## Reguły i logika

- Jeśli broker potwierdzi zapis zdarzenia, to zadanie zapisuje resolutionEventId, a proces kończy się zdarzeniem „Reklamacja uznana”.
- Decyzja w zdarzeniu ma wartość UZNANA, bo zadanie leży tylko na ścieżce UZNANA bramki decyzji.
- Jeśli compensation jest pusta albo nie większa od zera albo brakuje dispositionId lub resolvedAt, to zadanie nie publikuje zdarzenia i kończy się incydentem.
- Jeśli silnik ponawia zadanie, to zdarzenie ma ten sam identyfikator komunikatu wyliczony z identyfikatora reklamacji, żeby odbiorcy pominęli duplikat.

## Scenariusze błędów

Broker niedostępny albo brak potwierdzenia zapisu: silnik ponawia zadanie
3 razy co 30 sekund (cykl `R3/PT30S`), a potem zgłasza incydent. Korekta
rozliczenia jest już zaksięgowana, więc po obsłużeniu incydentu zadanie
publikuje zdarzenie bez ponownej korekty.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych.

## Efekty uboczne

W kanale zdarzenia QUE-003 pojawia się decyzja o uznaniu reklamacji; na jej
podstawie wypłata rekompensaty zleca przelew, a rozliczanie dyspozycji oznacza
reklamowaną dyspozycję jako skorygowaną. Zadanie nie zmienia stanu reklamacji.

## Kryteria akceptacji

### AC-01

- Given instancja na ścieżce UZNANA po zaksięgowaniu korekty ma complaintId, dispositionId, resolvedAt i compensation = 950.00
- When silnik wykonuje zadanie publikacji decyzji
- Then broker ma jedno zdarzenie QUE-003 z identyfikatorem reklamacji, identyfikatorem dyspozycji, decyzją UZNANA, kwotą 950.00 i datą decyzji, a proces kończy się zdarzeniem „Reklamacja uznana”

## Powiązane dokumenty

- QUE-003: kontrakt publikowanego zdarzenia.
- SPEC-WF-004: źródło zmiennych complaintId i dispositionId.
- SPEC-WF-005: źródło zmiennej resolvedAt.
- SPEC-WF-006: źródło zmiennej compensation.
