import { useCallback, useEffect, useRef, useState } from 'react';
import Canvas from './components/Canvas';
import FilePreview from './preview/FilePreview';
import CommandPalette from './components/CommandPalette';
import NodeMenu from './components/NodeMenu';
import Inspector, { vscodeLink } from './components/Inspector';
import LeftPanel from './components/LeftPanel';
import TopBar from './components/TopBar';
import { api, useData } from './state/data';
import { listParam, MODES, navigate, useRoute } from './state/route';

// Ustawienia jednego widza (motyw, szerokość paneli) są w localStorage.
// Wszystko, co opisuje widok, jest w adresie (state/route.js).
const stored = (key, fallback) => {
  try { const value = localStorage.getItem(`workbench.${key}`); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
};
const store = (key, value) => {
  try { localStorage.setItem(`workbench.${key}`, JSON.stringify(value)); } catch { /* brak dostępu do localStorage */ }
};

const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function usePanel(name, initial) {
  const [width, setWidth] = useState(() => stored(`${name}.width`, initial));
  const [open, setOpen] = useState(() => stored(`${name}.open`, true));
  useEffect(() => store(`${name}.width`, width), [name, width]);
  useEffect(() => store(`${name}.open`, open), [name, open]);
  return { width, setWidth, open, setOpen };
}

function Resizer({ side, panel }) {
  const [drag, setDrag] = useState(false);
  const start = useRef(null);
  const onPointerDown = event => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width: panel.width };
    setDrag(true);
  };
  const onPointerMove = event => {
    if (!start.current) return;
    const delta = event.clientX - start.current.x;
    panel.setWidth(Math.min(560, Math.max(180, start.current.width + (side === 'left' ? delta : -delta))));
  };
  const onPointerUp = () => { start.current = null; setDrag(false); };
  return <div className={`resizer ${drag ? 'drag' : ''}`} style={side === 'left' ? { left: panel.width - 3 } : { right: panel.width - 3 }}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} role="separator" aria-orientation="vertical" aria-label="Zmień szerokość panelu" />;
}

export default function App() {
  const { mode, params } = useRoute();
  const { error, meta, reload } = useData();
  const [theme, setTheme] = useState(() => stored('theme', 'dark'));
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState(null);
  const left = usePanel('left', 210);
  const right = usePanel('right', 290);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store('theme', theme);
  }, [theme]);

  const flash = useCallback(message => {
    setToast(message);
    setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    const onToast = event => flash(event.detail);
    window.addEventListener('workbench:toast', onToast);
    return () => window.removeEventListener('workbench:toast', onToast);
  }, [flash]);

  const copy = useCallback(text => {
    navigator.clipboard?.writeText(text).then(() => flash(`Skopiowano ${text}`), () => flash('Nie udało się skopiować'));
  }, [flash]);

  useEffect(() => {
    const onKeyDown = async event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette(open => !open);
        return;
      }
      if (palette || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape' && params.podglad) { navigate({ podglad: undefined }, { replace: true }); return; }
      if (event.key === 'Escape' && params.panel === 'walidacja') { navigate({ panel: undefined, problem: undefined }); return; }
      const modeByKey = MODES.find(m => m.key === event.key);
      if (modeByKey) { navigate({ mode: modeByKey.id, podglad: undefined }); return; }
      const key = event.key.toLowerCase();
      if (params.sel?.startsWith('grupa:')) return;
      // Space przełącza podgląd pliku; na przycisku zostawia jego zwykłe działanie.
      if (event.key === ' ' && params.sel && !['BUTTON', 'A'].includes(event.target.tagName) && !(event.target instanceof Element && event.target.closest('.preview-modal'))) {
        event.preventDefault();
        navigate({ podglad: params.podglad ? undefined : '1' }, { replace: true });
        return;
      }
      if (key === 'z' && params.sel) {
        const starts = listParam(params.start);
        if (!starts.includes(params.sel)) navigate({ start: [...starts, params.sel].join(',') }, { replace: true });
        flash(`${params.sel} w koszyku zasięgu`);
      } else if (key === 'i' && params.sel) {
        navigate({ mode: 'scope', start: params.sel, zapytanie: 'implementation' });
      } else if (key === 'o' && params.sel) {
        try {
          const link = vscodeLink(meta, await api(`/api/doc?id=${encodeURIComponent(params.sel)}`));
          if (link) window.location.href = link;
        } catch { flash('Nie udało się otworzyć pliku'); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [palette, params, meta, flash]);

  // Podgląd pliku otwiera się w oknie modalnym nad płótnem i panelami.
  const preview = Boolean(params.podglad) && Boolean(params.sel) && !params.sel.startsWith('grupa:');
  const leftOpen = left.open;
  // Panel walidacji potrzebuje szerszej kolumny (ekran 2f).
  const validationOpen = params.panel === 'walidacja';
  const rightOpen = right.open || validationOpen;
  const rightWidth = validationOpen ? Math.max(right.width, 420) : right.width;
  const columns = `${leftOpen ? `${left.width}px` : '0px'} minmax(0, 1fr) ${rightOpen ? `${rightWidth}px` : '0px'}`;

  return (
    <div className="app">
      <TopBar
        mode={mode}
        onMode={id => navigate({ mode: id })}
        onSearch={() => setPalette(true)}
        onValidation={() => navigate({ panel: params.panel === 'walidacja' ? undefined : 'walidacja', problem: undefined })}
        validationOpen={params.panel === 'walidacja'}
        theme={theme}
        onTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      />
      <div className="body" style={{ gridTemplateColumns: columns }}>
        <aside className={`lp ${leftOpen ? '' : 'panel-collapsed'}`} aria-label="Filtry i wygląd">
          {leftOpen && <LeftPanel mode={mode} params={params} />}
        </aside>
        <main style={{ display: 'grid', minWidth: 0, minHeight: 0, position: 'relative' }}>
          <Canvas mode={mode} params={params} />
          {error && <div className="banner" role="alert">{error} <button type="button" className="btn btn-ghost" onClick={reload}>Spróbuj ponownie</button></div>}
        </main>
        <aside className={`ins ${rightOpen ? '' : 'panel-collapsed'}`} aria-label="Inspektor">
          {rightOpen && <Inspector mode={mode} params={params} onCopy={copy} />}
        </aside>
        {leftOpen && <Resizer side="left" panel={left} />}
        {rightOpen && !validationOpen && <Resizer side="right" panel={right} />}
        <button type="button" className="panel-toggle" style={{ left: left.open ? left.width : 0, borderLeft: left.open ? 0 : undefined, borderRadius: '0 5px 5px 0' }}
          onClick={() => left.setOpen(o => !o)} aria-label={left.open ? 'Zwiń panel filtrów' : 'Rozwiń panel filtrów'}>{left.open ? '‹' : '›'}</button>
        <button type="button" className="panel-toggle" style={{ right: rightOpen ? rightWidth : 0, borderRadius: '5px 0 0 5px' }}
          onClick={() => right.setOpen(o => !o)} aria-label={right.open ? 'Zwiń inspektor' : 'Rozwiń inspektor'}>{right.open ? '›' : '‹'}</button>
      </div>
      {preview && <FilePreview params={params} onCopy={copy} />}
      <NodeMenu />
      {toast && <div className="banner toast" role="status">{toast}</div>}
      {palette && (
        <CommandPalette
          onClose={() => setPalette(false)}
          onSelect={key => { setPalette(false); navigate({ sel: key, panel: undefined }); }}
          onCatalog={type => { setPalette(false); navigate({ mode: 'map', zakres: 'typ', typ: type }); }}
        />
      )}
    </div>
  );
}
