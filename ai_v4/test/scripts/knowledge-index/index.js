'use strict';

// knowledge-index: fasada indeksu dokumentacji.
//
// Jedyny punkt wejścia dla CLI (cli.js) i serwera MCP. openIndex otwiera bazę
// i od razu synchronizuje ją z indeksowanym folderem, więc dane są aktualne,
// zanim ktokolwiek je odczyta. Metoda sync synchronizuje ponownie i wczytuje
// na nowo matrycę relacji i wzorce zapytań.
//
// Każdy dokument w wyniku ma ścieżkę folderu (path) względem folderu
// repozytorium i nazwę pliku (fileName). Wiersz dostaje plik swojego dokumentu.

const { parseId, isDocType } = require('../lib/ids');
const { CONTAINS, loadMatrix } = require('../lib/matrix');
const { loadPatterns, nodeType, nodeDoc, runQuery } = require('../lib/query');
const store = require('./store');
const { syncIndex } = require('./sync');

const DEFAULT_LIMIT = 20;

// Dokument z bazy w postaci wyniku.
const documentOut = row => ({
  docId: row.doc_id, type: row.doc_type, title: row.title, description: row.description,
  status: row.status, path: row.dir, fileName: row.file_name,
});

// Obiekt grafu dla lib/query.js (runQuery) czytający bazę. Dokument o doc-id
// zapisanym w kilku plikach bierze wpisy z pierwszego pliku według ścieżki, tak
// jak buildIndex. Wskazania przychodzące bierze ze wszystkich plików.
function graphFromStore(db) {
  const documentExists = db.prepare('SELECT 1 FROM document WHERE doc_id = ? LIMIT 1');
  const rowExists = db.prepare('SELECT 1 FROM edge WHERE source_doc = ? AND relation = ? AND target_key = ? LIMIT 1');
  const outgoing = db.prepare(`SELECT target_key, target_type FROM edge
    WHERE path = (SELECT path FROM document WHERE doc_id = ? ORDER BY path LIMIT 1) AND relation = ? ORDER BY line`);
  const incoming = db.prepare('SELECT source_doc, source_type FROM edge WHERE target_key = ? AND relation = ? ORDER BY path, line');
  return {
    typeOf: nodeType,
    docOf: nodeDoc,
    exists(key) {
      const id = parseId(key);
      if (!id || !id.doc) return false;
      return Boolean(id.row ? rowExists.get(id.doc, CONTAINS, key) : documentExists.get(id.doc));
    },
    out(key, relation) {
      const id = parseId(key);
      if (!id || !id.doc || id.row) return [];
      return outgoing.all(id.doc, relation).map(row => ({ key: row.target_key, type: row.target_type }));
    },
    in(key, relation) {
      return incoming.all(key, relation).map(row => ({ key: row.source_doc, type: row.source_type }));
    },
  };
}

