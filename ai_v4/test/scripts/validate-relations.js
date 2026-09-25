#!/usr/bin/env node
'use strict';

// Walidator relacji.
//
// Sprawdza graf dokumentacji: czy pole relations zgadza się z treścią
// (to samo, co sync-relations.js), czy cele wpisów istnieją, czy wpisy
// spełniają liczebność i reguły z matrycy relacji, czy doc-id są unikalne,
// czy każdy dokument jest połączony z resztą grafu i czy numery wierszy REQ,
// RB, RD, NFRT i ROLE nie wracają do obiegu (standards/methodology.md, sekcje 3,
// 4 i 8).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseId, findIds } = require('./lib/ids');
const { CONTAINS, loadMatrix } = require('./lib/matrix');
const { loadDocuments, buildIndex, parseDocument } = require('./lib/documents');
const { displayPath, parseArgs, printFindings } = require('./lib/report');
const { deriveRelations, reconcile } = require('./sync-relations');

const USAGE = `Użycie: node scripts/validate-relations.js <folder|plik.md> [...] [--json]

Sprawdza relacje w dokumentacji. Sprawdzenia grafu (cel istnieje, połączenie
z resztą grafu) potrzebują wszystkich dokumentów, więc podaj folder całej
dokumentacji. Sprawdzenie numerów wierszy czyta historię git tego folderu.

  --json  Wypisuje wynik jako JSON.

Kod wyjścia:
  0  nie ma błędów (mogą być ostrzeżenia)
  1  jest co najmniej jeden błąd
  2  błędne wywołanie skryptu albo nie da się odczytać matrycy`;

const CHECKS = {
  'REL-01': 'wzmianki i pole relations',
  'REL-02': 'cel nie istnieje',
  'REL-03': 'liczebność',
  'REL-04': 'reguła trójki',
  'REL-05': 'encja zawarta wskazana osobno',
  'REL-06': 'doc-id nie jest unikalny',
  'REL-07': 'brak połączenia z grafem',
  'REL-08': 'numer wiersza użyty ponownie',
};

// Wiersze, których numer nie wraca do obiegu (methodology.md, sekcja 3).
const NUMBERED_ROWS = ['REQ', 'RB', 'RD', 'NFRT', 'ROLE'];

// ── REL-01 ──────────────────────────────────────────────────────────────────
function checkMentions(doc, matrix, index, add) {
  const derivation = deriveRelations(doc, matrix);
  const { issues } = reconcile(doc, derivation, matrix);
  const syncFix = `Uruchom: node scripts/sync-relations.js ${displayPath(doc.file)} --fix`;
  for (const issue of [...derivation.problems, ...issues]) {
    let fix = null;
    if (issue.level === 'fix') {
      fix = syncFix;
    } else if (issue.label === 'wzmianka o dokumencie wskazującym') {
      fix = `Usuń wzmiankę o ${issue.mention.id} z linii ${issue.line}.`;
    } else if (issue.label === 'wiersz bez prefiksu') {
      // Pełne ID jest jednoznaczne, gdy dokument wskazuje dokładnie jeden
      // dokument, który ma taki wiersz.
      const candidates = [...new Set(doc.links.map(link => link.targetDoc))]
        .filter(id => id !== doc.docId && index.exists(`${id}.${issue.mention.row}`));
      if (candidates.length === 1) fix = `Zapisz wiersz pełnym ID: ${candidates[0]}.${issue.mention.row}.`;
    }
    add('REL-01', issue.line || 1, `${issue.label}: ${issue.subject}. ${issue.detail}`, fix);
  }
}

// ── REL-02 ──────────────────────────────────────────────────────────────────
function checkTargets(doc, index, add) {
  const lowerIds = new Map([...index.byId.keys()].map(id => [id.toLowerCase(), id]));
  for (const link of doc.links) {
    if (index.exists(link.key)) continue;
    const id = parseId(link.key);
    if (id.row && index.byId.has(id.doc)) {
      add('REL-02', link.line, `Wpis ${link.type} ${link.target} wskazuje wiersz ${id.row}, a ${id.doc} nie ma wpisu contains ${id.row}.`, null);
      continue;
    }
    const similar = lowerIds.get(id.doc.toLowerCase());
    add('REL-02', link.line, `Wpis ${link.type} ${link.target} wskazuje dokument ${id.doc}, którego nie ma w sprawdzanych plikach.`,
      similar ? `Popraw w treści ${id.doc} na ${similar}, a potem uruchom: node scripts/sync-relations.js ${displayPath(doc.file)} --fix` : null);
  }
}

