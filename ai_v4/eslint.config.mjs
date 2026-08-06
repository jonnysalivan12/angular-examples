import nx from '@nx/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import vitest from '@vitest/eslint-plugin';
import storybook from 'eslint-plugin-storybook';
import jsoncParser from 'jsonc-eslint-parser';

import { DEP_CONSTRAINTS } from './eslint.dep-constraints.mjs';
import eslintRules from './scripts/eslint-rules/index.js';

export default [
  ...nx.configs['flat/base'],
  {
    // Reguły tego repozytorium. Zwykły JavaScript obok walidatorów, które wykonują
    // samo sprawdzenie — bez osobnego projektu, budowania i przestrzeni nazw Nx.
    plugins: { 'eslint-rules': eslintRules },
  },
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    // Przykłady dla testów reguł i walidatorów są DANYMI, nie kodem repozytorium:
    // większość z nich celowo łamie sprawdzaną regułę, bo po to powstała.
    ignores: ['**/dist', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*', '**/__fixtures__/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@angular-eslint/no-output-native': 'off',
      '@angular-eslint/directive-selector': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: DEP_CONSTRAINTS,
        },
      ],
    },
  },
  {
    // Wejście `test` biblioteki niesie atrapy zależności — kod produkcyjny nie ma
    // prawa ich widzieć. Granice bibliotek tego nie złapią: atrapa leży w bibliotece,
    // do której import i tak jest dozwolony, więc rozstrzyga o tym ścieżka importu,
    // a nie tagi projektu. Dowody (testy i sceny) oraz same atrapy są poza zakazem.
    files: ['apps/**/*.ts', 'libs/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.stories.ts', '**/test/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/test', '**/test/*'],
              message: 'Atrapy z wejścia `test` są dla dowodów — kod produkcyjny nie może ich importować.',
            },
          ],
        },
      ],
    },
  },
  {
    // JSDoc opisujący działanie: każda klasa, metoda publiczna/chroniona,
    // eksportowana funkcja (conventions.md §6); prywatne poza bramką
    files: ['apps/**/*.ts', 'libs/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.stories.ts', '**/test-setup.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          // Bez naprawiacza: domyślnie `--fix` wstawia pusty blok `/** */`, a reguła
          // sprawdza samą obecność bloku, nie treść. Taka „naprawa" uciszyłaby
          // zgłoszenie na stałe i miejsce bez opisu zniknęłoby z wyniku lintu.
          enableFixer: false,
          require: {
            ClassDeclaration: true,
            FunctionDeclaration: true,
            MethodDefinition: false,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'MethodDefinition:not([accessibility="private"]) > FunctionExpression',
            'Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
          ],
          checkConstructors: false,
        },
      ],
    },
  },
  {
    // Opis biblioteki jest częścią biblioteki, więc pilnuje go lint projektu, nie
    // osobne polecenie. Sprawdzenie dotyczy całego projektu, dlatego wisi na
    // `project.json` — jedynym pliku, który biblioteka ma zawsze i dokładnie raz.
    //
    // Wzorzec bez przedrostka `libs/`: każda biblioteka ma WŁASNY eslint.config.mjs
    // dociągający ten plik, a w płaskiej konfiguracji `files` liczy się względem
    // katalogu konfiguracji, która go wprowadziła. Ścieżka z `libs/` pasowałaby
    // wtedy wyłącznie z korzenia repozytorium. Aplikacje odsiewa sama reguła —
    // czyta `projectType` i pomija wszystko, co nie jest biblioteką.
    files: ['**/project.json'],
    languageOptions: { parser: jsoncParser },
    rules: {
      'eslint-rules/library-readme': 'error',
      'eslint-rules/library-naming': 'error',
      'eslint-rules/boundary-tags': ['error', { depConstraints: DEP_CONSTRAINTS }],
    },
  },
  {
    // Nazwy bloków testów i scen: bez identyfikatorów zadań, kryteriów i story
    // (testing.md#test-naming). Egzekucja w istniejącym kroku lintu, bez osobnego
    // biegu — test z takim odsyłaczem przechodziłby, a odsyłacz i tak umiera
    // wraz z zadaniem, w którym powstał.
    files: ['**/*.spec.ts', '**/*.stories.ts'],
    rules: {
      'eslint-rules/test-naming': 'error',
    },
  },
  {
    // Obecność dowodu obok jednostki z zachowaniem. Reguła wisi na pliku źródłowym,
    // więc zgłasza się przy nim, a nie w osobnym przeglądzie repozytorium. Same
    // dowody są wyłączone: plik testu nie jest pytany o własny test.
    files: ['apps/**/*.ts', 'libs/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.stories.ts'],
    rules: {
      'eslint-rules/test-presence': 'error',
    },
  },
  {
    // Konfiguracja testów projektu: próg pokrycia ze wspólnych ustawień, a nie
    // opisany na miejscu. Plik zostawiony przez generator jest poprawny i cichy,
    // więc bez tej reguły rozjazd wychodzi dopiero przy biegu na całości.
    files: ['**/vite.config.mts'],
    rules: {
      'eslint-rules/coverage-config': 'error',
    },
  },
  {
    // Testy jednostkowe: dwa sposoby, na które test przechodzi, nie dowodząc niczego.
    // `.only` wycisza resztę pliku bez śladu w wyniku, a test bez asercji jest zielony
    // z definicji — oba wyglądają wtedy jak pokrycie, którego nie ma.
    files: ['**/*.spec.ts'],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*', 'assert*'] }],
      'vitest/no-identical-title': 'error',
    },
  },
  {
    // Rygor testu jednostkowego: atrapa z kontraktem, asercja domknięta argumentami
    // i granica bez wyrenderowanego drzewa. Sceny są poza zakresem — tam widok JEST
    // przedmiotem dowodu.
    //
    // Wyjątek dla `test/`: mieszkają tam narzędzia dowodu, a test narzędzia
    // wycinającego szablon musi sprawdzić właśnie brak wyrenderowanego drzewa.
    files: ['**/*.spec.ts'],
    ignores: ['**/test/**'],
    rules: {
      'eslint-rules/test-mocking': 'error',
      'eslint-rules/unit-test-scope': 'error',
    },
  },
  {
    // Sceny: interakcja bez `await` kończy się PO asercji, więc scena zdaje na stanie
    // sprzed interakcji. Reguły wtyczki są jedynym miejscem, które to widzi —
    // bieg scen zgłosi najwyżej migotanie.
    files: ['**/*.stories.ts'],
    plugins: { storybook },
    rules: {
      'storybook/await-interactions': 'error',
      'storybook/use-storybook-expect': 'error',
      'storybook/no-redundant-story-name': 'error',
    },
  },
  {
    // Kod POZA aplikacją: narzędzia repozytorium (generatory, walidatory, reguły
    // lintu) i warstwa agentów. To zwykłe skrypty Node, nie projekty nx — reguły
    // projektowe ich nie dotyczą. Blok MUSI stać po regułach projektowych, bo je
    // nadpisuje.
    files: [
      'scripts/**/*.js',
      'scripts/**/*.mjs',
      '.ai-agentic-workspace/**/*.js',
      '.ai-agentic-workspace/**/*.mjs',
    ],
    rules: {
      // Granice bibliotek to reguła dla apps/ i libs/ — liczy je z tagów project.json,
      // których skrypt nie ma. Wyłączona tutaj, zamiast zaklejana `eslint-disable`
      // w kolejnych plikach (taki komentarz wyciszyłby ją także tam, gdzie ma sens).
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    // Konfiguracja biegacza scen: leży w katalogu projektu, ale jest rusztowaniem
    // biegu, nie kodem aplikacji. Odsyła do wspólnej bramki dostępności w scripts/,
    // czyli poza projekty nx — reguła granic liczy zależności z tagów project.json,
    // których scripts/ nie ma, więc każdy taki odsyłacz widzi jako wyjście na zewnątrz.
    files: ['**/.storybook/test-runner.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    // Kierunek zależności: narzędzia repozytorium są niezależne od warstwy agentów.
    // Narzędzie potrzebne obu stronom mieszka w scripts/ — agenci czytają stamtąd,
    // nigdy odwrotnie. Dlatego zakaz obowiązuje WYŁĄCZNIE w scripts/.
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/.ai-agentic-workspace/**'],
              message: 'scripts/ nie może zależeć od warstwy agentów — przenieś narzędzie do scripts/.',
            },
          ],
        },
      ],
    },
  },
];
