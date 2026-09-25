'use strict';

// Baza SQLite indeksu dokumentacji: schemat, zapis i usuwanie plików.
//
// Baza trzyma tylko to, co jest w front matter: doc-id, title, description,
// status i wpisy relations. Każdy wiersz tabel file, document i edge należy do
// dokładnie jednego pliku. Dzięki temu zmiana pliku wymaga podmiany tylko jego
// wierszy. Cel wpisu jest zapisany jako tekst; to, czy cel istnieje, sprawdza
// dopiero odczyt.
//
// Baza jest kopią roboczą. Można ją skasować w każdej chwili, a następna
// synchronizacja zbuduje ją od nowa.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Zmiana schematu wymaga podniesienia wersji. Baza w starszej wersji jest
// kasowana i budowana od nowa.
const SCHEMA_VERSION = '1';
const DB_FILE = path.join(__dirname, '..', '..', 'node_modules', '.cache', 'knowledge-index.db');

const TABLES = ['meta', 'edge', 'document', 'document_fts', 'file'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Każdy plik .md z indeksowanego folderu. Pole path to ścieżka względem
-- folderu repozytorium, dir to folder, a file_name to nazwa pliku.
-- Pole kind: document (dokument), error (front matter z błędem) albo
-- not-document (plik bez doc-id).
CREATE TABLE IF NOT EXISTS file (
  path      TEXT PRIMARY KEY,
  dir       TEXT NOT NULL,
  file_name TEXT NOT NULL,
  hash      TEXT NOT NULL,
  kind      TEXT NOT NULL,
  error     TEXT
);

CREATE TABLE IF NOT EXISTS document (
  path        TEXT PRIMARY KEY REFERENCES file(path) ON DELETE CASCADE,
  doc_id      TEXT NOT NULL,
  doc_type    TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  status      TEXT
);

-- Poprawne wpisy relations. target_key to pełne ID celu, także dla własnego
-- wiersza zapisanego samym ID (REQ-01 w BFS-001 daje BFS-001.REQ-01).
CREATE TABLE IF NOT EXISTS edge (
  path        TEXT NOT NULL REFERENCES file(path) ON DELETE CASCADE,
  line        INTEGER NOT NULL,
  source_doc  TEXT NOT NULL,
  source_type TEXT NOT NULL,
  relation    TEXT NOT NULL,
  target_key  TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_doc  TEXT NOT NULL
);

-- Wyszukiwanie po słowach z doc-id, title i description. Tekst jest zapisany
-- po ujednoliceniu (searchText), a wartości do wyświetlenia są w tabeli document.
CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
  path UNINDEXED, doc_id, title, description,
  tokenize = 'unicode61'
);

CREATE INDEX IF NOT EXISTS idx_document_doc_id ON document(doc_id);
CREATE INDEX IF NOT EXISTS idx_document_type   ON document(doc_type);
CREATE INDEX IF NOT EXISTS idx_edge_path       ON edge(path);
CREATE INDEX IF NOT EXISTS idx_edge_source     ON edge(source_doc, relation);
CREATE INDEX IF NOT EXISTS idx_edge_target     ON edge(target_key, relation);
`;

// Ujednolica tekst do wyszukiwania: małe litery, bez znaków diakrytycznych.
// Litera ł nie rozkłada się w Unicode na l i znak diakrytyczny, więc jest
// zamieniana osobno. Dzięki temu „obsluga” znajduje „Obsługa”. Tej samej
// funkcji używa zapis i zapytanie.
function searchText(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
}

// Otwiera bazę i zakłada schemat. Folder bazy powstaje, jeśli go nie ma.
function openStore(file = DB_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const hasMeta = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'`).get();
  if (hasMeta && getMeta(db, 'schema_version') !== SCHEMA_VERSION) {
    for (const table of TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  db.exec(SCHEMA);
  setMeta(db, 'schema_version', SCHEMA_VERSION);
  return db;
}

function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : undefined;
}

function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

// Ścieżka → hash dla wszystkich plików w bazie.
function fileHashes(db) {
  return new Map(db.prepare('SELECT path, hash FROM file').all().map(row => [row.path, row.hash]));
}

// Usuwa plik i wszystkie jego wiersze.
function removeFile(db, filePath) {
  db.prepare('DELETE FROM document_fts WHERE path = ?').run(filePath);
  db.prepare('DELETE FROM file WHERE path = ?').run(filePath);
}

// Usuwa wszystkie pliki. Wartości w tabeli meta zostają.
function clearFiles(db) {
  db.exec('DELETE FROM document_fts; DELETE FROM file;');
}

// Zapisuje plik w miejsce poprzedniej wersji. Rekord:
//   path, hash, kind, error  jak w tabeli file,
//   document                 { docId, docType, title, description, status } albo null,
//   links                    powiązania dokumentu (documents.js, linksOf).
function putFile(db, record) {
  removeFile(db, record.path);
  const dir = path.posix.dirname(record.path);
  db.prepare('INSERT INTO file(path, dir, file_name, hash, kind, error) VALUES(?, ?, ?, ?, ?, ?)')
    .run(record.path, dir, path.posix.basename(record.path), record.hash, record.kind, record.error || null);
  const doc = record.document;
  if (!doc) return;
  db.prepare('INSERT INTO document(path, doc_id, doc_type, title, description, status) VALUES(?, ?, ?, ?, ?, ?)')
    .run(record.path, doc.docId, doc.docType, doc.title ?? null, doc.description ?? null, doc.status ?? null);
  db.prepare('INSERT INTO document_fts(path, doc_id, title, description) VALUES(?, ?, ?, ?)')
    .run(record.path, searchText(doc.docId), searchText(doc.title), searchText(doc.description));
  const insertEdge = db.prepare(`INSERT INTO edge(path, line, source_doc, source_type, relation, target_key, target_type, target_doc)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const link of record.links) {
    insertEdge.run(record.path, link.line, doc.docId, doc.docType, link.type, link.key, link.targetType, link.targetDoc);
  }
}

module.exports = { SCHEMA_VERSION, DB_FILE, searchText, openStore, getMeta, setMeta, fileHashes, removeFile, clearFiles, putFile };
