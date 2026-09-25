import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, applyNodeChanges, useInternalNode, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useData } from '../state/data';
import { navigate } from '../state/route';
import { ZoomBar } from '../map/MapCanvas';
import { AnchorDots, anchoredLine, keepMeasured } from '../map/nodes';
import { plural } from '../components/TopBar';
import NodePicker from '../components/NodePicker';
import { edgeKey, parseVia, stepEdge } from './paths';
import { useHoveredFile, useScopeResult } from './useScope';
import { openNodeMenu } from '../components/NodeMenu';

const NODE_WIDTH = 170;
const NODE_HEIGHT = 44;
const CONTEXT_LIMIT = 10;
const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const handles = (
  <>
    <Handle type="target" position={Position.Top} isConnectable={false} className="rf-handle" />
    <Handle type="source" position={Position.Bottom} isConnectable={false} className="rf-handle" />
  </>
);

const ScopeNode = memo(({ data, selected }) => {
  const { id, layer, title, kind, badge, hovered } = data;
  return (
    <div className={`node scope-node is-${kind} ${selected ? 'is-selected' : ''} ${hovered ? 'is-hovered' : ''}`} title={title ? `${id} · ${title}` : id}>
      {handles}
      <div className="node-head">
        <span className="dot" style={{ background: `var(--l-${layer || 'other'})` }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nid" style={{ color: `var(--l-${layer || 'other'}-t)` }}>{id}</div>
          {title && <div className="nt">{title}</div>}
        </div>
        {badge && <span className={`bdg bdg-${kind}`}>{badge}</span>}
      </div>
    </div>
  );
});

const ScopeEdge = memo(({ id, source, target, data, markerEnd }) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode?.measured?.width || !targetNode?.measured?.width) return null;
  // Linia biegnie między punktami połączenia kart (jak na Mapie).
  const { path, labelX, labelY, dots } = anchoredLine(sourceNode, targetNode, { markerEnd });
  const { kind, relation, showLabel } = data;
  const style = {
    scope: { stroke: 'var(--t-scope)', strokeWidth: 1.5 },
    hovered: { stroke: 'var(--t-scope)', strokeWidth: 3.2, filter: 'drop-shadow(0 0 3px var(--t-scope))' },
    context: { stroke: 'var(--t-edge)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.6 },
    extra: { stroke: 'var(--t-scope)', strokeWidth: 1, opacity: 0.45 },
    broken: { stroke: 'var(--t-error)', strokeWidth: 1.6, strokeDasharray: '5 4' },
  }[kind];
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <AnchorDots dots={dots} className={`scope-anchor is-${kind}`} />
        {showLabel && <div className={`edge-label scope-label is-${kind}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{relation}</div>}
      </EdgeLabelRenderer>
    </>
  );
});

const nodeTypes = { scope: ScopeNode, columnHead: memo(({ data }) => <div className="colh-node">{data.label}</div>) };
const edgeTypes = { scope: ScopeEdge };

function buildGraph(result, graph, { docIndex, rowIndex, showContext, simulate }) {
  const nodes = new Map();
  const edges = new Map();
  const titleOf = key => docIndex.get(key)?.title || (rowIndex.get(key) ? `wiersz · ${rowIndex.get(key).doc}` : null);
  const layerOf = key => docIndex.get(key)?.layer || rowIndex.get(key)?.layer;
  const starts = new Set(result.starts);
  const removal = simulate ? result.removal : null;
  const disconnected = new Set(removal?.disconnected || []);

  for (const item of result.nodes) {
    const steps = parseVia(item.via);
    // Każdy węzeł koszyka jest startem, nawet gdy zapytanie doszło do niego
    // od innego węzła startowego (koszyk UC-001, SCR-001).
    const isStart = starts.has(item.node);
    let kind = isStart ? 'start' : 'scope';
    let badge = isStart ? 'start' : null;
    if (simulate && isStart) { kind = 'removed'; badge = 'usunięcie'; }
    if (disconnected.has(item.node)) badge = 'traci połączenie';
    nodes.set(item.node, { id: item.node, column: isStart ? 0 : steps.length, kind, badge, layer: layerOf(item.node), title: titleOf(item.node), files: new Set() });
    for (const step of steps) {
      const edge = stepEdge(step);
      edges.set(edgeKey(edge), { ...edge, kind: 'scope', vias: new Set() });
    }
  }
  for (const item of result.nodes) {
    for (const step of parseVia(item.via)) edges.get(edgeKey(stepEdge(step))).vias.add(item.node);
  }

  // Pozostałe relacje między węzłami wyniku (poza drogą zapytania), cieńsze:
  // pokazują, że wynik jest spójny, np. NAV-001 groups SCR-002.
  const resultDoc = key => (nodes.has(key) ? key : rowIndex.get(key)?.doc && nodes.has(rowIndex.get(key).doc) ? rowIndex.get(key).doc : null);
  for (const edge of graph.edges) {
    if (!edge.exists || edge.source === edge.targetDoc) continue;
    const target = resultDoc(edge.target);
    if (!nodes.has(edge.source) || !target || target === edge.source) continue;
    const extra = { source: edge.source, target, relation: edge.relation };
    if (!edges.has(edgeKey(extra))) edges.set(`extra:${edgeKey(extra)}`, { ...extra, kind: 'extra', vias: new Set() });
  }

  // Skutki usunięcia: węzły, których wpisy stracą cel, i te linie.
  if (removal) {
    for (const entry of removal.broken) {
      if (!nodes.has(entry.source)) nodes.set(entry.source, { id: entry.source, column: 1, kind: 'context', badge: null, layer: layerOf(entry.source), title: titleOf(entry.source), files: new Set() });
      const target = nodes.has(entry.target) ? entry.target : rowIndex.get(entry.target)?.doc || entry.target;
      if (!nodes.has(target)) continue;
      const edge = { source: entry.source, target, relation: entry.relation };
      // Ta sama relacja jest też drogą zapytania; zostaje tylko czerwona linia.
      edges.delete(edgeKey(edge));
      edges.delete(`extra:${edgeKey(edge)}`);
      edges.set(`broken:${edgeKey(edge)}`, { ...edge, kind: 'broken', vias: new Set() });
    }
  }

  // Sąsiedzi spoza wyniku: węzły połączone z węzłami wyniku, które zapytanie
  // świadomie pomija (dla REQ-01: BFS-001, ACTOR-001.ROLE-01, UC-002).
  // Najpierw sąsiedzi startu, potem dalszych kroków; limit chroni czytelność.
  if (showContext) {
    const anchors = [...nodes.values()].filter(node => node.kind !== 'context').sort((a, b) => a.column - b.column).map(node => node.id);
    let added = 0;
    for (const anchor of anchors) {
      if (added >= CONTEXT_LIMIT) break;
      for (const edge of graph.edges) {
        if (added >= CONTEXT_LIMIT) break;
        // Wpis contains dokumentu do własnego wiersza łączy wiersz startowy z dokumentem.
        if (!edge.exists || edge.target === edge.source) continue;
        const touches = edge.source === anchor ? edge.target : edge.target === anchor || (edge.targetDoc === anchor && !rowIndex.has(anchor)) ? edge.source : null;
        if (!touches || nodes.has(touches) || touches === anchor) continue;
        // Własny wiersz dokumentu z wyniku (UC-001.A1) nie jest sąsiadem.
        if (rowIndex.get(touches)?.doc === anchor) continue;
        const anchorColumn = nodes.get(anchor).column;
        nodes.set(touches, { id: touches, column: anchorColumn + 1, kind: 'context', badge: null, layer: layerOf(touches), title: titleOf(touches), files: new Set() });
        const contextEdge = { source: edge.source, target: edge.source === anchor ? touches : anchor, relation: edge.relation };
        edges.set(`ctx:${edgeKey(contextEdge)}`, { ...contextEdge, kind: 'context', vias: new Set() });
        added++;
      }
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function Flow({ params }) {
  const { graph, docIndex, rowIndex } = useData();
  const flow = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  const { result, loading, error, empty, request } = useScopeResult(params);
  const hovered = useHoveredFile();
  const showContext = params.kontekst !== '0';
  const showLabels = params.etykiety_relacji === '1';
  const simulate = request.simulateRemoval;
  const [positions, setPositions] = useState(null);

  const model = useMemo(() => (result ? buildGraph(result, graph, { docIndex, rowIndex, showContext, simulate }) : null), [result, graph, docIndex, rowIndex, showContext, simulate]);
  const layoutKey = model ? model.nodes.map(node => `${node.id}:${node.column}`).join('|') : '';

  useEffect(() => {
    if (!model) return undefined;
    let cancelled = false;
    setPositions(null);
    import('./layout').then(({ layoutScope }) => layoutScope(model.nodes.map(node => ({ ...node, width: NODE_WIDTH, height: NODE_HEIGHT })), model.edges))
      .then(map => { if (!cancelled) setPositions(map); })
      .catch(() => { if (!cancelled) setPositions(new Map()); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const hoveredNodes = useMemo(() => new Set(hovered ? hovered.nodes.map(item => item.node) : []), [hovered]);
  const hoveredEdges = useMemo(() => {
    const keys = new Set();
    for (const item of hovered?.nodes || []) for (const step of parseVia(item.via)) keys.add(edgeKey(stepEdge(step)));
    return keys;
  }, [hovered]);

  const computedNodes = useMemo(() => {
    if (!model || !positions) return [];
    const columns = new Map();
    for (const node of model.nodes) {
      const position = positions.get(node.id);
      if (!position || node.kind === 'context') continue;
      const current = columns.get(node.column);
      columns.set(node.column, current === undefined ? position.x : Math.min(current, position.x));
    }
    const minY = Math.min(...[...positions.values()].map(p => p.y));
    const heads = [...columns].map(([column, x]) => ({
      id: `head:${column}`, type: 'columnHead', position: { x, y: minY - 34 }, draggable: false, selectable: false,
      data: { label: column === 0 ? (simulate ? 'Do usunięcia' : 'Start') : `krok ${column}` },
    }));
    return [...heads, ...model.nodes.map(node => ({
      id: node.id, type: 'scope', position: positions.get(node.id) || { x: 0, y: 0 },
      style: { width: NODE_WIDTH, height: NODE_HEIGHT }, width: NODE_WIDTH, height: NODE_HEIGHT,
      selected: node.id === params.sel,
      data: { ...node, hovered: hoveredNodes.has(node.id) },
    }))];
  }, [model, positions, params.sel, hoveredNodes, simulate]);

  const [nodes, setNodes] = useState([]);
  useEffect(() => { setNodes(current => keepMeasured(current, computedNodes)); }, [computedNodes]);
  const onNodesChange = useCallback(changes => setNodes(current => applyNodeChanges(changes, current)), []);

  const edges = useMemo(() => (model ? model.edges.map((edge, index) => {
    const isHovered = edge.kind === 'scope' && hoveredEdges.has(edgeKey(edge));
    const kind = isHovered ? 'hovered' : edge.kind;
    const color = { scope: 'var(--t-scope)', hovered: 'var(--t-scope)', context: 'var(--t-edge)', broken: 'var(--t-error)', extra: 'var(--t-scope)' }[kind];
    return {
      id: `${edge.kind}-${index}`, source: edge.source, target: edge.target, type: 'scope', zIndex: isHovered ? 3 : 1,
      markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color },
      data: { kind, relation: edge.relation, showLabel: showLabels || isHovered || edge.kind === 'broken' },
    };
  }) : []), [model, hoveredEdges, showLabels]);

  useEffect(() => {
    if (positions) requestAnimationFrame(() => flow.fitView({ padding: 0.12, maxZoom: 1.1 }));
  }, [positions, flow]);

  useEffect(() => {
    const onKeyDown = event => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('.pal, .preview-modal, .node-menu')) return;
      if (event.key === 'f' || event.key === 'F') {
        const target = flow.getNodes().filter(node => node.id === params.sel);
        flow.fitView({ nodes: target.length ? target : undefined, padding: 0.2, duration: 250, maxZoom: target.length ? 1.5 : 1.1 });
      } else if (event.key === '0') flow.zoomTo(1, { duration: 150 });
      else if (event.key === '+' || event.key === '=') flow.zoomIn({ duration: 150 });
      else if (event.key === '-') flow.zoomOut({ duration: 150 });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flow, params.sel]);

  let label;
  if (empty) label = <><b>Zasięg</b> · koszyk jest pusty</>;
  else if (result) {
    const count = result.files.length;
    const broken = result.removal?.broken.length || 0;
    label = (
      <>
        <b>Zasięg</b> · {simulate ? 'symulacja usunięcia' : <span className="m">{request.query}</span>} · start <span className="m" style={{ color: simulate ? 'var(--t-error)' : 'var(--t-scope)' }}>{result.starts.join(', ')}</span>
        {' · '}{count} {plural(count, 'plik', 'pliki', 'plików')}{simulate ? ' do przejrzenia' : ''}
        {simulate && <span style={{ color: broken ? 'var(--t-error)' : undefined }}> · {broken} {plural(broken, 'relacja', 'relacje', 'relacji')} bez celu</span>}
      </>
    );
  } else label = <><b>Zasięg</b> · liczenie…</>;

  return (
    <div className={`cv scope-cv ${zoom < 0.5 ? 'zoom-mid' : ''}`}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(event, node) => { if (node.type === 'scope' && node.id !== params.sel) navigate({ sel: node.id }); }}
        onPaneClick={() => { if (params.sel) navigate({ sel: undefined }); }}
        onNodeContextMenu={(event, node) => { if (node.type === 'scope') openNodeMenu(event, node.id); else event.preventDefault(); }}
        minZoom={0.1} maxZoom={4} nodesConnectable={false} zoomOnDoubleClick={false} deleteKeyCode={null}
        selectionKeyCode="Shift" multiSelectionKeyCode={null}
        onSelectionEnd={() => { const selected = flow.getNodes().filter(node => node.selected); if (selected.length) flow.fitView({ nodes: selected, padding: 0.15, duration: 300 }); }}
        proOptions={{ hideAttribution: true }}
      />
      <div className="vl">{label}</div>
      {empty && (
        <div className="center-picker">
          <div style={{ fontSize: 13, fontWeight: 500 }}>Koszyk jest pusty</div>
          <div className="mu" style={{ fontSize: 12 }}>Wyszukaj dokument albo wiersz, od którego liczyć zasięg. Możesz też zaznaczyć węzeł i nacisnąć Z albo kliknąć „Zasięg” w inspektorze.</div>
          <NodePicker autoFocus onPick={id => navigate({ start: id, sel: id }, { replace: true })} />
        </div>
      )}
      {error && <div className="cv-note" style={{ color: 'var(--t-error)' }}>{error}</div>}
      {result?.missing?.length > 0 && <div className="banner" role="alert">Nie ma takich węzłów: {result.missing.join(', ')}</div>}
      {!empty && !error && (loading || !positions) && <div className="cv-note">Liczenie i układanie…</div>}
      <div className="hint">
        {simulate ? <><span>Przerywana czerwona linia: relacja straci cel</span><span>Pliki się nie zmieniają</span></>
          : <><span>Najedź na plik w wyniku: podświetla ścieżkę</span>{showContext && <span>Wyszarzone: sąsiedzi spoza wyniku</span>}</>}
      </div>
      <ZoomBar zoom={zoom} />
    </div>
  );
}

export default function ScopeCanvas({ params }) {
  return (
    <ReactFlowProvider>
      <Flow params={params} />
    </ReactFlowProvider>
  );
}
