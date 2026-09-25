import { memo, useCallback, useEffect, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useData } from '../state/data';
import { navigate } from '../state/route';
import { ZoomBar } from '../map/MapCanvas';
import { ownersOf } from './model';
import { openNodeMenu } from '../components/NodeMenu';

// Graf katalogu: kolumny grup (procesy, foldery shared), w nich prostokąty
// właścicieli (na przykład CAP dla API), a w prostokątach dokumenty z liczbą
// użyć. Przy grupowaniu według statusu albo typu kolumną jest status albo typ.

const BOX_WIDTH = 320;
const ITEM_HEIGHT = 44;
const ITEM_GAP = 6;
const BOX_HEADER = 34;
const COLUMN_GAP = 48;
const BOX_GAP = 16;
const KIND_ORDER = { process: 0, shared: 1, other: 2 };
const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const CatalogItem = memo(({ data, selected }) => {
  const { doc, uses, issues, labels, colorBy } = data;
  const dot = colorBy === 'status' ? (doc.status === 'active' ? 'var(--t-ok)' : 'var(--t-muted)') : `var(--l-${doc.layer})`;
  return (
    <div className={`node ${selected ? 'is-selected' : ''}`} style={{ borderStyle: uses ? 'solid' : 'dashed' }} title={`${doc.id} · ${doc.title}`}>
      <div className="node-head">
        <span className="dot" style={{ background: dot }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nid" style={{ color: `var(--l-${doc.layer}-t)` }}>{doc.id}</div>
          {labels === 'id-tytul' && <div className="nt">{doc.title}</div>}
        </div>
        <span className="m" style={{ fontSize: 11, flex: 'none', color: uses ? 'var(--t-muted)' : 'var(--t-error)' }} title="Dokumenty, które go wskazują">{uses}</span>
      </div>
      {issues && <span className="mark" style={{ background: issues.errors ? 'var(--t-error)' : 'var(--t-scope)' }}>!</span>}
    </div>
  );
});

const CatalogBox = memo(({ data }) => (
  <div className="catalog-box">
    <div className="catalog-box-head">
      {data.layer && <span className="dot" style={{ background: `var(--l-${data.layer})`, flex: 'none' }} />}
      <span className="m" style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', flex: 'none', color: data.layer ? `var(--l-${data.layer}-t)` : undefined }}>{data.label}</span>
      {data.title && <span className="mu" title={data.title} style={{ fontSize: 11.5, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.title}</span>}
    </div>
  </div>
));

const ColumnLabel = memo(({ data }) => (
  <div className="lbl" style={{ whiteSpace: 'nowrap' }}>
    <span className="m" style={{ letterSpacing: 0, color: data.layer ? `var(--l-${data.layer}-t)` : undefined }}>{data.key}</span>{data.title ? ` · ${data.title}` : ''}
  </div>
));

const nodeTypes = { catalogItem: CatalogItem, catalogBox: CatalogBox, columnLabel: ColumnLabel };

const STATUS_ORDER = ['draft', 'review', 'active', 'deprecated'];

function buildLayout(graph, rows, grouping, docIndex) {
  const groupInfo = new Map(graph.groups.map(group => [group.id, group]));
  const typeOrder = graph.layers.flatMap(layer => layer.types.map(type => [type, layer.id]));
  const typeLayer = new Map(typeOrder);
  const typeRank = new Map(typeOrder.map(([type], index) => [type, index]));
  const boxes = new Map();
  const addTo = (boxKey, box, row) => {
    if (!boxes.has(boxKey)) boxes.set(boxKey, { ...box, items: [] });
    boxes.get(boxKey).items.push(row);
  };
  // Status i typ to tablica jak w kanbanie: jedna kolumna na status albo
  // na typ dokumentu, bez osobnego nagłówka kolumny (nagłówkiem jest prostokąt).
  const board = grouping === 'status' || grouping === 'typ';
  for (const row of rows) {
    const { doc } = row;
    if (grouping === 'status') { const status = doc.status || 'bez statusu'; addTo(`s:${status}`, { column: `s:${status}`, label: status }, row); continue; }
    if (grouping === 'typ') { addTo(`t:${doc.type}`, { column: `t:${doc.type}`, label: doc.type, layer: typeLayer.get(doc.type) }, row); continue; }
    const owners = grouping === 'wlasciciel' ? ownersOf(doc, graph) : [];
    if (!owners.length) {
      addTo(`g:${doc.group}`, { column: doc.group, label: grouping === 'wlasciciel' ? 'bez właściciela' : doc.group, title: grouping === 'wlasciciel' ? null : groupInfo.get(doc.group)?.title }, row);
      continue;
    }
    for (const owner of owners) {
      const ownerDoc = docIndex.get(owner);
      addTo(`o:${owner}`, { column: ownerDoc?.group || doc.group, label: owner, title: ownerDoc?.title, layer: ownerDoc?.layer }, row);
    }
  }

  const columns = new Map();
  for (const [key, box] of boxes) {
    if (!columns.has(box.column)) columns.set(box.column, []);
    columns.get(box.column).push([key, box]);
  }
  const rank = column => {
    if (column.startsWith('s:')) { const i = STATUS_ORDER.indexOf(column.slice(2)); return i < 0 ? 99 : i; }
    if (column.startsWith('t:')) return typeRank.get(column.slice(2)) ?? 999;
    return KIND_ORDER[groupInfo.get(column)?.kind] ?? 9;
  };
  const orderedColumns = [...columns].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));

  const nodes = [];
  orderedColumns.forEach(([column, columnBoxes], index) => {
    const x = index * (BOX_WIDTH + COLUMN_GAP);
    const info = groupInfo.get(column);
    if (!board) nodes.push({ id: `col:${column}`, type: 'columnLabel', position: { x, y: 0 }, data: { key: column, title: info?.title, layer: docIndex.get(column)?.layer }, draggable: false, selectable: false });
    for (const [, box] of columnBoxes) if (board) box.title = `${box.items.length}`;
    let y = board ? 0 : 26;
    for (const [key, box] of columnBoxes.sort((a, b) => a[1].label.localeCompare(b[1].label, 'pl', { numeric: true }))) {
      const height = BOX_HEADER + box.items.length * (ITEM_HEIGHT + ITEM_GAP) + 4;
      nodes.push({ id: `box:${key}`, type: 'catalogBox', position: { x, y }, data: box, style: { width: BOX_WIDTH, height }, width: BOX_WIDTH, height, draggable: false, selectable: false, zIndex: -1 });
      box.items.sort((a, b) => a.doc.id.localeCompare(b.doc.id, 'pl', { numeric: true })).forEach((row, i) => {
        nodes.push({
          id: `${key}::${row.doc.id}`, type: 'catalogItem', parentId: `box:${key}`,
          position: { x: 10, y: BOX_HEADER + i * (ITEM_HEIGHT + ITEM_GAP) },
          style: { width: BOX_WIDTH - 20, height: ITEM_HEIGHT }, width: BOX_WIDTH - 20, height: ITEM_HEIGHT,
          data: { doc: row.doc, uses: row.users.length }, draggable: false,
        });
      });
      y += height + BOX_GAP;
    }
  });
  return nodes;
}

