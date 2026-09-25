import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Dane z serwera: meta, graf i wynik walidacji. Po zdarzeniu „change” z
// /api/events dane są pobierane ponownie, a widok zostaje bez zmian.

const DataContext = createContext(null);

export async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Błąd serwera (${response.status})`);
  return data;
}

export function DataProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [graph, setGraph] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);
  const knownVersion = useRef(null);

  const load = useCallback(async () => {
    try {
      const [nextMeta, nextGraph] = await Promise.all([api('/api/meta'), api('/api/graph')]);
      knownVersion.current = nextMeta.version;
      setMeta(nextMeta);
      setGraph(nextGraph);
      setError(null);
      setValidation(await api('/api/validation'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const events = new EventSource('/api/events');
    events.addEventListener('change', load);
    events.addEventListener('sync-error', event => setError(JSON.parse(event.data).message));
    // Po ponownym połączeniu (restart serwera, zerwane SSE) serwer wysyła
    // hello z wersją; inna wersja niż znana znaczy, że pliki się zmieniły.
    events.addEventListener('hello', event => {
      const { version } = JSON.parse(event.data);
      if (knownVersion.current !== null && knownVersion.current !== version) load();
    });
    events.onerror = () => setError('Brak połączenia z serwerem. Uruchom serwer i odśwież stronę.');
    events.onopen = () => setError(null);
    return () => events.close();
  }, [load]);

  const value = useMemo(() => {
    const docIndex = new Map((graph?.documents || []).map(doc => [doc.id, doc]));
    const rowIndex = new Map((graph?.rows || []).map(row => [row.id, row]));
    // Warstwa i typ węzła: dokumentu albo wiersza.
    const nodeInfo = key => docIndex.get(key) || rowIndex.get(key) || null;
    return { meta, graph, validation, error, docIndex, rowIndex, nodeInfo, reload: load };
  }, [meta, graph, validation, error, load]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
