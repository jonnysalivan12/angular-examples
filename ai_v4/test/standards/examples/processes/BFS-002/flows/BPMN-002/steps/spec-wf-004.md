---
doc-id: SPEC-WF-004
title: "Rejestracja reklamacji w procesie"
description: "Zadanie serwisowe, które pobiera zgłoszoną reklamację, zapisuje w zmiennych procesu jej identyfikator, reklamowaną dyspozycję i kwotę tej dyspozycji oraz przekazuje reklamację do rozpatrzenia."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: API-007
---

# Rejestracja reklamacji w procesie

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | complaint-service |

## Cel zadania

Pobrać reklamację wskazaną kluczem biznesowym instancji, zapisać w zmiennych
procesu identyfikator reklamacji, identyfikator reklamowanej dyspozycji i jej
kwotę łączną, a potem przekazać reklamację do rozpatrzenia. Kolejne zadania nie
sięgają już do systemu reklamacji po te dane.

## Warunki wstępne

- Instancja procesu „Obsługa reklamacji” wystartowała po zgłoszeniu reklamacji i ma klucz biznesowy równy identyfikatorowi reklamacji.
- Reklamacja istnieje w systemie reklamacji w statusie ZGLOSZONA.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| API | API-007 | Pobiera reklamację po identyfikatorze z klucza biznesowego, z konta technicznego serwisu complaint-service; z odpowiedzi odczytuje identyfikator i status reklamacji oraz identyfikator i kwotę łączną reklamowanej dyspozycji |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| businessKey | String | Start procesu (zgłoszenie reklamacji) | Klucz biznesowy instancji: identyfikator reklamacji nadany przy zgłoszeniu |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| complaintId | UUID | Identyfikator reklamacji potwierdzony w systemie reklamacji |
| dispositionId | UUID | Identyfikator reklamowanej dyspozycji z pola disposition.dispositionId |
| dispositionAmount | Decimal | Kwota łączna reklamowanej dyspozycji z pola disposition.totalAmount; górna granica rekompensaty |

## Reguły i logika

- Jeśli businessKey nie jest poprawnym UUID, to zadanie nie woła API-007 i kończy się incydentem „Niepoprawny klucz reklamacji”.
- Jeśli API-007 zwraca reklamację w statusie ZGLOSZONA, to zadanie zapisuje complaintId, dispositionId i dispositionAmount, zmienia status reklamacji na W_ROZPATRZENIU i kończy się.
- Jeśli API-007 zwraca reklamację w innym statusie niż ZGLOSZONA, to zadanie nie zapisuje zmiennych, nie zmienia statusu i kończy się incydentem „Reklamacja już w obsłudze”.

## Scenariusze błędów

API-007 odpowiada 404: reklamacja nie istnieje, zadanie kończy się incydentem
bez ponowień. Brak odpowiedzi albo błąd 5xx: silnik ponawia zadanie 3 razy
co minutę (cykl `R3/PT1M`), a po ostatniej nieudanej próbie zgłasza incydent
do obsługi przez administratora procesu. Reklamacja zostaje wtedy w statusie
ZGLOSZONA.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych. Błędy obsługują ponowienia i incydent
silnika.

## Efekty uboczne

Zadanie zmienia status reklamacji z ZGLOSZONA na W_ROZPATRZENIU. Nie wysyła
powiadomień. Po zakończeniu zadania silnik tworzy zadanie rozpatrzenia
reklamacji.

## Kryteria akceptacji

### AC-01

- Given reklamacja w statusie ZGLOSZONA dotyczy dyspozycji na 3 450,00 PLN, a instancja procesu ma klucz biznesowy równy identyfikatorowi tej reklamacji
- When silnik wykonuje zadanie rejestracji reklamacji
- Then instancja ma zmienne complaintId równą identyfikatorowi reklamacji, dispositionId równą identyfikatorowi reklamowanej dyspozycji i dispositionAmount = 3450.00, reklamacja ma status W_ROZPATRZENIU, a silnik tworzy zadanie rozpatrzenia

## Powiązane dokumenty

- API-007: pobranie szczegółów reklamacji z reklamowaną dyspozycją.