function Graph({ rows, params }) {
  const { graph, docIndex, validation } = useData();
  const flow = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  // `brak` to dawna nazwa grupowania według typu.
  const grouping = params.kgrupuj === 'brak' ? 'typ' : params.kgrupuj || 'wlasciciel';
  const labels = params.etykiety || 'id-tytul';
  const colorBy = params.koloruj || 'warstwa';

  // Znaczniki walidacji jak na Mapie (parametr bez_znacznikow).
  const hiddenMarks = params.bez_znacznikow || '';
  const issues = useMemo(() => {
    const byDoc = new Map();
    const hidden = new Set(hiddenMarks.split(',').filter(Boolean));
    for (const finding of validation?.findings || []) {
      if (!finding.docId || hidden.has(finding.severity === 'error' ? 'bledy' : 'ostrzezenia')) continue;
      const entry = byDoc.get(finding.docId) || { errors: 0, warnings: 0 };
      if (finding.severity === 'error') entry.errors++; else entry.warnings++;
      byDoc.set(finding.docId, entry);
    }
    return byDoc;
  }, [validation, hiddenMarks]);

  const layout = useMemo(() => buildLayout(graph, rows, grouping, docIndex), [graph, rows, grouping, docIndex]);
  const nodes = useMemo(() => layout.map(node => (node.type === 'catalogItem'
    ? { ...node, selected: node.data.doc.id === params.sel, data: { ...node.data, labels, colorBy, issues: issues.get(node.data.doc.id) } }
    : node)), [layout, params.sel, labels, colorBy, issues]);

  const layoutKey = useMemo(() => layout.map(node => node.id).join('|'), [layout]);
  useEffect(() => {
    requestAnimationFrame(() => flow.fitView({ padding: 0.08, maxZoom: 1.1 }));
  }, [layoutKey, flow]);

  const onNodeClick = useCallback((event, node) => {
    if (node.type === 'catalogItem' && node.data.doc.id !== params.sel) navigate({ sel: node.data.doc.id, panel: undefined });
  }, [params.sel]);

  useEffect(() => {
    const onKeyDown = event => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('.pal, .preview-modal, .node-menu')) return;
      if (event.key === 'f' || event.key === 'F') {
        const target = flow.getNodes().filter(node => node.type === 'catalogItem' && node.data.doc.id === params.sel);
        flow.fitView({ nodes: target.length ? target : undefined, padding: 0.2, duration: 250, maxZoom: target.length ? 1.5 : 1.1 });
      } else if (event.key === '0') flow.zoomTo(1, { duration: 150 });
      else if (event.key === '+' || event.key === '=') flow.zoomIn({ duration: 150 });
      else if (event.key === '-') flow.zoomOut({ duration: 150 });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flow, params.sel]);

  return (
    <div className={`catalog-graph ${zoom < 0.5 ? 'zoom-mid' : ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={4}
        onNodeClick={onNodeClick}
        onNodeContextMenu={(event, node) => { if (node.type === 'catalogItem') openNodeMenu(event, node.data.doc.id); else event.preventDefault(); }}
        onPaneClick={() => { if (params.sel) navigate({ sel: undefined }); }}
        nodesConnectable={false}
        nodesDraggable={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        onSelectionEnd={() => {
          const selected = flow.getNodes().filter(node => node.selected && node.type === 'catalogItem');
          if (selected.length) flow.fitView({ nodes: selected, padding: 0.15, duration: 300 });
        }}
        proOptions={{ hideAttribution: true }}
      />
      <div className="hint"><span>Liczba po prawej: dokumenty wskazujące</span><span>Przerywana obwódka: bez użyć</span></div>
      <ZoomBar zoom={zoom} />
    </div>
  );
}

export default function CatalogGraph(props) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
