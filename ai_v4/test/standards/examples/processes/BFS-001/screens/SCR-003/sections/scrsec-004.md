---
doc-id: SCRSEC-004
title: "Historia statusów"
description: "Lista zmian statusu dyspozycji z etykietą statusu i datą zmiany, tylko do odczytu."
status: draft                                  # draft | active
owner: "Anna Nowak"
relations:
  - type: consumes
    target: ENT-Disposition
  - type: consumes
    target: ENT-StatusDict
---

# Historia statusów

## Opis sekcji

Sekcja pokazuje zmiany statusu dyspozycji od najnowszej: etykietę statusu
i datę zmiany. Na ekranie edycji pozycji potwierdza klientowi, że dyspozycja
nie weszła jeszcze do rozliczenia.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Status

| Atrybut | Wartość |
|---|---|
| Typ pola | Znacznik statusu w wierszu listy |
| Etykieta | Status |
| Wartość domyślna | Etykieta bieżącego statusu dyspozycji |
| Wartość przykładowa | Zaakceptowana |
| Źródło danych | ENT-StatusDict (label dla kodu statusu dyspozycji) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt historii własnej dyspozycji |
| Walidacja | — |
| Zachowanie | Bez wywołań; kod statusu z dyspozycji zamieniany na etykietę ze słownika statusów dyspozycji |
| Tooltip | Przy statusie końcowym, czyli dyspozycji odrzuconej albo skorygowanej: „Ta dyspozycja nie zmieni już statusu” |
| WCAG (atrybut aria) | aria-label łączy etykietę statusu i datę zmiany |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-status-badge |

### Data zmiany

| Atrybut | Wartość |
|---|---|
| Typ pola | Data i godzina, tylko do odczytu |
| Etykieta | Data zmiany |
| Wartość domyślna | Data przyjęcia dyspozycji |
| Wartość przykładowa | 14.09.2026 10:32 |
| Źródło danych | ENT-Disposition (createdAt, settledAt) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt historii własnej dyspozycji |
| Walidacja | — |
| Zachowanie | Bez wywołań; data przyjęcia pochodzi z createdAt, data rozliczenia z settledAt |
| Tooltip | — |
| WCAG (atrybut aria) | Element time z atrybutem datetime w formacie ISO 8601 |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ds-date-time |

## Reguły biznesowe

- Wiersze są uporządkowane od najnowszej zmiany.
- Status oznaczony w słowniku jako końcowy jest wyróżniony i ma tooltip.
- Status ROZLICZONA nie jest końcowy: po uznanej reklamacji rozliczona dyspozycja może przejść do statusu SKORYGOWANA, więc przy statusie ROZLICZONA sekcja nie pokazuje tooltipu statusu końcowego.
- Wiersz rozliczenia pojawia się dopiero wtedy, gdy dyspozycja ma datę rozliczenia.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
dodaj wiersz: etykieta statusu ZAAKCEPTOWANA, data createdAt
JEŚLI settledAt jest ustawione:
    dodaj wiersz: etykieta bieżącego statusu, data settledAt
posortuj wiersze malejąco po dacie
DLA każdego wiersza:
    JEŚLI status ma w słowniku isFinal = true:
        wyróżnij wiersz i dodaj tooltip
```