// ── REL-03 ──────────────────────────────────────────────────────────────────
// Liczebność „źródła:cele” z matrycy. 1 po stronie źródeł: cel ma najwyżej jedno
// źródło. 1 po stronie celów: źródło ma najwyżej jeden cel tego typu.
function checkCardinality(documents, matrix, add) {
  for (const triple of matrix.triples) {
    if (!triple.cardinality) continue;
    const [sources, targets] = triple.cardinality.split(':');
    const name = `${triple.source} ${triple.relation} ${triple.target} (${triple.cardinality})`;
    const matching = doc => (doc.docType === triple.source ? doc.links.filter(link => link.type === triple.relation && link.targetType === triple.target) : []);
    if (targets === '1') {
      for (const doc of documents) {
        for (const link of matching(doc).slice(1)) {
          add(doc, 'REL-03', link.line, `${doc.docId} ma drugi wpis ${link.type} do typu ${triple.target}: ${link.target}. Według trójki ${name} źródło wskazuje najwyżej jeden cel.`, null);
        }
      }
    }
    if (sources === '1') {
      const byTarget = new Map();
      for (const doc of documents) {
        for (const link of matching(doc)) {
          if (!byTarget.has(link.key)) byTarget.set(link.key, []);
          byTarget.get(link.key).push({ doc, link });
        }
      }
      for (const [key, list] of byTarget) {
        const ids = [...new Set(list.map(item => item.doc.docId))];
        if (ids.length < 2) continue;
        for (const { doc, link } of list) {
          add(doc, 'REL-03', link.line, `${key} wskazują ${ids.join(', ')}. Według trójki ${name} cel ma najwyżej jedno źródło.`, null);
        }
      }
    }
  }
}

// ── REL-04 ──────────────────────────────────────────────────────────────────
// Reguły z komentarza przy trójce LDM realizes DOM w relation-matrix.yaml.
function checkModelRules(documents, index, add) {
  const domainsOf = doc => [...new Set(index.out(doc, 'realizes', ['DOM']).map(link => link.targetDoc))];
  for (const doc of documents) {
    if (doc.docType === 'LDM') {
      const links = index.out(doc, 'realizes', ['DOM']);
      const first = links[0];
      for (const link of links) {
        if (link.targetDoc === first.targetDoc) continue;
        add(doc, 'REL-04', link.line, `${doc.docId} realizuje pojęcia z ${first.targetDoc} i z ${link.targetDoc}. Wszystkie pojęcia DOM jednego LDM pochodzą z jednego DDM (relation-matrix.yaml, LDM realizes DOM).`, null);
      }
    }
    if (doc.docType !== 'ENT') continue;
    const models = index.incoming(doc.docId).filter(({ doc: source, link }) => source.docType === 'LDM' && link.type === CONTAINS).map(({ doc: source }) => source);
    for (const model of models) {
      const concepts = index.out(model, 'realizes', ['DOM']).map(link => link.key);
      for (const link of index.out(doc, 'realizes', ['DOM'])) {
        if (concepts.includes(link.key)) continue;
        add(doc, 'REL-04', link.line, `${doc.docId} realizuje ${link.key}, a jego ${model.docId} nie realizuje tego pojęcia. Encja realizuje tylko pojęcie, które realizuje jej LDM (relation-matrix.yaml, LDM realizes DOM).`, null);
      }
      const domains = domainsOf(model);
      for (const link of index.out(doc, 'realizes', ['RD'])) {
        if (!domains.length || domains.includes(link.targetDoc)) continue;
        add(doc, 'REL-04', link.line, `${doc.docId} realizuje regułę ${link.key}, a jego ${model.docId} realizuje pojęcia z ${domains.join(', ')}. Encja realizuje tylko regułę RD z DDM swojego LDM (relation-matrix.yaml, LDM realizes DOM).`, null);
      }
    }
  }
}

