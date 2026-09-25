# Integracja (INT)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Integracja z systemem zewnętrznym z perspektywy konsumenta: cel, protokół,
operacja, obsługa błędów. Jedna operacja systemu zewnętrznego to jeden plik.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:** opisujesz integrację z systemem zewnętrznym.

**Nie używaj gdy:**

- opisujesz własny punkt końcowy → [api](../api/guide.md),
- opisujesz kontrakt zdarzenia w brokerze → [event](../event/guide.md),
- opisujesz zasadę wspólną dla wielu integracji, np. ponawianie wywołań → [convention](../convention/guide.md); integracja wskaże tę konwencję.

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- W odpowiedzi opisujesz tylko pola istotne dla nas, bez kopiowania pełnej specyfikacji dostawcy.
- Zdolność podajesz w polu „Zdolność” i wskazujesz wpisem `realizes`: `INT-017 realizes CAP-022`.
- Sekcja „Encje” wymienia encje, które w operacji są osobnym bytem: `INT-010 consumes ENT-Client`.
- „Ograniczenia NFR” wskazują wiersze NFR: `INT-001 constrained_by NFR-001.NFRT-AVAIL-01`. Wiersza NFR swojej zdolności nie powtarzasz: `INT-010` podlega `NFR-002.NFRT-SEC-02` przez `CAP-011`.
- „Obsługa błędów” wskazuje konwencję, która opisuje limit czasu i ponawianie wywołań: `INT-001 applies CONV-003`. W wierszach dopisujesz tylko skutek dla procesu, np. odrzucenie dyspozycji, gdy ponowienia zawiodą.
- Integracja, która odstępuje od konwencji, nie wskazuje jej i sama opisuje obsługę: INT-003 nie ponawia wywołań, więc nie wskazuje CONV-003.

## 4. Warianty

Brak wariantów.
