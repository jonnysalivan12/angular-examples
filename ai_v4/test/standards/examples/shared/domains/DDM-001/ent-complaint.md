---
doc-id: ENT-Complaint
title: "Reklamacja"
description: "Encja reklamacji rozliczonej dyspozycji z powodem, decyzją, kwotą rekompensaty i statusem."
status: active                                 # draft | active
owner: "Tomasz Lewandowski"
relations:
  - type: contains
    target: RW-001
  - type: realizes
    target: DDM-001.DOM-Reklamacja
---

# Reklamacja

| Pole | Wartość |
|---|---|
| ID | ENT-Complaint |
| Alias biznesowy | Reklamacja |
| Realizuje pojęcie (DDM) | DDM-001.DOM-Reklamacja |

## Opis

Zgłoszenie klienta kwestionujące rozliczenie dyspozycji. Encja przechowuje
powód i opis zgłoszenia, bieżący status rozpatrzenia, decyzję banku oraz kwotę
rekompensaty, gdy reklamacja zostanie uznana. Jest korzeniem osobnego
agregatu i wskazuje reklamowaną dyspozycję.

## Atrybuty

| Nazwa | Alias | Typ logiczny | Wymagalność | Identyfikator | Opis |
|---|---|---|---|---|---|
| complaintId | Identyfikator reklamacji | UUID | tak | Tak | Nadawany przy zgłoszeniu reklamacji |
| dispositionId | Identyfikator dyspozycji | UUID | tak | Nie | Reklamowana dyspozycja |
| reason | Powód | Enum | tak | Nie | Powód wybrany z listy przy zgłoszeniu |
| description | Opis | String | tak | Nie | Opis okoliczności reklamacji, do 2000 znaków |
| attachment | Załącznik | String | nie | Nie | Odnośnik do jednego pliku PDF, JPG albo PNG dołączonego do zgłoszenia |
| status | Status | Enum | tak | Nie | Bieżący status w cyklu życia reklamacji |
| decision | Decyzja | Enum | nie | Nie | Decyzja pracownika; pusta do czasu rozstrzygnięcia |
| compensationAmount | Kwota rekompensaty | Decimal | nie | Nie | Kwota do wypłaty klientowi; wypełniana przy uznaniu reklamacji |
| justification | Uzasadnienie decyzji | String | nie | Nie | Uzasadnienie decyzji pracownika, do 1000 znaków; wypełniane przy zapisie decyzji |
| submittedAt | Data zgłoszenia | DateTime | tak | Nie | Chwila zarejestrowania reklamacji |
| resolvedAt | Data rozstrzygnięcia | DateTime | nie | Nie | Chwila zapisania decyzji |

## Typy wyliczeniowe

reason:

- BLEDNA_KWOTA: rachunek obciążono inną kwotą niż w dyspozycji.
- PODWOJNE_OBCIAZENIE: rachunek obciążono dwukrotnie za tę samą pozycję.
- BRAK_UZNANIA_ODBIORCY: odbiorca nie otrzymał środków.
- INNY: powód spoza listy, opisany w description.

status:

- ZGLOSZONA: reklamacja zapisana, czeka na rejestrację w procesie obsługi reklamacji.
- W_ROZPATRZENIU: zadanie rozpatrzenia czeka na decyzję pracownika zaplecza.
- UZNANA: bank uznał reklamację; trwa korekta rozliczenia dyspozycji i wypłata rekompensaty.
- ODRZUCONA: bank odrzucił reklamację; status końcowy.
- ESKALOWANA: brak decyzji w 14 dni, kierownik dostał e-mail; zadanie nadal czeka na decyzję.
- ZAMKNIETA: reklamacja uznana, a system płatności przyjął przelew rekompensaty; status końcowy.

decision:

- UZNANA: bank uznaje reklamację i wypłaca rekompensatę.
- ODRZUCONA: bank odrzuca reklamację.

## Powiązania

<!-- Bez kluczy fizycznych. -->

| Relacja | Encja docelowa | Liczebność | Opis |
|---|---|---|---|
| wskazuje | Dyspozycja | N:1 | Reklamacja dotyczy jednej rozliczonej dyspozycji; dyspozycja może mieć wiele reklamacji |

## Reguły walidacyjne

| ID | Reguła | RD |
|---|---|---|
| RW-001 | Wartość compensationAmount jest wypełniona wtedy i tylko wtedy, gdy decision = UZNANA | — |

## Uwagi

- Encji używa tylko proces reklamacji, ale leży przy modelu logicznym
  dyspozycji, bo realizuje pojęcie domeny dyspozycji.
- Reklamacja wskazuje całą dyspozycję, nie pojedynczą pozycję.
- Termin 30 dni od rozliczenia dyspozycji nie jest regułą walidacyjną encji:
  łączy reklamację z dyspozycją, więc zostaje regułą domenową i regułą
  biznesową procesu reklamacji.