// ── REL-05 ──────────────────────────────────────────────────────────────────
function checkNestedEntities(documents, index, add) {
  for (const doc of documents) {
    const entities = new Map(index.out(doc, 'consumes', ['ENT']).map(link => [link.key, link]));
    for (const [key] of entities) {
      const parent = index.docOf(key);
      if (!parent) continue;
      for (const child of index.out(parent, CONTAINS, ['ENT'])) {
        if (!entities.has(child.key)) continue;
        add(doc, 'REL-05', entities.get(child.key).line,
          `${doc.docId} wskazuje ${key} i ${child.key}, a ${key} zawiera ${child.key}. Encja zagnieżdżona dostaje osobny wpis tylko wtedy, gdy występuje jako osobny obiekt (relation-matrix.yaml, „Którą encję wskazuje dokument”).`,
          null, 'warning');
      }
    }
  }
}

// ── REL-06 i REL-07 ─────────────────────────────────────────────────────────
function checkIdentity(documents, index, add) {
  for (const [id, list] of index.byId) {
    if (list.length < 2) continue;
    for (const doc of list) {
      const others = list.filter(other => other !== doc).map(other => displayPath(other.file));
      const field = doc.fields.find(item => item.name === 'doc-id');
      add(doc, 'REL-06', field ? field.line : 1, `doc-id ${id} ma też: ${others.join(', ')}.`, null);
    }
  }
}

function checkConnectivity(documents, index, add) {
  const parent = new Map(documents.map(doc => [doc.docId, doc.docId]));
  const find = id => {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)));
      id = parent.get(id);
    }
    return id;
  };
  for (const doc of documents) {
    for (const link of doc.links) {
      if (link.targetDoc !== doc.docId && index.exists(link.key)) parent.set(find(doc.docId), find(link.targetDoc));
    }
  }
  const groups = new Map();
  for (const id of index.byId.keys()) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  if (groups.size < 2) return;
  // Główny graf to największa grupa. Przy równej wielkości wygrywa grupa
  // z alfabetycznie pierwszym doc-id.
  const sorted = [...groups.values()].map(ids => ids.sort()).sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
  for (const ids of sorted.slice(1)) {
    for (const id of ids) {
      for (const doc of index.byId.get(id)) {
        add(doc, 'REL-07', 1, ids.length === 1
          ? `${id} nie ma żadnego powiązania: nie ma wpisów do istniejących celów i nie wskazuje go żaden dokument (methodology.md, sekcja 4).`
          : `${id} należy do wyspy ${ids.join(', ')}: te dokumenty są połączone tylko ze sobą, a nie z resztą grafu (methodology.md, sekcja 4).`, null);
      }
    }
  }
}

// ── REL-08 ──────────────────────────────────────────────────────────────────
// Wiersze z numerem, które dokument o doc-id docId zawiera: własne wiersze
// zapisane samym ID albo pełnym ID z doc-id tego dokumentu.
function numberedRows(text, docId, docType, matrix) {
  const rows = new Set();
  for (const id of findIds(text)) {
    if (!id.row || (id.doc && id.doc !== docId)) continue;
    const parsed = parseId(id.row);
    if (parsed && NUMBERED_ROWS.includes(parsed.rowType) && matrix.owns(docType, parsed.rowType)) rows.add(id.row);
  }
  return rows;
}

// REQ-05 daje { series: 'REQ', number: 5, width: 2 }, NFRT-PERF-02 daje serię NFRT-PERF.
function numberOf(row) {
  const match = /^(.*)-(\d+)$/.exec(row);
  return { series: match[1], number: Number(match[2]), width: match[2].length };
}

