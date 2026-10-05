# Paczki pluginów Copilota i modułu Figmy

| Paczka | Zawartość | Dla kogo |
|---|---|---|
| `figma-designer-0.1.0.7z` | Plugin Copilota: audyt ramy z Figmy i prompt naprawy dla agenta Figmy. | projektanci |
| `figma-analyst-0.1.0.7z` | Plugin Copilota: opis ekranu według szablonów SCR i SCRSEC, analiza zmian między wersjami ramy i porównanie wersji na obrazach. | analitycy |
| `task-flow-0.1.0.7z` | Plugin Copilota: prowadzi zadanie od gałęzi do raportu, z pętlą tester, implementer i verifier dla każdego zadania planu. | programiści |
| `figma-1.0.1.7z` | Skrypty Figmy: IR ramy, porównanie wersji, audyt makiety, serwer MCP i plugin Figmy do eksportu zmiennych. | programiści i agenci |

## Co trzeba mieć

1. Node.js. Skrypty i serwery MCP nie mają zależności.
2. Copilot CLI. Pluginy Figmy działają też w VS Code z GitHub Copilot po włączeniu ustawienia `chat.plugins.enabled`.
3. Osobisty token Figmy w zmiennej środowiskowej `FIGMA_API_KEY`, z zakresami `file_content:read` i `file_metadata:read`. Plugin task-flow potrzebuje go tylko w trybie `frontend`.
4. Git, jeśli używasz pluginu task-flow.

## Plugin z paczki

1. Rozpakuj paczkę. Powstanie folder pluginu, np. `task-flow/`.
2. Uruchom Copilota z tym folderem bez instalacji:

   ```bash
   copilot --plugin-dir <folder pluginu>
   ```

   Możesz też zainstalować plugin z folderu poleceniem `copilot plugin install <folder pluginu>`. Copilot ostrzeże wtedy, że instalacja z folderu jest przestarzała. Bez ostrzeżenia zainstalujesz plugin z marketplace, opisanego w sekcji „Własny marketplace”.
3. Dalsze kroki opisuje `README.md` w folderze pluginu.

W VS Code dodaj w ustawieniu `chat.pluginLocations` wpis `"<folder pluginu>": true`.

Plugin task-flow wymaga w repozytorium projektu pliku `.github/plugin/task-flow/settings.json`. Opisuje go sekcja „Konfiguracja” w README pluginu.

Jeśli później zainstalujesz plugin z marketplace, najpierw usuń instalację z folderu poleceniem `copilot plugin uninstall <nazwa pluginu>`.

## Własny marketplace

Marketplace to folder albo repozytorium git z plikiem `marketplace.json`, który wymienia pluginy. Copilot instaluje z niego pluginy poleceniem `copilot plugin install <plugin>@<marketplace>`.

### 1. Przygotuj folder marketplace

1. Utwórz folder marketplace, a w nim foldery `.github/plugin/` i `plugins/`.
2. Rozpakuj paczki pluginów do folderu `plugins/` 7-Zipem albo windowsowym `tar`. Podaj pełną ścieżkę do `tar`, bo `tar` z Gita nie czyta archiwów 7z:

   ```powershell
   C:\Windows\System32\tar.exe -xf task-flow-0.1.0.7z -C plugins
   ```

   Tak samo rozpakuj `figma-designer-0.1.0.7z` i `figma-analyst-0.1.0.7z`.
3. Zapisz plik `.github/plugin/marketplace.json`:

   ```json
   {
     "name": "gdprrt-docs",
     "owner": { "name": "Igor Stadnik" },
     "metadata": {
       "description": "Pluginy Copilota: narzędzia Figmy dla projektantów i analityków oraz przepływ realizacji zadania."
     },
     "plugins": [
       {
         "name": "figma-designer",
         "description": "Narzędzia Figmy dla projektantów: audyt ramy z promptem naprawy dla agenta Figmy.",
         "version": "0.1.0",
         "source": "./plugins/figma-designer"
       },
       {
         "name": "figma-analyst",
         "description": "Narzędzia Figmy dla analityków: agent opisu ekranu i jego sekcji według szablonów SCR i SCRSEC, analiza zmian między dwiema wersjami ramy i porównanie wersji na obrazach.",
         "version": "0.1.0",
         "source": "./plugins/figma-analyst"
       },
       {
         "name": "task-flow",
         "description": "Prowadzi gotowe zadanie od gałęzi do raportu: analiza, akceptacja planu, standardy, pętla implementacji z commitem po każdym zadaniu planu.",
         "version": "0.1.0",
         "source": "./plugins/task-flow"
       }
     ]
   }
   ```

Gotowy folder wygląda tak:

```text
<folder marketplace>/
├── .github/plugin/marketplace.json
└── plugins/
    ├── figma-designer/
    ├── figma-analyst/
    └── task-flow/
```

- `name` to nazwa marketplace w poleceniu instalacji. Nazwa `gdprrt-docs` zgadza się z poleceniami w README pluginów. Copilot nie doda drugiego marketplace o nazwie, którą już zna.
- `source` to folder pluginu liczony od folderu marketplace.

### 2a. Marketplace z lokalnego folderu

1. Dodaj marketplace:

   ```bash
   copilot plugin marketplace add <ścieżka folderu marketplace>
   ```

2. Zainstaluj plugin, np. task-flow:

   ```bash
   copilot plugin install task-flow@gdprrt-docs
   ```

- Copilot nie kopiuje pluginu. Wczytuje go z folderu marketplace przy każdej sesji, więc nie przenoś ani nie usuwaj tego folderu.
- Zmiana plików w folderze działa od następnej sesji Copilota, bez aktualizacji.
- `copilot plugin uninstall` tylko wyłącza taki plugin. Pliki zostają w folderze.

### 2b. Marketplace z GitLaba

1. Utwórz w GitLabie puste repozytorium.
2. W folderze marketplace z punktu 1 zatwierdź pliki i wypchnij je do tego repozytorium:

   ```bash
   git init -b main
   git add -A
   git commit -m "Marketplace pluginów Copilota"
   git remote add origin <adres repozytorium>
   git push -u origin main
   ```

3. Każdy użytkownik dodaje marketplace adresem repozytorium, tym samym co do `git clone`:

   ```bash
   copilot plugin marketplace add https://<serwer GitLaba>/<grupa>/<repozytorium>.git
   ```

   Adres SSH ma postać `ssh://git@<serwer GitLaba>/<grupa>/<repozytorium>.git`.
4. Użytkownik instaluje plugin:

   ```bash
   copilot plugin install task-flow@gdprrt-docs
   ```

- Copilot pobiera repozytorium poleceniem `git clone --depth 1`. Użytkownik potrzebuje więc takiego samego dostępu jak do `git clone` tego repozytorium.
- Copilot kopiuje plugin do `~/.copilot/installed-plugins/gdprrt-docs/<plugin>/`.
- Nowa wersja: podnieś `version` w `plugin.json` pluginu i w `marketplace.json`, a potem zatwierdź i wypchnij zmiany. Użytkownicy pobierają ją poleceniem `copilot plugin update --all`.

## Moduł figma z paczki

1. Rozpakuj paczkę. Powstanie folder `figma/`.
2. W tym folderze zapisz IR ramy:

   ```bash
   node extract-design-ir.js "<link do ramy>"
   ```

3. Pozostałe polecenia i serwer MCP opisuje `figma/README.md`.
