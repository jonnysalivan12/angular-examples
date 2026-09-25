'use strict';

// Synchronizacja bazy indeksu z plikami w indeksowanym folderze.
//
// Każdy plik dostaje skrót treści (hash). Plik o niezmienionym skrócie jest
// pomijany bez parsowania. Plik nowy albo zmieniony jest parsowany, a jego
// wiersze w bazie są podmieniane. Plik, którego już nie ma na dysku, jest
// usuwany z bazy.
//
// Cała baza jest budowana od nowa, gdy zmieni się indeksowany folder albo
// jeden z plików, od których zależy wynik parsowania: matryca relacji,
// scripts/lib/ids.js albo scripts/lib/documents.js.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { collectFiles, parseDocument, linksOf } = require('../lib/documents');
const store = require('./store');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PARSER_FILES = [path.join(__dirname, '..', 'lib', 'ids.js'), path.join(__dirname, '..', 'lib', 'documents.js')];

const hashText = text => crypto.createHash('sha1').update(text).digest('hex');

// Ścieżka względem folderu repozytorium, zawsze z ukośnikami /.
const repoPath = file => path.relative(REPO_ROOT, file).split(path.sep).join('/') || '.';

// Rekord pliku do zapisu w bazie (store.js, putFile).
function fileRecord(file, raw, matrix) {
  const record = { path: repoPath(file), hash: hashText(raw), document: null, links: [] };
  const doc = parseDocument(file, raw, matrix);
  record.kind = doc.kind;
  if (doc.kind === 'error') record.error = doc.error;
  if (doc.kind !== 'document') return record;
  const field = name => (doc.fields.find(candidate => candidate.name === name) || {}).value;
  record.document = { docId: doc.docId, docType: doc.docType, title: field('title'), description: field('description'), status: field('status') };
  record.links = linksOf(doc, matrix);
  return record;
}

// Synchronizuje bazę z folderem root. Zwraca liczby:
//   root       indeksowany folder względem folderu repozytorium,
//   rebuilt    true, gdy baza była budowana od nowa,
//   files      pliki .md w folderze,
//   added, changed, removed, unchanged  pliki według rodzaju zmiany,
//   errors     pliki, których front matter ma błąd.
function syncIndex(db, { root, matrix }) {
  const folder = path.resolve(root);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error(`Indeksowany folder nie istnieje: ${root}`);
  const rootKey = repoPath(folder);
  const inputsHash = hashText([matrix.file, ...PARSER_FILES].map(file => fs.readFileSync(file, 'utf8')).join('\0'));
  const rebuilt = store.getMeta(db, 'root') !== rootKey || store.getMeta(db, 'inputs_hash') !== inputsHash;
  const counts = { root: rootKey, rebuilt, files: 0, added: 0, changed: 0, removed: 0, unchanged: 0, errors: 0 };

  db.exec('BEGIN');
  try {
    if (rebuilt) {
      store.clearFiles(db);
      store.setMeta(db, 'root', rootKey);
      store.setMeta(db, 'inputs_hash', inputsHash);
    }
    const known = store.fileHashes(db);
    const seen = new Set();
    for (const file of collectFiles(folder)) {
      const raw = fs.readFileSync(file, 'utf8');
      const key = repoPath(file);
      seen.add(key);
      counts.files++;
      if (known.get(key) === hashText(raw)) {
        counts.unchanged++;
        continue;
      }
      store.putFile(db, fileRecord(file, raw, matrix));
      counts[known.has(key) ? 'changed' : 'added']++;
    }
    for (const key of known.keys()) {
      if (seen.has(key)) continue;
      store.removeFile(db, key);
      counts.removed++;
    }
    counts.errors = db.prepare(`SELECT COUNT(*) AS count FROM file WHERE kind = 'error'`).get().count;
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return counts;
}

module.exports = { REPO_ROOT, repoPath, fileRecord, syncIndex };
