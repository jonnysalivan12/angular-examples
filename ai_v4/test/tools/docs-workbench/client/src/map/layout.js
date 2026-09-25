import ELK from 'elkjs/lib/elk.bundled.js';

// Układ Mapy liczony przez elkjs.
//
// Warstwowy (domyślny) ma dwie fazy:
//   1. każda rozwinięta ramka osobno: algorytm layered, kolumny wymuszone
//      partycjami (kolejność warstw z model.js), linie trasowane ortogonalnie
//      wokół kart; każda wiązka linii do węzła poza ramką ma jeden port na
//      brzegu ramki (EAST, gdy wpisy wychodzą z ramki, WEST, gdy przychodzą).
//      Port w tej fazie to mały węzeł w skrajnej partycji, a nie port ELK:
//      partycje razem z portami zewnętrznymi kończą się w elkjs wyjątkiem
//      „layer constraint set to LAST” (np. BFS-001 bez relacji contains),
//   2. węzły najwyższego poziomu: ramki o rozmiarze z fazy 1 z portami w stałych
//      miejscach, grupy i dokumenty bez grup; linie wiązek i grup trasowane
//      ortogonalnie.
// Wynik zawiera trasy linii w układzie współrzędnych płótna.
//
// Siłowy i kołowy układają tylko węzły najwyższego poziomu; dokumenty w ramce
// mają położenie z modelu, a linie rysują się od brzegu do brzegu.

const elk = new ELK();
// Powyżej tylu węzłów rozsuwanie par jest za drogie (O(n²)); układ stress
// i tak rzadko nakłada węzły przy tej liczbie.
const SEPARATE_LIMIT = 400;
const FRAME_PADDING = '[top=62,left=16,bottom=16,right=16]';

export async function layoutMap(model, { algorithm = 'warstwowy', density = 0.5, center = null } = {}) {
  if (algorithm === 'warstwowy') return layoutLayered(model, density);
  return { positions: await layoutTopLevel(model, { algorithm, density, center }), frames: new Map(), routes: new Map(), fans: new Map() };
}

const pointsOf = (edge, dx = 0, dy = 0) => {
  const section = edge.sections?.[0];
  if (!section) return null;
  return [section.startPoint, ...(section.bendPoints || []), section.endPoint].map(point => ({ x: point.x + dx, y: point.y + dy }));
};

export const portId = (frameId, bundle) => `port:${frameId}>${bundle.id}`;

