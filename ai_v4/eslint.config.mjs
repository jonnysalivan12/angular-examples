import nx from '@nx/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import jsoncParser from 'jsonc-eslint-parser';

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
          depConstraints: [
            // ── Oś scope ────────────────────────────────────────────────────
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:frontend-app',
              onlyDependOnLibsWithTags: ['scope:frontend-app', 'scope:shared'],
            },
            // ── Oś context (zamknięty rejestr kontekstów — context.md §1) ──
            // kontekst przekrojowy: nie zna ŻADNEGO kontekstu biznesowego
            {
              sourceTag: 'context:common',
              onlyDependOnLibsWithTags: ['context:common'],
            },
            // kontekst biznesowy: widzi siebie + common
            {
              sourceTag: 'context:auth',
              onlyDependOnLibsWithTags: ['context:auth', 'context:common'],
            },
            {
              sourceTag: 'context:user',
              onlyDependOnLibsWithTags: ['context:user', 'context:common'],
            },
            {
              sourceTag: 'context:workspace',
              onlyDependOnLibsWithTags: ['context:workspace', 'context:common'],
            },
            {
              sourceTag: 'context:ado',
              onlyDependOnLibsWithTags: ['context:ado', 'context:common'],
            },
            {
              sourceTag: 'context:process',
              onlyDependOnLibsWithTags: ['context:process', 'context:common'],
            },
            {
              sourceTag: 'context:entitlement',
              onlyDependOnLibsWithTags: ['context:entitlement', 'context:common'],
            },
            {
              sourceTag: 'context:dictionary',
              onlyDependOnLibsWithTags: ['context:dictionary', 'context:common'],
            },
            // ── Oś type (przekątna dozwolona dla wszystkich typów poza asset) ──
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:state', 'type:core', 'type:model', 'type:util', 'type:asset'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:feature', 'type:state', 'type:model', 'type:core', 'type:ui', 'type:util', 'type:asset'],
            },
            {
              sourceTag: 'type:state',
              onlyDependOnLibsWithTags: ['type:state', 'type:core', 'type:model', 'type:util', 'type:ui'],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:model', 'type:util', 'type:asset'],
            },
            {
              sourceTag: 'type:core',
              onlyDependOnLibsWithTags: ['type:core', 'type:model', 'type:util'],
            },
            {
              sourceTag: 'type:model',
              onlyDependOnLibsWithTags: ['type:model'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:model'],
            },
            {
              sourceTag: 'type:asset',
              onlyDependOnLibsWithTags: [],
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
    rules: { '@nx/workspace-library-readme': 'error' },
  },
  {
    // Kod POZA aplikacją: narzędzia repozytorium (generatory, walidatory) i warstwa
    // agentów. To zwykłe skrypty Node, nie projekty nx — reguły projektowe ich nie
    // dotyczą. Blok MUSI stać po regułach projektowych, bo je nadpisuje.
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
