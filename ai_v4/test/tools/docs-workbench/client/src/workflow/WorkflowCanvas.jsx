import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { api, useData } from '../state/data';
import { navigate } from '../state/route';
import { ZoomBar } from '../map/MapCanvas';
import { roundedPath } from '../map/nodes';
import { layerColor, layerText } from '../components/common';
import { openNodeMenu } from '../components/NodeMenu';
import { fileUrl, modelFor, SCREEN_SIZE, viewOf } from './model';
import { layoutWorkflow } from './layout';

// Widoki przepływu pracy w trybie Przepływ: nawigacja ekranów (NAV) z makietami,
// przepływ (FLOW) z aktywnościami, proces BPMN z krokami SPEC-WF i mapa scenariuszy (UCMAP).

const BpmnDiagram = lazy(() => import('./BpmnDiagram'));

const cache = new Map();
export function useWorkflows() {
  const { graph } = useData();
  const version = graph?.version;
  const [state, setState] = useState(() => cache.get(version) || null);
  useEffect(() => {
    if (!graph) return undefined;
    if (cache.has(version)) { setState(cache.get(version)); return undefined; }
    let cancelled = false;
    // Błąd (np. serwer uruchomiony przed dodaniem /api/workflows) zamiast wiecznego wczytywania.
    api('/api/workflows')
      .then(data => { cache.set(version, data); if (!cancelled) setState(data); })
      .catch(error => { if (!cancelled) setState({ error: error.message }); });
    return () => { cancelled = true; };
  }, [graph, version]);
  return state;
}

// Dokument widoku z parametru `dok`, a bez niego pierwszy dokument typu.
export function currentItem(workflows, params) {
  const view = viewOf(params.widok);
  if (!view || !workflows || workflows.error) return null;
  const items = workflows[view.key];
  return items.find(item => item.id === params.dok) || items[0] || null;
}

// Niewidoczne uchwyty: bez nich React Flow nie rysuje linii do węzła.
const handles = (
  <>
    <Handle type="target" position={Position.Top} isConnectable={false} className="rf-handle" />
    <Handle type="source" position={Position.Bottom} isConnectable={false} className="rf-handle" />
  </>
);

const pick = (event, id) => { event.stopPropagation(); if (id) navigate({ sel: id, lin: undefined }); };
const preview = (event, id) => { event.stopPropagation(); if (id) navigate({ sel: id, podglad: '1' }); };

// Odnośnik do dokumentu wewnątrz karty: klik zaznacza, dwuklik otwiera podgląd, prawy klik menu.
function DocLink({ id, className = '', children }) {
  const { docIndex } = useData();
  const doc = docIndex.get(id);
  return (
    <button type="button" className={`wf-doc-link ${className}`} title={doc ? `${id} · ${doc.title}` : id}
      onClick={event => pick(event, id)} onDoubleClick={event => preview(event, id)} onContextMenu={event => { event.stopPropagation(); openNodeMenu(event, id); }}>
      {children || (
        <>
          <span className="m" style={{ color: layerText(doc?.layer) }}>{id}</span>
          {doc && <span className="nt">{doc.title}</span>}
        </>
      )}
    </button>
  );
}

// Makieta: obraz o nazwie pliku dokumentu albo miejsce na niego z oczekiwaną nazwą.
function Mockup({ image, expected, height, small = false }) {
  if (image) return <div className={`wf-mockup ${small ? 'is-small' : ''}`} style={{ height }}><img src={fileUrl(image)} alt="" loading="lazy" draggable={false} /></div>;
  return (
    <div className={`wf-mockup is-empty ${small ? 'is-small' : ''}`} style={{ height }} title={`Brak makiety: ${expected} obok pliku dokumentu`}>
      {small ? <span>brak</span> : <><span>Brak makiety</span><span className="m">{expected}</span></>}
    </div>
  );
}

