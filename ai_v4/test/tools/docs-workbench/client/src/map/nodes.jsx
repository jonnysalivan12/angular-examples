import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getBezierPath, getStraightPath, useInternalNode } from '@xyflow/react';
import { LAYER_ORDER } from './model';

// Węzły i linie Mapy w wariancie 1g z projektu: kropka i ID kolorem warstwy.

const hiddenHandles = (
  <>
    <Handle type="target" position={Position.Top} isConnectable={false} className="rf-handle" />
    <Handle type="source" position={Position.Bottom} isConnectable={false} className="rf-handle" />
  </>
);

// Znacznik problemów walidacji na rogu węzła.
function Marks({ issues }) {
  if (!issues) return null;
  if (issues.errors) return <span className="mark" style={{ background: 'var(--t-error)' }} title={`${issues.errors} błędów walidacji`}>!</span>;
  if (issues.warnings) return <span className="mark" style={{ background: 'var(--t-scope)' }} title={`${issues.warnings} ostrzeżeń walidacji`}>!</span>;
  return null;
}

const statusDot = status => (status === 'active' ? 'var(--t-ok)' : 'var(--t-muted)');

export const DocNode = memo(({ data, selected }) => {
  const { doc, rows, labels, colorBy, issues, focus } = data;
  const dot = colorBy === 'status' ? statusDot(doc.status) : `var(--l-${doc.layer})`;
  return (
    <div className={`node ${selected ? 'is-selected' : ''} ${focus ? `is-${focus}` : ''}`} title={labels === 'najechanie' ? `${doc.id} · ${doc.title}` : doc.title}>
      {hiddenHandles}
      <div className="node-head">
        <span className="dot" style={{ background: dot }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nid" style={{ color: `var(--l-${doc.layer}-t)` }}>{doc.id}</div>
          {labels === 'id-tytul' && <div className="nt">{doc.title}</div>}
        </div>
      </div>
      {rows && rows.length > 0 && (
        <div className="node-rows">
          {rows.map(row => <div key={row.id} className="m">{row.id.slice(doc.id.length + 1)}</div>)}
        </div>
      )}
      <Marks issues={issues} />
    </div>
  );
});

export const GroupNode = memo(({ data, selected }) => {
  const { key, title, count, layers, issues, folder, byLayer, focus } = data;
  const total = count || 1;
  // Grupa warstwy nie pokazuje klucza warstwy (scr, data): nazwa wystarcza.
  return (
    <div className={`grp-node ${selected ? 'is-selected' : ''} ${focus ? `is-${focus}` : ''}`}>
      {hiddenHandles}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        {byLayer ? <span className="grp-title">{title}</span> : <span className="m grp-id">{key}</span>}
        <span className="m mu" style={{ fontSize: 11 }}>{count}</span>
      </div>
      {!byLayer && <div className="grp-title">{title || (folder ? 'folder' : '')}</div>}
      <div className="bar">
        {LAYER_ORDER.filter(layer => layers[layer]).map(layer => (
          <span key={layer} style={{ flex: layers[layer] / total, background: `var(--l-${layer})` }} />
        ))}
      </div>
      <Marks issues={issues} />
    </div>
  );
});

export const FrameNode = memo(({ data, selected }) => {
  const { key, title, count, columnHeads, groupLayer, fixed, byLayer } = data;
  return (
    <div className={`frame-node ${selected ? 'is-selected' : ''}`}>
      {hiddenHandles}
      <div className="frame-head">
        {!byLayer && <span className="m" style={{ fontWeight: 500, color: groupLayer ? `var(--l-${groupLayer}-t)` : undefined }}>{key}</span>}
        {title && <span className="frame-title" title={title}>{title}</span>}
        <span className="m mu" style={{ fontSize: 11 }}>{count}</span>
        {!fixed && <span className="mu" style={{ fontSize: 11 }}>· dwuklik zwija</span>}
      </div>
      {columnHeads.map((head, index) => <div key={`${index}:${head.label}`} className={`frame-col ${head.sub ? 'is-sub' : ''}`} style={{ left: head.x }}>{head.label}</div>)}
    </div>
  );
});

// Nowa kopia węzłów płótna po zmianie modelu. Węzeł bez podanego rozmiaru
// bierze zmierzony rozmiar ze starej kopii, bo bez niego React Flow uznaje
// węzeł za niezainicjowany (błąd 015 przy przeciąganiu), a linie od brzegu
// karty znikają. Węzeł przeciągany w tej chwili zostaje tam, gdzie jest
// (najechanie zmienia fokus w trakcie przeciągania).
export function keepMeasured(current, computed) {
  const byId = new Map(current.map(node => [node.id, node]));
  return computed.map(node => {
    const previous = byId.get(node.id);
    if (!previous) return node;
    const measured = node.measured || previous.measured;
    return previous.dragging
      ? { ...node, measured, position: previous.position, dragging: true }
      : measured ? { ...node, measured } : node;
  });
}

// Punkt na brzegu prostokąta węzła na linii do punktu (tx, ty).
export function borderPoint(node, tx, ty) {
  const { x, y } = node.internals.positionAbsolute;
  const w = node.measured.width;
  const h = node.measured.height;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

// Ścieżka łamana z zaokrąglonymi narożnikami przez punkty trasy z ELK.
export function roundedPath(points, radius = 6) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [prev, current, next] = [points[i - 1], points[i], points[i + 1]];
    const inLength = Math.hypot(current.x - prev.x, current.y - prev.y);
    const outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (!r) { path += ` L ${current.x} ${current.y}`; continue; }
    const before = { x: current.x - ((current.x - prev.x) / inLength) * r, y: current.y - ((current.y - prev.y) / inLength) * r };
    const after = { x: current.x + ((next.x - current.x) / outLength) * r, y: current.y + ((next.y - current.y) / outLength) * r };
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

// Środek najdłuższego odcinka trasy: tam stoi etykieta.
function labelPoint(points) {
  let best = { length: -1, x: points[0].x, y: points[0].y };
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (length > best.length) best = { length, x: (points[i].x + points[i - 1].x) / 2, y: (points[i].y + points[i - 1].y) / 2 };
  }
  return best;
}

// Punkty połączeń karty dokumentu i grupy: trzy na górnym i dolnym brzegu,
// po jednym na lewym i prawym. Linia kończy się w punkcie, a punkt jest
// widoczny tylko na końcu linii. Ramka nie ma punktów: jej wiązki mają port z układu.
const ANCHORS = [
  ['top', 0.2, 0], ['top', 0.5, 0], ['top', 0.8, 0],
  ['bottom', 0.2, 1], ['bottom', 0.5, 1], ['bottom', 0.8, 1],
  ['left', 0, 0.5], ['right', 1, 0.5],
];
const NORMAL = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const ANCHOR_RADIUS = 3.5;
const hasAnchors = node => node.type === 'doc' || node.type === 'group';

function boxOf(node) {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured.width, h: node.measured.height };
}

