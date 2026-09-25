import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, applyNodeChanges, getBezierPath, useInternalNode, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { api, useData } from '../state/data';
import { listParam, navigate } from '../state/route';
import { ZoomBar } from '../map/MapCanvas';
import { borderPoint, keepMeasured } from '../map/nodes';
import { plural } from '../components/TopBar';
import { capLevel, contractLevel, lineId } from './model';
import { openNodeMenu } from '../components/NodeMenu';

const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Dane /api/flow wspólne dla płótna i inspektora linii.
const flowCache = new Map();
export function useFlowData() {
  const { graph } = useData();
  const version = graph?.version;
  const [state, setState] = useState(() => flowCache.get(version) || null);
  useEffect(() => {
    if (!graph) return undefined;
    if (flowCache.has(version)) { setState(flowCache.get(version)); return undefined; }
    let cancelled = false;
    api('/api/flow').then(data => { flowCache.set(version, data); if (!cancelled) setState(data); });
    return () => { cancelled = true; };
  }, [graph, version]);
  return state;
}

const handles = (
  <>
    <Handle type="target" position={Position.Top} isConnectable={false} className="rf-handle" />
    <Handle type="source" position={Position.Bottom} isConnectable={false} className="rf-handle" />
  </>
);

const CapCard = memo(({ data, selected }) => {
  const { cap, highlight, selectedChip } = data;
  return (
    <div className={`cap-card ${selected ? 'is-selected' : ''}`}>
      {handles}
      <div className="cap-card-head">
        <span className="dot" style={{ background: 'var(--l-resp)' }} />
        <span className="m cap-id" style={{ color: 'var(--l-resp-t)' }}>{cap.id}</span>
        <span className="m mu" style={{ marginLeft: 'auto', fontSize: 11 }}>{cap.contracts.length}</span>
      </div>
      <div className="cap-card-title">{cap.title}</div>
      <div className="cap-chips">
        {cap.contracts.map(contract => (
          <button key={contract.id} type="button" title={`${contract.id} · ${contract.title}`}
            className={`cap-chip m ${highlight.has(contract.id) ? 'is-on' : ''} ${selectedChip === contract.id ? 'is-selected' : ''}`}
            onClick={event => { event.stopPropagation(); navigate({ sel: contract.id, lin: undefined }); }}
            onContextMenu={event => openNodeMenu(event, contract.id)}>{contract.id}</button>
        ))}
        {cap.contracts.length === 0 && <span className="mu" style={{ fontSize: 11 }}>brak kontraktów</span>}
      </div>
    </div>
  );
});

const ProcessHead = memo(({ data }) => (
  <div className="colh-node"><span className="m" style={{ letterSpacing: 0, color: 'var(--color-text)' }}>{data.group}</span>{data.title ? ` · ${data.title}` : ''}</div>
));

const CapFrame = memo(({ data }) => (
  <div className={`flow-frame ${data.focus ? 'is-focus' : ''}`}>
    <div className="flow-frame-head">
      {data.layer && <span className="dot" style={{ background: `var(--l-${data.layer})` }} />}
      <span className="m" style={{ fontWeight: 500, color: data.layer ? `var(--l-${data.layer}-t)` : 'var(--t-muted)' }}>{data.key}</span>
      {data.title && <span className="mu" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.title}</span>}
    </div>
  </div>
));