// Otwiera indeks. Opcje:
//   root          indeksowany folder (wymagany),
//   dbFile        plik bazy; domyślnie node_modules/.cache/knowledge-index.db,
//   matrixFile    matryca relacji; domyślnie standards/config/relation-matrix.yaml,
//   patternsFile  wzorce zapytań; domyślnie standards/config/query-patterns.yaml.
function openIndex({ root, dbFile = store.DB_FILE, matrixFile, patternsFile } = {}) {
  if (!root) throw new Error('Nie podano indeksowanego folderu (root).');
  const db = store.openStore(dbFile);
  let matrix;
  let patterns;
  let graph;
  let lastSync;

  const firstDocument = db.prepare(`SELECT d.*, f.dir, f.file_name FROM document d JOIN file f USING(path)
    WHERE d.doc_id = ? ORDER BY d.path LIMIT 1`);

  // Synchronizuje bazę z folderem. Opcja full buduje całą bazę od nowa.
  // Zwraca liczby z syncIndex.
  function sync({ full = false } = {}) {
    matrix = loadMatrix(matrixFile);
    patterns = loadPatterns(matrix, patternsFile);
    if (full) store.setMeta(db, 'inputs_hash', '');
    lastSync = syncIndex(db, { root, matrix });
    graph = graphFromStore(db);
    return lastSync;
  }

  // Wykonuje zapytanie change_scope albo implementation. Zwraca:
  //   query, starts  nazwę zapytania i węzły startowe,
  //   missing        węzły startowe, których nie ma w dokumentacji,
  //   nodes          węzły: { node, type, docId, title, path, fileName, via, pattern },
  //   files          pliki do przeczytania w kolejności pierwszego węzła:
  //                  { path, fileName, docId, title, nodes: [{ node, type, via }] }.
  function query(name, starts) {
    const result = runQuery(patterns, matrix, graph, name, starts);
    const nodes = result.nodes.map(item => {
      const doc = firstDocument.get(item.doc);
      return {
        node: item.node, type: item.type, docId: item.doc, title: doc.title,
        path: doc.dir, fileName: doc.file_name, via: item.via, pattern: item.pattern,
      };
    });
    const files = new Map();
    for (const item of nodes) {
      const key = `${item.path}/${item.fileName}`;
      if (!files.has(key)) files.set(key, { path: item.path, fileName: item.fileName, docId: item.docId, title: item.title, nodes: [] });
      files.get(key).nodes.push({ node: item.node, type: item.type, via: item.via });
    }
    return { query: name, starts, missing: result.missing, nodes, files: [...files.values()] };
  }

  // Szuka dokumentów. Tekst może być:
  //   ID dokumentu albo wiersza (UC-001, BFS-001.REQ-01)  dokument o tym doc-id,
  //   typ dokumentu (API)                                   wszystkie dokumenty tego typu,
  //   słowami                                               dokumenty, których doc-id, title
  //                                                         albo description zawiera słowa
  //                                                         zaczynające się od podanych.
  // Opcje: type ogranicza wynik do typu dokumentu, limit to liczba wyników.
  function findDocuments(text, { type, limit = DEFAULT_LIMIT } = {}) {
    const trimmed = String(text || '').trim();
    const select = `SELECT d.*, f.dir, f.file_name FROM document d JOIN file f USING(path)`;
    const typeFilter = type ? ' AND d.doc_type = :type' : '';
    const params = { limit, ...(type ? { type } : {}) };
    const id = parseId(trimmed);
    if (id && id.doc) {
      return db.prepare(`${select} WHERE d.doc_id = :docId${typeFilter} ORDER BY d.path LIMIT :limit`).all({ ...params, docId: id.doc }).map(documentOut);
    }
    if (isDocType(trimmed)) {
      return db.prepare(`${select} WHERE d.doc_type = :docType${typeFilter} ORDER BY d.doc_id, d.path LIMIT :limit`).all({ ...params, docType: trimmed }).map(documentOut);
    }
    const words = store.searchText(trimmed).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!words.length) return [];
    const match = words.map(word => `"${word}"*`).join(' ');
    return db.prepare(`${select} JOIN document_fts ON document_fts.path = d.path WHERE document_fts MATCH :match${typeFilter} ORDER BY document_fts.rank LIMIT :limit`)
      .all({ ...params, match }).map(documentOut);
  }

  // Opisuje węzeł: dokument albo wiersz. Zwraca null, gdy tekst nie jest
  // kluczem węzła. Wynik:
  //   node, type, exists              klucz, typ węzła (dla wiersza typ wiersza)
  //                                    i to, czy węzeł istnieje,
  //   docId, title, …, path, fileName  pola dokumentu węzła; gdy dokumentu nie ma,
  //                                    jest tylko docId,
  //   duplicates                       inne pliki z tym samym doc-id,
  //   outgoing                         wpisy dokumentu: { relation, target, targetType, exists };
  //                                    wiersz nie ma własnych wpisów,
  //   incoming                         wpisy innych dokumentów, które wskazują węzeł,
  //                                    a dla dokumentu także jego wiersze; wpis contains
  //                                    własnego dokumentu nie jest tu powtarzany:
  //                                    { relation, target, source, sourceType, path, fileName }.
  function describeNode(key) {
    const type = nodeType(key);
    if (!type) return null;
    const id = parseId(key);
    const docs = db.prepare(`SELECT d.*, f.dir, f.file_name FROM document d JOIN file f USING(path) WHERE d.doc_id = ? ORDER BY d.path`).all(id.doc);
    const doc = docs[0] ? documentOut(docs[0]) : null;
    const outgoing = doc && !id.row
      ? db.prepare('SELECT relation, target_key, target_type FROM edge WHERE path = ? ORDER BY line').all(docs[0].path)
        .map(row => ({ relation: row.relation, target: row.target_key, targetType: row.target_type, exists: graph.exists(row.target_key) }))
      : [];
    const incoming = db.prepare(`SELECT e.relation, e.target_key, e.source_doc, e.source_type, f.dir, f.file_name
      FROM edge e JOIN file f USING(path) WHERE ${id.row ? 'e.target_key = ?' : 'e.target_doc = ?'} AND e.source_doc <> e.target_doc
      ORDER BY e.path, e.line`).all(id.row ? key : id.doc)
      .map(row => ({ relation: row.relation, target: row.target_key, source: row.source_doc, sourceType: row.source_type, path: row.dir, fileName: row.file_name }));
    return {
      ...(doc || { docId: id.doc }), node: key, type, exists: graph.exists(key),
      duplicates: docs.slice(1).map(row => ({ path: row.dir, fileName: row.file_name })),
      outgoing, incoming,
    };
  }

  // Pliki, których front matter ma błąd: { path, fileName, error }.
  function brokenFiles() {
    return db.prepare(`SELECT dir, file_name, error FROM file WHERE kind = 'error' ORDER BY path`).all()
      .map(row => ({ path: row.dir, fileName: row.file_name, error: row.error }));
  }

  sync();
  return {
    db,
    get lastSync() { return lastSync; },
    get queries() { return Object.keys(patterns); },
    sync, query, findDocuments, describeNode, brokenFiles,
    close: () => db.close(),
  };
}

module.exports = { openIndex, graphFromStore };