function anchorsOf(node) {
  const box = boxOf(node);
  return ANCHORS.map(([side, fx, fy]) => ({ side, x: box.x + fx * box.w, y: box.y + fy * box.h }));
}

// Punkt na brzegu ramki w stronę punktu, z brzegiem, na którym leży.
function frameEnd(node, tx, ty) {
  const box = boxOf(node);
  const point = borderPoint(node, tx, ty);
  const side = Math.abs(point.y - box.y) < 1 ? 'top' : Math.abs(point.y - box.y - box.h) < 1 ? 'bottom' : Math.abs(point.x - box.x) < 1 ? 'left' : 'right';
  return [{ ...point, side }];
}

// Para punktów do linii bez trasy: najkrótsza, a punkt skierowany od drugiego
// węzła (np. górny, gdy drugi węzeł leży niżej) dostaje karę. Węzeł bez
// punktów (anchored zwraca false) daje punkt na brzegu w stronę drugiego.
function anchorPair(sourceNode, targetNode, anchored = hasAnchors) {
  const center = node => { const box = boxOf(node); return { x: box.x + box.w / 2, y: box.y + box.h / 2 }; };
  const sc = center(sourceNode);
  const tc = center(targetNode);
  const sources = anchored(sourceNode) ? anchorsOf(sourceNode) : frameEnd(sourceNode, tc.x, tc.y);
  const targets = anchored(targetNode) ? anchorsOf(targetNode) : frameEnd(targetNode, sc.x, sc.y);
  let best = null;
  for (const s of sources) for (const t of targets) {
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const distance = Math.hypot(dx, dy);
    const away = (NORMAL[s.side].x * dx + NORMAL[s.side].y * dy < 0 ? 1 : 0) + (NORMAL[t.side].x * -dx + NORMAL[t.side].y * -dy < 0 ? 1 : 0);
    const cost = distance + away * 400;
    if (!best || cost < best.cost) best = { cost, s, t };
  }
  return best;
}

