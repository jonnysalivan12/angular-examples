/* ─────────────────────────────────────────────────────────────────────────── *
 * Testy projektów przestrzeni roboczej — jedyne miejsce z tymi ustawieniami;
 * konfiguracja projektu podaje wyłącznie własny katalog. Progu pokrycia tu nie
 * ma: jednostką oceny jest aplikacja razem ze swoimi bibliotekami, więc próg
 * stosuje scalanie raportów po osi `scope:` (`scripts/coverage/lcov-summary.js`).
 * Obecność dowodu sprawdza osobno `npm run validate:test-presence`.
 * ─────────────────────────────────────────────────────────────────────────── */
/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vite';

import { projectConfigFor } from './scripts/coverage/vitest-project.js';

/** Silnik liczący pokrycie. */
export const COVERAGE_PROVIDER = 'v8';

/**
 * Formaty raportu pokrycia: `text` do odczytu przy biegu lokalnym, `lcov` dla
 * scalania raportów, które czyta wyłącznie ten format.
 */
export const COVERAGE_REPORTERS = ['text', 'lcov'];

/** Katalog raportów pokrycia — względem korzenia repozytorium. */
export const COVERAGE_DIR = 'coverage';

/**
 * Pliki wchodzące do mianownika pomiaru: WSZYSTKIE źródła projektu, także te,
 * których żaden test nie ładuje.
 */
export const COVERAGE_INCLUDE = ['src/**/*.ts'];

/**
 * Pliki poza pomiarem: dowody i pliki bez zachowania. Ta sama granica co przy
 * wymogu obecności dowodu (`scripts/config/test-presence.js`).
 */
export const COVERAGE_EXCLUDE = [
  '**/*.spec.ts',
  '**/*.stories.ts',
  '**/*.model.ts',
  '**/*.d.ts',
  '**/index.ts',
  '**/test-setup.ts',
  '**/*.mock.ts',
  '**/*.builder.ts',
  '**/*.fixture.ts',
  '**/test/**',
];

/** Katalog pamięci podręcznej vite — względem korzenia repozytorium. */
export const CACHE_BASE = 'node_modules/.vite';

/**
 * Wspólne pola sekcji `test`. `passWithNoTests` pozwala uruchomić cel `test`
 * w bibliotece, która nie ma jeszcze żadnego testu; braku testu pilnuje osobno
 * walidator obecności dowodów.
 */
export const TEST_DEFAULTS = {
  watch: false,
  passWithNoTests: true,
  globals: true,
  environment: 'jsdom',
  include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  setupFiles: ['src/test-setup.ts'],
  reporters: ['default'],
};

/**
 * Konfiguracja testów projektu leżącego w podanym katalogu.
 *
 * @param projectDir katalog projektu — w konfiguracji zawsze `__dirname`
 */
export function defineProjectConfig(projectDir: string) {
  return defineConfig(() =>
    projectConfigFor(projectDir, {
      plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
      test: TEST_DEFAULTS,
      cacheBase: CACHE_BASE,
      provider: COVERAGE_PROVIDER,
      reporters: COVERAGE_REPORTERS,
      coverageDir: COVERAGE_DIR,
      coverageInclude: COVERAGE_INCLUDE,
      coverageExclude: COVERAGE_EXCLUDE,
    }),
  );
}
