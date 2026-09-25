import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, useData } from '../state/data';
import { listParam } from '../state/route';

// Wynik zapytania zasięgu wspólny dla panelu, płótna i inspektora. Ten sam
// zestaw (zapytanie, koszyk, symulacja, wersja danych) jest pobierany raz.
const cache = new Map();

export function scopeRequest(params) {
  return {
    query: params.zapytanie || 'change_scope',
    starts: listParam(params.start),
    simulateRemoval: params.tryb === 'usuniecie',
  };
}

export function useScopeResult(params) {
  const { graph } = useData();
  const request = scopeRequest(params);
  const key = JSON.stringify([request, graph?.version]);
  const [, force] = useState(0);

  useEffect(() => {
    if (!request.starts.length || !graph) return;
    if (cache.has(key)) return;
    const entry = { loading: true, result: null, error: null, listeners: new Set() };
    cache.set(key, entry);
    api('/api/query', request)
      .then(result => { entry.result = result; })
      .catch(error => { entry.error = error.message; })
      .finally(() => { entry.loading = false; force(n => n + 1); window.dispatchEvent(new Event('workbench:scope')); });
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const update = () => force(n => n + 1);
    window.addEventListener('workbench:scope', update);
    return () => window.removeEventListener('workbench:scope', update);
  }, []);

  if (!request.starts.length) return { request, empty: true };
  const entry = cache.get(key);
  if (entry?.result) lastResult.set(JSON.stringify(request), entry.result);
  // Po zmianie plików, zanim przyjdzie nowy wynik, zostaje poprzedni wynik tego
  // samego zapytania, więc płótno nie znika i nie układa się od nowa.
  const stale = !entry?.result ? lastResult.get(JSON.stringify(request)) : null;
  return { request, loading: !entry || entry.loading, result: entry?.result || stale || null, error: entry?.error || null };
}

const lastResult = new Map();

// Plik najechany na liście wyniku; płótno podświetla jego ścieżki.
let hovered = null;
const hoverListeners = new Set();
export function setHoveredFile(file) {
  hovered = file;
  hoverListeners.forEach(listener => listener());
}
export function useHoveredFile() {
  return useSyncExternalStore(listener => { hoverListeners.add(listener); return () => hoverListeners.delete(listener); }, () => hovered);
}
