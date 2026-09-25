// Katalog typu: wszystkie dokumenty wybranych typów, ich kolumny, użycia
// i grupowanie według właściciela.

// Właściciel dokumentu w grafie katalogu. To ustawienie widoku, nie reguła
// standardu: mówi tylko, w którym prostokącie narysować dokument.
//   out  dokument ma wpis relacji do właściciela (API realizes CAP),
//   in   właściciel ma wpis relacji do dokumentu (LDM contains ENT).
const OWNER_RULES = {
  API: { direction: 'out', relation: 'realizes', type: 'CAP' },
  INT: { direction: 'out', relation: 'realizes', type: 'CAP' },
  QUE: { direction: 'out', relation: 'realizes', type: 'CAP' },
  UC: { direction: 'out', relation: 'realizes', type: 'CAP' },
  TUC: { direction: 'out', relation: 'realizes', type: 'CAP' },
  FLOW: { direction: 'out', relation: 'realizes', type: 'CAP' },
  BPMN: { direction: 'out', relation: 'realizes', type: 'CAP' },
  STM: { direction: 'out', relation: 'realizes', type: 'CAP' },
  // LDM to indeks encji obszaru, więc jego wpis contains nie jest użyciem
  // encji. Dzięki temu encja, której nie wskazuje nic poza LDM, ma 0 użyć.
  ENT: { direction: 'in', relation: 'contains', type: 'LDM', notUsage: true },
  SCR: { direction: 'in', relation: 'contains', type: 'UC' },
  SCRSEC: { direction: 'in', relation: 'contains', type: 'SCR' },
  'SPEC-WF': { direction: 'in', relation: 'contains', type: 'BPMN' },
  ACT: { direction: 'in', relation: 'contains', type: 'FLOW' },
};

export const ownerLabel = types => {
  const owners = [...new Set(types.map(type => OWNER_RULES[type]?.type).filter(Boolean))];
  return owners.length ? `właściciel: ${owners.join(', ')}` : 'folder';
};

// Kolumny tabeli: trójki matrycy, w których wybrany typ jest źródłem, oraz
// wpisy contains, w których wybrany typ jest celem (dokument nadrzędny).
export function catalogColumns(types, triples) {
  const typeSet = new Set(types);
  const columns = [];
  const seen = new Set();
  for (const triple of triples) {
    if (typeSet.has(triple.source)) {
      const key = `out:${triple.relation}:${triple.target}`;
      if (!seen.has(key)) { seen.add(key); columns.push({ key, direction: 'out', relation: triple.relation, type: triple.target, label: `${triple.relation} ${triple.target}` }); }
    }
  }
  for (const triple of triples) {
    if (typeSet.has(triple.target) && triple.relation === 'contains' && !typeSet.has(triple.source)) {
      const key = `in:${triple.relation}:${triple.source}`;
      if (!seen.has(key)) { seen.add(key); columns.push({ key, direction: 'in', relation: triple.relation, type: triple.source, label: `‹ ${triple.relation} ${triple.source}` }); }
    }
  }
  return columns;
}

// Użycia dokumentu: inne dokumenty, które wskazują dokument albo jego wiersz.
// Nie liczy się wpis właściciela oznaczonego notUsage (LDM contains ENT).
export function usageIndex(graph) {
  const usage = new Map();
  for (const edge of graph.edges) {
    if (edge.source === edge.targetDoc || !edge.exists) continue;
    const rule = OWNER_RULES[edge.targetType];
    if (rule?.notUsage && rule.direction === 'in' && edge.relation === rule.relation && edge.sourceType === rule.type) continue;
    if (!usage.has(edge.targetDoc)) usage.set(edge.targetDoc, new Set());
    usage.get(edge.targetDoc).add(edge.source);
  }
  return usage;
}

export function catalogRows(graph, types, columns) {
  const typeSet = new Set(types);
  const usage = usageIndex(graph);
  const out = new Map();
  const incoming = new Map();
  for (const edge of graph.edges) {
    if (!edge.exists) continue;
    if (typeSet.has(edge.sourceType)) {
      const key = `${edge.source}|out:${edge.relation}:${edge.targetType}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(edge.target);
    }
    if (edge.relation === 'contains' && edge.target === edge.targetDoc && typeSet.has(edge.targetType)) {
      const key = `${edge.target}|in:contains:${edge.sourceType}`;
      if (!incoming.has(key)) incoming.set(key, []);
      incoming.get(key).push(edge.source);
    }
  }
  return graph.documents.filter(doc => typeSet.has(doc.type)).map(doc => {
    const cells = {};
    for (const column of columns) {
      const key = `${doc.id}|${column.key}`;
      cells[column.key] = (column.direction === 'out' ? out.get(key) : incoming.get(key)) || [];
    }
    return { doc, cells, users: [...(usage.get(doc.id) || [])].sort() };
  });
}

// Właściciele dokumentu według OWNER_RULES; pusta lista, gdy reguły nie ma.
export function ownersOf(doc, graph) {
  const rule = OWNER_RULES[doc.type];
  if (!rule) return [];
  const result = new Set();
  for (const edge of graph.edges) {
    if (edge.relation !== rule.relation || !edge.exists) continue;
    if (rule.direction === 'out' && edge.source === doc.id && edge.targetType === rule.type) result.add(edge.target);
    if (rule.direction === 'in' && edge.target === doc.id && edge.sourceType === rule.type) result.add(edge.source);
  }
  return [...result].sort();
}

export function summary(rows) {
  const status = {};
  for (const row of rows) status[row.doc.status || 'bez statusu'] = (status[row.doc.status || 'bez statusu'] || 0) + 1;
  const max = rows.reduce((m, row) => Math.max(m, row.users.length), 0);
  return {
    count: rows.length,
    status,
    top: max ? { count: max, ids: rows.filter(row => row.users.length === max).map(row => row.doc.id) } : null,
    unused: rows.filter(row => row.users.length === 0).map(row => row.doc.id),
  };
}

// Filtr tekstowy i gotowy filtr (bez-uzyc, draft, active).
export function filterRows(rows, text, preset) {
  const needle = (text || '').trim().toLowerCase();
  return rows.filter(row => {
    if (preset === 'bez-uzyc' && row.users.length) return false;
    if ((preset === 'draft' || preset === 'active') && row.doc.status !== preset) return false;
    if (!needle) return true;
    return row.doc.id.toLowerCase().includes(needle) || (row.doc.title || '').toLowerCase().includes(needle);
  });
}
