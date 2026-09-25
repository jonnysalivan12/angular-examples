---
doc-id: SCRSEC-005
title: "Wybór dyspozycji"
description: "Lista rozliczonych dyspozycji klienta z ostatnich 30 dni, z której zgłaszający wybiera dyspozycję do reklamacji, a przy rozpatrzeniu podgląd reklamowanej dyspozycji."
status: draft                                  # draft | active
owner: "Piotr Zieliński"
relations:
  - type: consumes
    target: ENT-Complaint
  - type: consumes
    target: ENT-Disposition
  - type: consumes
    target: API-005
---

# Wybór dyspozycji

## Opis sekcji

Sekcja pokazuje dyspozycje klienta rozliczone w ostatnich 30 dniach, od
najnowszej. Każdy wiersz listy to jedna dyspozycja z rachunkiem obciążanym,
kwotą łączną, walutą i datą rozliczenia. Zgłaszający zaznacza jedną dyspozycję,
której dotyczy reklamacja. W bankowości internetowej lista dotyczy zalogowanego
klienta, w oddziale klienta zidentyfikowanego przez doradcę w bieżącej obsłudze.
Sekcja tylko udostępnia wybór: wybrana dyspozycja trafia do zgłoszenia
wysyłanego z ekranu. W zadaniu rozpatrzenia reklamacji sekcja jest tylko do
odczytu i pokazuje pracownikowi zaplecza jedną reklamowaną dyspozycję ze
szczegółów reklamacji, bez listy wyboru.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Dyspozycja

| Atrybut | Wartość |
|---|---|
| Typ pola | lista jednokrotnego wyboru (karty z przyciskiem opcji); przy rozpatrzeniu jedna karta bez przycisku opcji |
| Etykieta | Dyspozycja, której dotyczy reklamacja |
| Wartość domyślna | brak zaznaczenia; przy rozpatrzeniu reklamowana dyspozycja |
| Wartość przykładowa | 7c9e6679-7425-40de-944b-e07fc1f90ae7 |
| Źródło danych | ENT-Disposition (`dispositionId`) |
| Miejsce utrwalenia | ENT-Complaint (`dispositionId`) |
| Edytowalność | tak przy zgłoszeniu; nie przy rozpatrzeniu |
| Wymagalność | tak |
| Uprawnienia | Klient: wybór własnej dyspozycji; Doradca w oddziale: wybór dyspozycji obsługiwanego klienta; Pracownik zaplecza: odczyt reklamowanej dyspozycji |
| Walidacja | Dokładnie jedna zaznaczona dyspozycja; na liście tylko dyspozycje w statusie ROZLICZONA z datą rozliczenia nie starszą niż 30 dni |
| Zachowanie | Słownik wartości: przy otwarciu sekcji w zgłoszeniu pobiera dyspozycje klienta z filtrem statusu ROZLICZONA i odrzuca rozliczone dawniej niż 30 dni, API-005; w oddziale pobiera je z clientId zwróconym przez identyfikację klienta w oddziale; przy rozpatrzeniu pokazuje dyspozycję ze szczegółów reklamacji bez pobierania słownika |
| Tooltip | Reklamację można złożyć do 30 dni od rozliczenia dyspozycji. |
| WCAG (atrybut aria) | `role="radiogroup"`, `aria-labelledby="wybor-dyspozycji-naglowek"`, `aria-required="true"` |
| Analityka zdarzeń (opcjonalnie) | `complaint_disposition_selected` z liczbą dyspozycji na liście |
| Referencja komponentu UI (opcjonalnie) | DS `RadioCardList` |

### Rachunek obciążany

| Atrybut | Wartość |
|---|---|
| Typ pola | tekst tylko do odczytu w wierszu listy |
| Etykieta | Rachunek obciążany |
| Wartość domyślna | — |
| Wartość przykładowa | PL61 1090 1014 0000 0712 1981 2874 |
| Źródło danych | ENT-Disposition (`accountNumber`) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient, Doradca w oddziale, Pracownik zaplecza: odczyt |
| Walidacja | Brak; numer wyświetlany w grupach po cztery znaki |
| Zachowanie | Wartość z tej samej odpowiedzi słownika co lista dyspozycji, API-005; przy rozpatrzeniu ze szczegółów reklamacji |
| Tooltip | — |
| WCAG (atrybut aria) | `aria-label="Rachunek obciążany"` |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `IbanText` |

