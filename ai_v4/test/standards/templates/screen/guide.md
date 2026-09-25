# Ekran (SCR)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Pojedynczy ekran procesu użytkownika: cel, podział na sekcje, kolejność
wyświetlania, nawigacja do sąsiednich kroków. Spina sekcje ekranu i osadza
ekran w mapie nawigacyjnej.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz ekran z odnośnikami do makiet, z podziałem na sekcje.

**Nie używaj gdy:**

- opisujesz pola jednej sekcji → [screen-section](../screen-section/guide.md),
- opisujesz przejścia między ekranami procesu → [navigation-map](../navigation-map/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Tytuł ma postać „Ekran {Nazwa produktu}: Krok {X} z {Y} — {Nazwa kroku}”.
- Ekran zawiera sekcje: `SCR-001 contains SCRSEC-001`, `SCRSEC-002`.
- Ekran bywa wspólny dla kilku scenariuszy. Scenariusz wskazuje ekran sam: `UC-001 contains SCR-001`. Krok procesu nie wskazuje ekranu, bo człowiek obsługuje go przez API wywołane w krokach scenariusza.
- Ekran nie wskazuje innych ekranów, bo matryca nie ma trójki SCR → SCR. Sąsiednie kroki opisujesz numerem i nazwą; przejścia z ID ekranów opisuje mapa nawigacyjna.

## 4. Warianty

Brak wariantów.
