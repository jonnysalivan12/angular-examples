# Mapa nawigacyjna ekranów (NAV)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Przejścia między ekranami jednego procesu: ścieżka podstawowa i ścieżki
błędne. Jeden proces to jedna mapa.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz przejścia i połączenia między ekranami procesu.

**Nie używaj gdy:**

- opisujesz jeden ekran → [screen](../screen/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Każdy ekran z diagramu ma wpis w tabeli odniesień.
- Mapa zestawia ekrany (`groups SCR`) i opisuje przejścia między nimi. Nie ma własnych wzorców zapytań; zwraca ją `change_scope` ekranu, scenariusza i wymagania: dla `SCR-002` wynik to `UC-001` i `NAV-001`.

## 4. Warianty

Brak wariantów.
