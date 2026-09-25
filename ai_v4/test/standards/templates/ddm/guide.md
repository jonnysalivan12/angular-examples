# Domain Data Model (DDM)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Model domenowy danych dla jednego obszaru: pojęcia biznesowe, znaczenie,
reguły i relacje. Odpowiada na pytanie „Co te dane znaczą w domenie i jakimi
regułami się rządzą?”.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz domenowy model danych: pojęcia biznesowe i relacje.

**Nie używaj gdy:**

- opisujesz strukturę logiczną danych → [ldm](../ldm/guide.md), [ldm-entity](../ldm-entity/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Poziom analityczny, niezależny od implementacji, struktury bazy i kontraktów API.
- DDM jest nadrzędny i niezależny od konsumentów: to konsumenci wskazują model. DDM nie opisuje struktury logicznej ani konsumentów modelu.
- Jeden obszar domenowy to jeden DDM.
- Sposób pracy: od źródła w górę (model EA, rozmowy), potem pojęcia `DOM-*`, encje i Value Objects, agregaty, reguły `RD-*` i mapowanie do LDM.
- Pojęcia `DOM-{Nazwa}` i reguły `RD-{nnn}` to wiersze. Inne dokumenty wskazują je pełnym ID: `ENT-Disposition realizes DDM-001.DOM-Dyspozycja`. Cały DDM nie jest celem relacji.
- Numer RD nie wraca do obiegu. Usunięty wiersz znika z dokumentu, historię trzyma repozytorium.
- Encja i maszyna stanów wskazują własne pojęcie. Brakujące pojęcie dopisujesz do DDM, zamiast wskazywać najbliższe.

## 4. Warianty

Brak wariantów.
