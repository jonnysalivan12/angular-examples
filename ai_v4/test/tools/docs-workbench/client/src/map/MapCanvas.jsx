import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkerType, MiniMap, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useData } from '../state/data';
import { listParam, navigate } from '../state/route';
import { buildMapModel, groupKeyOf, groupNodeId, isGroupNode } from './model';
import { edgeTypes, keepMeasured, nodeTypes } from './nodes';
import { plural } from '../components/TopBar';
import { clearFocus, peekFocus } from '../state/focus';
import { openNodeMenu } from '../components/NodeMenu';
import NodePicker from '../components/NodePicker';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Położenie przeciągniętych węzłów zostaje do „Ułóż ponownie”.
const dragged = new Map();
export const RELAYOUT_EVENT = 'workbench:relayout';

// Ustawienia Mapy z parametrów adresu.
export function mapOptions(params) {
  return {
    grouping: params.grupuj || 'proces',
    expanded: new Set(listParam(params.rozwin)),
    hiddenLayers: new Set(listParam(params.bez_warstw)),
    hiddenRelations: new Set(listParam(params.bez_relacji)),
    scope: params.zakres || 'calosc',
    scopeGroup: params.grupa || null,
    // Środek sąsiedztwa jest osobnym parametrem, więc klik w tło (zdjęcie
    // zaznaczenia) nie opróżnia widoku. Stare linki bez parametru wezel biorą środek z zaznaczenia.
    selection: params.zakres === 'sasiedztwo' ? params.wezel || params.sel || null : params.sel || null,
    depth: Number(params.kroki) || 1,
    rowsExpanded: new Set(listParam(params.wiersze)),
  };
}

// Linie Mapy: trzy niezależne pola zapisane w parametrze `linie` jako lista.
// grupy: linie między grupami i wiązki do grup; relacje: każda relacja
// dokumentów; najechanie: węzeł pod kursorem albo zaznaczony pokazuje swoje
// relacje, a reszta przygasa. Domyślnie grupy i najechanie, w sąsiedztwie
// wszystkie trzy. Stare wartości: `wszystkie` i `fokus`.
export const LINE_MODES = ['grupy', 'relacje', 'najechanie'];
const defaultLines = scope => (scope === 'sasiedztwo' ? LINE_MODES : ['grupy', 'najechanie']);
export function lineModes(params) {
  const scope = params.zakres || 'calosc';
  const value = params.linie === 'wszystkie' ? LINE_MODES
    : params.linie === 'fokus' ? ['grupy', 'najechanie']
      : params.linie === 'brak' ? []
        : params.linie ? listParam(params.linie) : defaultLines(scope);
  return { groups: value.includes('grupy'), relations: value.includes('relacje'), hover: value.includes('najechanie') };
}
export function lineParam(modes, scope) {
  const list = LINE_MODES.filter(mode => modes[{ grupy: 'groups', relacje: 'relations', najechanie: 'hover' }[mode]]);
  if (list.join(',') === defaultLines(scope).join(',')) return undefined;
  return list.length ? list.join(',') : 'brak';
}

export function ZoomBar({ zoom, autoFit, onAutoFit }) {
  const flow = useReactFlow();
  return (
    <div className="zoom">
      <button type="button" onClick={() => flow.zoomOut({ duration: 150 })} aria-label="Oddal">−</button>
      <button type="button" className="m" onClick={() => flow.zoomTo(1, { duration: 150 })} title="Zoom 100% (0)">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={() => flow.zoomIn({ duration: 150 })} aria-label="Przybliż">+</button>
      <button type="button" onClick={() => flow.fitView({ padding: 0.12, duration: 250 })}>Dopasuj <span className="sk">F</span></button>
      {onAutoFit && (
        <button type="button" className={`auto ${autoFit ? 'is-on' : ''}`} aria-pressed={autoFit} onClick={() => onAutoFit(!autoFit)}
          title={autoFit ? 'Widok dopasowuje się po zmianie zakresu, warstw, relacji, grupowania i układu. Kliknij, żeby wyłączyć.' : 'Włącz dopasowanie widoku po każdej zmianie filtrów i układu.'}>
          Auto
        </button>
      )}
    </div>
  );
}

