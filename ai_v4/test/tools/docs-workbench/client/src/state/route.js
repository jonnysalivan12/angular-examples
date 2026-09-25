import { useSyncExternalStore } from 'react';

// Stan widoku zapisany w adresie: #/tryb?parametry.
// Każda zmiana zaznaczenia i trybu to nowy wpis w historii przeglądarki, więc
// przycisk Wstecz przywraca poprzedni widok. Zmiany filtrów podmieniają wpis.

export const MODES = [
  { id: 'map', slug: 'mapa', name: 'Mapa', key: '1' },
  { id: 'scope', slug: 'zasieg', name: 'Zasięg', key: '2' },
  { id: 'flow', slug: 'przeplyw', name: 'Przepływ', key: '3' },
];

const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());
window.addEventListener('hashchange', notify);

let cachedHash = null;
let cachedRoute = null;

function parse(hash) {
  const [slug = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const mode = (MODES.find(m => m.slug === slug) || MODES[0]).id;
  return { mode, params: Object.fromEntries(new URLSearchParams(query)) };
}

function current() {
  if (window.location.hash !== cachedHash) {
    cachedHash = window.location.hash;
    cachedRoute = parse(cachedHash);
  }
  return cachedRoute;
}

function build(mode, params) {
  const slug = (MODES.find(m => m.id === mode) || MODES[0]).slug;
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  const text = query.toString();
  return `#/${slug}${text ? `?${text}` : ''}`;
}

// Zmienia widok. patch może zawierać mode i parametry; parametr z wartością
// undefined albo pustą jest usuwany. Opcja replace nie dodaje wpisu historii.
export function navigate(patch, { replace = false } = {}) {
  const { mode, params } = current();
  const { mode: nextMode = mode, ...rest } = patch;
  const hash = build(nextMode, { ...params, ...rest });
  if (hash === window.location.hash) return;
  if (replace) {
    window.history.replaceState(null, '', hash);
    notify();
  } else {
    window.location.hash = hash;
  }
}

export function useRoute() {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, current);
}

// Lista zapisana w parametrze jako wartości oddzielone przecinkami.
export const listParam = value => (value ? value.split(',').filter(Boolean) : []);