const ScreenNode = memo(({ data }) => {
  const { screen, label, selectedId } = data;
  return (
    <div className={`wf-card wf-screen ${selectedId === screen.id ? 'is-selected' : ''} ${data.outside ? 'is-outside' : ''}`}>
    {handles}
      <div className="wf-screen-head" style={{ height: SCREEN_SIZE.header }}>
        <span className="dot" style={{ background: layerColor('scr') }} />
        <div style={{ minWidth: 0 }}>
          <div className="nid" style={{ color: layerText('scr') }}>{screen.id}</div>
          <div className="nt" title={screen.title}>{label || screen.title}</div>
        </div>
      </div>
      <div style={{ padding: `0 ${SCREEN_SIZE.padding}px` }}><Mockup image={screen.image} expected={screen.expectedImage} height={SCREEN_SIZE.image} /></div>
      <div className="wf-sections" style={{ padding: `${SCREEN_SIZE.padding}px ${SCREEN_SIZE.padding}px 0` }}>
        {screen.sections.map(section => (
          <div key={section.id} className={`wf-section ${selectedId === section.id ? 'is-selected' : ''}`} style={{ height: SCREEN_SIZE.section - 6 }}>
            <Mockup image={section.image} expected={section.expectedImage} height={SCREEN_SIZE.section - 14} small />
            <DocLink id={section.id} />
          </div>
        ))}
      </div>
    </div>
  );
});

const TextNode = memo(({ data }) => (
  <div className={`wf-text is-${data.kind}`} title={data.label}>
    {handles}
    {data.kind === 'entry' && <span className="wf-text-kind">wejście</span>}
    {data.kind === 'exit' && <span className="wf-text-kind">wyjście</span>}
    {data.kind === 'actor' && <span className="wf-actor-icon" aria-hidden="true" />}
    <span>{data.label.replace(/^(wej[śs]cie|wyj[śs]cie)(\s+poza przepływ)?:\s*/i, '')}</span>
  </div>
));

const StartNode = memo(({ data }) => (
  <div className="wf-card wf-start">
    {handles}
    <div className="k" style={{ margin: 0 }}>Warunki wstępne</div>
    <div className="wf-clamp" style={{ WebkitLineClamp: 6 }}>{data.label}</div>
  </div>
));

const StepNode = memo(({ data }) => {
  const { step, selectedId } = data;
  const related = [...step.activities, ...step.calls];
  return (
    <div className={`wf-card wf-step ${related.includes(selectedId) ? 'is-selected' : ''}`}>
    {handles}
      <div className="wf-step-head"><span className="wf-step-nr m">{step.nr}</span><span className="k" style={{ margin: 0 }}>Krok</span></div>
      <div className="wf-clamp" style={{ WebkitLineClamp: 7 }} title={step.text}>{step.text}</div>
      {related.length > 0 && (
        <div className="wf-chips">
          {step.activities.map(id => <DocLink key={id} id={id} className="is-activity" />)}
          {step.calls.map(id => <DocLink key={id} id={id} className="is-call"><span className="m">{id}</span></DocLink>)}
        </div>
      )}
    </div>
  );
});

