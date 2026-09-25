# Actor (ACTOR)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Wspólna baza aktorów, czyli użytkowników i ról systemowych, dla UC i TUC:
role, odpowiedzialności, uprawnienia, zależności.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** zakładasz bazę aktorów systemu. Rolę nowego procesu dopisujesz do istniejącej bazy.

**Nie używaj gdy:**

- opisujesz kroki, które rola wykonuje → [use-case](../use-case/guide.md) albo [technical-use-case](../technical-use-case/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Jeden aktor ma jedną nazwę kanoniczną i jedno ID.
- Rola opisuje odpowiedzialność biznesową, nie stanowisko.
- Aktor systemowy realizuje kroki bez udziału człowieka.
- Dziedziczenie uprawnień pokazujesz jawnie w tabeli i na diagramie relacji.
- Role mają prefiks ROLE: `ACTOR-001 contains ROLE-01`. UC, TUC i SPEC-WF wskazują rolę pełnym ID: `UC-001 involves ACTOR-001.ROLE-01`. Cały ACTOR nie jest celem relacji.
- Numer ROLE nie wraca do obiegu. Usunięty wiersz znika z dokumentu, historię trzyma repozytorium.

## 4. Warianty

Brak wariantów: jedna baza aktorów systemu, wspólna dla wszystkich procesów.
