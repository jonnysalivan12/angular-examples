import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../state/data';
import { TypeTag, layerText } from './common';

const LIMIT = 12;

// Wyszukiwanie węzła po ID albo tytule w grafie (bez serwera): najpierw ID
// zaczynające się od tekstu, potem słowo tytułu, potem dowolne dopasowanie.
function searchNodes(graph, text) {
  const needle = text.trim().toLowerCase();
  if (!needle) return [];
  const rank = (id, title) => {
    const lowerId = id.toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    if (lowerId === needle) return 0;
    if (lowerId.startsWith(needle)) return 1;
    if (lowerTitle.split(/[^\p{L}\p{N}]+/u).some(word => word.startsWith(needle))) return 2;
    if (lowerId.includes(needle) || lowerTitle.includes(needle)) return 3;
    return null;
  };
  const found = [];
  for (const doc of graph.documents) {
    const score = rank(doc.id, doc.title);
    if (score !== null) found.push({ id: doc.id, type: doc.type, layer: doc.layer, title: doc.title, score });
  }
  for (const row of graph.rows) {
    const score = rank(row.id, '');
    if (score !== null) found.push({ id: row.id, type: row.type, layer: row.layer, title: `wiersz dokumentu ${row.doc}`, score: score + 0.5 });
  }
  return found.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id, 'pl', { numeric: true })).slice(0, LIMIT);
}

// Pole z listą wyników: strzałki wybierają, Enter albo klik zatwierdza.
// exclude: węzły, których nie pokazywać (na przykład już w koszyku).
export default function NodePicker({ onPick, placeholder = 'ID albo tytuł węzła…', autoFocus = false, compact = false, exclude = [] }) {
  const { graph } = useData();
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const excludeKey = exclude.join(',');
  const results = useMemo(() => {
    const skip = new Set(excludeKey.split(',').filter(Boolean));
    return graph ? searchNodes(graph, text).filter(item => !skip.has(item.id)) : [];
  }, [graph, text, excludeKey]);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  useEffect(() => { setActive(0); }, [text]);

  const pick = item => {
    if (!item) return;
    onPick(item.id);
    setText('');
  };
  const onKeyDown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); pick(results[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setText(''); }
  };

  return (
    <div className={`node-picker ${compact ? 'is-compact' : ''}`}>
      <input ref={inputRef} className="sel" type="search" value={text} placeholder={placeholder} aria-label={placeholder}
        onChange={event => setText(event.target.value)} onKeyDown={onKeyDown} role="combobox" aria-expanded={results.length > 0} />
      {text.trim() && (
        <div className="node-picker-list" role="listbox">
          {results.length === 0 && <div className="mu" style={{ padding: '6px 10px', fontSize: 12 }}>Brak węzłów dla „{text.trim()}”.</div>}
          {results.map((item, index) => (
            <div key={item.id} role="option" aria-selected={index === active} className="node-picker-item"
              onMouseMove={() => setActive(index)} onMouseDown={event => { event.preventDefault(); pick(item); }}>
              <TypeTag type={item.type} layer={item.layer} />
              <span className="m" style={{ color: layerText(item.layer), fontSize: 11.5, whiteSpace: 'nowrap' }}>{item.id}</span>
              <span className="mu" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