// Koniec trasy z układu przesunięty do najbliższego punktu na tym samym brzegu.
// Ostatni odcinek zostaje prostopadły do brzegu; gdy trasa ma tylko dwa
// punkty albo ostatni odcinek nie jest prostopadły, dochodzi załamanie.
function snapRouteEnd(points, node) {
  const box = boxOf(node);
  const end = points[points.length - 1];
  const side = Math.abs(end.y - box.y) < 2 ? 'top' : Math.abs(end.y - box.y - box.h) < 2 ? 'bottom'
    : Math.abs(end.x - box.x) < 2 ? 'left' : Math.abs(end.x - box.x - box.w) < 2 ? 'right' : null;
  if (!side) return { points, side: null };
  const anchor = anchorsOf(node).filter(a => a.side === side)
    .reduce((best, a) => (Math.hypot(a.x - end.x, a.y - end.y) < Math.hypot(best.x - end.x, best.y - end.y) ? a : best));
  const before = points[points.length - 2];
  const vertical = side === 'top' || side === 'bottom';
  const head = points.slice(0, -2);
  if (vertical) {
    if (points.length >= 3 && Math.abs(before.x - end.x) < 0.5) return { points: [...head, { x: anchor.x, y: before.y }, { x: anchor.x, y: anchor.y }], side };
    const middle = (before.y + anchor.y) / 2;
    return { points: [...head, before, { x: before.x, y: middle }, { x: anchor.x, y: middle }, { x: anchor.x, y: anchor.y }], side };
  }
  if (points.length >= 3 && Math.abs(before.y - end.y) < 0.5) return { points: [...head, { x: before.x, y: anchor.y }, { x: anchor.x, y: anchor.y }], side };
  const middle = (before.x + anchor.x) / 2;
  return { points: [...head, before, { x: middle, y: before.y }, { x: middle, y: anchor.y }, { x: anchor.x, y: anchor.y }], side };
}

// Koniec linii odsunięty o promień punktu, żeby grot strzałki dotykał punktu, a nie ginął pod nim.
const pullBack = (point, side) => ({ x: point.x + NORMAL[side].x * ANCHOR_RADIUS, y: point.y + NORMAL[side].y * ANCHOR_RADIUS });

const POSITION = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right };

