// Model widoku Mapy: które węzły i linie pokazać przy danych ustawieniach.
//
// Funkcja jest czysta (bez Reacta), więc wynik zależy tylko od grafu
// i ustawień z adresu strony. Położenie węzłów najwyższego poziomu (grupy,
// ramki, dokumenty bez grup) liczy potem layout.js. Położenie dokumentów
// wewnątrz rozwiniętej ramki liczy ten plik: kolumny według warstw.

// Kolejność warstw z metodyki: pasek udziału warstw i legenda.
export const LAYER_ORDER = ['req', 'resp', 'scen', 'scr', 'con', 'flow', 'data', 'map', 'other'];

// Kolejność kolumn w rozwiniętej ramce. Policzona na korpusie tak, żeby jak
// najwięcej relacji łączyło sąsiednie kolumny: scenariusze wskazują wymagania,
// ekrany i kontrakty, kontrakty realizują zdolności, przepływy korzystają
// z kontraktów, mapy grupują ekrany. Dane stoją na prawym brzegu, bo ich
// relacje idą głównie do grupy shared/domains poza ramką.
export const COLUMN_ORDER = ['map', 'scr', 'scen', 'req', 'resp', 'con', 'flow', 'data', 'other'];

// Podkolumny warstwy: dokument nadrzędny po lewej, jego części po prawej,
// żeby linie contains (FLOW › ACT, SCR › SCRSEC) były krótkie i poziome,
// a nie biegły w dół jednej kolumny przez inne karty.
const SUBCOLUMNS = {
  flow: [['FLOW', 'BPMN'], ['ACT', 'SPEC-WF']],
  scr: [['SCR'], ['SCRSEC']],
};

export const GROUP_PREFIX = 'grupa:';
export const groupNodeId = key => `${GROUP_PREFIX}${key}`;
export const isGroupNode = id => typeof id === 'string' && id.startsWith(GROUP_PREFIX);
export const groupKeyOf = id => id.slice(GROUP_PREFIX.length);

export const SIZE = {
  card: { width: 190, height: 68 },
  doc: { width: 170, height: 44 },
  rowLine: 17,
  frame: { padding: 20, header: 62, columnGap: 64, subColumnGap: 48, rowGap: 16 },
};

// Folder dokumentu względem folderu dokumentacji.
const relativeFolder = (dir, root) => (dir === root ? '.' : dir.startsWith(`${root}/`) ? dir.slice(root.length + 1) : dir);

// Klucz grupy dokumentu dla wybranego grupowania; null znaczy „bez grup”.
export function groupKeyFor(doc, grouping, root) {
  if (grouping === 'brak') return null;
  if (grouping === 'warstwa') return doc.layer;
  if (grouping === 'folder') return relativeFolder(doc.path, root);
  return doc.group;
}

function docHeight(doc, rowsExpanded, rowsByDoc) {
  const rows = rowsExpanded.has(doc.id) ? (rowsByDoc.get(doc.id) || []).length : 0;
  return SIZE.doc.height + (rows ? 8 + rows * SIZE.rowLine : 0);
}

// Dokumenty w odległości co najwyżej depth kroków od węzła start (w obie
// strony), po liniach, które są widoczne przy bieżących filtrach.
function neighbourhood(graph, edges, start, depth) {
  const startDoc = graph.rows.find(row => row.id === start)?.doc || start;
  const adjacent = new Map();
  const link = (a, b) => {
    if (!adjacent.has(a)) adjacent.set(a, new Set());
    adjacent.get(a).add(b);
  };
  for (const edge of edges) {
    if (edge.source === edge.targetDoc) continue;
    link(edge.source, edge.targetDoc);
    link(edge.targetDoc, edge.source);
  }
  const seen = new Set([startDoc]);
  let frontier = [startDoc];
  for (let step = 0; step < depth; step++) {
    const next = [];
    for (const id of frontier) for (const other of adjacent.get(id) || []) {
      if (!seen.has(other)) { seen.add(other); next.push(other); }
    }
    frontier = next;
  }
  return seen;
}