async function layoutLayered(model, density) {
  const spacing = 0.5 + density;
  const byId = new Map(model.nodes.map(node => [node.id, node]));
  const frames = model.nodes.filter(node => node.kind === 'frame');
  const bundlesOf = new Map(frames.map(frame => [frame.id, []]));
  for (const bundle of model.bundles) {
    for (const end of [bundle.a, bundle.b]) if (bundlesOf.has(end)) bundlesOf.get(end).push(bundle);
  }
  const edgeById = new Map(model.edges.map(edge => [edge.id, edge]));

  // Faza 1: ramki.
  const frameLayouts = new Map();
  for (const frame of frames) {
    const members = model.nodes.filter(node => node.parentId === frame.id);
    // Partycje: 0 porty WEST, 1…n kolumny, n+1 porty EAST.
    const lastRank = Math.max(0, ...members.map(node => node.data.rank ?? 0));
    const portNodes = [];
    const edges = model.edges
      .filter(edge => edge.scope === 'inner' && edge.topSource === frame.id)
      .map(edge => ({ id: edge.id, sources: [edge.source], targets: [edge.target] }));
    const fanKeys = new Map();
    for (const bundle of bundlesOf.get(frame.id)) {
      const side = bundle.sides[frame.id];
      const port = portId(frame.id, bundle);
      portNodes.push({ id: port, side, width: 1, height: 1, layoutOptions: { 'elk.partitioning.partition': String(side === 'EAST' ? lastRank + 2 : 0) } });
      const docs = new Set(bundle.members.map(id => edgeById.get(id)).map(edge => (edge.topSource === frame.id ? edge.source : edge.target)));
      for (const doc of docs) {
        const id = `fan:${bundle.id}|${doc}`;
        fanKeys.set(id, { bundle: bundle.id, doc, side });
        edges.push(side === 'EAST' ? { id, sources: [doc], targets: [port] } : { id, sources: [port], targets: [doc] });
      }
    }
    const wrapped = await elk.layout({
      id: 'wrap',
      layoutOptions: { 'elk.algorithm': 'layered' },
      children: [{
        id: frame.id,
        layoutOptions: {
          'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
          'elk.partitioning.activate': 'true', 'elk.padding': FRAME_PADDING,
          // Bez tego dokument bez linii w ramce jest osobną składową, układaną
          // obok reszty, i jego kolumna trafia na to samo x co kolumna innej składowej.
          'elk.separateConnectedComponents': 'false',
          'elk.spacing.nodeNode': String(Math.round(12 * spacing)),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(40 * spacing)),
          'elk.spacing.edgeNode': '10', 'elk.spacing.edgeEdge': '5',
          'elk.layered.spacing.edgeNodeBetweenLayers': '12', 'elk.layered.spacing.edgeEdgeBetweenLayers': '5',
        },
        children: [
          ...members.map(node => ({ id: node.id, width: node.width, height: node.height, layoutOptions: { 'elk.partitioning.partition': String((node.data.rank ?? 0) + 1) } })),
          ...portNodes.map(({ side, ...node }) => node),
        ],
        edges,
      }],
    });
    // Port na brzegu ramki na wysokości swojego węzła. Ramka jest co najmniej
    // tak szeroka jak jej nagłówek; wachlarz do portu EAST wydłuża się do brzegu.
    const result = wrapped.children[0];
    result.width = Math.max(result.width, frame.data.headerWidth || 0);
    const placed = new Map(result.children.map(child => [child.id, child]));
    const ports = portNodes.map(({ id, side }) => {
      const node = placed.get(id);
      return { id, side, x: side === 'EAST' ? result.width : -1, y: node.y + node.height / 2 };
    });
    frameLayouts.set(frame.id, { result, ports, fanKeys, members });
  }

  // Faza 2: węzły najwyższego poziomu.
  const top = model.nodes.filter(node => !node.parentId);
  const rootEdges = [];
  for (const bundle of model.bundles) {
    const end = id => (byId.get(id)?.kind === 'frame' ? portId(id, bundle) : id);
    rootEdges.push({ id: bundle.id, sources: [end(bundle.source)], targets: [end(bundle.target)] });
  }
  for (const edge of model.edges) {
    if (edge.scope === 'top') rootEdges.push({ id: edge.id, sources: [edge.source], targets: [edge.target] });
  }
  const withoutGroups = model.grouping === 'brak';
  const root = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.partitioning.activate': withoutGroups ? 'true' : 'false',
      // Ramki i grupy: ten sam odstęp w warstwie i między warstwami, a położenie
      // w warstwie z NETWORK_SIMPLEX, który skraca linie i nie zostawia pustych
      // pasów (domyślny BRANDES_KOEPF wyrównywał węzły do portów i rozciągał
      // układ w pionie). Bez grup karty stoją gęściej, w kolumnach warstw.
      'elk.spacing.nodeNode': String(Math.round((withoutGroups ? 12 : 60) * spacing)),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round((withoutGroups ? 40 : 60) * spacing)),
      'elk.layered.nodePlacement.strategy': withoutGroups ? 'BRANDES_KOEPF' : 'NETWORK_SIMPLEX',
      'elk.spacing.edgeNode': '16', 'elk.spacing.edgeEdge': '8',
      'elk.layered.spacing.edgeNodeBetweenLayers': '20', 'elk.layered.spacing.edgeEdgeBetweenLayers': '8',
      'elk.separateConnectedComponents': 'true', 'elk.spacing.componentComponent': String(Math.round(60 * spacing)),
    },
    children: top.map(node => {
      const frame = frameLayouts.get(node.id);
      if (!frame) {
        const options = withoutGroups ? { 'elk.partitioning.partition': String(node.data.rank ?? 0) } : undefined;
        return { id: node.id, width: node.width, height: node.height, layoutOptions: options };
      }
      return {
        id: node.id, width: frame.result.width, height: frame.result.height,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ports: frame.ports.map(port => ({ id: port.id, x: port.x, y: port.y - 0.5, width: 1, height: 1 })),
      };
    }),
    edges: rootEdges,
  });

  const positions = new Map(root.children.map(child => [child.id, { x: child.x, y: child.y }]));
  const routes = new Map();
  const fans = new Map();
  const frameInfo = new Map();
  for (const edge of root.edges || []) {
    const points = pointsOf(edge);
    if (points) routes.set(edge.id, points);
  }
  for (const [frameId, { result, ports, fanKeys, members }] of frameLayouts) {
    const origin = positions.get(frameId);
    const memberIds = new Set(members.map(node => node.id));
    const children = new Map(result.children.filter(child => memberIds.has(child.id)).map(child => [child.id, { x: child.x, y: child.y }]));
    const portById = new Map(ports.map(port => [port.id, port]));
    for (const edge of result.edges || []) {
      const points = pointsOf(edge, origin.x, origin.y);
      if (!points) continue;
      if (fanKeys.has(edge.id)) {
        const fan = fanKeys.get(edge.id);
        // Wachlarz zawsze od dokumentu do portu; ostatni odcinek biegnie
        // poziomo od węzła portu do brzegu ramki.
        const toPort = fan.side === 'EAST' ? points : [...points].reverse();
        const port = portById.get(portId(frameId, { id: fan.bundle }));
        const end = toPort[toPort.length - 1];
        toPort[toPort.length - 1] = { x: end.x, y: origin.y + port.y };
        toPort.push({ x: origin.x + (port.side === 'EAST' ? result.width : 0), y: origin.y + port.y });
        fans.set(`${fan.bundle}|${fan.doc}`, toPort);
      } else {
        routes.set(edge.id, points);
      }
    }
    // Nagłówki kolumn: pierwsza warstwa każdej kolumny modelu.
    const columns = new Map();
    for (const node of members) {
      const child = children.get(node.id);
      const current = columns.get(node.data.rank);
      if (!current || child.x < current.x) columns.set(node.data.rank, { x: child.x, label: node.data.column?.label || '', sub: node.data.column?.sub });
    }
    frameInfo.set(frameId, {
      width: result.width, height: result.height, children,
      columnHeads: [...columns.entries()].sort((a, b) => a[0] - b[0]).map(([, head]) => head),
    });
  }
  return { positions, frames: frameInfo, routes, fans };
}

