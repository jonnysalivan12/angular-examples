---
doc-id: CONV-001
title: "Model odpowiedzi błędnej API"
description: "Wspólny format odpowiedzi błędnej i kody błędów wspólne dla punktów końcowych API."
status: draft                                  # draft | active
owner: "Tomasz Lewandowski"
relations: []
---

# Model odpowiedzi błędnej API

## Cel

Ujednolicić odpowiedź błędną wszystkich punktów końcowych, żeby aplikacje
i procesy obsługiwały błędy w jeden sposób, a każde zgłoszenie do pomocy
technicznej miało identyfikator śladu.

## Zakres

Wszystkie punkty końcowe API, publiczne i wewnętrzne.

## Zasady

### Model odpowiedzi

Odpowiedź błędna ma typ `application/problem+json` i pola:

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| status | Integer | tak | Status HTTP odpowiedzi |
| code | String | tak | Kod błędu: kod wspólny z tabeli „Kody wspólne” albo kod własny punktu końcowego |
| message | String | tak | Komunikat dla użytkownika albo operatora |
| traceId | String | tak | Identyfikator śladu do zgłoszenia w pomocy technicznej |
| violations | Lista | nie | Naruszenia reguł walidacji; tylko przy błędzie walidacji |
| violations[].field | String | tak | Ścieżka pola żądania, np. `items[2].amount` |
| violations[].code | String | nie | Kod naruszenia, np. `PESEL_FORMAT` |
| violations[].message | String | tak | Komunikat naruszenia |

Punkt końcowy może dodać własne pole, np. identyfikator trwającego przebiegu.
Opisuje je w swojej sekcji „Struktura odpowiedzi błędnej”.

```json
{
  "status": 400,
  "code": "INVALID_INPUT",
  "message": "Żądanie zawiera nieprawidłowe dane.",
  "traceId": "4f1c2a9e7b3d4e21",
  "violations": [
    { "field": "pesel", "code": "PESEL_FORMAT", "message": "PESEL musi mieć 11 cyfr." }
  ]
}
```

### Kody wspólne

| HTTP | Kod | Warunek | Komunikat domyślny |
|---|---|---|---|
| 400 | INVALID_INPUT | Pole żądania narusza regułę z tabeli „Walidacja pól wejściowych” punktu końcowego | „Żądanie zawiera nieprawidłowe dane.” |
| 401 | UNAUTHENTICATED | Brak tokenu albo token nieważny lub wygasły | „Wymagane uwierzytelnienie.” |
| 403 | FORBIDDEN | Token jest ważny, ale nie ma roli ani zakresu, których wymaga punkt końcowy | „Brak uprawnień do tej operacji.” |
| 404 | NOT_FOUND | Zasób o identyfikatorze z żądania nie istnieje albo wywołujący nie ma do niego dostępu | „Nie znaleziono zasobu.” |
| 500 | INTERNAL_ERROR | Nieoczekiwany błąd techniczny | „Wystąpił błąd. Spróbuj ponownie później.” |

### Kody i komunikaty własne

Kod własny punktu końcowego zastępuje kod wspólny, gdy błąd ma znaczenie
biznesowe, np. jest przyczyną odrzucenia zapisywaną w danych. Komunikat
z tabeli „Walidacja pól wejściowych” punktu końcowego zastępuje komunikat
domyślny.
