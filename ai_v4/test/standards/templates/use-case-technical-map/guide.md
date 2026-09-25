# Use Case + Technical Map (UCMAP)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Jeden diagram relacji między UC i TUC: powiązania `<<include>>`,
`<<extend>>`, `<<exclude>>` oraz aktorzy.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** zestawiasz UC i TUC z aktorami oraz relacjami include, extend,
exclude.

**Nie używaj gdy:**

- opisujesz jeden scenariusz → [use-case](../use-case/guide.md), [technical-use-case](../technical-use-case/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- `include` to krok obowiązkowy, `extend` to krok warunkowy, `exclude` to wzajemne wykluczenie wariantów (nie jest to standard UML).
- Mapa zestawia scenariusze (`UCMAP-001 groups UC-001`) i opisuje ich powiązania include, extend, exclude. Nie ma własnych wzorców zapytań; zwraca ją `change_scope` scenariusza i wymagania: dla `UC-001` wynik zawiera `UCMAP-001`.
- Aktorów na mapie podajesz nazwą. Matryca nie ma trójki UCMAP z rolą, więc ID roli w treści mapy jest błędem walidatora.

## 4. Warianty

- **Lekki**: do 5 przypadków; tylko Cel, Diagram, Opis relacji, Powiązanie z artefaktami szczegółowymi.
- **Rozbudowany**: diagram podzielony na obszary, jeden plik mapy.
