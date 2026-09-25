'use strict';

// Dane Warsztatu dokumentacji.
//
// Graf, zapytania, wyszukiwanie i opis węzła pochodzą z knowledge-index
// (scripts/knowledge-index/index.js). Ten plik dokłada to, czego potrzebuje
// interfejs: grupy i warstwy, treść pliku, symulację usunięcia, przepływ danych
// między zdolnościami i wynik walidatorów.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { openIndex } = require('../../../scripts/knowledge-index/index');
const { REPO_ROOT } = require('../../../scripts/knowledge-index/sync');
const { parseId } = require('../../../scripts/lib/ids');
const { loadMatrix } = require('../../../scripts/lib/matrix');
const { LAYERS, layerOf } = require('./layers');
const { buildWorkflows } = require('./workflows');

const DB_FILE = path.join(REPO_ROOT, 'node_modules', '.cache', 'docs-workbench.db');
const VALIDATORS = [
  { id: 'relations', name: 'relacje', script: 'validate-relations.js' },
  { id: 'form', name: 'forma', script: 'validate-form.js' },
  { id: 'consistency', name: 'spójność', script: 'validate-consistency.js' },
];

// Grupa dokumentu według folderu (metodyka, sekcja 11):
//   processes/BFS-001/…         proces BFS-001,
//   shared/domains/DDM-001/…    folder wspólny shared/domains (wszystkie domeny razem),
//   shared/actors/…             folder wspólny shared/actors.
function groupOf(dir, rootDir) {
  const relative = dir === rootDir ? '' : dir.slice(rootDir.length + 1);
  const parts = relative.split('/').filter(Boolean);
  if (parts[0] === 'processes' && parts[1]) return { id: parts[1], kind: 'process' };
  if (parts[0] === 'shared' && parts[1]) return { id: `shared/${parts[1]}`, kind: 'shared' };
  return { id: parts[0] || '.', kind: 'other' };
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LABEL_MAX = 160;

// Etykiety wierszy z treści dokumentu. Wiersz ma etykietę, gdy jego ID stoi
// na początku nagłówka („### A1. Zapis szkicu”) albo w pierwszej komórce
// tabeli („| REQ-01 | Klient składa… |”); etykietą jest reszta nagłówka albo
// druga komórka. Front matter jest pomijany.
function rowLabels(content, shortIds) {
  const body = content.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const lines = body.split(/\r?\n/);
  const labels = {};
  for (const short of shortIds) {
    const id = escapeRegExp(short);
    const heading = new RegExp(`^#{1,6}\\s+${id}(?![\\w-])[.:)]?\\s*(.*)$`);
    const tableRow = new RegExp(`^\\|\\s*${id}\\s*\\|`);
    let label = null;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const h = line.match(heading);
      if (h) {
        // Sam nagłówek (### AC-01): etykietą jest pierwsza niepusta linia pod nim.
        label = h[1].trim() || (lines.slice(index + 1).find(next => next.trim() && !/^#{1,6}\s/.test(next)) || '')
          .replace(/^\s*(?:[-*]\s+|\d+\.\s+)/, '').replace(/\*\*/g, '').trim() || null;
        break;
      }
      if (tableRow.test(line)) {
        label = line.split('|').map(cell => cell.trim()).filter(Boolean)[1] || null;
        break;
      }
    }
    if (label) labels[short] = label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
  }
  return labels;
}

function openWorkbench({ root, dbFile = DB_FILE }) {
  const index = openIndex({ root, dbFile });
  const { db } = index;
  let version = 1;
  let validationCache = null;

  const rootDir = () => index.lastSync.root;

  // Cały graf dla mapy i katalogu.
  function graph() {
    const documents = db.prepare(`SELECT d.doc_id, d.doc_type, d.title, d.description, d.status, f.dir, f.file_name
      FROM document d JOIN file f USING(path) ORDER BY d.doc_id, d.path`).all();
    const seen = new Set();
    const docs = [];
    for (const row of documents) {
      if (seen.has(row.doc_id)) continue; // duplikat doc-id zgłasza walidator
      seen.add(row.doc_id);
      const group = groupOf(row.dir, rootDir());
      docs.push({
        id: row.doc_id, type: row.doc_type, layer: layerOf(row.doc_type), title: row.title, description: row.description,
        status: row.status, path: row.dir, fileName: row.file_name, group: group.id,
      });
    }
    const docIndex = new Map(docs.map(doc => [doc.id, doc]));

    const edges = db.prepare(`SELECT source_doc, source_type, relation, target_key, target_type, target_doc, line
      FROM edge ORDER BY path, line`).all().map(row => ({
      source: row.source_doc, sourceType: row.source_type, relation: row.relation,
      target: row.target_key, targetType: row.target_type, targetDoc: row.target_doc, line: row.line,
    }));
    // Wiersze to cele wpisów contains, które leżą w dokumencie źródłowym.
    const rows = edges
      .filter(edge => edge.relation === 'contains' && edge.targetDoc === edge.source && edge.target !== edge.source)
      .map(edge => ({ id: edge.target, type: edge.targetType, layer: layerOf(edge.targetType), doc: edge.source }));
    const rowKeys = new Set(rows.map(row => row.id));
    for (const edge of edges) edge.exists = edge.target === edge.targetDoc ? docIndex.has(edge.target) : rowKeys.has(edge.target);

    const groups = new Map();
    for (const doc of docs) {
      if (!groups.has(doc.group)) {
        const kind = groupOf(doc.path, rootDir()).kind;
        const owner = docIndex.get(doc.group);
        groups.set(doc.group, { id: doc.group, kind, title: owner ? owner.title : null, documents: 0, layers: {}, docIds: [] });
      }
      const group = groups.get(doc.group);
      group.documents++;
      group.layers[doc.layer] = (group.layers[doc.layer] || 0) + 1;
      group.docIds.push(doc.id);
    }
    // Folder wspólny nie ma dokumentu-właściciela, więc tytułem jest lista jego
    // dokumentów; w shared/domains lista dokumentów DDM (domen).
    for (const group of groups.values()) {
      const domains = group.docIds.filter(id => docIndex.get(id)?.type === 'DDM');
      const ids = domains.length ? domains : group.docIds;
      if (!group.title) group.title = ids.length <= 3 ? ids.join(', ') : `${ids.slice(0, 3).join(', ')} i ${ids.length - 3} więcej`;
      delete group.docIds;
    }
    const links = new Map();
    for (const edge of edges) {
      const from = docIndex.get(edge.source);
      const to = docIndex.get(edge.targetDoc);
      if (!from || !to) continue;
      const key = from.group === to.group ? `${from.group}|${from.group}` : [from.group, to.group].sort().join('|');
      links.set(key, (links.get(key) || 0) + 1);
    }
    const groupLinks = [...links].map(([key, count]) => {
      const [a, b] = key.split('|');
      return { a, b, count };
    }).sort((x, y) => y.count - x.count);

    return {
      version, root: rootDir(), layers: LAYERS.map(({ id, name, types }) => ({ id, name, types })),
      documents: docs, rows, edges, groups: [...groups.values()], groupLinks,
      // Trójki matrycy w jej kolejności: z nich wynikają kolumny katalogu typu.
      triples: loadMatrix().triples.map(({ source, relation, target }) => ({ source, relation, target })),
    };
  }

  // Dokument albo wiersz z relacjami w obie strony, treścią pliku, wierszami
  // dokumentu (z etykietą z treści) i właścicielem z front matter.
  function describe(key) {
    const node = index.describeNode(key);
    if (!node || !node.exists) return null;
    let content = null;
    if (node.path && node.fileName) {
      const file = path.join(REPO_ROOT, node.path, node.fileName);
      content = fs.readFileSync(file, 'utf8');
    }
    const docRows = db.prepare(`SELECT target_key, target_type FROM edge
      WHERE source_doc = ? AND relation = 'contains' AND target_doc = source_doc AND target_key <> source_doc ORDER BY line`).all(node.docId);
    const incomingCount = db.prepare('SELECT COUNT(DISTINCT source_doc) AS count FROM edge WHERE target_key = ? AND source_doc <> ?');
    const labels = content ? rowLabels(content, docRows.map(row => row.target_key.slice(node.docId.length + 1))) : {};
    const rows = docRows.map(row => {
      const short = row.target_key.slice(node.docId.length + 1);
      return { id: row.target_key, short, type: row.target_type, layer: layerOf(row.target_type), label: labels[short] || null, incoming: incomingCount.get(row.target_key, node.docId).count };
    });
    const owner = content ? (content.match(/^owner:\s*"?([^"#\r\n]*?)"?\s*(?:#.*)?$/m) || [])[1] || null : null;
    const isRow = node.node !== node.docId;
    return {
      ...node, layer: layerOf(node.type), group: node.path ? groupOf(node.path, rootDir()).id : null,
      owner, rows, rowLabel: isRow ? labels[node.node.slice(node.docId.length + 1)] || null : null, content,
    };
  }

  // Zapytanie change_scope albo implementation. Opcja simulateRemoval dokłada
  // skutki usunięcia węzłów startowych: wpisy, których cel przestanie istnieć,
  // i węzły, które stracą połączenie z największą spójną częścią grafu.
  // Zasięg jest liczony na grafie przed usunięciem (metodyka, sekcja 6).
  function query(name, starts, { simulateRemoval = false } = {}) {
    const result = index.query(name, starts);
    if (simulateRemoval) result.removal = removal(starts.filter(key => !(result.missing || []).includes(key)));
    return result;
  }

  function removal(starts) {
    const full = graph();
    const removedDocs = new Set(starts.filter(key => !(parseId(key) || {}).row));
    const removedRows = new Set(starts.filter(key => (parseId(key) || {}).row));
    const removed = new Set([...starts, ...full.rows.filter(row => removedDocs.has(row.doc)).map(row => row.id)]);
    const isRemoved = key => removed.has(key) || removedDocs.has((parseId(key) || {}).doc);
    // Usunięcie wiersza to usunięcie jego wpisu contains, więc ten wpis nie jest zepsuty.
    const ownRowEntry = edge => edge.relation === 'contains' && removedRows.has(edge.target) && edge.source === edge.targetDoc;

    const broken = full.edges
      .filter(edge => isRemoved(edge.target) && !removedDocs.has(edge.source) && !ownRowEntry(edge))
      .map(edge => ({ source: edge.source, relation: edge.relation, target: edge.target, line: edge.line, reason: 'cel nie istnieje' }));

    const nodes = [...full.documents.map(doc => doc.id), ...full.rows.map(row => row.id)];
    const componentsOf = skip => {
      const adjacent = new Map(nodes.filter(key => !skip(key)).map(key => [key, []]));
      for (const edge of full.edges) {
        if (!adjacent.has(edge.source) || !adjacent.has(edge.target)) continue;
        adjacent.get(edge.source).push(edge.target);
        adjacent.get(edge.target).push(edge.source);
      }
      const component = new Map();
      let count = 0;
      for (const start of adjacent.keys()) {
        if (component.has(start)) continue;
        count++;
        const stack = [start];
        component.set(start, count);
        while (stack.length) {
          for (const next of adjacent.get(stack.pop())) {
            if (component.has(next)) continue;
            component.set(next, count);
            stack.push(next);
          }
        }
      }
      const sizes = new Map();
      for (const id of component.values()) sizes.set(id, (sizes.get(id) || 0) + 1);
      const main = [...sizes].sort((a, b) => b[1] - a[1])[0];
      return { component, main: main ? main[0] : null };
    };
    const before = componentsOf(() => false);
    const after = componentsOf(isRemoved);
    const disconnected = [...after.component]
      .filter(([key, id]) => id !== after.main && before.component.get(key) === before.main)
      .map(([key]) => key);

    return { removed: [...removed], broken, disconnected };
  }

  // Przepływ danych między zdolnościami CAP.
  //   zdarzenie   nadawca: QUE realizes CAP, odbiorca: CAP consumes QUE,
  //   wywołanie   dokument z jedną zdolnością wywołuje API albo INT innej zdolności;
  //               zdolność dokumentu: API, INT, UC, TUC, FLOW i BPMN mają wpis
  //               realizes CAP, SPEC-WF bierze zdolność swojego BPMN, a SCR
  //               i SCRSEC zdolności dokumentów, które je zawierają
  //               (SCRSEC ‹ SCR ‹ UC; kilka scenariuszy daje kilka zdolności),
  //   niejednoznaczne  wywołujący należy do kilku zdolności.
  // Widoki przepływu pracy (NAV, FLOW, BPMN, UCMAP), liczone raz na wersję danych.
  let workflowCache = null;
  function workflows() {
    if (workflowCache?.version === version) return workflowCache.data;
    const { documents, edges } = graph();
    const data = { version, ...buildWorkflows({ docs: documents, edges, repoRoot: REPO_ROOT, rootDir: rootDir() }) };
    workflowCache = { version, data };
    return data;
  }

  // Wpis consumes QUE w UC, TUC, FLOW i SPEC-WF nie wyznacza linii, bo nie mówi,
  // czy dokument zdarzenie publikuje, czy odbiera.
  function flow() {
    const full = graph();
    const docIndex = new Map(full.documents.map(doc => [doc.id, doc]));
    const out = (id, relation, prefix) => full.edges.filter(edge => edge.source === id && edge.relation === relation && (!prefix || edge.targetType === prefix));
    const containers = (id, types) => full.edges.filter(edge => edge.relation === 'contains' && edge.target === id && edge.source !== id && (!types || types.includes(edge.sourceType))).map(edge => edge.source);
    const capsCache = new Map();
    const capsOf = id => {
      if (capsCache.has(id)) return capsCache.get(id);
      capsCache.set(id, []);
      const doc = docIndex.get(id);
      let caps = [];
      if (!doc) caps = [];
      else if (doc.type === 'CAP') caps = [id];
      else if (doc.type === 'SPEC-WF') caps = containers(id, ['BPMN']).flatMap(capsOf);
      else if (doc.type === 'SCR' || doc.type === 'SCRSEC') caps = containers(id).flatMap(capsOf);
      else caps = out(id, 'realizes', 'CAP').map(edge => edge.target);
      caps = [...new Set(caps)];
      capsCache.set(id, caps);
      return caps;
    };

    const caps = full.documents.filter(doc => doc.type === 'CAP').map(cap => ({
      id: cap.id, title: cap.title, group: cap.group, status: cap.status,
      contracts: full.documents.filter(doc => ['API', 'INT', 'QUE'].includes(doc.type) && capsOf(doc.id).includes(cap.id))
        .map(doc => ({ id: doc.id, type: doc.type, title: doc.title })),
    }));

    const lines = new Map();
    const addLine = (kind, from, to, contract, via) => {
      if (from === to) return;
      const key = kind === 'ambiguous' ? `${kind}|${[from, to].sort().join('|')}` : `${kind}|${from}|${to}`;
      if (!lines.has(key)) lines.set(key, { kind, from, to, contracts: [], via: [] });
      const line = lines.get(key);
      if (contract && !line.contracts.includes(contract)) line.contracts.push(contract);
      if (via && !line.via.includes(via)) line.via.push(via);
    };

    for (const que of full.documents.filter(doc => doc.type === 'QUE')) {
      const senders = capsOf(que.id);
      const receivers = full.edges.filter(edge => edge.relation === 'consumes' && edge.target === que.id && edge.sourceType === 'CAP').map(edge => edge.source);
      for (const from of senders) for (const to of receivers) addLine('event', from, to, que.id, null);
    }
    for (const edge of full.edges) {
      if (edge.relation !== 'consumes' || !['API', 'INT'].includes(edge.targetType)) continue;
      const callers = capsOf(edge.source);
      const owners = capsOf(edge.target);
      // Wywołujący z kilkoma zdolnościami może wołać z każdej z nich, także
      // z tej, do której należy wywoływany element. Dlatego jego linie są
      // niejednoznaczne nawet wtedy, gdy jedna z jego zdolności to właściciel.
      for (const to of owners) {
        if (callers.length === 1) addLine('call', callers[0], to, edge.target, edge.source);
        else for (const from of callers) addLine('ambiguous', from, to, edge.target, edge.source);
      }
    }
    const payload = id => full.edges.filter(edge => edge.source === id && edge.relation === 'consumes' && edge.targetType === 'ENT').map(edge => edge.target);
    return {
      version, caps,
      lines: [...lines.values()].map(line => ({ ...line, entities: [...new Set(line.contracts.flatMap(payload))] })),
    };
  }

  // Wynik trzech walidatorów dla indeksowanego folderu. Wynik jest pamiętany
  // do następnej zmiany plików.
  function validation() {
    if (validationCache) return validationCache;
    // Wynik opisuje pliki z chwili startu walidatorów, więc wersja też jest z tej chwili.
    const snapshot = version;
    const run = validator => new Promise(resolve => {
      const script = path.join(REPO_ROOT, 'scripts', validator.script);
      execFile(process.execPath, [script, rootDir(), '--json'], { cwd: REPO_ROOT, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
        try {
          const report = JSON.parse(stdout);
          resolve({ ...validator, documents: report.documents, errors: report.errors, warnings: report.warnings, notes: report.notes, findings: report.findings });
        } catch {
          resolve({ ...validator, failed: (stderr || (error && error.message) || 'brak wyniku').trim(), findings: [] });
        }
      });
    });
    validationCache = Promise.all(VALIDATORS.map(run)).then(validators => ({
      version: snapshot,
      errors: validators.reduce((sum, v) => sum + (v.errors || 0), 0),
      warnings: validators.reduce((sum, v) => sum + (v.warnings || 0), 0),
      validators: validators.map(({ findings, ...rest }) => rest),
      findings: validators.flatMap(v => v.findings.map(finding => ({ validator: v.id, ...finding }))),
    }));
    return validationCache;
  }

  // Synchronizuje indeks po zmianie plików. Zwraca null, gdy nic się nie zmieniło.
  function sync() {
    const counts = index.sync();
    if (!counts.rebuilt && !counts.added && !counts.changed && !counts.removed) return null;
    version++;
    validationCache = null;
    return { version, ...counts };
  }

  // Wyszukiwanie dokumentów: wynik knowledge-index (FTS) ułożony tak, żeby
  // dopasowanie w ID albo na początku słowa tytułu stało przed dopasowaniem
  // w opisie, a przy równym dopasowaniu warstwy szły w kolejności metodyki
  // (wymagania, zdolności, scenariusze…). Dla „dysp” pierwsze są BFS-001
  // „Obsługa dyspozycji”, potem CAP-001 i UC-001.
  const layerRank = new Map(LAYERS.map((layer, position) => [layer.id, position]));
  function search(text, { type, limit = 20 } = {}) {
    const needle = text.trim().toLowerCase();
    const found = index.findDocuments(text, { type, limit: Math.max(limit * 4, 80) });
    const rank = doc => {
      const id = doc.docId.toLowerCase();
      const title = (doc.title || '').toLowerCase();
      if (id === needle || id.startsWith(needle)) return 0;
      if (title.split(/[^\p{L}\p{N}]+/u).some(word => word.startsWith(needle))) return 1;
      if (id.includes(needle) || title.includes(needle)) return 2;
      return 3;
    };
    const layer = doc => layerRank.get(layerOf(doc.type)) ?? LAYERS.length;
    return found
      .map(doc => ({ doc, rank: rank(doc), layer: layer(doc) }))
      .sort((a, b) => a.rank - b.rank || a.layer - b.layer || a.doc.docId.localeCompare(b.doc.docId, 'pl', { numeric: true }))
      .slice(0, limit)
      .map(({ doc }) => doc);
  }

  return {
    get version() { return version; },
    get root() { return rootDir(); },
    graph, describe, query, flow, workflows, validation, sync, search,
    queries: () => index.queries,
    close: () => index.close(),
  };
}

module.exports = { DB_FILE, openWorkbench, groupOf };