const TaskNode = memo(({ data }) => {
  const { task, selectedId } = data;
  return (
    <div className={`wf-card wf-task ${selectedId === task.spec ? 'is-selected' : ''}`}>
    {handles}
      <div className="wf-task-name" title={task.name}>{task.name}</div>
      <div className="m mu" style={{ fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.taskId}</div>
      {task.spec ? <DocLink id={task.spec} /> : <span className="mu" style={{ fontSize: 11 }}>bez kroku SPEC-WF</span>}
    </div>
  );
});

const DocNode = memo(({ data }) => {
  const { docIndex } = useData();
  const doc = docIndex.get(data.doc);
  return (
    <div className={`wf-card wf-docnode ${data.selectedId === data.doc ? 'is-selected' : ''} ${data.note ? 'is-note' : ''}`}>
    {handles}
      <div className="node-head" style={{ minHeight: 0 }}>
        <span className="dot" style={{ background: layerColor(doc?.layer) }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nid" style={{ color: layerText(doc?.layer) }}>{data.doc}</div>
          <div className="nt" title={doc?.title}>{doc?.title}</div>
        </div>
      </div>
      {data.note && <div className="mu" style={{ fontSize: 10.5 }}>{data.note}</div>}
    </div>
  );
});

const AreaNode = memo(({ data }) => <div className="wf-area"><span>{data.title}</span></div>);

const nodeTypes = { screen: ScreenNode, text: TextNode, start: StartNode, step: StepNode, task: TaskNode, doc: DocNode, area: AreaNode };

const WorkflowEdge = memo(({ id, data, markerEnd }) => {
  if (!data.points) return null;
  const style = { stroke: data.highlighted ? 'var(--color-accent)' : 'var(--t-edge)', strokeWidth: data.highlighted ? 1.8 : 1.3, strokeDasharray: data.dotted ? '5 4' : undefined, fill: 'none' };
  return (
    <>
      <BaseEdge id={id} path={roundedPath(data.points)} markerEnd={markerEnd} style={style} />
      {data.label && data.labelPosition && (
        <EdgeLabelRenderer>
          <div className={`edge-label wf-edge-label ${data.reason ? 'has-reason' : ''} ${data.highlighted ? 'is-highlighted' : ''}`} title={data.reason || undefined}
            style={{ transform: `translate(-50%, -50%) translate(${data.labelPosition.x}px, ${data.labelPosition.y}px)` }}>{data.label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
const edgeTypes = { workflow: WorkflowEdge };

const TYPE_OF_KIND = { screen: 'screen', start: 'start', step: 'step', task: 'task', doc: 'doc' };

function Diagram({ view, item, params }) {
  const flow = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  const model = useMemo(() => modelFor(view.id, item), [view.id, item]);
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState(null);
  const selectedId = params.sel || null;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    layoutWorkflow(model)
      .then(result => { if (!cancelled) setLayout({ ...result, item: item.id }); })
      .catch(reason => { if (!cancelled) setError(String(reason.message || reason)); });
    return () => { cancelled = true; };
  }, [model, item.id]);

  const ready = layout?.item === item.id;
  const nodes = useMemo(() => {
    if (!ready) return [];
    const areas = model.areas.map(area => {
      const position = layout.positions.get(area.id);
      const size = layout.sizes.get(area.id);
      return { id: area.id, type: 'area', position, data: { title: area.title }, style: { width: size.width, height: size.height }, width: size.width, height: size.height, zIndex: -1, selectable: false, draggable: false, measured: size };
    });
    return [...areas, ...model.nodes.map(node => ({
      id: node.id, type: TYPE_OF_KIND[node.kind] || 'text', position: layout.positions.get(node.id),
      data: { ...node, selectedId }, style: { width: node.width, height: node.height }, width: node.width, height: node.height,
      measured: { width: node.width, height: node.height }, draggable: false, selectable: false,
    }))];
  }, [ready, layout, model, selectedId]);

  const edges = useMemo(() => {
    if (!ready) return [];
    const nodeById = new Map(model.nodes.map(node => [node.id, node]));
    const docOf = id => nodeById.get(id)?.doc || nodeById.get(id)?.screen?.id || nodeById.get(id)?.task?.spec;
    return model.edges.map(edge => {
      const highlighted = Boolean(selectedId) && (docOf(edge.from) === selectedId || docOf(edge.to) === selectedId);
      return {
        id: edge.id, source: edge.from, target: edge.to, type: 'workflow',
        markerEnd: edge.arrow ? { type: MarkerType.ArrowClosed, width: 20, height: 20, markerUnits: 'userSpaceOnUse', color: highlighted ? 'var(--color-accent)' : 'var(--t-edge)' } : undefined,
        data: { points: layout.routes.get(edge.id), label: edge.label, labelPosition: layout.labels.get(edge.id), dotted: edge.dotted, reason: edge.reason, highlighted },
        zIndex: highlighted ? 2 : 1,
      };
    });
  }, [ready, layout, model, selectedId]);

  useEffect(() => {
    if (ready) requestAnimationFrame(() => flow.fitView({ padding: 0.08, maxZoom: 1.1 }));
  }, [ready, item.id, flow]);

  const docOfNode = node => node.data.doc || node.data.screen?.id || node.data.task?.spec || null;
  const onNodeClick = useCallback((event, node) => { const id = docOfNode(node); if (id) navigate({ sel: id, lin: undefined }); }, []);
  const onNodeDoubleClick = useCallback((event, node) => { const id = docOfNode(node); if (id) navigate({ sel: id, podglad: '1' }); }, []);

  return (
    <>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        minZoom={0.1} maxZoom={4} nodesConnectable={false} nodesDraggable={false} zoomOnDoubleClick={false} deleteKeyCode={null}
        onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={(event, node) => { const id = docOfNode(node); if (id) openNodeMenu(event, id); else event.preventDefault(); }}
        onPaneClick={() => { if (params.sel) navigate({ sel: undefined }); }}
        proOptions={{ hideAttribution: true }}
      />
      {!ready && !error && <div className="cv-note">Układanie diagramu…</div>}
      {error && <div className="cv-note" style={{ color: 'var(--t-error)' }}>Nie udało się ułożyć diagramu: {error}</div>}
      <ZoomBar zoom={zoom} />
    </>
  );
}

function hintFor(view, item) {
  if (view.id === 'nawigacja') return [
    item.fromDiagram ? 'Przejścia z diagramu nawigacji w dokumencie' : 'Dokument nie ma diagramu: ekrany z relacji groups, bez przejść',
    'Makieta: obraz o nazwie pliku ekranu lub sekcji (scr-001.png)',
  ];
  if (view.id === 'flow') return ['Kroki z tabeli „Opis przepływu”', 'Klik w aktywność albo kontrakt: inspektor, dwuklik: podgląd'];
  if (view.id === 'ucmap') return [item.fromDiagram ? 'Relacje z diagramu mapy; najedź na etykietę: uzasadnienie' : 'Dokument nie ma diagramu: scenariusze z relacji groups'];
  return [];
}

export default function WorkflowCanvas({ params }) {
  const workflows = useWorkflows();
  const view = viewOf(params.widok);
  const item = currentItem(workflows, params);
  const { docIndex } = useData();

  let body;
  if (!workflows) body = <div className="cv-note">Wczytywanie przepływów…</div>;
  else if (workflows.error) {
    body = (
      <div className="cv-note" style={{ color: 'var(--t-error)', textAlign: 'center', lineHeight: 1.6 }}>
        Serwer nie zwrócił przepływów: {workflows.error}<br />
        <span className="mu">Jeśli serwer działa od przed aktualizacji, uruchom <span className="m">npm run dev</span> ponownie.</span>
      </div>
    );
  }
  else if (!item) body = <div className="cv-note">Nie ma dokumentów {view.short} w folderze dokumentacji.</div>;
  else if (view.id === 'bpmn' && item.bpmnXml.path) {
    body = <Suspense fallback={<div className="cv-note">Wczytywanie diagramu BPMN…</div>}><BpmnDiagram key={item.id} process={item} selectedId={params.sel} /></Suspense>;
  } else if (view.id === 'bpmn' && item.bpmnImage.path) {
    body = <div className="wf-bpmn-image"><img src={fileUrl(item.bpmnImage.path)} alt={`Diagram ${item.title}`} /></div>;
  } else {
    body = <ReactFlowProvider key={`${view.id}:${item.id}`}><Diagram view={view} item={item} params={params} /></ReactFlowProvider>;
  }

  const doc = item ? docIndex.get(item.id) : null;
  return (
    <div className="cv flow-canvas wf-canvas">
      {body}
      <div className="vl"><b>Przepływ</b> · {view.name}{item && <> · <span className="m" style={{ color: layerText(doc?.layer) }}>{item.id}</span> {item.title}</>}</div>
      {view.id === 'bpmn' && item && !item.bpmnXml.path && (
        <div className="banner wf-banner" role="note">
          {item.bpmnImage.path ? 'Eksport diagramu z pliku; ' : 'Uproszczenie bez pliku BPMN XML: '}
          {!item.bpmnImage.path && 'zadania w kolejności z tabeli „Zadania procesu”, linie to zmienne procesowe przekazywane między krokami. Bramki opisuje panel po lewej. '}
          {item.bpmnXml.reference ? <>Diagram BPMN pojawi się, gdy będzie plik <span className="m">{item.bpmnXml.reference}</span>.</> : 'Dokument nie podaje pliku BPMN XML.'}
        </div>
      )}
      {item && <div className="hint">{hintFor(view, item).map(text => <span key={text}>{text}</span>)}</div>}
    </div>
  );
}
