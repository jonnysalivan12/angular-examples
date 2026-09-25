// Model widoku Przepływ. Linie między zdolnościami liczy serwer (/api/flow);
// ten plik układa zdolności w kolumnach procesów i buduje poziom kontraktów
// jednej zdolności.

export const LINE_KINDS = [
  { id: 'event', name: 'Zdarzenia' },
  { id: 'call', name: 'Wywołania' },
  { id: 'ambiguous', name: 'Niejednoznaczne' },
];

export const lineId = line => `${line.kind}|${line.from}|${line.to}`;

// Zdolności dokumentu: CAP sam dla siebie, SPEC-WF przez swój BPMN, SCR
// i SCRSEC przez dokumenty, które je zawierają, reszta przez wpis realizes
// CAP (tak samo liczy serwer).
export function capResolver(graph) {
  const realizes = new Map();
  const containers = new Map();
  for (const edge of graph.edges) {
    if (edge.relation === 'realizes' && edge.targetType === 'CAP') {
      if (!realizes.has(edge.source)) realizes.set(edge.source, []);
      realizes.get(edge.source).push(edge.target);
    }
    if (edge.relation === 'contains' && edge.source !== edge.target) {
      if (!containers.has(edge.target)) containers.set(edge.target, []);
      containers.get(edge.target).push({ id: edge.source, type: edge.sourceType });
    }
  }
  const types = new Map(graph.documents.map(doc => [doc.id, doc.type]));
  const cache = new Map();
  return function capsOf(id) {
    if (cache.has(id)) return cache.get(id);
    cache.set(id, []);
    const type = types.get(id);
    let caps;
    if (type === 'CAP') caps = [id];
    else if (type === 'SPEC-WF') caps = (containers.get(id) || []).filter(c => c.type === 'BPMN').flatMap(c => capsOf(c.id));
    else if (type === 'SCR' || type === 'SCRSEC') caps = (containers.get(id) || []).flatMap(c => capsOf(c.id));
    else caps = realizes.get(id) || [];
    caps = [...new Set(caps)];
    cache.set(id, caps);
    return caps;
  };
}

const CARD_WIDTH = 240;
const COLUMN_GAP = 110;
const CARD_GAP = 60;
const CHIPS_PER_ROW = 3;

// Poziom CAP: kolumny procesów, w nich zdolności z kontraktami.
export function capLevel(flow, graph, { hiddenProcesses, hiddenKinds }) {
  const groupInfo = new Map(graph.groups.map(group => [group.id, group]));
  const caps = flow.caps.filter(cap => !hiddenProcesses.has(cap.group));
  const visible = new Set(caps.map(cap => cap.id));
  const columns = [...new Set(caps.map(cap => cap.group))].sort();
  const nodes = [];
  columns.forEach((group, column) => {
    const x = column * (CARD_WIDTH + COLUMN_GAP);
    nodes.push({ id: `head:${group}`, type: 'processHead', position: { x, y: 0 }, data: { group, title: groupInfo.get(group)?.title }, draggable: false, selectable: false });
    let y = 34;
    for (const cap of caps.filter(item => item.group === group).sort((a, b) => a.id.localeCompare(b.id, 'pl', { numeric: true }))) {
      const height = 62 + Math.ceil(Math.max(cap.contracts.length, 1) / CHIPS_PER_ROW) * 24;
      nodes.push({ id: cap.id, type: 'capCard', position: { x, y }, width: CARD_WIDTH, height, style: { width: CARD_WIDTH, height }, data: { cap } });
      y += height + CARD_GAP;
    }
  });
  const lines = flow.lines.filter(line => visible.has(line.from) && visible.has(line.to) && !hiddenKinds.has(line.kind));
  return { nodes, lines, capCount: caps.length };
}

const DOC_WIDTH = 200;
const DOC_HEIGHT = 44;
const FRAME_PADDING = 12;
const FRAME_HEADER = 30;
const DOC_GAP = 8;
const FRAME_GAP = 26;
const LEVEL_GAP = 150;