function checkNumbering(documents, inputs, matrix, add, notes) {
  const first = path.resolve(inputs[0]);
  const cwd = fs.statSync(first).isDirectory() ? first : path.dirname(first);
  const run = (args, input) => execFileSync('git', args, { cwd: root || cwd, input, maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'ignore'] });
  let root = null;
  try {
    root = run(['rev-parse', '--show-toplevel']).toString().trim();
    run(['rev-parse', '--verify', 'HEAD']);
  } catch (error) {
    notes.push('REL-08 pominięte: folder nie jest w repozytorium git albo repozytorium nie ma jeszcze commitów.');
    return;
  }
  const specs = inputs.map(input => path.relative(root, path.resolve(input)).split(path.sep).join('/') || '.');
  const shas = new Set();
  const headShas = new Set();
  for (const line of run(['log', '--format=', '--raw', '--no-abbrev', '--no-renames', 'HEAD', '--', ...specs]).toString().split('\n')) {
    const match = /^:\d+ \d+ ([0-9a-f]+) ([0-9a-f]+) \S+\t(.*)$/.exec(line);
    if (!match || !match[3].endsWith('.md')) continue;
    for (const sha of [match[1], match[2]]) if (!/^0+$/.test(sha)) shas.add(sha);
  }
  for (const line of run(['ls-tree', '-r', 'HEAD', '--', ...specs]).toString().split('\n')) {
    const match = /^\d+ blob ([0-9a-f]+)\t(.*)$/.exec(line);
    if (match && match[2].endsWith('.md')) { shas.add(match[1]); headShas.add(match[1]); }
  }
  if (!shas.size) return;

  // Treść wszystkich wersji plików z historii, jednym wywołaniem git cat-file.
  const output = run(['cat-file', '--batch'], [...shas].join('\n') + '\n');
  const highest = new Map();
  const headRows = new Map();
  let offset = 0;
  while (offset < output.length) {
    const headerEnd = output.indexOf(10, offset);
    const [sha, kind, size] = output.slice(offset, headerEnd).toString().split(' ');
    const start = headerEnd + 1;
    offset = start + (kind === 'blob' ? Number(size) + 1 : 0);
    if (kind !== 'blob') continue;
    const doc = parseDocument(sha, output.slice(start, start + Number(size)).toString('utf8'), matrix);
    if (!doc.docType) continue;
    const rows = numberedRows(doc.lines.join('\n'), doc.docId, doc.docType, matrix);
    for (const row of rows) {
      const { series, number } = numberOf(row);
      const key = `${doc.docId}|${series}`;
      highest.set(key, Math.max(highest.get(key) || 0, number));
    }
    if (headShas.has(sha)) {
      if (!headRows.has(doc.docId)) headRows.set(doc.docId, new Set());
      rows.forEach(row => headRows.get(doc.docId).add(row));
    }
  }

  for (const doc of documents) {
    const rows = [...numberedRows(doc.lines.join('\n'), doc.docId, doc.docType, matrix)];
    const before = headRows.get(doc.docId) || new Set();
    const next = new Map();
    const fresh = rows.filter(row => !before.has(row)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const row of fresh) {
      const { series, number, width } = numberOf(row);
      const max = highest.get(`${doc.docId}|${series}`);
      if (max === undefined || number > max) continue;
      if (!next.has(series)) {
        const current = rows.map(numberOf).filter(item => item.series === series).map(item => item.number);
        next.set(series, Math.max(max, ...current) + 1);
      }
      const suggested = `${series}-${String(next.get(series)).padStart(width, '0')}`;
      next.set(series, next.get(series) + 1);
      const line = doc.lines.findIndex((text, index) => index > doc.frontMatterEnd && findIds(text).some(id => id.row === row && (!id.doc || id.doc === doc.docId)));
      add(doc, 'REL-08', line >= 0 ? line + 1 : 1,
        `Wiersz ${row} jest nowy względem HEAD, a ${doc.docId} miał już w historii numer ${series}-${String(max).padStart(width, '0')}. Nowy wiersz dostaje kolejny wolny numer (methodology.md, sekcja 3).`,
        `Zmień ${row} na ${suggested} w ${doc.docId} i we wpisach innych dokumentów, które go wskazują.`);
    }
  }
}

function main(args) {
  const options = parseArgs(args, USAGE);
  if (options.exitCode !== undefined) return options.exitCode;
  let matrix;
  try {
    matrix = loadMatrix();
  } catch (error) {
    console.error(`Nie da się odczytać matrycy relacji: ${error.message}`);
    return 2;
  }
  const { documents, broken } = loadDocuments(options.inputs, matrix);
  const index = buildIndex(documents, matrix);
  const findings = [];
  const notes = [];
  if (broken.length) notes.push(`Pominięte pliki z błędnym front matter: ${broken.length}. Szczegóły wypisuje validate-form.js.`);
  const add = (doc, code, line, message, fix, severity = 'error') => findings.push({ file: doc.file, line, docId: doc.docId, severity, code, check: CHECKS[code], message, fix });

  for (const doc of documents) {
    const addTo = (code, line, message, fix, severity) => add(doc, code, line, message, fix, severity);
    checkMentions(doc, matrix, index, addTo);
    checkTargets(doc, index, addTo);
  }
  checkCardinality(documents, matrix, add);
  checkModelRules(documents, index, add);
  checkNestedEntities(documents, index, add);
  checkIdentity(documents, index, add);
  checkConnectivity(documents, index, add);
  checkNumbering(documents, options.inputs, matrix, add, notes);
  return printFindings(findings, { json: options.json, documents: documents.length, notes });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