### Kwota łączna

| Atrybut | Wartość |
|---|---|
| Typ pola | kwota tylko do odczytu w wierszu listy |
| Etykieta | Kwota dyspozycji |
| Wartość domyślna | — |
| Wartość przykładowa | 3 450,00 |
| Źródło danych | ENT-Disposition (`totalAmount`) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient, Doradca w oddziale, Pracownik zaplecza: odczyt |
| Walidacja | Brak; format z dwoma miejscami po przecinku i spacją co trzy cyfry |
| Zachowanie | Wartość z tej samej odpowiedzi słownika co lista dyspozycji, API-005; przy rozpatrzeniu ze szczegółów reklamacji |
| Tooltip | Suma kwot wszystkich pozycji dyspozycji. |
| WCAG (atrybut aria) | `aria-label` z kwotą i walutą, np. „Kwota dyspozycji 3 450,00 PLN” |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `AmountText` |

### Waluta

| Atrybut | Wartość |
|---|---|
| Typ pola | tekst tylko do odczytu w wierszu listy |
| Etykieta | Waluta |
| Wartość domyślna | — |
| Wartość przykładowa | PLN |
| Źródło danych | ENT-Disposition (`currency`) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient, Doradca w oddziale, Pracownik zaplecza: odczyt |
| Walidacja | Brak |
| Zachowanie | Wyświetlana obok kwoty dyspozycji, API-005; przy rozpatrzeniu ze szczegółów reklamacji |
| Tooltip | — |
| WCAG (atrybut aria) | `aria-hidden="true"`, bo kwota ma walutę w `aria-label` |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `AmountText` |

### Data rozliczenia

| Atrybut | Wartość |
|---|---|
| Typ pola | data i godzina tylko do odczytu w wierszu listy |
| Etykieta | Rozliczona |
| Wartość domyślna | — |
| Wartość przykładowa | 02.09.2026 01:42 |
| Źródło danych | ENT-Disposition (`settledAt`) |
| Miejsce utrwalenia | — |
| Edytowalność | nie |
| Wymagalność | nie |
| Uprawnienia | Klient, Doradca w oddziale, Pracownik zaplecza: odczyt |
| Walidacja | Brak |
| Zachowanie | Pod datą sekcja pokazuje w zgłoszeniu liczbę dni pozostałych na reklamację, API-005; przy rozpatrzeniu tylko datę ze szczegółów reklamacji |
| Tooltip | Termin na reklamację liczy się od daty rozliczenia. |
| WCAG (atrybut aria) | `aria-describedby="termin-reklamacji"` |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `DateTimeText` |

## Reguły biznesowe

- Reklamacja dotyczy dyspozycji rozliczonej nie dawniej niż 30 dni; lista nie pokazuje starszych dyspozycji, a ostateczną kontrolę terminu wykonuje wysłanie zgłoszenia.
- Jedno zgłoszenie dotyczy jednej dyspozycji.
- Dyspozycja w innym statusie niż ROZLICZONA nie może być reklamowana.
- Przy rozpatrzeniu reklamowanej dyspozycji nie można zmienić.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
przy otwarciu sekcji w zgłoszeniu:
  lista = dyspozycje klienta ze statusem ROZLICZONA (API-005)
  lista = pozycje listy z settledAt >= dziś - 30 dni, malejąco po settledAt
  jeśli lista jest pusta:
    pokaż komunikat "Brak dyspozycji rozliczonych w ostatnich 30 dniach"
    ukryj sekcję "Opis reklamacji" i zablokuj wysłanie zgłoszenia
  jeśli słownik nie odpowiada:
    pokaż komunikat "Nie udało się pobrać dyspozycji" z przyciskiem "Spróbuj ponownie"
przy otwarciu sekcji w zadaniu rozpatrzenia:
  pokaż reklamowaną dyspozycję ze szczegółów reklamacji jako jedną kartę tylko do odczytu
```