export async function layoutTopLevel(model, { algorithm = 'silowy', density = 0.5, center = null } = {}) {
  const top = model.nodes.filter(node => !node.parentId);
  const topOf = new Map();
  for (const node of model.nodes) topOf.set(node.id, node.parentId || node.id);
  // Kierunek pary węzłów najwyższego poziomu: większość wpisów relacji
  // (od dokumentu z wpisem do celu), więc układ warstwowy idzie za relacjami.
  const pairs = new Map();
  for (const edge of model.edges) {
    const a = topOf.get(edge.source);
    const b = topOf.get(edge.target);
    if (!a || !b || a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!pairs.has(key)) pairs.set(key, { a, b, forward: 0, backward: 0 });
    const pair = pairs.get(key);
    if (pair.a === a) pair.forward += edge.count; else pair.backward += edge.count;
  }
  const links = [...pairs.values()].map(pair => (pair.backward > pair.forward ? { a: pair.b, b: pair.a } : pair));
  const spacing = 30 + density * 110;

  if (algorithm === 'kolowy') return radial(top, links, center, spacing);

  const layered = algorithm === 'warstwowy';
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': layered ? 'layered' : 'stress',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.6),
      'elk.stress.desiredEdgeLength': String(120 + spacing * 2.5),
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': String(spacing),
    },
    children: top.map(node => ({ id: node.id, width: node.width, height: node.height })),
    edges: links.map(({ a, b }, index) => ({ id: `e${index}`, sources: [a], targets: [b] })),
  });
  const boxes = result.children.map(child => ({ id: child.id, x: child.x, y: child.y, width: child.width, height: child.height }));
  if (!layered && boxes.length <= SEPARATE_LIMIT) {
    separate(boxes, Math.max(16, spacing / 2));
    compact(boxes, Math.max(16, spacing / 2));
  }
  return new Map(boxes.map(box => [box.id, { x: box.x, y: box.y }]));
}

