import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../state/data';
import { navigate } from '../state/route';
import { createRenderer } from './markdown';

let mermaidLoader = null;
let mermaidCounter = 0;

// Rysuje bloki mermaid. Biblioteka ładuje się dopiero, gdy plik ma diagram.
async function renderMermaid(container, theme) {
  const blocks = [...container.querySelectorAll('pre.mermaid-src')];
  if (!blocks.length) return;
  mermaidLoader = mermaidLoader || import('mermaid').then(module => module.default);
  const mermaid = await mermaidLoader;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'light' ? 'default' : 'dark', fontFamily: 'Inter, system-ui, sans-serif' });
  for (const block of blocks) {
    if (!block.isConnected) continue;
    const holder = document.createElement('div');
    holder.className = 'mermaid-diagram';
    try {
      const { svg } = await mermaid.render(`mermaid-${++mermaidCounter}`, block.textContent);
      holder.innerHTML = svg;
    } catch (error) {
      holder.className = 'mermaid-error';
      holder.textContent = `Diagramu Mermaid nie da się narysować: ${error.message?.split('\n')[0] || error}`;
    }
    block.replaceWith(holder);
  }
}

// Treść dokumentu z klikalnymi ID. Najechanie na ID pokazuje tytuł i status.
// Blok treści, który obejmuje linię pliku: najmniejszy zakres z linią, a gdy
// linia wypada między blokami (pusta linia), najbliższy następny blok.
export function blockForLine(container, line) {
  const blocks = [...container.querySelectorAll('[data-src-start]')].map(element => ({
    element, start: Number(element.dataset.srcStart), end: Number(element.dataset.srcEnd),
  }));
  const covering = blocks.filter(block => block.start <= line && line <= block.end).sort((a, b) => (a.end - a.start) - (b.end - b.start));
  if (covering.length) return covering[0].element;
  const next = blocks.filter(block => block.start > line).sort((a, b) => a.start - b.start)[0];
  return (next || blocks.filter(block => block.end < line).sort((a, b) => b.end - a.end)[0])?.element || null;
}

export default function MarkdownView({ body, bodyLine = 1, docId, onHeadings, problemLine = null }) {
  const { docIndex, rowIndex, nodeInfo } = useData();
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const theme = document.documentElement.dataset.theme;

  const docPath = docIndex.get(docId)?.path;
  const render = useMemo(() => createRenderer(token => {
    if (docIndex.has(token) || rowIndex.has(token)) return token;
    if (docId && rowIndex.has(`${docId}.${token}`)) return `${docId}.${token}`;
    return null;
  }, { assetBase: docPath ? `/api/file?path=${encodeURIComponent(docPath)}/` : null }), [docIndex, rowIndex, docId, docPath]);

  const { html, headings } = useMemo(() => render(body || '', { bodyLine }), [render, body, bodyLine]);

  useEffect(() => { onHeadings?.(headings); }, [headings, onHeadings]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    for (const link of container.querySelectorAll('a.idlink')) {
      const info = nodeInfo(link.dataset.id);
      link.style.color = `var(--l-${info?.layer || 'other'}-t)`;
    }
    renderMermaid(container, theme);
  }, [html, theme, nodeInfo]);

  // Linia z problemem walidacji: podświetlony blok treści, przewinięty na środek.
  useEffect(() => {
    const container = ref.current;
    if (!container || !problemLine) return undefined;
    const block = blockForLine(container, problemLine);
    if (!block) return undefined;
    block.classList.add('md-problem');
    requestAnimationFrame(() => block.scrollIntoView({ block: 'center' }));
    return () => block.classList.remove('md-problem');
  }, [html, theme, problemLine]);

  const onClick = event => {
    const link = event.target.closest('a.idlink');
    if (!link) return;
    event.preventDefault();
    navigate({ sel: link.dataset.id });
  };

  const onMouseOver = event => {
    const link = event.target.closest('a.idlink');
    if (!link) { setTip(null); return; }
    const key = link.dataset.id;
    const info = nodeInfo(key);
    const doc = docIndex.get(info?.doc || key);
    const box = link.getBoundingClientRect();
    const host = ref.current.getBoundingClientRect();
    setTip({ key, layer: info?.layer, title: info?.doc ? `wiersz dokumentu ${info.doc}` : doc?.title, status: info?.doc ? null : doc?.status, x: box.left - host.left, y: box.bottom - host.top + 4 });
  };

  return (
    <div className="md-host" onMouseLeave={() => setTip(null)}>
      {/* Klucz z motywem odtwarza treść, więc diagramy rysują się w nowym motywie. */}
      <div key={theme} ref={ref} className="md" onClick={onClick} onMouseOver={onMouseOver} dangerouslySetInnerHTML={{ __html: html }} />
      {tip && (
        <div className="id-tip" style={{ left: tip.x, top: tip.y }}>
          <span className="dot" style={{ background: `var(--l-${tip.layer || 'other'})` }} />
          <span className="m" style={{ color: `var(--l-${tip.layer || 'other'}-t)`, fontWeight: 500 }}>{tip.key}</span>
          {tip.title && <span>{tip.title}</span>}
          {tip.status && <span className={`st ${tip.status === 'active' ? 'active' : ''}`}>{tip.status}</span>}
        </div>
      )}
    </div>
  );
}
