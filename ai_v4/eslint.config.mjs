import nx from '@nx/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import jsoncParser from 'jsonc-eslint-parser';

import { DEP_CONSTRAINTS } from './eslint.dep-constraints.mjs';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
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
      '@nx/workspace-library-readme': 'error',
      '@nx/workspace-library-naming': 'error',
      '@nx/workspace-boundary-tags': ['error', { depConstraints: DEP_CONSTRAINTS }],
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
      'tools/**/*.ts',
      '.ai-agentic-workspace/**/*.js',
      '.ai-agentic-workspace/**/*.mjs',
    ],
    rules: {
      // Granice bibliotek to reguła dla apps/ i libs/ — liczy je z tagów project.json,
      // których skrypt nie ma. Wyłączona tutaj, zamiast zaklejana `eslint-disable`
      // w kolejnych plikach (taki komentarz wyciszyłby ją także tam, gdzie ma sens).
      //
      // Dla `tools/` to jedyne wyjście: reguły lintu sięgają po walidatory ścieżką
      // względną, a każdy import poza własny projekt trafia w projekt korzeniowy,
      // który obejmuje całe repozytorium — więc wygląda jak import projektu ścieżką.
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