// Układ kołowy wokół zaznaczenia: węzeł środkowy, na pierwszym pierścieniu
// jego sąsiedzi, dalej kolejne kroki. Bez zaznaczenia środkiem jest węzeł
// z największą liczbą połączeń.
function radial(top, links, center, spacing) {
  const ids = new Set(top.map(node => node.id));
  const adjacent = new Map(top.map(node => [node.id, new Set()]));
  for (const { a, b } of links) {
    if (!ids.has(a) || !ids.has(b)) continue;
    adjacent.get(a).add(b);
    adjacent.get(b).add(a);
  }
  let root = center && ids.has(center) ? center : null;
  if (!root) root = [...adjacent].sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]))[0]?.[0];
  const ring = new Map([[root, 0]]);
  let frontier = [root];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) for (const other of adjacent.get(id)) {
      if (!ring.has(other)) { ring.set(other, ring.get(id) + 1); next.push(other); }
    }
    frontier = next;
  }
  const last = Math.max(0, ...ring.values());
  for (const node of top) if (!ring.has(node.id)) ring.set(node.id, last + 1);

  const size = new Map(top.map(node => [node.id, node]));
  const rings = new Map();
  for (const [id, level] of ring) rings.set(level, [...(rings.get(level) || []), id]);
  // Odległość od środka węzła do jego brzegu w kierunku kąta: prostokąt jest
  // szeroki albo wysoki, więc duża ramka nie odpycha małych kart o swoją szerokość.
  const reach = (node, angle) => Math.abs(Math.cos(angle)) * node.width / 2 + Math.abs(Math.sin(angle)) * node.height / 2;

  const positions = new Map();
  const angles = new Map();
  const rootNode = size.get(root);
  positions.set(root, { x: -rootNode.width / 2, y: -rootNode.height / 2 });
  angles.set(root, -Math.PI / 2);
  // Jak daleko od środka w kierunku kąta sięgają już ułożone węzły: promień
  // wychodzi z nich w punkcie, za którym jest wolne miejsce (metoda płyt).
  const occupiedAlong = angle => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let far = 0;
    for (const [id, point] of positions) {
      const node = size.get(id);
      const box = { x0: point.x - spacing / 2, y0: point.y - spacing / 2, x1: point.x + node.width + spacing / 2, y1: point.y + node.height + spacing / 2 };
      let enter = -Infinity;
      let exit = Infinity;
      for (const [d, lo, hi] of [[dx, box.x0, box.x1], [dy, box.y0, box.y1]]) {
        if (Math.abs(d) < 1e-9) { if (lo > 0 || hi < 0) { exit = -1; break; } continue; }
        const t1 = lo / d;
        const t2 = hi / d;
        enter = Math.max(enter, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
      }
      if (exit >= Math.max(enter, 0)) far = Math.max(far, exit);
    }
    return far;
  };
  for (const level of [...rings.keys()].filter(level => level > 0).sort((a, b) => a - b)) {
    // Kolejność na pierścieniu według kąta sąsiadów z wcześniejszych pierścieni,
    // żeby linie do środka się nie krzyżowały.
    const meanAngle = id => {
      const known = [...adjacent.get(id)].filter(other => angles.has(other)).map(other => angles.get(other));
      if (!known.length) return Infinity;
      return Math.atan2(known.reduce((s, a) => s + Math.sin(a), 0), known.reduce((s, a) => s + Math.cos(a), 0));
    };
    const members = rings.get(level).map(id => ({ id, target: meanAngle(id) }))
      .sort((a, b) => a.target - b.target || a.id.localeCompare(b.id)).map(item => item.id);
    // Każdy węzeł dostaje wycinek kąta proporcjonalny do swojego rozmiaru.
    const extent = id => (size.get(id).width + size.get(id).height) / 2 + spacing;
    const total = members.reduce((sum, id) => sum + extent(id), 0);
    const minimumRadius = total / (2 * Math.PI);
    const first = meanAngle(members[0]);
    let cursor = (Number.isFinite(first) ? first : -Math.PI / 2) - (Math.PI * extent(members[0])) / total;
    const placed = [];
    for (const id of members) {
      const node = size.get(id);
      const angle = cursor + (Math.PI * extent(id)) / total;
      cursor += (2 * Math.PI * extent(id)) / total;
      placed.push({ id, node, angle });
    }
    // Promień liczony względem wcześniejszych pierścieni (nie tego samego),
    // więc wszystkie węzły pierścienia widzą ten sam zajęty obszar.
    const radii = placed.map(({ node, angle }) => Math.max(occupiedAlong(angle) + spacing / 2 + reach(node, angle), minimumRadius));
    placed.forEach(({ id, node, angle }, index) => {
      positions.set(id, { x: Math.cos(angle) * radii[index] - node.width / 2, y: Math.sin(angle) * radii[index] - node.height / 2 });
      angles.set(id, angle);
    });
  }
  // Sąsiednie węzły pierścienia mają różne promienie, więc mogą na siebie
  // nachodzić; rozsunięcie usuwa nakładki bez zmiany ogólnego układu.
  const boxes = [...positions].map(([id, point]) => ({ id, x: point.x, y: point.y, width: size.get(id).width, height: size.get(id).height }));
  separate(boxes, spacing / 2);
  return new Map(boxes.map(box => [box.id, { x: box.x, y: box.y }]));
}

