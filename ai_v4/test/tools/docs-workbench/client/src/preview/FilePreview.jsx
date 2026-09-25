import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../state/route';
import useNode from '../state/useNode';
import { NodeActions } from '../components/NodeDetails';
import { Status, TypeTag, layerText, relPath } from '../components/common';
import { plural } from '../components/TopBar';
import { useData } from '../state/data';
import MarkdownView from './MarkdownView';
import ProblemPanel from './ProblemPanel';
import { splitFrontMatter } from './markdown';
import { keyedFindings } from '../validation/findings';

// Podgląd pliku w oknie modalnym nad płótnem: nagłówek z przyciskami, spis
// sekcji, zwinięty front matter i treść. Zaznaczony wiersz przewija treść
// do miejsca, w którym wiersz jest opisany. Klik w ID w treści zmienia
// zaznaczenie, a okno pokazuje wtedy nowy dokument.
const MIN_WIDTH = 640;
const DEFAULT_WIDTH = 1180;
const WIDTH_KEY = 'workbench.preview.width';
const maxWidth = () => window.innerWidth - 32;
const clampWidth = width => Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, width)));

// Szerokość okna podglądu to ustawienie jednego widza, więc pamięta ją przeglądarka.
function storedWidth() {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY));
    return value > 0 ? value : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

// Uchwyt na brzegu okna. Okno jest wyśrodkowane, więc przesunięcie brzegu
// o N pikseli zmienia szerokość o 2N. Dwuklik przywraca szerokość domyślną.
function ResizeHandle({ side, width, setWidth }) {
  const start = useRef(null);
  const onPointerDown = event => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width };
  };
  const onPointerMove = event => {
    if (!start.current) return;
    const delta = (event.clientX - start.current.x) * (side === 'right' ? 1 : -1);
    setWidth(clampWidth(start.current.width + delta * 2));
  };
  const onPointerUp = () => { start.current = null; };
  const onKeyDown = event => {
    const step = event.shiftKey ? 80 : 20;
    const grow = side === 'right' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = side === 'right' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === grow) { event.preventDefault(); setWidth(clampWidth(width + step)); }
    if (event.key === shrink) { event.preventDefault(); setWidth(clampWidth(width - step)); }
  };
  return (
    <div className={`preview-resize is-${side}`} role="separator" aria-orientation="vertical" aria-label="Zmień szerokość podglądu"
      aria-valuenow={width} aria-valuemin={MIN_WIDTH} tabIndex={0} title="Przeciągnij, żeby zmienić szerokość; dwuklik przywraca domyślną"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onDoubleClick={() => setWidth(clampWidth(DEFAULT_WIDTH))} onKeyDown={onKeyDown} />
  );
}