// Kolejność kart w kolumnach według średniej pozycji sąsiadów (barycentrum,
// kilka przebiegów w obie strony). Zmniejsza przecięcia linii między
// kolumnami. columns to tablica tablic dokumentów, edges to pary [a, b] ID.
function orderByBarycenter(columns, edges) {
  const columnOf = new Map();
  columns.forEach((docs, index) => docs.forEach(doc => columnOf.set(doc.id, index)));
  const adjacent = new Map();
  for (const [a, b] of edges) {
    if (!columnOf.has(a) || !columnOf.has(b) || columnOf.get(a) === columnOf.get(b)) continue;
    if (!adjacent.has(a)) adjacent.set(a, []);
    if (!adjacent.has(b)) adjacent.set(b, []);
    adjacent.get(a).push(b);
    adjacent.get(b).push(a);
  }
  const position = new Map();
  const remember = () => columns.forEach(docs => docs.forEach((doc, index) => position.set(doc.id, index)));
  remember();
  for (let sweep = 0; sweep < 6; sweep++) {
    const order = sweep % 2 ? [...columns.keys()].reverse() : [...columns.keys()];
    for (const index of order) {
      columns[index] = columns[index]
        .map((doc, current) => {
          const others = adjacent.get(doc.id) || [];
          const center = others.length ? others.reduce((sum, id) => sum + position.get(id), 0) / others.length : current;
          return { doc, center, current };
        })
        .sort((x, y) => x.center - y.center || x.current - y.current)
        .map(item => item.doc);
      columns[index].forEach((doc, i) => position.set(doc.id, i));
    }
  }
  return columns;
}

