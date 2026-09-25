---
doc-id: SPEC-WF-009
title: "Korekta księgowania dyspozycji"
description: "Zadanie serwisowe podprocesu korekty, które księguje w księdze głównej korektę rozliczenia dyspozycji na kwotę rekompensaty."
status: draft                                  # draft | active
task-type: service-task                        # service-task | user-task | script-task | call-activity
owner: "Piotr Zieliński"
relations:
  - type: contains
    target: AC-01
  - type: consumes
    target: API-007
  - type: consumes
    target: INT-002
  - type: consumes
    target: SPEC-WF-008
---

# Korekta księgowania dyspozycji

## Kontekst

| Pole | Wartość |
|---|---|
| Aktor / serwis | complaint-service |

## Cel zadania

Zaksięgować w księdze głównej korektę rozliczenia reklamowanej dyspozycji na
kwotę rekompensaty i oddać procesowi nadrzędnemu identyfikator oraz status
księgowania korygującego.

## Warunki wstępne

- Podproces wystartował z SPEC-WF-008 w procesie nadrzędnym „Obsługa reklamacji” ze zmiennymi complaintId i compensation.
- Reklamacja ma stan UZNANA i wskazuje rozliczoną dyspozycję.

## Wywoływane zasoby

| Rodzaj | ID | Jak zadanie go używa |
|---|---|---|
| API | API-007 | Przed wysłaniem korekty pobiera reklamację z reklamowaną dyspozycją i odczytuje z obiektu disposition dispositionId i currency |
| Integracja | INT-002 | Wysyła księgowanie korygujące z postingType = CORRECTION: dispositionId i currency reklamowanej dyspozycji, wewnętrzne rachunki kosztów reklamacji i wypłat rekompensat z konfiguracji serwisu, complaintId i jedną pozycję korekty na kwotę rekompensaty; z odpowiedzi odczytuje postingId i postingStatus pozycji korekty |

## Zmienne procesowe

### Wejście

| Zmienna | Typ | Źródło | Opis |
|---|---|---|---|
| complaintId | UUID | SPEC-WF-008 | Identyfikator uznanej reklamacji; po nim zadanie pobiera przez API-007 reklamację z reklamowaną dyspozycją |
| compensation | Decimal | SPEC-WF-008 | Kwota korekty rozliczenia |

### Wyjście

| Zmienna | Typ | Opis |
|---|---|---|
| postingId | String | Identyfikator księgowania korygującego w księdze głównej |
| postingStatus | String | Status księgowania korygującego zwrócony przez księgę główną |

## Reguły i logika

- Jeśli compensation nie jest większa od zera, to zadanie nie woła INT-002 i kończy się incydentem.
- Jeśli reklamacja pobrana przez API-007 nie wskazuje dyspozycji, to zadanie nie woła INT-002 i kończy się incydentem.
- Jeśli zadanie ponawia wywołanie, to wysyła ten sam klucz idempotencji: dispositionId, postingType = CORRECTION i complaintId; księga główna nie tworzy wtedy drugiej korekty tej samej reklamacji.
- Jeśli księga główna zwróci dla pozycji korekty postingStatus = ZAKSIEGOWANA, to zadanie zapisuje postingId i postingStatus, a podproces kończy się zdarzeniem „Korekta zaksięgowana”.
- Jeśli księga główna zwróci dla pozycji korekty postingStatus = NIEZAKSIEGOWANA, to zadanie nie ponawia wywołania i kończy się incydentem z tym wynikiem, a podproces nie kończy się zdarzeniem „Korekta zaksięgowana”.
- Jeśli księga główna odrzuci księgowanie z błędem biznesowym, to zadanie nie ponawia wywołania i kończy się incydentem z kodem odrzucenia.

## Scenariusze błędów

Pobranie reklamacji przez API-007 kończy się brakiem odpowiedzi albo błędem
5xx: silnik ponawia zadanie 3 razy co minutę, a po ostatniej nieudanej próbie
zgłasza incydent bez wysłania korekty do księgi głównej.

Księga główna niedostępna: zadanie czeka na odpowiedź najwyżej 3 sekundy
i ponawia wywołanie 3 razy z tym samym kluczem idempotencji, zgodnie
z wymaganiem jakościowym integracji. Po ostatniej nieudanej próbie silnik
zgłasza incydent w tym kroku korekty, status dyspozycji się nie zmienia,
a proces nadrzędny czeka na zakończenie podprocesu. Odrzucenie księgowania
albo pozycja korekty ze statusem NIEZAKSIEGOWANA: incydent bez ponowień,
podproces nie kończy się zdarzeniem „Korekta zaksięgowana”, a administrator
procesu wyjaśnia przyczynę z zespołem księgi głównej.

## Obsługa zdarzeń granicznych

Zadanie nie ma zdarzeń granicznych.

## Efekty uboczne

W księdze głównej powstaje księgowanie korygujące na kwotę rekompensaty,
powiązane z reklamowaną dyspozycją i reklamacją. Zadanie nie zmienia stanu
reklamacji ani statusu dyspozycji.

## Kryteria akceptacji

### AC-01

- Given podproces wystartował z complaintId uznanej reklamacji i compensation = 950.00
- When zadanie wysyła przez INT-002 księgowanie korygujące z postingType = CORRECTION, a księga główna je przyjmuje
- Then podproces ma zmienne postingId i postingStatus = ZAKSIEGOWANA z odpowiedzi i kończy się zdarzeniem „Korekta zaksięgowana”

## Powiązane dokumenty

- INT-002: księgowanie w księdze głównej.
- API-007: pobranie reklamacji z reklamowaną dyspozycją przed wysłaniem korekty.
- SPEC-WF-008: wywołanie podprocesu w procesie nadrzędnym „Obsługa reklamacji”, źródło zmiennych wejściowych.