function Modal({ label, onClose, children }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(() => clampWidth(storedWidth()));
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => previous instanceof HTMLElement && previous.focus();
  }, []);
  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* brak dostępu do localStorage */ }
  }, [width]);
  // Po zmniejszeniu okna przeglądarki podgląd nie może być szerszy niż ekran.
  useEffect(() => {
    const onResize = () => setWidth(current => clampWidth(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <>
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-modal" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} style={{ width }}>
        {children}
        <ResizeHandle side="left" width={width} setWidth={setWidth} />
        <ResizeHandle side="right" width={width} setWidth={setWidth} />
      </div>
    </>
  );
}

export default function FilePreview({ params, onCopy }) {
  const { nodeInfo, graph, validation } = useData();
  const key = params.sel;
  const { node, error } = useNode(key);
  const [headings, setHeadings] = useState([]);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [active, setActive] = useState(null);
  const scrollRef = useRef(null);

  const close = useCallback(() => navigate({ podglad: undefined }, { replace: true }), []);
  const { yaml, body, bodyLine } = useMemo(() => splitFrontMatter(node?.content), [node?.content]);

  // Problem walidacji z adresu (parametr problem), jeśli dotyczy tego dokumentu.
  const fileFindings = useMemo(() => keyedFindings(validation)
    .filter(finding => node && finding.docId === node.docId)
    .sort((a, b) => (a.line || 0) - (b.line || 0)), [validation, node]);
  const finding = fileFindings.find(item => item.key === params.problem) || null;
  // Linia w front matter: YAML jest rozwinięty, a linia podświetlona w nim.
  const problemInYaml = Boolean(finding && yaml !== null && finding.line < bodyLine);
  useEffect(() => { if (problemInYaml) setYamlOpen(true); }, [problemInYaml, finding?.key]);
  const yamlRef = useRef(null);
  useEffect(() => {
    if (!problemInYaml || !yamlOpen) return;
    requestAnimationFrame(() => yamlRef.current?.querySelector('.is-problem')?.scrollIntoView({ block: 'center' }));
  }, [problemInYaml, yamlOpen, finding?.key]);

  // Przewinięcie do wiersza: pierwszy element treści, który zaczyna się jego ID.
  useEffect(() => {
    if (!node || node.node === node.docId || !scrollRef.current || finding) return;
    const short = node.node.slice(node.docId.length + 1);
    requestAnimationFrame(() => {
      const target = [...scrollRef.current.querySelectorAll('h2, h3, h4, td:first-child')].find(el => el.textContent.trim().startsWith(short));
      target?.scrollIntoView({ block: 'center' });
      target?.classList.add('md-flash');
      setTimeout(() => target?.classList.remove('md-flash'), 1600);
    });
  }, [node, headings]);

  const onScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top + 24;
    let current = null;
    for (const heading of headings) {
      const el = container.querySelector(`#${CSS.escape(heading.id)}`);
      if (el && el.getBoundingClientRect().top <= top) current = heading.id;
    }
    setActive(current);
  };

  if (!key || key.startsWith('grupa:')) return null;
  if (error || !node) {
    return (
      <Modal label={`Podgląd ${key}`} onClose={close}>
        <div className="preview-note">{error ? `${key}: ${error}` : `Wczytywanie ${key}…`}</div>
      </Modal>
    );
  }

  const layer = nodeInfo(node.docId)?.layer || node.layer;
  const docTitle = node.node === node.docId ? node.title : `${node.title} · wiersz ${node.node.slice(node.docId.length + 1)}`;

  return (
    <Modal label={`Podgląd ${node.node}`} onClose={close}>
      <div className="preview-head">
        <TypeTag type={nodeInfo(node.docId)?.type || node.type} layer={layer} />
        <span className="m" style={{ fontSize: 13, fontWeight: 500, color: layerText(layer) }}>{node.docId}</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{docTitle}</span>
        <Status status={node.status} />
        {node.owner && <span className="mu" style={{ fontSize: 12 }}>{node.owner}</span>}
        <span className="m mu" style={{ fontSize: 11 }}>{relPath(node, graph)}</span>
        <div style={{ marginLeft: 'auto' }}>
          <NodeActions node={node} onCopy={onCopy} extra={<button type="button" className="btn btn-ghost" onClick={close}>Zamknij <span className="sk">Esc</span></button>} />
        </div>
      </div>
      <div className="preview-body">
        <nav className="preview-toc" aria-label="Sekcje dokumentu">
          <div className="k" style={{ marginBottom: 6 }}>Sekcje</div>
          {headings.length === 0 && <div className="mu" style={{ fontSize: 11.5 }}>Dokument nie ma sekcji.</div>}
          {headings.map(heading => (
            <button key={heading.id} type="button" className={`toc-item ${heading.level === 3 ? 'is-sub' : ''} ${active === heading.id ? 'is-active' : ''}`}
              onClick={() => scrollRef.current?.querySelector(`#${CSS.escape(heading.id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
              {heading.text}
            </button>
          ))}
        </nav>
        <div className="preview-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="preview-content">
            {finding && <ProblemPanel finding={finding} fileFindings={fileFindings} node={node} />}
            {yaml !== null && (
              <div className="fm-box">
                <div className="fm-line">
                  <span className="m">---</span>
                  <span>front matter · {node.outgoing.length} {plural(node.outgoing.length, 'relacja', 'relacje', 'relacji')}</span>
                  <button type="button" className="linkish" style={{ marginLeft: 'auto', color: 'var(--color-accent)' }} onClick={() => setYamlOpen(open => !open)}>
                    {yamlOpen ? 'zwiń YAML' : 'rozwiń YAML'}
                  </button>
                </div>
                {yamlOpen && (
                  <pre className="fm-yaml" ref={yamlRef}>
                    {yaml.split(/\r?\n/).map((text, index) => {
                      // Linia 1 pliku to „---”, więc YAML zaczyna się od linii 2.
                      const number = index + 2;
                      return <div key={number} className={`fm-row ${problemInYaml && finding.line === number ? 'is-problem' : ''}`}><span className="ln">{number}</span>{text || ' '}</div>;
                    })}
                  </pre>
                )}
              </div>
            )}
            <MarkdownView body={body} bodyLine={bodyLine} docId={node.docId} onHeadings={setHeadings} problemLine={finding && !problemInYaml ? finding.line : null} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