const AUTO_FIT_KEY = 'workbench.map.autofit';
const readAutoFit = () => { try { return localStorage.getItem(AUTO_FIT_KEY) !== '0'; } catch { return true; } };

function MapFlow({ params }) {
  const { graph, validation, docIndex, rowIndex } = useData();
  const flow = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  const options = useMemo(() => mapOptions(params), [params]);
  const model = useMemo(() => buildMapModel(graph, options), [graph, options]);
  const [layout, setLayout] = useState(null);
  const [relayoutTick, setRelayoutTick] = useState(0);
  const fittedFor = useRef(null);
  const labels = params.etykiety || 'id-tytul';
  const colorBy = params.koloruj || 'warstwa';
  const selection = params.sel || null;

  // Problemy walidacji według dokumentu i według grupy. Znaczniki błędów
  // i ostrzeżeń można wyłączyć w panelu (parametr bez_znacznikow).
  const hiddenMarks = params.bez_znacznikow || '';
  const issues = useMemo(() => {
    const byDoc = new Map();
    const hidden = new Set(hiddenMarks.split(',').filter(Boolean));
    for (const finding of validation?.findings || []) {
      if (!finding.docId) continue;
      if (hidden.has(finding.severity === 'error' ? 'bledy' : 'ostrzezenia')) continue;
      const entry = byDoc.get(finding.docId) || { errors: 0, warnings: 0 };
      if (finding.severity === 'error') entry.errors++; else entry.warnings++;
      byDoc.set(finding.docId, entry);
    }
    return byDoc;
  }, [validation, hiddenMarks]);

  // „Pokaż” w panelu walidacji: wyśrodkuj węzeł, gdy tylko pojawi się na płótnie
  // (grupa mogła dopiero zostać rozwinięta i ułożona).

  // Układ: warstwowy (domyślny) liczy też położenie dokumentów w ramkach i trasy
  // linii, więc zależy od rozmiarów kart i od zestawu linii. Siłowy i kołowy
  // układają tylko węzły najwyższego poziomu. Dopasowanie widoku (fitKey)
  // zależy od zestawu węzłów najwyższego poziomu i układu, a z włączonym „Auto”
  // także od zakresu, grupowania, warstw, relacji i gęstości. Rozwinięcie
  // wierszy, zaznaczenie ani odświeżenie danych nie przesuwa widoku.
  const algorithm = params.uklad || 'warstwowy';
  // Środek układu kołowego to zaznaczenie z chwili wyboru układu albo kliknięcia
  // „Ułóż”. Samo zaznaczenie (klik, prawy klik z menu) nie przestawia węzłów.
  const selectedTop = isGroupNode(params.sel) ? params.sel : model.nodeOfDoc.get(rowIndex.get(params.sel)?.doc || params.sel) || null;
  const [radialCenter, setRadialCenter] = useState(selectedTop);
  useEffect(() => {
    if (algorithm === 'kolowy') setRadialCenter(selectedTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithm, relayoutTick]);
  const layoutCenter = algorithm === 'kolowy' && radialCenter && model.nodes.some(node => node.id === radialCenter && !node.parentId) ? radialCenter : null;
  const [autoFit, setAutoFitState] = useState(readAutoFit);
  const setAutoFit = useCallback(value => {
    setAutoFitState(value);
    try { localStorage.setItem(AUTO_FIT_KEY, value ? '1' : '0'); } catch { /* bez pamięci przeglądarki */ }
    if (value) flow.fitView({ padding: 0.12, duration: 250, maxZoom: 1.2 });
  }, [flow]);
  const fitKey = useMemo(() => JSON.stringify([
    model.nodes.filter(node => !node.parentId).map(node => [node.id, node.kind]), algorithm, relayoutTick,
    autoFit && [options.scope, options.scopeGroup, options.grouping, options.scope === 'sasiedztwo' && options.selection, options.depth,
      [...options.hiddenLayers], [...options.hiddenRelations], params.gestosc || '0.5', layoutCenter],
  ]), [model, algorithm, relayoutTick, autoFit, options, params.gestosc, layoutCenter]);
  const layoutKey = useMemo(() => JSON.stringify([
    algorithm === 'warstwowy'
      ? [model.nodes.map(node => [node.id, node.kind, node.width, node.height]), model.edges.map(edge => edge.id)]
      : model.nodes.filter(node => !node.parentId).map(node => [node.id, node.kind]),
    algorithm, params.gestosc || '0.5', layoutCenter, relayoutTick,
  ]), [model, algorithm, params.gestosc, layoutCenter, relayoutTick]);

  // Przeciągnięte pozycje dotyczą jednego zakresu, grupowania i układu.
  useEffect(() => { dragged.clear(); }, [params.zakres, params.grupa, params.grupuj, algorithm]);

  useEffect(() => {
    let cancelled = false;
    // elkjs ma ponad 1 MB, więc ładuje się osobno, przy pierwszym układaniu.
    // Gdy układ warstwowy się nie uda, zostaje układ siłowy bez tras.
    const density = Number(params.gestosc ?? 0.5);
    import('./layout')
      .then(({ layoutMap }) => layoutMap(model, { algorithm, density, center: layoutCenter })
        .catch(error => {
          console.error('Układ warstwowy się nie udał, używam siłowego.', error);
          return layoutMap(model, { algorithm: 'silowy', density });
        }))
      .then(result => { if (!cancelled) setLayout({ ...result, key: layoutKey }); })
      .catch(() => { if (!cancelled) setLayout({ positions: new Map(), frames: new Map(), routes: new Map(), fans: new Map(), key: layoutKey }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  useEffect(() => {
    const onRelayout = () => { dragged.clear(); setRelayoutTick(t => t + 1); fittedFor.current = null; };
    window.addEventListener(RELAYOUT_EVENT, onRelayout);
    return () => window.removeEventListener(RELAYOUT_EVENT, onRelayout);
  }, []);

  // Zaznaczony dokument w zwiniętej grupie podświetla tę grupę.
  // Zaznaczony wiersz podświetla swój dokument.
  const selectedDoc = selection && !isGroupNode(selection)
    ? (docIndex.has(selection) ? selection : rowIndex.get(selection)?.doc)
    : null;
  const selectedNodeId = isGroupNode(selection) ? selection : selectedDoc ? model.nodeOfDoc.get(selectedDoc) || null : null;

  // Fokus (pole „Po najechaniu”): węzeł pod kursorem, a bez niego zaznaczony
  // węzeł. Jego linie są widoczne i wyróżnione, sąsiedzi też, reszta przygasza się.
  const [hovered, setHovered] = useState(null);
  const lines = useMemo(() => lineModes(params), [params]);
  const focusId = lines.hover ? hovered || selectedNodeId : null;
  const nodeById = useMemo(() => new Map(model.nodes.map(node => [node.id, node])), [model]);
  const edgeById = useMemo(() => new Map(model.edges.map(edge => [edge.id, edge])), [model]);
  const focus = useMemo(() => {
    if (!focusId || !nodeById.has(focusId)) return null;
    const edges = new Set();
    const bundles = new Set();
    const neighbours = new Set();
    const groupFocus = isGroupNode(focusId);
    for (const edge of model.edges) {
      // Dokument w fokusie: jego linie. Grupa albo ramka w fokusie: linie
      // najwyższego poziomu, które jej dotyczą (linie dokumentów pokazują wiązki).
      const related = groupFocus
        ? edge.scope === 'top' && (edge.source === focusId || edge.target === focusId)
        : edge.source === focusId || edge.target === focusId;
      if (!related) continue;
      edges.add(edge.id);
      neighbours.add(edge.source === focusId ? edge.target : edge.source);
      if (edge.bundle) bundles.add(edge.bundle);
    }
    for (const bundle of model.bundles) {
      if (bundle.a !== focusId && bundle.b !== focusId) continue;
      bundles.add(bundle.id);
      neighbours.add(bundle.a === focusId ? bundle.b : bundle.a);
    }
    return { id: focusId, edges, bundles, neighbours };
  }, [focusId, model, nodeById]);

  // Położenie węzła na płótnie w chwili układania: trasa linii jest ważna, dopóki
  // żaden z jej końców się nie przesunął.
  const absolute = useCallback(id => {
    const node = nodeById.get(id);
    if (!layout || !node) return null;
    if (!node.parentId) return layout.positions.get(id) || null;
    const frame = layout.positions.get(node.parentId);
    const child = layout.frames.get(node.parentId)?.children.get(id);
    return frame && child ? { x: frame.x + child.x, y: frame.y + child.y } : null;
  }, [layout, nodeById]);

  const computedNodes = useMemo(() => {
    if (!layout) return [];
    return model.nodes.map(node => {
      const top = !node.parentId;
      const frameLayout = layout.frames.get(node.kind === 'frame' ? node.id : node.parentId);
      const position = top
        ? dragged.get(node.id) || layout.positions.get(node.id) || { x: 0, y: 0 }
        : frameLayout?.children.get(node.id) || { x: node.x, y: node.y };
      const width = node.kind === 'frame' && frameLayout ? frameLayout.width : node.width;
      const height = node.kind === 'frame' && frameLayout ? frameLayout.height : node.height;
      const data = { ...node.data, labels, colorBy, byLayer: model.grouping === 'warstwa' };
      if (node.kind === 'doc') data.issues = issues.get(node.data.doc.id);
      if (node.kind === 'group') {
        const sum = { errors: 0, warnings: 0 };
        for (const id of node.data.docIds) { const i = issues.get(id); if (i) { sum.errors += i.errors; sum.warnings += i.warnings; } }
        data.issues = sum.errors || sum.warnings ? sum : null;
        data.folder = model.grouping === 'folder';
      }
      if (node.kind === 'frame') {
        if (model.grouping === 'proces') data.groupLayer = docIndex.get(node.data.key)?.layer;
        if (frameLayout) data.columnHeads = frameLayout.columnHeads;
      }
      // Dokumenty ramki w fokusie nie są przygaszone: fokus ramki to ona cała.
      if (focus && node.kind !== 'frame' && node.parentId !== focus.id) data.focus = node.id === focus.id ? 'focus' : focus.neighbours.has(node.id) ? 'neighbour' : 'dim';
      return {
        id: node.id, type: node.kind, position, data, parentId: node.parentId,
        // Rozmiar karty jest znany z modelu, więc węzeł jest zmierzony od razu,
        // także poza ekranem (onlyRenderVisibleElements nie renderuje go i nie mierzy).
        style: { width, height }, width, height, measured: { width, height },
        draggable: top, selectable: true, selected: node.id === selectedNodeId,
        zIndex: node.kind === 'frame' ? -1 : 0,
      };
    });
  }, [model, layout, labels, colorBy, issues, selectedNodeId, docIndex, focus]);

  // React Flow zmienia węzły przy przeciąganiu i zaznaczaniu ramką, więc
  // trzyma własną kopię, którą nadpisuje każda zmiana modelu.
  const [nodes, setNodes] = useState([]);
  useEffect(() => { setNodes(current => keepMeasured(current, computedNodes)); }, [computedNodes]);
  const onNodesChange = useCallback(changes => setNodes(current => applyNodeChanges(changes, current)), []);

  const edges = useMemo(() => {
    if (!layout) return [];
    const bundleById = new Map(model.bundles.map(bundle => [bundle.id, bundle]));
    // Strzałka ma stały rozmiar w pikselach płótna: domyślnie React Flow skaluje
    // ją grubością linii, więc na grubej linii grupy rosła kilkukrotnie.
    const arrow = highlighted => ({ type: MarkerType.ArrowClosed, width: 24, height: 24, markerUnits: 'userSpaceOnUse', color: highlighted ? 'var(--color-accent)' : 'var(--t-edge)' });
    // Grubość rośnie z liczbą relacji tylko lekko (1,2–2,4 px); liczbę podaje etykieta.
    const lineWidth = count => Math.min(2.4, 1.2 + Math.log2(count) * 0.3);
    const expected = (source, target) => ({ source: absolute(source), target: absolute(target) });
    const concat = parts => parts.reduce((all, part) => [...all, ...(all.length ? part.slice(1) : part)], []);
    // Trasa linii dokumentu do węzła poza ramką: wachlarz do portu, wiązka, wachlarz od portu.
    const crossRoute = edge => {
      const bundle = bundleById.get(edge.bundle);
      const main = layout.routes.get(bundle.id);
      if (!main) return null;
      const parts = [];
      if (edge.source !== edge.topSource) {
        const fan = layout.fans.get(`${bundle.id}|${edge.source}`);
        if (!fan) return null;
        parts.push(fan);
      }
      parts.push(bundle.source === edge.topSource ? main : [...main].reverse());
      if (edge.target !== edge.topTarget) {
        const fan = layout.fans.get(`${bundle.id}|${edge.target}`);
        if (!fan) return null;
        parts.push([...fan].reverse());
      }
      return concat(parts);
    };

    const result = [];
    // Wiązka zastępuje linie, których nie widać. Z polem „Relacje dokumentów”
    // każda linia jest na płótnie, więc wiązek nie ma. W fokusie dokumentu jego
    // linie zastępują jego część wiązki: zostaje wiązka pozostałych dokumentów
    // (cienka, bez akcentu) albo żadna, gdy wiązka to tylko linie fokusu.
    for (const bundle of lines.groups && !lines.relations ? model.bundles : []) {
      const groupFocus = Boolean(focus) && (bundle.a === focus.id || bundle.b === focus.id);
      const focusEntries = focus && !groupFocus
        ? bundle.members.filter(id => focus.edges.has(id)).reduce((sum, id) => sum + edgeById.get(id).count, 0)
        : 0;
      const count = bundle.count - focusEntries;
      if (!count) continue;
      const highlighted = groupFocus;
      const points = layout.routes.get(bundle.id) || null;
      result.push({
        id: bundle.id, source: bundle.source, target: bundle.target, type: 'floating', className: 'is-group',
        // Bez trasy wiązka biegnie od brzegu do brzegu ramki i nie ma strzałki,
        // żeby nie wyglądała jak osobna relacja.
        markerEnd: points ? arrow(highlighted) : undefined,
        markerStart: points && bundle.bidirectional ? arrow(highlighted) : undefined,
        data: {
          group: true, bundle: true, count, highlighted, dim: Boolean(focus) && !highlighted, label: null,
          width: lineWidth(count), points, expected: expected(bundle.source, bundle.target),
        },
        zIndex: highlighted ? 2 : 1,
      });
    }
    for (const edge of model.edges) {
      const inFocus = Boolean(focus?.edges.has(edge.id));
      if (!edge.detail && edge.scope === 'top') {
        // Linia między grupami albo grupą i dokumentem bez grupy, z liczbą relacji:
        // z polem „Grupujące” albo w fokusie.
        if (!lines.groups && !inFocus) continue;
        result.push({
          id: edge.id, source: edge.source, target: edge.target, type: 'floating', className: 'is-group',
          markerEnd: arrow(inFocus), data: {
            group: true, count: edge.count, highlighted: inFocus, dim: Boolean(focus) && !inFocus, label: null,
            width: lineWidth(edge.count), points: layout.routes.get(edge.id) || null,
            expected: expected(edge.source, edge.target),
          },
          zIndex: inFocus ? 2 : 1,
        });
        continue;
      }
      if (!lines.relations && !inFocus) continue;
      const label = edge.relations.length === 1 && edge.count === 1 ? edge.relations[0] : `${edge.relations.join(', ')}${edge.count > 1 ? ` · ${edge.count}` : ''}`;
      result.push({
        id: edge.id, source: edge.source, target: edge.target, type: 'floating',
        // Linia dokumentu do grupy biegnie w stronę, w którą idzie większość wpisów.
        markerEnd: edge.directed || edge.bidirectional || !edge.detail ? arrow(inFocus) : undefined,
        markerStart: edge.bidirectional ? arrow(inFocus) : undefined,
        data: {
          group: false, count: edge.count, highlighted: inFocus, dim: Boolean(focus) && !inFocus && !(edge.scope === 'inner' && edge.topSource === focus.id), label,
          width: 1.1, points: edge.scope === 'cross' ? crossRoute(edge) : layout.routes.get(edge.id) || null,
          expected: expected(edge.source, edge.target),
        },
        zIndex: inFocus ? 3 : 1,
      });
    }
    return result;
  }, [model, layout, focus, lines, absolute, edgeById]);

  // Dopasowanie widoku po pierwszym ułożeniu danego zestawu węzłów, a gdy
  // czeka węzeł do wyśrodkowania, przybliżenie do niego.
  // Widok dopasowuje się dopiero do nowego układu: układ liczy się
  // asynchronicznie, a węzły na płótnie muszą już stać na nowych pozycjach.
  useEffect(() => {
    if (!layout || layout.key !== layoutKey) return;
    if (nodes.length !== computedNodes.length || nodes.some((node, i) => node.position !== computedNodes[i].position)) return;
    const pending = peekFocus();
    const pendingNode = pending ? model.nodeOfDoc.get(pending) : null;
    if (pendingNode && nodes.some(node => node.id === pendingNode)) {
      clearFocus();
      fittedFor.current = fitKey;
      setTimeout(() => flow.fitView({ nodes: [{ id: pendingNode }], padding: 0.6, duration: 350, maxZoom: 1.4 }), 60);
      return;
    }
    if (fittedFor.current === fitKey) return;
    fittedFor.current = fitKey;
    requestAnimationFrame(() => flow.fitView({ padding: 0.12, duration: 0, maxZoom: 1.2 }));
  }, [layout, layoutKey, fitKey, flow, nodes, computedNodes, model]);

  // Najechanie na kartę dokumentu albo grupy ustawia fokus; ramka go nie ustawia.
  const onNodeMouseEnter = useCallback((event, node) => { if (node.type !== 'frame') setHovered(node.id); }, []);
  const onNodeMouseLeave = useCallback(() => setHovered(null), []);

  const onNodeClick = useCallback((event, node) => {
    if (node.id !== params.sel) navigate({ sel: node.id, panel: undefined });
  }, [params.sel]);

  // W sąsiedztwie wszystkie grupy są rozwinięte, a grupa zakresu procesu
  // nie daje się zwinąć; pozostałe grupy rozwija dwuklik.
  const toggleExpanded = useCallback(key => {
    if (params.zakres === 'sasiedztwo') return;
    if (params.zakres === 'proces' && key === params.grupa) return;
    const set = new Set(listParam(params.rozwin));
    if (set.has(key)) set.delete(key); else set.add(key);
    navigate({ rozwin: [...set].join(',') || undefined }, { replace: true });
  }, [params.rozwin, params.zakres, params.grupa]);

  // Klik w tło zdejmuje zaznaczenie w całej aplikacji (zasada jednego zaznaczenia).
  const onPaneClick = useCallback(() => {
    if (params.sel) navigate({ sel: undefined });
  }, [params.sel]);

  // Dwuklik: grupa się rozwija albo zwija; dokument w sąsiedztwie staje się środkiem.
  const onNodeDoubleClick = useCallback((event, node) => {
    if (node.type === 'group' || node.type === 'frame') toggleExpanded(groupKeyOf(node.id));
    else if (node.type === 'doc' && params.zakres === 'sasiedztwo') navigate({ wezel: node.id, sel: node.id }, { replace: true });
  }, [toggleExpanded, params.zakres]);

  // Stary link sąsiedztwa bez środka: środkiem zostaje zaznaczenie.
  useEffect(() => {
    if (params.zakres === 'sasiedztwo' && !params.wezel && params.sel && !isGroupNode(params.sel)) navigate({ wezel: params.sel }, { replace: true });
  }, [params.zakres, params.wezel, params.sel]);

  const onNodeDragStop = useCallback((event, node) => {
    if (!node.parentId) dragged.set(node.id, node.position);
  }, []);

  // Shift + przeciągnięcie zaznacza węzły ramką; po puszczeniu widok
  // przybliża się do zaznaczonych węzłów.
  const onSelectionEnd = useCallback(() => {
    const selected = flow.getNodes().filter(node => node.selected);
    if (selected.length) flow.fitView({ nodes: selected, padding: 0.15, duration: 300, maxZoom: MAX_ZOOM });
  }, [flow]);

  useEffect(() => {
    const onKeyDown = event => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('.pal, .preview-modal, .node-menu')) return;
      if (event.key === 'f' || event.key === 'F') {
        const target = selectedNodeId ? flow.getNodes().filter(node => node.id === selectedNodeId) : undefined;
        flow.fitView({ nodes: target?.length ? target : undefined, padding: 0.2, duration: 250, maxZoom: target?.length ? 1.5 : 1.2 });
      } else if (event.key === '0') flow.zoomTo(1, { duration: 150 });
      else if (event.key === '+' || event.key === '=') flow.zoomIn({ duration: 150 });
      else if (event.key === '-') flow.zoomOut({ duration: 150 });
      else if ((event.key === 'e' || event.key === 'E') && params.sel && docIndex.has(params.sel)) {
        const set = new Set(listParam(params.wiersze));
        if (set.has(params.sel)) set.delete(params.sel); else set.add(params.sel);
        navigate({ wiersze: [...set].join(',') || undefined }, { replace: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flow, selectedNodeId, params.sel, params.wiersze, docIndex]);

  const zoomClass = `${zoom < 0.25 ? 'zoom-far' : zoom < 0.5 ? 'zoom-mid' : ''} ${model.grouping === 'brak' ? '' : 'has-groups'}`;
  const scopeLabel = {
    calosc: model.grouping === 'brak' ? 'całość bez grup' : 'całość w grupach',
    proces: `proces ${params.grupa || '(wybierz w panelu)'}`,
    sasiedztwo: `sąsiedztwo ${params.wezel || '(wybierz środek)'} · ${Number(params.kroki) || 1} ${plural(Number(params.kroki) || 1, 'krok', 'kroki', 'kroków')}`,
    typ: 'typ dokumentu (etap 4)',
  }[params.zakres || 'calosc'];

  return (
    <div className={`cv map-cv ${zoomClass}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={(event, node) => openNodeMenu(event, node.id)}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onSelectionEnd={onSelectionEnd}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={null}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements
      >
        {zoom > 1.5 && <MiniMap pannable zoomable className="mm" nodeColor={node => (node.type === 'frame' ? 'transparent' : 'var(--t-edge)')} nodeStrokeColor="var(--t-edge)" maskColor="color-mix(in srgb, var(--color-bg) 60%, transparent)" />}
      </ReactFlow>
      <div className="vl"><b>Mapa</b> · {scopeLabel} · {model.docCount} {plural(model.docCount, 'dokument', 'dokumenty', 'dokumentów')}
        {model.grouping !== 'brak' && ` · ${model.groupCount} ${model.focused ? plural(model.groupCount, 'grupa sąsiednia', 'grupy sąsiednie', 'grup sąsiednich') : plural(model.groupCount, 'grupa', 'grupy', 'grup')}`}</div>
      {!layout && <div className="cv-note">Układanie grafu…</div>}
      {model.note && params.zakres !== 'sasiedztwo' && <div className="cv-note">{model.note}</div>}
      {params.zakres === 'sasiedztwo' && !params.wezel && !params.sel && (
        <div className="center-picker">
          <div style={{ fontSize: 13, fontWeight: 500 }}>Sąsiedztwo węzła</div>
          <div className="mu" style={{ fontSize: 12 }}>Wyszukaj dokument albo wiersz, od którego liczyć sąsiedztwo.</div>
          <NodePicker autoFocus onPick={id => navigate({ wezel: id, sel: id }, { replace: true })} />
        </div>
      )}
      <div className="hint">{params.zakres !== 'sasiedztwo' && model.grouping !== 'brak' && <span>Dwuklik rozwija grupę</span>}{params.zakres === 'sasiedztwo' && <span>Dwuklik na dokumencie: nowy środek</span>}{lines.hover && !lines.relations && <span>Najedź na kartę: jej relacje</span>}<span>Shift + przeciągnij: ramka</span><span><span className="kbd">E</span> wiersze</span><span><span className="kbd">Z</span> do koszyka</span></div>
      <ZoomBar zoom={zoom} autoFit={autoFit} onAutoFit={setAutoFit} />
    </div>
  );
}

export default function MapCanvas({ params }) {
  return (
    <ReactFlowProvider>
      <MapFlow params={params} />
    </ReactFlowProvider>
  );
}

export { groupNodeId };