// Karty jedna nad drugą (w jednej kolumnie): prostokąty zachodzą na siebie w poziomie.
function stacked(sourceNode, targetNode) {
  const a = boxOf(sourceNode);
  const b = boxOf(targetNode);
  const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  return overlap > Math.min(a.w, b.w) / 2 && (a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// Linia bez trasy między kartami: ścieżka, miejsce etykiety i punkty na końcach.
// Karty w jednej kolumnie łączy łuk z lewego boku do lewego boku, wygięty
// w lewo tym mocniej, im dalej leżą karty, żeby linia nie szła przez karty
// pomiędzy. Pozostałe: łuk (albo prosta, straight) między najbliższą parą punktów.
export function anchoredLine(sourceNode, targetNode, { markerStart, markerEnd, straight = false, anchored = () => true, curvature } = {}) {
  if (!straight && anchored(sourceNode) && anchored(targetNode) && stacked(sourceNode, targetNode)) {
    const s = { ...anchorsOf(sourceNode).find(a => a.side === 'left') };
    const t = { ...anchorsOf(targetNode).find(a => a.side === 'left') };
    const from = markerStart ? pullBack(s, 'left') : s;
    const to = markerEnd ? pullBack(t, 'left') : t;
    // Wygięcie mieści się w odstępie między kolumnami ramki (48–64 px).
    const bend = Math.min(14 + Math.abs(t.y - s.y) * 0.05, 36);
    const path = `M ${from.x} ${from.y} C ${from.x - bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
    return { path, labelX: Math.min(from.x, to.x) - bend * 0.75, labelY: (from.y + to.y) / 2, dots: [s, t] };
  }
  const { s, t } = anchorPair(sourceNode, targetNode, anchored);
  const from = anchored(sourceNode) && markerStart ? pullBack(s, s.side) : s;
  const to = anchored(targetNode) && markerEnd ? pullBack(t, t.side) : t;
  const [path, labelX, labelY] = straight
    ? getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y })
    : getBezierPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y, sourcePosition: POSITION[s.side], targetPosition: POSITION[t.side], curvature });
  return { path, labelX, labelY, dots: [anchored(sourceNode) && s, anchored(targetNode) && t].filter(Boolean) };
}

// Punkty połączenia na końcach linii, w warstwie etykiet (nad kartami).
export function AnchorDots({ dots, className = '', style }) {
  return dots.map((dot, i) => (
    <div key={i} className={`edge-anchor ${className}`} style={{ ...style, transform: `translate(-50%, -50%) translate(${dot.x}px, ${dot.y}px)` }} />
  ));
}

const moved = (node, expected) => !expected || Math.abs(node.internals.positionAbsolute.x - expected.x) > 0.5 || Math.abs(node.internals.positionAbsolute.y - expected.y) > 0.5;

// Linia Mapy. Z trasą z układu warstwowego rysuje łamaną wokół kart. Gdy
// trasy nie ma (układ siłowy albo kołowy) albo węzeł przeciągnięto, linia
// biegnie od brzegu do brzegu: prosto między grupami, łukiem między dokumentami.
export const FloatingEdge = memo(({ id, source, target, data, markerEnd, markerStart }) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const { highlighted, group, bundle, count, label, width, points, expected, dim, showCount } = data;
  if (!sourceNode || !targetNode) return null;

  let path;
  let labelX;
  let labelY;
  const sourceMoved = points && moved(sourceNode, expected?.source);
  const targetMoved = points && moved(targetNode, expected?.target);
  const routed = points && !sourceMoved && !targetMoved;
  // Wiązka bez trasy (przeciągnięta ramka) nie ma strzałek.
  if (bundle && !routed) {
    markerEnd = undefined;
    markerStart = undefined;
  }
  if (!sourceNode.measured?.width || !targetNode.measured?.width) return null;
  // Punkty połączeń na końcach linii (tylko karty dokumentów i grup).
  const dots = [];
  if (routed) {
    let route = points;
    let sourceSide = null;
    let targetSide = null;
    if (hasAnchors(targetNode)) ({ points: route, side: targetSide } = snapRouteEnd(route, targetNode));
    if (hasAnchors(sourceNode)) {
      const snapped = snapRouteEnd([...route].reverse(), sourceNode);
      route = snapped.points.reverse();
      sourceSide = snapped.side;
    }
    if (sourceSide) dots.push(route[0]);
    if (targetSide) dots.push(route[route.length - 1]);
    const drawn = [...route];
    if (sourceSide && markerStart) drawn[0] = pullBack(drawn[0], sourceSide);
    if (targetSide && markerEnd) drawn[drawn.length - 1] = pullBack(drawn[drawn.length - 1], targetSide);
    path = roundedPath(drawn);
    ({ x: labelX, y: labelY } = labelPoint(route));
  } else {
    const line = anchoredLine(sourceNode, targetNode, { markerStart, markerEnd, straight: group, anchored: hasAnchors });
    ({ path, labelX, labelY } = line);
    dots.push(...line.dots);
  }
  // Etykieta: liczba relacji na wiązce i linii grupy, nazwa relacji na liniach
  // węzła w fokusie.
  const text = highlighted && label ? label : group || showCount ? String(count) : null;
  const opacity = dim ? 0.18 : highlighted ? 1 : group ? 0.85 : 0.5;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart}
        style={{ stroke: highlighted ? 'var(--color-accent)' : 'var(--t-edge)', strokeWidth: highlighted ? Math.max(1.6, width) : width, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', opacity }} />
      {(text && !dim) || dots.length ? (
        <EdgeLabelRenderer>
          <AnchorDots dots={dots} className={highlighted ? 'is-highlighted' : ''} style={{ opacity: dim ? 0.3 : 1 }} />
          {text && !dim && <div className={`edge-label ${highlighted ? 'is-highlighted' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{text}</div>}
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

export const nodeTypes = { doc: DocNode, group: GroupNode, frame: FrameNode };
export const edgeTypes = { floating: FloatingEdge };
