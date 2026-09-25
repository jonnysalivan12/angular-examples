import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useData } from '../state/data';
import { listParam, navigate, useRoute } from '../state/route';
import { vscodeLink } from '../state/useNode';
import { groupKeyOf, isGroupNode } from '../map/model';
import { layerText } from './common';

// Menu kontekstowe węzła na każdym płótnie: te same działania co przyciski
// inspektora. Płótno woła openNodeMenu(event, klucz) w onNodeContextMenu,
// a App rysuje jedno menu dla całej aplikacji.

let state = null;
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());

export function openNodeMenu(event, key) {
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  state = { key, x: event.clientX, y: event.clientY };
  // Prawy klik zaznacza węzeł, więc inspektor pokazuje to samo co menu.
  navigate({ sel: key, lin: undefined });
  emit();
}

export function closeNodeMenu() {
  if (!state) return;
  state = null;
  emit();
}

const useMenuState = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state);
const toast = message => window.dispatchEvent(new CustomEvent('workbench:toast', { detail: message }));

function documentItems(key, { docIndex, rowIndex, meta, params }) {
  const docId = rowIndex.get(key)?.doc || key;
  const doc = docIndex.get(docId);
  const link = doc ? vscodeLink(meta, doc) : null;
  const starts = listParam(params.start);
  return [
    { id: 'podglad', label: 'Podgląd pliku', hint: 'Space', run: () => navigate({ sel: key, podglad: '1' }, { replace: true }) },
    { id: 'vscode', label: 'Otwórz w VS Code', hint: 'O', disabled: !link, run: () => { window.location.href = link; } },
    { separator: true },
    { id: 'zasieg', label: 'Zasięg', run: () => navigate({ mode: 'scope', start: key, zapytanie: undefined, podglad: undefined }) },
    {
      id: 'koszyk', label: starts.includes(key) ? 'Już w koszyku zasięgu' : 'Dodaj do koszyka zasięgu', hint: 'Z', disabled: starts.includes(key),
      run: () => { navigate({ start: [...starts, key].join(',') }, { replace: true }); toast(`${key} w koszyku zasięgu`); },
    },
    { id: 'implementacja', label: 'Implementacja', hint: 'I', run: () => navigate({ mode: 'scope', start: key, zapytanie: 'implementation', podglad: undefined }) },
    { id: 'sasiedztwo', label: 'Sąsiedztwo na Mapie', run: () => navigate({ mode: 'map', zakres: 'sasiedztwo', wezel: key, sel: key, grupa: undefined, podglad: undefined }) },
    { separator: true },
    {
      id: 'kopiuj', label: 'Kopiuj ID',
      run: () => navigator.clipboard?.writeText(key).then(() => toast(`Skopiowano ${key}`), () => toast('Nie udało się skopiować')),
    },
  ];
}

function groupItems(key, { graph, params }) {
  const groupKey = groupKeyOf(key);
  const grouping = params.grupuj || 'proces';
  const info = grouping === 'proces' ? graph.groups.find(group => group.id === groupKey) : null;
  const expanded = listParam(params.rozwin);
  const isExpanded = expanded.includes(groupKey);
  const items = [];
  // W zakresie procesu grupa zakresu zostaje rozwinięta, a w sąsiedztwie wszystkie są rozwinięte.
  const fixed = params.zakres === 'sasiedztwo' || (params.zakres === 'proces' && params.grupa === groupKey);
  if (grouping !== 'brak' && !fixed) {
    items.push({
      id: 'rozwin', label: isExpanded ? 'Zwiń grupę' : 'Rozwiń grupę',
      run: () => navigate({ rozwin: (isExpanded ? expanded.filter(k => k !== groupKey) : [...expanded, groupKey]).join(',') || undefined }, { replace: true }),
    });
  }
  if (info?.kind === 'process' && params.grupa !== groupKey) {
    items.push({
      id: 'tylko', label: 'Tylko ten proces',
      run: () => navigate({ zakres: 'proces', grupa: groupKey, rozwin: undefined }),
    });
  }
  if (docIndex(graph).has(groupKey)) {
    if (items.length) items.push({ separator: true });
    items.push({ id: 'dokument', label: `Zaznacz dokument ${groupKey}`, run: () => navigate({ sel: groupKey }) });
  }
  items.push({ separator: true });
  items.push({ id: 'kopiuj', label: 'Kopiuj nazwę grupy', run: () => navigator.clipboard?.writeText(groupKey).then(() => toast(`Skopiowano ${groupKey}`), () => toast('Nie udało się skopiować')) });
  return items;
}

