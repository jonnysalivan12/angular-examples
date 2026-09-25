---
doc-id: SCRSEC-012
title: "Zgody"
description: "Sekcja wniosku o rachunek ze zgodą na regulamin produktu i opcjonalną zgodą marketingową."
status: draft                                  # draft | active
owner: "Katarzyna Wójcik"
relations:
  - type: consumes
    target: ENT-Consent
---

# Zgody

## Opis sekcji

Sekcja zbiera zgody wnioskodawcy przed wysłaniem wniosku: wymaganą zgodę na
regulamin wybranego produktu i opcjonalną zgodę na komunikację marketingową.
Każda zgoda zapisuje się z wersją dokumentu, który klient zaakceptował.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Regulamin

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole wyboru (checkbox) z odnośnikiem do dokumentu |
| Etykieta | Akceptuję regulamin produktu i potwierdzam, że się z nim zapoznałem |
| Wartość domyślna | Niezaznaczone |
| Wartość przykładowa | Zaznaczone, wersja dokumentu 2026/03 |
| Źródło danych | — (klient zaznacza przy każdym wniosku) |
| Miejsce utrwalenia | ENT-Consent (consentType = REGULAMIN, atrybuty granted, grantedAt, documentVersion) |
| Edytowalność | tak |
| Wymagalność | tak |
| Uprawnienia | Klient: odczyt i zaznaczenie |
| Walidacja | Musi być zaznaczone przed wysłaniem wniosku |
| Zachowanie | Zaznaczenie aktywuje przycisk „Wyślij wniosek”; odznaczenie go dezaktywuje |
| Tooltip | Bez akceptacji regulaminu nie możemy otworzyć rachunku |
| WCAG (atrybut aria) | aria-required="true", aria-describedby wskazuje odnośnik do regulaminu |
| Analityka zdarzeń (opcjonalnie) | konto_wniosek_regulamin_zaakceptowany |
| Referencja komponentu UI (opcjonalnie) | ConsentCheckbox |

### Marketing

| Atrybut | Wartość |
|---|---|
| Typ pola | Pole wyboru (checkbox) |
| Etykieta | Zgadzam się na otrzymywanie informacji marketingowych e-mailem i SMS-em |
| Wartość domyślna | Niezaznaczone |
| Wartość przykładowa | Niezaznaczone |
| Źródło danych | — (klient zaznacza przy każdym wniosku) |
| Miejsce utrwalenia | ENT-Consent (consentType = MARKETING, atrybuty granted, grantedAt, documentVersion) |
| Edytowalność | tak |
| Wymagalność | nie |
| Uprawnienia | Klient: odczyt i zaznaczenie |
| Walidacja | Brak |
| Zachowanie | Brak wywołań; wartość nie wpływa na przycisk „Wyślij wniosek” |
| Tooltip | Zgodę możesz wycofać w każdej chwili w ustawieniach bankowości |
| WCAG (atrybut aria) | aria-required="false" |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | ConsentCheckbox |

## Reguły biznesowe

- Bez zaznaczonej zgody na regulamin przycisk „Wyślij wniosek” jest nieaktywny i wniosek nie przechodzi dalej.
- Zgoda marketingowa jest dobrowolna i nie wpływa na otwarcie rachunku.
- Zgoda zapisuje wersję dokumentu wyświetlonego klientowi w chwili zaznaczenia.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
przycisk "Wyślij wniosek".aktywny = Regulamin.zaznaczone
gdy wersja regulaminu zmieni się między otwarciem ekranu a wysłaniem:
    odznacz Regulamin i pokaż komunikat "Regulamin został zaktualizowany, zapoznaj się z nową wersją"
```
