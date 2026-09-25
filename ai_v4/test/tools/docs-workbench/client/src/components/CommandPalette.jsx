import { useEffect, useMemo, useRef, useState } from 'react';
import { api, useData } from '../state/data';
import { TypeTag, layerText, relPath } from './common';
import { plural } from './TopBar';

const LIMIT = 20;
const ROW_LIMIT = 8;

// Paleta wyszukiwania. Dokumenty szuka serwer (knowledge-index), wiersze
// szuka klient w grafie po identyfikatorze, a „typ:API” to polecenie katalogu.
export default function CommandPalette({ onClose, onSelect, onCatalog }) {
  const { graph, docIndex } = useData();
  const [text, setText] = useState('');
  const [docs, setDocs] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const trimmed = text.trim();
  const typeQuery = /^typ:/i.test(trimmed) ? trimmed.slice(4).trim().toUpperCase() : null;

  useEffect(() => {
    if (!trimmed || typeQuery !== null) { setDocs([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${LIMIT}`)
        .then(result => { if (!cancelled) setDocs(result); })
        .catch(() => { if (!cancelled) setDocs([]); });
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trimmed, typeQuery]);

  const rows = useMemo(() => {
    if (!trimmed || typeQuery !== null || !graph) return [];
    const needle = trimmed.toLowerCase();
    return graph.rows.filter(row => row.id.toLowerCase().includes(needle)).slice(0, ROW_LIMIT);
  }, [trimmed, typeQuery, graph]);

  const commands = useMemo(() => {
    if (!graph) return [];
    const types = [...new Set(graph.documents.map(doc => doc.type))].sort();
    // Bez prefiksu typ: polecenie pojawia się, gdy tekst jest początkiem nazwy
    // typu (api → Katalog typu: API). Dokładne dopasowanie stoi pierwsze.
    const needle = typeQuery === null ? trimmed.toUpperCase() : typeQuery;
    if (!needle) return [];
    const matching = types.filter(type => type.startsWith(needle)).sort((a, b) => (b === needle) - (a === needle));
    return matching.map(type => ({
      type, count: graph.documents.filter(doc => doc.type === type).length, layer: graph.documents.find(doc => doc.type === type).layer,
    }));
  }, [graph, typeQuery]);

  const items = [
    ...docs.map(doc => ({ kind: 'doc', key: doc.docId, doc })),
    ...rows.map(row => ({ kind: 'row', key: row.id, row })),
    ...commands.map(command => ({ kind: 'command', key: `typ:${command.type}`, command })),
  ];

  useEffect(() => { setActive(0); }, [text]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = item => {
    if (!item) return;
    if (item.kind === 'command') onCatalog(item.command.type);
    else onSelect(item.key);
  };

  const onKeyDown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(items[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };

  let index = -1;
  const itemProps = item => {
    index++;
    const position = index;
    return { role: 'option', 'aria-selected': position === active, onMouseMove: () => setActive(position), onClick: () => choose(item), className: 'pal-item' };
  };

  return (
    <>
      <div className="pal-backdrop" onClick={onClose} />
      <div className="pal" role="dialog" aria-label="Wyszukiwanie">
        <div className="pal-input">
          <span className="mu" aria-hidden="true">⌕</span>
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown} placeholder="Szukaj po ID, tytule albo opisie…" aria-label="Szukaj" role="combobox" aria-expanded="true" aria-controls="pal-list" />
          <span className="mu" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>składnia: <span className="m">typ:API</span></span>
        </div>

        {trimmed && items.length === 0 ? (
          <div className="pal-empty">
            <div style={{ fontSize: 13 }}>Brak wyników dla <span className="m">„{trimmed}”</span></div>
            <div className="mu" style={{ fontSize: 12, lineHeight: 1.5 }}>Szukaj po ID, tytule albo opisie. Katalog typu: <span className="m">typ:API</span>, <span className="m">typ:ENT</span>. Wiersz dokumentu: <span className="m">UC-001.A1</span>.</div>
          </div>
        ) : (
          <div className="pal-list" id="pal-list" role="listbox" ref={listRef}>
            {!trimmed && (
              <div className="pal-empty">
                <div className="mu" style={{ fontSize: 12, lineHeight: 1.5 }}>Wpisz ID (<span className="m">UC-001</span>), słowo z tytułu (<span className="m">dysp</span>) albo <span className="m">typ:API</span>.</div>
              </div>
            )}
            {docs.length > 0 && <div className="k">Dokumenty<b>{docs.length === LIMIT ? `${LIMIT} pierwszych` : docs.length}</b></div>}
            {docs.map(({ docId, type, title, path, fileName }) => {
              const layer = docIndex.get(docId)?.layer;
              return (
                <div key={`d-${docId}`} {...itemProps({ kind: 'doc', key: docId })}>
                  <TypeTag type={type} layer={layer} />
                  <span className="pid" style={{ color: layerText(layer) }}>{docId}</span>
                  <span className="pt">{title}</span>
                  <span className="pp" title={relPath({ path, fileName }, graph)}>{fileName}</span>
                </div>
              );
            })}
            {rows.length > 0 && <div className="k">Wiersze<b>{rows.length}</b></div>}
            {rows.map(row => {
              const doc = docIndex.get(row.doc);
              return (
                <div key={`r-${row.id}`} {...itemProps({ kind: 'row', key: row.id })}>
                  <TypeTag type={row.type} layer={row.layer} />
                  <span className="pid" style={{ color: layerText(row.layer), width: 'auto', flex: 1 }}>{row.id}</span>
                  <span className="pp">{doc?.fileName}</span>
                </div>
              );
            })}
            {commands.length > 0 && <div className="k">Polecenia</div>}
            {commands.map(command => (
              <div key={`c-${command.type}`} {...itemProps({ kind: 'command', command })}>
                <span className="tt" style={{ border: '1px solid var(--t-line)', color: 'var(--t-muted)' }}>›</span>
                <span className="pt">Katalog typu: <span className="m" style={{ color: layerText(command.layer) }}>{command.type}</span></span>
                <span className="mu" style={{ fontSize: 11.5 }}>{command.count} {plural(command.count, 'dokument', 'dokumenty', 'dokumentów')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pal-foot">
          <span><span className="kbd">↑↓</span> wybór</span>
          <span><span className="kbd">Enter</span> zaznacz</span>
          <span style={{ marginLeft: 'auto' }}><span className="kbd">Esc</span> zamknij</span>
        </div>
      </div>
    </>
  );
}
