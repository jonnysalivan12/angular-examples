---
doc-id: SCRSEC-006
title: "Opis reklamacji"
description: "Powód, opis i opcjonalny załącznik reklamacji wpisywane przez klienta albo doradcę przy zgłoszeniu i pokazywane pracownikowi zaplecza przy rozpatrzeniu."
status: draft                                  # draft | active
owner: "Piotr Zieliński"
relations:
  - type: consumes
    target: ENT-Complaint
---

# Opis reklamacji

## Opis sekcji

Sekcja zbiera treść reklamacji wybranej dyspozycji: powód z listy, opis
własnymi słowami i opcjonalny załącznik, np. potwierdzenie z banku odbiorcy.
Klient wypełnia ją w bankowości internetowej, doradca w oddziale na podstawie
rozmowy z klientem. Powód i opis zapisuje reklamacja utworzona po wysłaniu
zgłoszenia. W zadaniu rozpatrzenia reklamacji sekcja jest tylko do odczytu:
pracownik zaplecza widzi powód, opis i załącznik zapisane w reklamacji.

## Pola sekcji

<!-- Blok powielany dla każdego pola. -->

### Powód

| Atrybut | Wartość |
|---|---|
| Typ pola | lista rozwijana; przy rozpatrzeniu tekst tylko do odczytu |
| Etykieta | Powód reklamacji |
| Wartość domyślna | „Wybierz powód” (brak wartości) |
| Wartość przykładowa | Przelew nie dotarł do odbiorcy |
| Źródło danych | ENT-Complaint (`reason`) przy rozpatrzeniu; przy zgłoszeniu puste, a lista powodów jest stała: Nieprawidłowa kwota księgowania, Przelew nie dotarł do odbiorcy, Podwójne obciążenie rachunku, Inny |
| Miejsce utrwalenia | ENT-Complaint (`reason`) |
| Edytowalność | tak przy zgłoszeniu; nie przy rozpatrzeniu |
| Wymagalność | tak |
| Uprawnienia | Klient, Doradca w oddziale: edycja przy zgłoszeniu; Pracownik zaplecza: odczyt |
| Walidacja | Wartość z listy powodów; bez wyboru przycisk „Wyślij zgłoszenie” pozostaje nieaktywny |
| Zachowanie | Wybór „Inny” zmienia podpowiedź w polu Opis na „Opisz, czego dotyczy reklamacja” |
| Tooltip | Wybierz powód najbliższy sytuacji; szczegóły wpisz w opisie. |
| WCAG (atrybut aria) | `aria-required="true"`, `aria-describedby="powod-podpowiedz"` |
| Analityka zdarzeń (opcjonalnie) | `complaint_reason_selected` z kodem powodu |
| Referencja komponentu UI (opcjonalnie) | DS `Select` |

### Opis

| Atrybut | Wartość |
|---|---|
| Typ pola | pole tekstowe wielowierszowe; przy rozpatrzeniu tekst tylko do odczytu |
| Etykieta | Opis reklamacji |
| Wartość domyślna | puste |
| Wartość przykładowa | Odbiorca pozycji nr 3 zgłasza, że 1 200,00 PLN nie wpłynęło na jego rachunek. |
| Źródło danych | ENT-Complaint (`description`) przy rozpatrzeniu; przy zgłoszeniu puste |
| Miejsce utrwalenia | ENT-Complaint (`description`) |
| Edytowalność | tak przy zgłoszeniu; nie przy rozpatrzeniu |
| Wymagalność | tak |
| Uprawnienia | Klient, Doradca w oddziale: edycja przy zgłoszeniu; Pracownik zaplecza: odczyt |
| Walidacja | Od 1 do 2000 znaków, bez samych spacji; tekst dłuższy niż 2000 znaków jest ucinany przy wklejaniu z komunikatem |
| Zachowanie | Licznik pozostałych znaków pod polem, aktualizowany przy każdej zmianie; przy rozpatrzeniu bez licznika |
| Tooltip | Podaj numer pozycji dyspozycji i kwotę, której dotyczy reklamacja. |
| WCAG (atrybut aria) | `aria-required="true"`, `aria-describedby="opis-licznik"` |
| Analityka zdarzeń (opcjonalnie) | — |
| Referencja komponentu UI (opcjonalnie) | DS `TextArea` z licznikiem |

### Załącznik

| Atrybut | Wartość |
|---|---|
| Typ pola | wybór pliku; przy rozpatrzeniu odnośnik do pobrania pliku |
| Etykieta | Załącznik (opcjonalnie) |
| Wartość domyślna | brak pliku |
| Wartość przykładowa | potwierdzenie-banku-odbiorcy.pdf |
| Źródło danych | ENT-Complaint (`attachment`) przy rozpatrzeniu; przy zgłoszeniu brak pliku |
| Miejsce utrwalenia | ENT-Complaint (`attachment`) |
| Edytowalność | tak przy zgłoszeniu; nie przy rozpatrzeniu |
| Wymagalność | nie |
| Uprawnienia | Klient, Doradca w oddziale: edycja przy zgłoszeniu; Pracownik zaplecza: odczyt i pobranie pliku |
| Walidacja | Jeden plik PDF, JPG albo PNG o rozmiarze do 5 MB |
| Zachowanie | Po wybraniu pliku sekcja sprawdza format i rozmiar w przeglądarce, pokazuje nazwę pliku i przycisk „Usuń”; przy rozpatrzeniu pokazuje nazwę pliku jako odnośnik, a bez załącznika tekst „Brak załącznika” |
| Tooltip | Dołącz dokument, który potwierdza reklamację. |
| WCAG (atrybut aria) | `aria-describedby="zalacznik-formaty"`, komunikat błędu w `aria-live="polite"` |
| Analityka zdarzeń (opcjonalnie) | `complaint_attachment_added` z typem pliku |
| Referencja komponentu UI (opcjonalnie) | DS `FileUpload` |

## Reguły biznesowe

- Zgłoszenie bez powodu i opisu nie może zostać wysłane.
- Opis reklamacji ma najwyżej 2000 znaków.
- Załącznik jest opcjonalny; jedno zgłoszenie ma najwyżej jeden plik.
- Przy rozpatrzeniu powodu, opisu ani załącznika nie można zmienić.

## Zachowania specjalne

<!-- Opcjonalnie, pseudokod. -->

```text
przycisk "Wyślij zgłoszenie" aktywny, gdy:
  wybrana dyspozycja w sekcji "Wybór dyspozycji"
  i powód ma wartość z listy
  i opis ma od 1 do 2000 znaków innych niż same spacje
  i załącznik jest pusty albo poprawny
po zmianie wybranej dyspozycji:
  pola sekcji zachowują wpisane wartości
w zadaniu rozpatrzenia:
  pokaż powód, opis i załącznik reklamacji tylko do odczytu
```
