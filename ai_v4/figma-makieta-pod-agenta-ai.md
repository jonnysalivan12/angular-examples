# Makieta w Figmie pod agenta AI — poradnik dla designera

> Krótki, praktyczny przewodnik: **jak** przygotować makietę i **po co**.

## Co się zmieniło i dlaczego Cię to dotyczy

Twoją makietę czyta teraz nie tylko deweloper, ale i **agent AI, który buduje z niej kod**. To dobra wiadomość: dobrze przygotowana makieta zamienia się w działający, spójny interfejs niemal od razu. Ale jest haczyk — **agent niczego się nie domyśla**. Składa dokładnie to, co mu pokażesz. Im czytelniejsza makieta, tym lepszy kod, mniej błędów i mniej pytań wracających do Ciebie.

> **Złota zasada:** projektujesz nie tylko obrazek — projektujesz **instrukcję dla maszyny**. To, czego nie nazwiesz i nie pokażesz, nie powstanie.

Poniżej kilkanaście nawyków. Każdy ma: **Zrób → Unikaj → Co Ci to daje**.

---

## 1. Nazywaj warstwy jak *rzeczy*, nie jak *kształty*

Agent rozpoznaje strukturę ekranu po nazwach warstw. „Rectangle 3" nie mówi mu nic — „ProductCard" mówi wszystko.