// Dociąga węzły do środka układu, dopóki nie zbliżą się do sąsiada na odstęp
// margin. Usuwa puste pasy, które zostają po układzie stress i po rozsuwaniu
// nakładek (mała karta daleko od reszty, a ramki ściśnięte).
function compact(boxes, margin) {
  if (boxes.length < 2) return;
  const center = () => {
    const minX = Math.min(...boxes.map(b => b.x)); const maxX = Math.max(...boxes.map(b => b.x + b.width));
    const minY = Math.min(...boxes.map(b => b.y)); const maxY = Math.max(...boxes.map(b => b.y + b.height));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };
  const collides = (box, x, y) => boxes.some(other => other !== box
    && x < other.x + other.width + margin && x + box.width + margin > other.x
    && y < other.y + other.height + margin && y + box.height + margin > other.y);
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    const { x: cx, y: cy } = center();
    // Najpierw węzły najdalej od środka.
    const order = [...boxes].sort((a, b) => Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy) - Math.hypot(a.x + a.width / 2 - cx, a.y + a.height / 2 - cy));
    for (const box of order) {
      for (const axis of ['x', 'y']) {
        const size = axis === 'x' ? box.width : box.height;
        const toward = (axis === 'x' ? cx : cy) - (box[axis] + size / 2);
        if (Math.abs(toward) < 1) continue;
        // Największy krok w stronę środka bez kolizji (połowienie kroku).
        let step = toward;
        while (Math.abs(step) >= 1) {
          const x = axis === 'x' ? box.x + step : box.x;
          const y = axis === 'y' ? box.y + step : box.y;
          if (!collides(box, x, y)) { box.x = x; box.y = y; moved = true; break; }
          step /= 2;
        }
      }
    }
    if (!moved) break;
  }
}

// Układ stress nie pilnuje, żeby węzły na siebie nie nachodziły. Rozsuwa
// każdą parę nachodzących prostokątów wzdłuż osi mniejszego nałożenia.
function separate(boxes, margin) {
  for (let iteration = 0; iteration < 80; iteration++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) + margin - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) + margin - Math.max(a.y, b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (overlapX < overlapY) {
          const shift = overlapX / 2 * (a.x + a.width / 2 <= b.x + b.width / 2 ? 1 : -1);
          a.x -= shift;
          b.x += shift;
        } else {
          const shift = overlapY / 2 * (a.y + a.height / 2 <= b.y + b.height / 2 ? 1 : -1);
          a.y -= shift;
          b.y += shift;
        }
      }
    }
    if (!moved) break;
  }
}