const FlowDoc = memo(({ data, selected }) => {
  const { doc, entities } = data;
  const layer = doc?.layer || 'other';
  return (
    <div className={`node ${selected ? 'is-selected' : ''}`} title={doc ? `${doc.id} · ${doc.title}` : ''}>
      {handles}
      <div className="node-head">
        <span className="dot" style={{ background: `var(--l-${layer})` }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nid" style={{ color: `var(--l-${layer}-t)` }}>{doc?.id}</div>
          <div className="nt">{entities?.length ? entities.join(', ') : doc?.title}</div>
        </div>
      </div>
    </div>
  );
});

const FlowEdge = memo(({ id, source, target, data, markerEnd, markerStart }) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode?.measured?.width || !targetNode?.measured?.width) return null;
  const center = node => ({ x: node.internals.positionAbsolute.x + node.measured.width / 2, y: node.internals.positionAbsolute.y + node.measured.height / 2 });
  const sc = center(sourceNode);
  const tc = center(targetNode);
  const s = borderPoint(sourceNode, tc.x, tc.y);
  const t = borderPoint(targetNode, sc.x, sc.y);
  // Kilka linii między tą samą parą zdolności (zdarzenie i wywołanie, albo
  // linie w obie strony) rozsuwa się prostopadle, żeby każda była widoczna.
  const offset = data.offset || 0;
  if (offset) {
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const length = Math.hypot(dx, dy) || 1;
    const sign = source < target ? 1 : -1;
    const nx = (-dy / length) * offset * sign;
    const ny = (dx / length) * offset * sign;
    s.x += nx; s.y += ny; t.x += nx; t.y += ny;
  }
  const horizontal = Math.abs(t.x - s.x) >= Math.abs(t.y - s.y);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: s.x, sourceY: s.y, targetX: t.x, targetY: t.y,
    sourcePosition: horizontal ? (t.x > s.x ? Position.Right : Position.Left) : (t.y > s.y ? Position.Bottom : Position.Top),
    targetPosition: horizontal ? (t.x > s.x ? Position.Left : Position.Right) : (t.y > s.y ? Position.Top : Position.Bottom),
    curvature: 0.35,
  });
  const { kind, label, selected, onSelect } = data;
  const color = selected ? 'var(--color-accent)' : kind === 'ambiguous' ? 'var(--t-muted)' : kind === 'relation' ? 'var(--t-edge)' : 'var(--color-text)';
  const style = {
    stroke: color,
    strokeWidth: selected ? 2.4 : kind === 'event' ? 1.7 : kind === 'call' ? 1.3 : 1.2,
    strokeDasharray: kind === 'ambiguous' ? '4 4' : undefined,
    opacity: kind === 'relation' && !selected ? 0.7 : 1,
    filter: selected ? 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-accent) 60%, transparent))' : undefined,
  };
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={style} interactionWidth={16} />
      {kind === 'call' && <circle cx={s.x} cy={s.y} r={3} fill={color} />}
      {label && (
        <EdgeLabelRenderer>
          <button type="button" className={`flow-label ${selected ? 'is-selected' : ''} is-${kind}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={onSelect}>{label}</button>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

const nodeTypes = { capCard: CapCard, processHead: ProcessHead, capFrame: CapFrame, flowDoc: FlowDoc };
const edgeTypes = { flow: FlowEdge };

function Flow({ params }) {
  const { graph } = useData();
  const flowData = useFlowData();
  const flow = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  const level = params.poziom === 'kontrakty' ? 'kontrakty' : 'cap';
  const hiddenProcesses = useMemo(() => new Set(listParam(params.bez_procesow)), [params.bez_procesow]);
  const hiddenKinds = useMemo(() => new Set(listParam(params.bez_linii)), [params.bez_linii]);
  const labelMode = params.linia === 'encje' ? 'encje' : 'id';

  const model = useMemo(() => {
    if (!flowData || !graph) return null;
    if (level === 'kontrakty') return params.cap ? contractLevel(flowData, graph, params.cap) : null;
    return capLevel(flowData, graph, { hiddenProcesses, hiddenKinds });
  }, [flowData, graph, level, params.cap, hiddenProcesses, hiddenKinds]);

  const selectedLine = level === 'cap' && model ? model.lines.find(line => lineId(line) === params.lin) : null;

  const computedNodes = useMemo(() => {
    if (!model) return [];
    const highlight = new Set(selectedLine ? selectedLine.contracts : []);
    return model.nodes.map(node => ({
      ...node,
      selected: node.id === params.sel,
      data: node.type === 'capCard' ? { ...node.data, highlight, selectedChip: params.sel } : node.data,
    }));
  }, [model, params.sel, selectedLine, level]);

  const [nodes, setNodes] = useState([]);
  useEffect(() => { setNodes(current => keepMeasured(current, computedNodes)); }, [computedNodes]);
  const onNodesChange = useCallback(changes => setNodes(current => applyNodeChanges(changes, current)), []);

  const edges = useMemo(() => {
    if (!model) return [];
    if (level === 'kontrakty') {
      return model.edges.map((edge, index) => {
        const selected = params.sel && (edge.source === params.sel || edge.target === params.sel);
        return {
          id: `rel-${index}`, source: edge.source, target: edge.target, type: 'flow', zIndex: selected ? 3 : 1,
          markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13, color: selected ? 'var(--color-accent)' : 'var(--t-edge)' },
          data: { kind: 'relation', selected, label: selected ? edge.relation : null },
        };
      });
    }
    const pairKey = line => [line.from, line.to].sort().join('|');
    const perPair = new Map();
    for (const line of model.lines) perPair.set(pairKey(line), [...(perPair.get(pairKey(line)) || []), lineId(line)]);
    return model.lines.map(line => {
      const id = lineId(line);
      const selected = params.lin === id;
      const siblings = perPair.get(pairKey(line));
      const offset = (siblings.indexOf(id) - (siblings.length - 1) / 2) * 16;
      const label = line.kind === 'ambiguous'
        ? line.via.join(', ')
        : labelMode === 'encje' ? (line.entities.join(', ') || '—') : line.contracts.map(contract => (flowData.caps.flatMap(cap => cap.contracts).find(c => c.id === contract)?.type === 'QUE' ? `${contract} · ${graph.documents.find(doc => doc.id === contract)?.title || ''}` : contract)).join(' → ');
      return {
        id, source: line.from, target: line.to, type: 'flow', zIndex: selected ? 3 : 1,
        markerEnd: line.kind === 'ambiguous' ? undefined : { type: MarkerType.ArrowClosed, width: 14, height: 14, color: selected ? 'var(--color-accent)' : 'var(--color-text)' },
        data: { kind: line.kind, selected, label, offset, onSelect: () => navigate({ lin: selected ? undefined : id }, { replace: false }) },
      };
    });
  }, [model, level, params.sel, params.lin, labelMode, flowData, graph]);

  const layoutKey = model ? `${level}|${params.cap || ''}|${model.nodes.map(node => node.id).join(',')}` : '';
  useEffect(() => {
    if (layoutKey) requestAnimationFrame(() => flow.fitView({ padding: 0.12, maxZoom: 1.1 }));
  }, [layoutKey, flow]);

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
  if (!flowData) label = <><b>Przepływ</b> · wczytywanie…</>;
  else if (level === 'cap') {
    const certain = model.lines.filter(line => line.kind !== 'ambiguous').length;
    const ambiguous = model.lines.length - certain;
    label = <><b>Przepływ</b> · zdolności CAP · {model.capCount} {plural(model.capCount, 'zdolność', 'zdolności', 'zdolności')} · {certain} {plural(certain, 'linia pewna', 'linie pewne', 'linii pewnych')} · {ambiguous} {plural(ambiguous, 'niejednoznaczna', 'niejednoznaczne', 'niejednoznacznych')}</>;
  } else if (model) {
    label = <><b>Przepływ</b> · kontrakty <span className="m" style={{ color: 'var(--l-resp-t)' }}>{model.cap.id}</span> · {model.cap.contracts.length} kontraktów · {model.callers} korzystających <button type="button" className="linkish" style={{ pointerEvents: 'auto', color: 'var(--color-accent)', marginLeft: 6 }} onClick={() => navigate({ poziom: undefined, cap: undefined })}>‹ poziom CAP</button></>;
  } else label = <><b>Przepływ</b> · kontrakty</>;

  return (
    <div className={`cv flow-cv ${zoom < 0.5 ? 'zoom-mid' : ''}`}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(event, node) => {
          if (node.type === 'capCard' || node.type === 'flowDoc') navigate({ sel: node.id, lin: undefined });
        }}
        onNodeDoubleClick={(event, node) => { if (node.type === 'capCard') navigate({ poziom: 'kontrakty', cap: node.id, sel: node.id, lin: undefined }); }}
        onEdgeClick={(event, edge) => { if (level === 'cap') navigate({ lin: params.lin === edge.id ? undefined : edge.id }); }}
        onPaneClick={() => { if (params.sel || params.lin) navigate({ sel: undefined, lin: undefined }); }}
        onNodeContextMenu={(event, node) => { if (node.type === 'capCard' || node.type === 'flowDoc') openNodeMenu(event, node.id); else event.preventDefault(); }}
        minZoom={0.1} maxZoom={4} nodesConnectable={false} zoomOnDoubleClick={false} deleteKeyCode={null}
        nodesDraggable={level === 'cap'} selectionKeyCode="Shift" multiSelectionKeyCode={null}
        onSelectionEnd={() => { const selected = flow.getNodes().filter(node => node.selected); if (selected.length) flow.fitView({ nodes: selected, padding: 0.15, duration: 300 }); }}
        proOptions={{ hideAttribution: true }}
      />
      <div className="vl">{label}</div>
      {level === 'kontrakty' && !params.cap && <div className="cv-note">Wybierz zdolność w panelu po lewej albo kliknij dwukrotnie zdolność na poziomie CAP.</div>}
      <div className="hint">
        {level === 'cap'
          ? <><span>Klik w linię: nadawca, odbiorca, ładunek</span><span>Dwuklik w zdolność: jej kontrakty</span></>
          : <><span>Lewa kolumna: kto korzysta</span><span>Prawa: z czego korzystają kontrakty i kto odbiera zdarzenia</span></>}
      </div>
      <ZoomBar zoom={zoom} />
    </div>
  );
}

export default function FlowCanvas({ params }) {
  return (
    <ReactFlowProvider>
      <Flow params={params} />
    </ReactFlowProvider>
  );
}