- **Zrób:** `ProductCard`, `ProductImage`, `CTA_Button`, `SectionHeader`.
- **Unikaj:** `Frame 247`, `Rectangle 3`, `Group 5`, `Copy of…`.
- **Co Ci to daje:** trafny podział na komponenty, mniej zgadywania, mniej poprawek. *(Makieta z domyślnymi nazwami wraca dziś do Ciebie z pytaniem „co to za element?".)*

## 2. Powtarzający się element = jeden komponent i jedna, stała nazwa

Kiedy ten sam element pojawia się na wielu ekranach (przycisk, karta, pole), zrób z niego **komponent Figmy** i wszędzie wstawiaj jego **instancje** — zamiast kopiować. Nadaj mu **jedną czytelną nazwę** i trzymaj się jej konsekwentnie; tak samo nazywaj jego **warianty** (np. `variant: primary / secondary`, `size: small / large`). To Ty ustalasz słownik — kod później się do niego dopasuje, nie odwrotnie.

- **Zrób:** jeden komponent → jedna nazwa → spójne nazwy wariantów na **wszystkich** ekranach.
- **Unikaj:** kopiuj-wklej zamiast instancji; tej samej rzeczy nazwanej inaczej na różnych ekranach; „prawie takich samych" wariantów (`Filled` tu, `Solid` tam).
- **Co Ci to daje:** agent rozpozna, że to **ten sam** element wszędzie, i zbuduje go **raz**, a potem użyje ponownie. Niespójne nazwy = z jednego przycisku robią się trzy różne.

## 3. Kolory, odstępy i zaokrąglenia — **tylko ze zmiennych (tokenów)**, nigdy „na oko"

Agent widzi tylko te wartości, które są podpięte jako **Figma Variables / Style**. Kolor wklepany ręcznie z color-pickera jest dla niego **niewidzialny**.

- **Zrób:** podpinaj kolory, spacing i radius do zmiennych z biblioteki.
- **Unikaj:** ręcznego `#3B8BD4`, „doklikanych" 15 px paddingu poza skalą.
- **Co Ci to daje:** spójność, zmiana marki w jednym miejscu, brak ręcznych poprawek później. *(Surowy kolor/odstęp kończy się pytaniem do Ciebie „jaki to token?".)*

## 4. Używaj tokenów **znaczeniowych**, nie surowych

`blue/500` mówi *jaki* jest kolor. `color/action/default` mówi *po co* jest. Agentowi (i deweloperowi) potrzebne jest to drugie.

- **Zrób:** `color/action/default`, `color/text/muted`. Surowe „prymitywy" trzymaj jako warstwę pod spodem, niewidoczną w panelu.
- **Co Ci to daje:** zmiana brandu czy trybu ciemnego nie psuje komponentów — przełączasz znaczenie, nie każdy kolor z osobna.

## 5. Buduj na **Auto Layout**

Auto Layout to nie wygoda — to sposób, w jaki agent rozumie układ (kierunek, odstępy, wyrównanie) i przekłada go 1:1 na elastyczny układ w gotowym interfejsie.

- **Zrób:** każdy kontener w Auto Layout; odstępy podpięte do tokenów; rozmiary świadome (**Fill / Hug / Fixed**).
- **Unikaj:** swobodnie porozrzucanych warstw, „ręcznego" pozycjonowania.
- **Co Ci to daje:** responsywność z pudełka i mniej rozjazdów między makietą a wdrożeniem.

## 6. Responsywność: owijaj komponenty w **ramy-breakpointy**

Agent nie zgaduje, jak element ma się zachować na różnych szerokościach ekranu — pokazujesz mu to **jawnie**. Umieść responsywny komponent w ramie-rodzicu nazwanej breakpointem; szerokość tej ramy = szerokość breakpointu.

- **Zrób:** owiń komponent w ramę `DesktopBreakpoint`, `TabletBreakpoint`, `MobileBreakpoint` (po jednej na każdą szerokość, którą chcesz pokazać). Wewnątrz ustaw element na **Fill**, żeby wypełniał ramę.
- **Unikaj:** jednej makiety desktopowej bez ram-breakpointów w nadziei, że agent „domyśli się" wersji mobilnej.
- **Pamiętaj o szerokości:** sztywna szerokość (**Fixed**, np. `Fixed 1440`) jest traktowana **dosłownie** — jako stałe `1440 px`. Element ma się rozciągać? Daj mu **Fill** wewnątrz ramy-breakpointu; agent nie domyśli się, że „1440" znaczy „pełna szerokość".
- **Co Ci to daje:** realnie responsywny układ zbudowany z jawnych breakpointów zamiast jednego sztywnego ekranu — i żadnego pytania „czy te 1440 px to pełna szerokość, czy stała wartość?".

## 7. Pokaż **wszystkie stany**

Czego nie narysujesz, tego nie będzie w gotowym produkcie. Komplet stanów to: **hover, focus, aktywny, wyłączony, błąd, pusty, ładowanie, szkielet**.

- **Zrób:** stany jako warianty komponentu na osi nazwanej `State` (np. `State: Hover / Disabled`).
- **Unikaj:** rysowania tylko stanu spoczynkowego; oznaczania stanu jako zwykłej właściwości.
- **Co Ci to daje:** kompletny komponent. *(Stan oznaczony jako zwykła właściwość potrafi zrobić np. przycisk „na zawsze wciśnięty".)*

## 8. Wymienne elementy przez **Instance Swap** — i nie odpinaj instancji

Gdy w jednym miejscu może być różna ikona/treść, użyj wymiany instancji wskazującej **prawdziwy** komponent z biblioteki.

- **Zrób:** Instance Swap → komponent z biblioteki; właściwości z poprawnym typem (wariant / przełącznik / wymiana / tekst).
- **Unikaj:** **odpinania (Detach)** — odpięty element traci tożsamość i agent przestaje wiedzieć, że to ten sam przycisk.
- **Co Ci to daje:** spójność z design systemem i poprawnie złożone komponenty zamiast „klonów".

## 9. Dodaj krótki **opis komponentu**

Jedno–dwa zdania w opisie komponentu to gotowy kontekst dla agenta.

- **Zrób:** np. „Gwiazdka oceny. Stany: pełna, pusta, połówka. Domyślnie interaktywna."
- **Co Ci to daje:** mniej nieporozumień co do przeznaczenia elementu.

## 10. Pamiętaj, że **tekst w makiecie to często przykład**

Domyślnie treść bierze się z makiety — ale jeśli to placeholder, a nie finalne copy, zaznacz to. Finalne, zatwierdzone treści (po akceptacji prawnej/redakcji) traktujemy jako wiążące.

- **Co Ci to daje:** agent nie wstawi „Lorem ipsum" jako docelowego tekstu ani nie będzie dopytywał o oczywiste copy.

## 11. Drobne, a robi różnicę

- **Podlinkuj konkretny ekran** — wyślij link „Copy link to selection" do właściwego frame'u, nie do całej strony.
- **Nazywaj strony i sekcje** (nie „Page 1", „Copy of Exploration").
- **Projektuj najpierw cały ekran, potem rozbijaj na komponenty** — relacje, rytm i sąsiedztwa widać dopiero na pełnej kompozycji; z izolowanego komponentu nie da się ich odtworzyć.

---

## Szybka checklista przed handoffem

- [ ] Warstwy i komponenty mają **znaczące nazwy** (zero „Frame 247").
- [ ] Powtarzalne elementy jako **komponenty**; nazwy i warianty **spójne na wszystkich ekranach**.
- [ ] Kolory, odstępy, radius **z tokenów**, nie z color-pickera.
- [ ] Tokeny **znaczeniowe** (akcja/tekst/tło), nie surowe.
- [ ] Wszystko na **Auto Layout**, rozmiary Fill/Hug/Fixed.
- [ ] Responsywne komponenty owinięte w **ramy-breakpointy** (Desktop/Tablet/Mobile); sztywna szerokość = świadoma decyzja.
- [ ] **Wszystkie stany** narysowane (hover/focus/disabled/błąd/pusty/ładowanie).
- [ ] Wymienne elementy przez **Instance Swap**, **bez Detach**.
- [ ] Krótki **opis** przy komponentach.
- [ ] Link do **konkretnego frame'u**, strony i sekcje nazwane.

> **Myśl przewodnia:** agent wiernie składa to, co mu dasz. Bogata, czytelna makieta (dobre nazwy + tokeny + stany) = bogaty, spójny interfejs. Generyczna makieta = generyczny wynik. **Wskazuj precyzyjnie.**