// Poziom kontraktów jednej zdolności:
//   lewa kolumna    dokumenty, które korzystają z jej kontraktów (w ramkach swoich zdolności),
//   środek          kontrakty zdolności,
//   prawa kolumna   to, z czego korzystają kontrakty (INT innych zdolności),
//                   i zdolności, które odbierają jej zdarzenia.
export function contractLevel(flow, graph, capId) {
  const capsOf = capResolver(graph);
  const docIndex = new Map(graph.documents.map(doc => [doc.id, doc]));
  const cap = flow.caps.find(item => item.id === capId);
  if (!cap) return null;
  const contracts = new Set(cap.contracts.map(contract => contract.id));
  const left = new Map();
  const right = new Map();
  const edges = [];
  const place = (column, id) => {
    const caps = capsOf(id);
    const frame = caps.length === 1 ? caps[0] : caps.length ? 'kilka zdolności' : 'bez zdolności';
    if (!column.has(frame)) column.set(frame, new Set());
    column.get(frame).add(id);
  };

  for (const edge of graph.edges) {
    if (!edge.exists || edge.relation !== 'consumes') continue;
    if (contracts.has(edge.target) && !contracts.has(edge.source)) {
      if (edge.sourceType === 'CAP') place(right, edge.source); else place(left, edge.source);
      edges.push({ source: edge.source, target: edge.target, relation: edge.relation });
    }
    if (contracts.has(edge.source) && ['INT', 'API', 'QUE'].includes(edge.targetType) && !contracts.has(edge.target)) {
      place(right, edge.target);
      edges.push({ source: edge.source, target: edge.target, relation: edge.relation });
    }
    if (contracts.has(edge.source) && contracts.has(edge.target)) edges.push({ source: edge.source, target: edge.target, relation: edge.relation });
  }

  // Węzeł może być na płótnie tylko raz: kolumna lewa ma pierwszeństwo.
  const placedLeft = new Set([...left.values()].flatMap(set => [...set]));
  for (const set of right.values()) for (const id of [...set]) if (placedLeft.has(id)) set.delete(id);
  for (const [key, set] of [...right]) if (!set.size) right.delete(key);

  const nodes = [];
  const payload = id => graph.edges.filter(edge => edge.source === id && edge.relation === 'consumes' && edge.targetType === 'ENT').map(edge => edge.target);
  const addFrame = (key, ids, x, y, focus) => {
    const list = [...ids].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
    const height = FRAME_HEADER + FRAME_PADDING + list.length * (DOC_HEIGHT + DOC_GAP);
    const width = DOC_WIDTH + FRAME_PADDING * 2;
    const frameId = `frame:${x}:${key}`;
    const capDoc = docIndex.get(key);
    nodes.push({ id: frameId, type: 'capFrame', position: { x, y }, width, height, style: { width, height }, draggable: false, selectable: false, zIndex: -1, data: { key, title: capDoc?.title, focus, layer: capDoc?.layer } });
    list.forEach((id, index) => {
      const doc = docIndex.get(id);
      nodes.push({
        id, type: 'flowDoc', parentId: frameId, position: { x: FRAME_PADDING, y: FRAME_HEADER + index * (DOC_HEIGHT + DOC_GAP) },
        width: DOC_WIDTH, height: DOC_HEIGHT, style: { width: DOC_WIDTH, height: DOC_HEIGHT }, draggable: false,
        data: { doc, entities: ['API', 'INT', 'QUE'].includes(doc?.type) ? payload(id) : [] },
      });
    });
    return height;
  };
  const stack = (column, x) => {
    let y = 0;
    for (const [key, ids] of [...column].sort((a, b) => a[0].localeCompare(b[0], 'pl', { numeric: true }))) {
      y += addFrame(key, ids, x, y, false) + FRAME_GAP;
    }
    return y;
  };
  const columnWidth = DOC_WIDTH + FRAME_PADDING * 2 + LEVEL_GAP;
  const leftHeight = stack(left, 0);
  const rightHeight = stack(right, columnWidth * 2);
  const centerHeight = FRAME_HEADER + FRAME_PADDING + contracts.size * (DOC_HEIGHT + DOC_GAP);
  addFrame(cap.id, contracts, columnWidth, Math.max(0, (Math.max(leftHeight, rightHeight) - centerHeight) / 2), true);

  const unique = new Map(edges.map(edge => [`${edge.source}>${edge.relation}>${edge.target}`, edge]));
  return { nodes, edges: [...unique.values()], cap, callers: [...left.values()].reduce((n, set) => n + set.size, 0) };
}