const docIndexCache = new WeakMap();
function docIndex(graph) {
  if (!docIndexCache.has(graph)) docIndexCache.set(graph, new Map(graph.documents.map(doc => [doc.id, doc])));
  return docIndexCache.get(graph);
}

export default function NodeMenu() {
  const menu = useMenuState();
  const data = useData();
  const { params } = useRoute();
  const ref = useRef(null);
  const [position, setPosition] = useState(null);
  const [active, setActive] = useState(0);

  const items = !menu || !data.graph ? [] : isGroupNode(menu.key) ? groupItems(menu.key, { ...data, params }) : documentItems(menu.key, { ...data, params });
  const actionable = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.separator && !item.disabled);

  // Menu nie wychodzi poza ekran: przy prawym albo dolnym brzegu otwiera się w drugą stronę.
  useLayoutEffect(() => {
    if (!menu || !ref.current) { setPosition(null); return; }
    const box = ref.current.getBoundingClientRect();
    const x = menu.x + box.width > window.innerWidth - 8 ? Math.max(8, menu.x - box.width) : menu.x;
    const y = menu.y + box.height > window.innerHeight - 8 ? Math.max(8, menu.y - box.height) : menu.y;
    setPosition({ x, y });
    setActive(0);
    ref.current.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;
    const onPointerDown = event => { if (!ref.current?.contains(event.target)) closeNodeMenu(); };
    // Klawisze obsługuje menu, a nie skróty aplikacji ani płótna (faza przechwytywania).
    const onKeyDown = event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closeNodeMenu(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(current => (current + (event.key === 'ArrowDown' ? 1 : actionable.length - 1)) % actionable.length);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const chosen = actionable[active]?.item;
        if (chosen) { closeNodeMenu(); chosen.run(); }
        return;
      }
      // Skrót z podpowiedzi uruchamia działanie tak jak na płótnie.
      const byHint = actionable.find(({ item }) => item.hint && item.hint.toLowerCase() === (event.key === ' ' ? 'space' : event.key.toLowerCase()));
      if (byHint) { event.preventDefault(); closeNodeMenu(); byHint.item.run(); }
    };
    const onClose = () => closeNodeMenu();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('wheel', onClose, { capture: true, passive: true });
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('wheel', onClose, { capture: true });
      window.removeEventListener('blur', onClose);
    };
  }, [menu, actionable, active]);

  if (!menu) return null;
  const layer = data.nodeInfo(menu.key)?.layer;
  const activeIndex = actionable[active]?.index;

  return (
    <div ref={ref} className="node-menu" role="menu" aria-label={`Działania dla ${menu.key}`} tabIndex={-1}
      style={{ left: position?.x ?? menu.x, top: position?.y ?? menu.y, visibility: position ? 'visible' : 'hidden' }}
      onContextMenu={event => event.preventDefault()}>
      <div className="node-menu-head m" style={{ color: isGroupNode(menu.key) ? 'var(--t-muted)' : layerText(layer) }}>
        {isGroupNode(menu.key)
          ? `grupa ${params.grupuj === 'warstwa' ? data.graph.layers.find(layer => layer.id === groupKeyOf(menu.key))?.name || groupKeyOf(menu.key) : groupKeyOf(menu.key)}`
          : menu.key}
      </div>
      {items.map((item, index) => (item.separator
        ? <div key={`sep-${index}`} className="node-menu-sep" role="separator" />
        : (
          <button key={item.id} type="button" role="menuitem" className={`node-menu-item ${index === activeIndex ? 'is-active' : ''}`} disabled={item.disabled}
            onMouseEnter={() => { const position = actionable.findIndex(entry => entry.index === index); if (position >= 0) setActive(position); }}
            onClick={() => { closeNodeMenu(); item.run(); }}>
            <span>{item.label}</span>
            {item.hint && <span className="kbd">{item.hint}</span>}
          </button>
        )))}
    </div>
  );
}
