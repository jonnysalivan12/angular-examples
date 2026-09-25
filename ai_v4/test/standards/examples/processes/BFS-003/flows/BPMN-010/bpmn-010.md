---
doc-id: BPMN-010
title: "Otwarcie rachunku"
description: "Proces w silniku Workflow od wysłania wniosku przez weryfikację tożsamości do otwarcia rachunku i publikacji zdarzenia albo do odrzucenia wniosku."
status: draft                                  # draft | active
bpmn-process-id: "otwarcie-rachunku"
process-version: "2.0"                         # znacznik lub skrót zapisu pliku BPMN XML
owner: "Katarzyna Wójcik"
relations:
  - type: contains
    target: SPEC-WF-011
  - type: contains
    target: SPEC-WF-012
  - type: contains
    target: SPEC-WF-013
  - type: contains
    target: SPEC-WF-014
  - type: contains
    target: SPEC-WF-015
  - type: realizes
    target: CAP-010
---

# Otwarcie rachunku

## Cel procesu

Doprowadzić wysłany wniosek o rachunek osobisty albo lokatę terminową do
otwartego rachunku: zweryfikować tożsamość wnioskodawcy automatycznie, a gdy
wynik jest niejednoznaczny, przez pracownika zaplecza; odrzucić wniosek osoby
z listy sankcyjnej albo wniosek odrzucony przez pracownika, zamknąć rachunek
z wniosku i powiadomić klienta; otworzyć rachunek i ogłosić jego otwarcie
innym systemom.

## Kontekst

| Pole | Wartość |
|---|---|
| System | System wniosków o rachunek |
| Silnik BPMN | Camunda 8, identyfikator procesu otwarcie-rachunku |
| Inicjator | Wysłanie wniosku o rachunek przez klienta w bankowości internetowej |
| Zakres | Od zapisania wniosku do publikacji zdarzenia o otwarciu rachunku albo do odrzucenia wniosku; aktywacja rachunku w systemie centralnym leży poza procesem |
| Zdolność | CAP-010 |

## Diagram procesu

| Zasób | Odnośnik |
|---|---|
| BPMN XML | docs/project/system/workflows/bpmn/otwarcie-rachunku.bpmn |
| Widok w silniku | https://operate.bank.example/processes/otwarcie-rachunku |
| Eksport PNG/SVG | docs/project/system/workflows/bpmn/otwarcie-rachunku.svg |

## Zadania procesu

| ID zadania | Nazwa | SPEC-WF |
|---|---|---|
| Task_AutomaticIdentityVerification | Automatyczna weryfikacja tożsamości | SPEC-WF-011 |
| Task_ManualIdentityVerification | Ręczna weryfikacja tożsamości | SPEC-WF-012 |
| Task_OpenAccount | Otwarcie rachunku w systemie | SPEC-WF-013 |
| Task_PublishAccountOpened | Publikacja otwarcia rachunku | SPEC-WF-014 |
| Task_RejectApplication | Odrzucenie wniosku o rachunek | SPEC-WF-015 |

## Bramki i warunki

Bramka wyłączna „Wynik weryfikacji automatycznej” po zadaniu SPEC-WF-011
wybiera ścieżkę według zmiennej verificationResult:

- NO_MATCH: proces przechodzi do otwarcia rachunku (SPEC-WF-013),
- POSSIBLE_MATCH: proces tworzy zadanie ręcznej weryfikacji (SPEC-WF-012),
- MATCH: proces przechodzi do odrzucenia wniosku (SPEC-WF-015), w którym rachunek z wniosku przechodzi do stanu ZAMKNIETY, a klient dostaje powiadomienie; potem proces kończy się zdarzeniem końcowym „Wniosek odrzucony”.

Bramka wyłączna „Decyzja pracownika” po zadaniu SPEC-WF-012 wybiera ścieżkę
według zmiennej manualDecision: ZATWIERDZONA prowadzi do otwarcia rachunku
(SPEC-WF-013), ODRZUCONA do odrzucenia wniosku (SPEC-WF-015) i zdarzenia
końcowego „Wniosek odrzucony”.

## Zdarzenia graniczne

Zadanie SPEC-WF-011 ma graniczne zdarzenie błędu IDENTITY_VERIFICATION_UNAVAILABLE.
Zadanie zgłasza je, gdy weryfikacja automatyczna nie daje wyniku po wyczerpaniu
ponowień. Proces przechodzi wtedy do zadania ręcznej weryfikacji (SPEC-WF-012)
z pustą zmienną verificationResult.

Zadanie SPEC-WF-013 ma graniczne zdarzenie błędu ACCOUNT_OPENING_FAILED, które
tworzy incydent w silniku; proces czeka na ponowienie zadania przez administratora.

## Podprocesy

Proces nie wywołuje podprocesów.

## Powiązane dokumenty

- CAP-010: zdolność zakładania rachunku, którą proces realizuje.
- SPEC-WF-011, SPEC-WF-012, SPEC-WF-013, SPEC-WF-014, SPEC-WF-015: logika zadań procesu.
