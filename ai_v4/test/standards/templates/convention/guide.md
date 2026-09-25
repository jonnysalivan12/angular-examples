# Konwencja (CONV)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Zasady wspólne dla wielu kontraktów: model odpowiedzi błędnej, sposób
autentykacji, zasady ponawiania wywołań, nagłówki komunikatów. Jeden temat to
jeden plik. Kontrakt wskazuje konwencję zamiast powtarzać jej treść.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** ta sama zasada dotyczy wielu kontraktów API, INT albo QUE, a jej
zmiana ma objąć wszystkie te kontrakty.

**Nie używaj gdy:**

- opisujesz próg jakościowy z metryką i metodą pomiaru → [non-functional-requirements](../non-functional-requirements/guide.md),
- opisujesz część przebiegu wspólną dla kilku API → [flow](../flow/guide.md),
- opisujesz algorytm, którego używa kilka przepływów → [activity](../activity/guide.md),
- opisujesz regułę biznesową procesu → [business-functional-spec](../business-functional-spec/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Kontrakt wskazuje konwencję wpisem `applies` w miejscu, w którym bez niej powtórzyłby jej treść: `API-009 applies CONV-001` w sekcji „Struktura odpowiedzi błędnej”, `INT-001 applies CONV-003` w sekcji „Obsługa błędów”. Kontrakt opisuje potem tylko to, co własne, np. kody błędów punktu końcowego.
- Konwencja nie wymienia kontraktów, które ją stosują. „Zakres” opisuje je cechą, np. „punkty końcowe z parametrem stage”, a ich listę zwraca `change_scope` dla konwencji.
- Kontrakt, który odstępuje od konwencji, nie wskazuje jej i sam opisuje swoje zachowanie: INT-003 nie ponawia wywołań, więc nie wskazuje CONV-003.
- Konwencja nie wskazuje innej konwencji. Każda zasada leży w jednej konwencji i nie korzysta z definicji z innej. Zasady, które od siebie zależą, zostają w jednym pliku. Do innej konwencji odsyłasz nazwą, bez ID.
- Sekcja „Zasady” ma nagłówek H3 dla każdej zasady, np. „Model odpowiedzi”, „Kody błędów”.

## 4. Warianty

Brak wariantów.