export function buildMapModel(graph, options) {
  const {
    grouping = 'proces', expanded = new Set(), hiddenLayers = new Set(), hiddenRelations = new Set(),
    scope = 'calosc', scopeGroup = null, selection = null, depth = 1, rowsExpanded = new Set(),
  } = options;
  const layerNames = new Map(graph.layers.map(layer => [layer.id, layer.name]));
  const groupInfo = new Map(graph.groups.map(group => [group.id, group]));
  const docLayer = new Map(graph.documents.map(doc => [doc.id, doc.layer]));
  const rowsByDoc = new Map();
  for (const row of graph.rows) {
    if (!rowsByDoc.has(row.doc)) rowsByDoc.set(row.doc, []);
    rowsByDoc.get(row.doc).push(row);
  }

  // Wpisy relacji, które mogą dać linię przy bieżących filtrach: istniejący
  // cel, relacja nie ukryta, oba końce w widocznych warstwach, nie do własnego wiersza.
  const activeEdges = graph.edges.filter(edge => edge.exists && !hiddenRelations.has(edge.relation) && edge.source !== edge.targetDoc
    && !hiddenLayers.has(docLayer.get(edge.source)) && !hiddenLayers.has(docLayer.get(edge.targetDoc)));

  let effectiveGrouping = grouping;
  let effectiveExpanded = new Set(expanded);
  let docs = graph.documents.filter(doc => !hiddenLayers.has(doc.layer));
  let note = null;

  // Zakres: jeden proces (rozwinięty, a sąsiednie grupy zwinięte)
  // albo sąsiedztwo zaznaczonego węzła (wszystkie grupy rozwinięte).
  if (scope === 'proces' && scopeGroup) {
    effectiveGrouping = 'proces';
    // Grupa zakresu jest zawsze rozwinięta; sąsiednie rozwija dwuklik (rozwin).
    effectiveExpanded = new Set([scopeGroup, ...expanded]);
    const inGroup = new Set(docs.filter(doc => doc.group === scopeGroup).map(doc => doc.id));
    const neighbours = new Set();
    for (const edge of activeEdges) {
      if (inGroup.has(edge.source) && !inGroup.has(edge.targetDoc)) neighbours.add(edge.targetDoc);
      if (inGroup.has(edge.targetDoc) && !inGroup.has(edge.source)) neighbours.add(edge.source);
    }
    const docGroup = new Map(graph.documents.map(doc => [doc.id, doc.group]));
    const neighbourGroups = new Set([...neighbours].map(id => docGroup.get(id)));
    docs = docs.filter(doc => doc.group === scopeGroup || neighbourGroups.has(doc.group));
  } else if (scope === 'sasiedztwo') {
    if (selection && !isGroupNode(selection)) {
      const near = neighbourhood(graph, activeEdges, selection, depth);
      docs = docs.filter(doc => near.has(doc.id));
      effectiveExpanded = new Set(docs.map(doc => groupKeyFor(doc, effectiveGrouping, graph.root)));
    } else {
      note = 'Zaznacz dokument, żeby zobaczyć jego sąsiedztwo.';
      docs = [];
    }
  }

  const visibleDocs = new Map(docs.map(doc => [doc.id, doc]));
  const groups = new Map();
  for (const doc of docs) {
    const key = groupKeyFor(doc, effectiveGrouping, graph.root);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  const nodes = [];
  const nodeOfDoc = new Map();

  const groupTitle = key => {
    if (effectiveGrouping === 'warstwa') return layerNames.get(key) || key;
    if (effectiveGrouping === 'folder') return null;
    const info = groupInfo.get(key);
    return info?.title || null;
  };
  const layerCounts = list => {
    const counts = {};
    for (const doc of list) counts[doc.layer] = (counts[doc.layer] || 0) + 1;
    return counts;
  };

  // Kolumna dokumentu w ramce: warstwa (albo proces przy grupowaniu po
  // warstwach), z podkolumną dla części dokumentów nadrzędnych.
  const columnKey = doc => {
    if (effectiveGrouping === 'warstwa') return { key: doc.group, layer: null, sub: 0, label: doc.group };
    const subs = SUBCOLUMNS[doc.layer];
    const sub = subs ? Math.max(0, subs.findIndex(types => types.includes(doc.type))) : 0;
    return { key: `${doc.layer}/${sub}`, layer: doc.layer, sub, label: sub === 0 ? layerNames.get(doc.layer) || doc.layer : subs[sub].join(', ') };
  };
  const columnRank = column => (effectiveGrouping === 'warstwa' ? 0 : COLUMN_ORDER.indexOf(column.layer) * 10 + column.sub);

  for (const [key, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const id = groupNodeId(key);
    if (!effectiveExpanded.has(key)) {
      nodes.push({ id, kind: 'group', width: SIZE.card.width, height: SIZE.card.height, data: { key, title: groupTitle(key), count: list.length, layers: layerCounts(list), docIds: list.map(doc => doc.id) } });
      for (const doc of list) nodeOfDoc.set(doc.id, id);
      continue;
    }
    const columns = new Map();
    for (const doc of [...list].sort((a, b) => a.id.localeCompare(b.id, 'pl', { numeric: true }))) {
      const column = columnKey(doc);
      if (!columns.has(column.key)) columns.set(column.key, { ...column, docs: [] });
      columns.get(column.key).docs.push(doc);
    }
    const ordered = [...columns.values()].sort((a, b) => (effectiveGrouping === 'warstwa' ? a.key.localeCompare(b.key) : columnRank(a) - columnRank(b)));
    const inGroup = new Set(list.map(doc => doc.id));
    const pairs = activeEdges.filter(edge => inGroup.has(edge.source) && inGroup.has(edge.targetDoc)).map(edge => [edge.source, edge.targetDoc]);
    const orderedDocs = orderByBarycenter(ordered.map(column => column.docs), pairs);
    const { padding, header, columnGap, subColumnGap, rowGap } = SIZE.frame;
    let height = 0;
    let x = padding;
    const columnHeads = [];
    ordered.forEach((column, index) => {
      if (index) x += SIZE.doc.width + (column.sub > 0 && ordered[index - 1].layer === column.layer ? subColumnGap : columnGap);
      columnHeads.push({ x, label: column.label, sub: column.sub > 0 });
      let y = header;
      for (const doc of orderedDocs[index]) {
        const h = docHeight(doc, rowsExpanded, rowsByDoc);
        nodes.push({
          id: doc.id, kind: 'doc', parentId: id, x, y, width: SIZE.doc.width, height: h,
          data: { doc, rows: rowsExpanded.has(doc.id) ? rowsByDoc.get(doc.id) || [] : null, rank: index, column: { label: column.label, sub: column.sub > 0 } },
        });
        nodeOfDoc.set(doc.id, doc.id);
        y += h + rowGap;
      }
      height = Math.max(height, y);
    });
    const width = x + SIZE.doc.width + padding;
    // Ramka musi być w tablicy przed swoimi dokumentami (wymóg React Flow).
    const fixed = scope === 'sasiedztwo' || (scope === 'proces' && key === scopeGroup);
    // Szerokość nagłówka ramki (klucz, tytuł, liczba, „dwuklik zwija”) w przybliżeniu
    // z liczby znaków, żeby tekst nie wychodził poza ramkę jednokolumnową.
    const title = groupTitle(key);
    const headerWidth = Math.ceil(24 + (effectiveGrouping === 'warstwa' ? 0 : key.length * 7.4 + 8) + (title || '').length * 6.9 + 8 + String(list.length).length * 7.4 + (fixed ? 0 : 92));
    const frame = { id, kind: 'frame', width: Math.max(width, 260, headerWidth), height: height + padding - rowGap, data: { key, title, count: list.length, columnHeads, fixed, headerWidth } };
    const firstChild = nodes.findIndex(node => node.parentId === id);
    nodes.splice(firstChild === -1 ? nodes.length : firstChild, 0, frame);
  }

  if (effectiveGrouping === 'brak') {
    for (const doc of docs) {
      const column = columnKey(doc);
      nodes.push({
        id: doc.id, kind: 'doc', width: SIZE.doc.width, height: docHeight(doc, rowsExpanded, rowsByDoc),
        data: { doc, rows: rowsExpanded.has(doc.id) ? rowsByDoc.get(doc.id) || [] : null, rank: columnRank(column), column: { label: column.label, sub: column.sub > 0 } },
      });
      nodeOfDoc.set(doc.id, doc.id);
    }
  }

  // Linie: wpisy relacji zebrane w pary węzłów na płótnie. Wpis do własnego
  // wiersza i wpis wewnątrz zwiniętej grupy nie dają linii.
  const lines = new Map();
  for (const edge of activeEdges) {
    if (!visibleDocs.has(edge.source) || !visibleDocs.has(edge.targetDoc)) continue;
    const from = nodeOfDoc.get(edge.source);
    const to = nodeOfDoc.get(edge.targetDoc);
    if (!from || !to || from === to) continue;
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}|${b}`;
    if (!lines.has(key)) lines.set(key, { id: key, a, b, count: 0, relations: new Set(), forward: 0, backward: 0, entries: [] });
    const line = lines.get(key);
    line.count++;
    line.relations.add(edge.relation);
    if (from === a) line.forward++; else line.backward++;
    line.entries.push(edge);
  }

  // Strzałka biegnie od dokumentu z wpisem relacji do celu. Para z wpisami
  // w obie strony (SPEC-WF-008 ↔ SPEC-WF-009) ma strzałki na obu końcach.
  //   scope  inner  oba końce w tej samej rozwiniętej ramce,
  //          cross  dokument w ramce i węzeł poza nią (grupa albo dokument innej ramki),
  //          top    oba końce to węzły najwyższego poziomu (grupy, dokumenty bez grup).
  const parentOf = new Map(nodes.filter(node => node.parentId).map(node => [node.id, node.parentId]));
  const topOf = id => parentOf.get(id) || id;
  const edges = [...lines.values()].map(line => {
    const docLine = !isGroupNode(line.a) && !isGroupNode(line.b);
    const directed = docLine && (line.forward === 0 || line.backward === 0);
    const bidirectional = docLine && line.forward > 0 && line.backward > 0;
    const [source, target] = line.backward > line.forward ? [line.b, line.a] : [line.a, line.b];
    const topSource = topOf(source);
    const topTarget = topOf(target);
    const scope = topSource === topTarget ? 'inner' : topSource !== source || topTarget !== target ? 'cross' : 'top';
    return {
      id: line.id, source, target, count: line.count, relations: [...line.relations], directed, bidirectional, entries: line.entries,
      scope, topSource, topTarget, detail: docLine,
    };
  });

  // Wiązki: linie cross zebrane według pary węzłów najwyższego poziomu. Na
  // brzegu ramki wiązka ma jeden port, a linie dokumentów zbiegają się do niego.
  const bundles = new Map();
  for (const edge of edges) {
    if (edge.scope !== 'cross') continue;
    const [a, b] = edge.topSource < edge.topTarget ? [edge.topSource, edge.topTarget] : [edge.topTarget, edge.topSource];
    const id = `wiazka:${a}|${b}`;
    if (!bundles.has(id)) bundles.set(id, { id, a, b, count: 0, fromA: 0, fromB: 0, relations: new Set(), members: [] });
    const bundle = bundles.get(id);
    bundle.members.push(edge.id);
    edge.bundle = id;
    for (const entry of edge.entries) {
      bundle.count++;
      bundle.relations.add(entry.relation);
      if (topOf(nodeOfDoc.get(entry.source)) === a) bundle.fromA++; else bundle.fromB++;
    }
  }
  const bundleList = [...bundles.values()].map(bundle => {
    const [source, target] = bundle.fromB > bundle.fromA ? [bundle.b, bundle.a] : [bundle.a, bundle.b];
    // Strona portu na ramce zgodna z kierunkiem wiązki: ramka, z której wychodzi
    // większość wpisów, ma port EAST, a ramka po stronie celu port WEST. Przy
    // remisie kierunek wynika z kolejności, więc obie strony są spójne.
    const sides = {};
    for (const end of [bundle.a, bundle.b]) {
      if (nodes.some(node => node.id === end && node.kind === 'frame')) sides[end] = end === source ? 'EAST' : 'WEST';
    }
    return {
      ...bundle, relations: [...bundle.relations], source, target, sides,
      directed: bundle.fromA === 0 || bundle.fromB === 0, bidirectional: bundle.fromA > 0 && bundle.fromB > 0,
    };
  });

  // Przy zakresie procesu liczba dotyczy tylko tej grupy; pozostałe
  // grupy to sąsiedzi pokazani jako zwinięte.
  const focused = scope === 'proces' && scopeGroup;
  const scopeCount = focused ? docs.filter(doc => doc.group === scopeGroup).length : docs.length;
  return {
    nodes, edges, bundles: bundleList, grouping: effectiveGrouping, expanded: effectiveExpanded, note, nodeOfDoc,
    docCount: scopeCount, groupCount: focused ? Math.max(0, groups.size - 1) : groups.size, focused: Boolean(focused),
  };
}
