#!/usr/bin/env node
'use strict';

// Migracja dokumentów ze starego front matter na pole relations.
//
// Stary standard zapisywał powiązania w polach source-spec-ids (dokument
// nadrzędny) i related-doc-ids (dokumenty powiązane), zdolność w polu component,
// a typ dokumentu w polu type. Nowy standard ma jedno pole relations, a jego
// wpisy wynikają z identyfikatorów wspomnianych w treści dokumentu.
//
// Skrypt dla każdego dokumentu w starym formacie:
//   1. zmienia stary zapis wierszy: NFR-PERF-01 na NFRT-PERF-01, ACTOR-01 na ROLE-01,
//   2. dopisuje ID dokumentu do wiersza innego dokumentu zapisanego bez niego,
//      na przykład REQ-01 → BFS-001.REQ-01, gdy stare pola wskazują dokładnie
//      jeden dokument, który może mieć taki wiersz,
//   3. usuwa pola type, component, source-spec-ids i related-doc-ids,
//   4. zapisuje pole relations wyliczone z treści, tak jak sync-relations.js --fix,
//   5. sprawdza, czy każde stare powiązanie ma relację w nowym grafie, w którąkolwiek
//      stronę, i zgłasza te, które przepadły.

const fs = require('fs');
const path = require('path');
const { ID_PATTERN, DOC_MATCHERS, ROW_MATCHERS, typeOf, parseId } = require('./lib/ids');
const { MATRIX_FILE, CONTAINS, loadMatrix } = require('./lib/matrix');
const { uniq, collectFiles, parseDocument, linksOf } = require('./lib/documents');
const { displayPath } = require('./lib/report');
const { deriveRelations, reconcile } = require('./sync-relations');

const USAGE = `Użycie: node scripts/migrate-relations.js <folder> [...] [--fix]

Skrypt przepisuje dokumenty ze starego front matter (source-spec-ids,
related-doc-ids, component, type) na pole relations wyliczone z treści.

  bez opcji  Wypisuje, co zmieni, i niczego nie zmienia w plikach.
  --fix      Zapisuje zmiany w plikach.

Podaj folder całej dokumentacji. Skrypt sprawdza, czy stare powiązanie ma
relację po którejkolwiek stronie, więc potrzebuje obu dokumentów.

Kod wyjścia:
  0  nie ma nic do zmiany ani do poprawy ręcznej
  1  są zmiany do zapisania albo powiązania do poprawy ręcznej
  2  błędne wywołanie skryptu albo nie da się odczytać matrycy`;

// Etykiety w raporcie:
//   manual   trzeba poprawić ręcznie,
//   change   zmianę zapisze opcja --fix,
//   changed  opcja --fix już zapisała zmianę.
const LABELS = { manual: 'RĘCZNIE', change: 'DO ZMIANY', changed: 'ZMIENIONE' };

// Pola starego front matter. Pola z listy LINK_FIELDS podają ID powiązanych
// dokumentów. Pole type podaje typ dokumentu, który w nowym standardzie wynika
// z prefiksu doc-id.
const OLD_FIELDS = ['type', 'component', 'source-spec-ids', 'related-doc-ids'];
const LINK_FIELDS = ['component', 'source-spec-ids', 'related-doc-ids'];

// Stary zapis wierszy, które w nowym standardzie mają własny prefiks:
//   wiersz NFR: NFR-PERF-01 → NFRT-PERF-01,
//   rola aktora: ACTOR-01 → ROLE-01. Rola ma numer z dwóch cyfr, a dokument
//   aktora z trzech (ACTOR-001), więc ACTOR-001 zostaje bez zmian.
const OLD_ROWS = [
  { name: 'zapis wiersza NFR', pattern: /(?<![\p{L}\p{N}\-])NFR-([A-Z][A-Z0-9]*-\d+)(?![\p{L}\p{N}\-])/gu, prefix: 'NFRT', detail: 'Wiersz NFR ma w nowym standardzie prefiks NFRT.' },
  { name: 'zapis roli aktora', pattern: /(?<![\p{L}\p{N}\-])ACTOR-(\d{2})(?![\p{L}\p{N}\-])/gu, prefix: 'ROLE', detail: 'Rola aktora ma w nowym standardzie prefiks ROLE.' },
];

// Znajduje w front matter pola starego formatu. Pole kończy się przed pierwszą
// linią, która nie jest wcięta i nie zaczyna się od myślnika, tak jak pole
// relations w lib/documents.js. Zwraca pola { name, start, end, text }, gdzie
// start i end to pozycje linii, a text to wartość razem z liniami listy.
function findOldFields(lines, end) {
  const fields = [];
  for (let index = 1; index < end; index++) {
    const field = /^([\w-]+)\s*:(.*)$/.exec(lines[index]);
    if (!field || !OLD_FIELDS.includes(field[1])) continue;
    let last = index + 1;
    for (let next = index + 1; next < end; next++) {
      if (/^\s*(#.*)?$/.test(lines[next])) continue;
      if (!/^[\s-]/.test(lines[next])) break;
      last = next + 1;
    }
    const text = lines.slice(index, last).map((line, offset) => (offset ? line : field[2]))
      .map(line => line.replace(/(^|\s)#.*$/, '')).join(' ');
    fields.push({ name: field[1], start: index, end: last, text });
  }
  return fields;
}

// Odczytuje ID ze starych pól powiązań. Zwraca:
//   links     ID dokumentów bez powtórzeń, w kolejności wystąpienia; własne
//             wiersze dokumentu, na przykład A1 w UC, skrypt pomija,
//   problems  wartości, których nie da się odczytać jako ID dokumentu.
function readOldLinks(fields, docId, docType, matrix) {
  const links = [];
  const problems = [];
  for (const field of fields.filter(item => LINK_FIELDS.includes(item.name))) {
    // Wartości oddzielają przecinki, nawiasy listy i myślniki na początku pozycji listy.
    const values = field.text.split(/[,[\]]|(?:^|\s)-\s/).map(value => value.trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean);
    for (const value of values) {
      const id = parseId(value);
      if (!id) problems.push(`Pole ${field.name} ma wartość „${value}”, która nie jest ID dokumentu.`);
      else if (!id.doc && matrix.owns(docType, id.rowType)) continue;
      else if (!id.doc) problems.push(`Pole ${field.name} ma wiersz ${value} bez ID dokumentu, więc skrypt nie wie, do którego dokumentu należy.`);
      else if (id.doc !== docId) links.push(id.doc);
    }
  }
  return { links: uniq(links), problems };
}

// Zmienia stary zapis wierszy z listy OLD_ROWS w treści. Zwraca listę zmian
// { rule, from, to, line }.
function renameOldRows(lines, end) {
  const changes = [];
  for (let index = end + 1; index < lines.length; index++) {
    for (const rule of OLD_ROWS) {
      lines[index] = lines[index].replace(rule.pattern, (match, rest) => {
        changes.push({ rule, from: match, to: `${rule.prefix}-${rest}`, line: index + 1 });
        return `${rule.prefix}-${rest}`;
      });
    }
  }
  return changes;
}

// Dopisuje ID dokumentu do wierszy innych dokumentów zapisanych bez niego.
// Wiersz dostaje ID dokumentu tylko wtedy, gdy matryca pozwala wskazać taki
// wiersz relacją inną niż contains i stare pola wskazują dokładnie jeden
// dokument, który zawiera wiersze tego typu. Przykład: UC ze starym polem
// source-spec-ids: BFS-001 wspomina REQ-01, więc wzmianka zmienia się na
// BFS-001.REQ-01. Zwraca:
//   changes    zmiany { from, to, line },
//   ambiguous  wiersze, których skrypt nie zmienił, z wyjaśnieniem.
function prefixRows(lines, end, docType, oldLinks, matrix) {
  const changes = [];
  const ambiguous = new Map();
  for (let index = end + 1; index < lines.length; index++) {
    const matches = [...lines[index].matchAll(ID_PATTERN)].filter(match => match[3]);
    for (const match of matches.reverse()) {
      const row = match[3];
      const rowType = typeOf(ROW_MATCHERS, row);
      if (matrix.owns(docType, rowType)) continue;
      const relation = matrix.relation(docType, rowType);
      if (!relation || relation === CONTAINS) continue;
      const owners = oldLinks.filter(id => matrix.owns(typeOf(DOC_MATCHERS, id), rowType));
      if (owners.length !== 1) {
        if (!ambiguous.has(row)) {
          ambiguous.set(row, owners.length
            ? `Stare pola wskazują kilka dokumentów z wierszami typu ${rowType}: ${owners.join(', ')}. Dopisz ID właściwego dokumentu, na przykład ${owners[0]}.${row}.`
            : `Stare pola nie wskazują dokumentu z wierszami typu ${rowType}. Dopisz ID dokumentu, do którego należy wiersz.`);
        }
        continue;
      }
      const to = `${owners[0]}.${row}`;
      const text = lines[index];
      lines[index] = text.slice(0, match.index) + to + text.slice(match.index + row.length);
      changes.push({ from: row, to, line: index + 1 });
    }
  }
  return { changes, ambiguous };
}

// Skraca listę zmian do postaci „REQ-01 → BFS-001.REQ-01 (linie 12, 30)”.
function describeChanges(changes) {
  const groups = new Map();
  for (const change of changes) {
    const key = `${change.from} → ${change.to}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(change.line);
  }
  return [...groups].map(([key, list]) => {
    const numbers = uniq(list).sort((a, b) => a - b);
    return `${key} (${numbers.length > 1 ? 'linie' : 'linia'} ${numbers.join(', ')})`;
  });
}

// Zapisuje pole relations w liniach dokumentu. Jeśli dokument nie ma pola,
// dopisuje je na końcu front matter.
function withRelations(doc, entries) {
  const block = entries.length
    ? ['relations:', ...entries.flatMap(entry => [`  - type: ${entry.type}`, `    target: ${entry.target}`])]
    : ['relations: []'];
  const lines = doc.lines.slice();
  if (doc.relations) lines.splice(doc.relations.start, doc.relations.end - doc.relations.start, ...block);
  else lines.splice(doc.frontMatterEnd, 0, ...block);
  return lines;
}

// Migruje jeden dokument w pamięci. Zwraca null, gdy dokument jest już w nowym
// formacie: nie ma starych pól ani starego zapisu wierszy NFR i ma pole relations.
function migrateDocument(file, raw, matrix) {
  const original = parseDocument(file, raw, matrix);
  if (original.kind === 'not-document') return { kind: 'not-document' };
  const lines = original.lines.slice();
  const end = original.kind === 'document' ? original.frontMatterEnd : -1;
  if (end < 0) return { kind: 'error', docId: original.docId, error: original.error };

  const fields = findOldFields(lines, end);
  const renames = renameOldRows(lines, end);
  if (!fields.length && !renames.length && original.relations) return null;

  const { links, problems: fieldProblems } = readOldLinks(fields, original.docId, original.docType, matrix);
  const prefixes = prefixRows(lines, end, original.docType, links, matrix);
  for (const field of [...fields].reverse()) lines.splice(field.start, field.end - field.start);

  const doc = parseDocument(file, (original.bom ? '﻿' : '') + lines.join('\n'), matrix);
  if (doc.kind !== 'document') return { kind: 'error', docId: original.docId, error: doc.error || 'Po usunięciu starych pól plik nie ma poprawnego front matter.' };
  doc.eol = original.eol;
  const derivation = deriveRelations(doc, matrix);
  const { entries } = reconcile(doc, derivation, matrix);

  const changes = [];
  const manual = [];
  if (fields.length) changes.push({ label: 'stare pola', subject: 'front matter', detail: `Usunięte pola: ${fields.map(field => field.name).join(', ')}.` });
  for (const rule of OLD_ROWS) {
    for (const text of describeChanges(renames.filter(change => change.rule === rule))) changes.push({ label: rule.name, subject: text, detail: rule.detail });
  }
  for (const text of describeChanges(prefixes.changes)) changes.push({ label: 'ID dokumentu przy wierszu', subject: text, detail: 'Dokument wiersza wynika ze starych pól powiązań.' });
  changes.push({ label: 'pole relations', subject: `wpisy: ${entries.length}`, detail: 'Wpisy wyliczone z treści w kolejności z matrycy.' });
  for (const detail of fieldProblems) manual.push({ label: 'stara wartość', subject: 'front matter', detail });
  for (const problem of derivation.problems) {
    const note = problem.label === 'wiersz bez prefiksu' && prefixes.ambiguous.get(problem.mention.id);
    manual.push({ label: problem.label, subject: problem.subject, detail: note || problem.detail });
  }

  const migrated = { ...doc, entries: entries.map(entry => ({ type: entry.type, target: entry.target })) };
  return {
    kind: 'migrated',
    doc: migrated,
    oldLinks: links,
    changes,
    manual,
    text: (original.bom ? '﻿' : '') + withRelations(doc, entries).join(original.eol),
  };
}

// Szuka trójki między dwoma typami dokumentów: wprost albo przez wiersz celu
// inny niż contains. Zwraca opis trójki, na przykład „UC realizes REQ”, albo null.
function tripleBetween(matrix, sourceType, targetType) {
  const direct = matrix.relation(sourceType, targetType);
  if (direct) return `${sourceType} ${direct} ${targetType}`;
  const rowType = matrix.rowTypesOf(targetType).find(type => {
    const relation = matrix.relation(sourceType, type);
    return relation && relation !== CONTAINS;
  });
  return rowType ? `${sourceType} ${matrix.relation(sourceType, rowType)} ${rowType}` : null;
}

// Wyjaśnia, dlaczego stare powiązanie dokumentu doc z dokumentem target nie ma
// relacji w nowym grafie, i mówi, co zrobić.
function lostLinkReason(doc, target, targetDoc, matrix) {
  const targetType = typeOf(DOC_MATCHERS, target);
  if (!targetDoc) return `Dokumentu ${target} nie ma w podanych folderach. Jeśli leży gdzie indziej, uruchom migrację na folderze całej dokumentacji. Jeśli go usunięto, powiązanie przepada.`;
  const what = (id, type, triple) => (triple.endsWith(` ${type}`) ? `ID ${id}` : `pełne ID wiersza dokumentu ${id}`);
  const forward = tripleBetween(matrix, doc.docType, targetType);
  if (forward) return `Treść ${doc.docId} nie wspomina ${target}. Jeśli powiązanie jest aktualne, wpisz ${what(target, targetType, forward)} w treści ${doc.docId} (trójka ${forward}).`;
  const reverse = tripleBetween(matrix, targetType, doc.docType);
  if (reverse) return `Relację zapisuje ${target} (trójka ${reverse}), a jego treść nie wspomina ${doc.docId}. Jeśli powiązanie jest aktualne, wpisz ${what(doc.docId, doc.docType, reverse)} w treści ${target}.`;
  return `Matryca nie ma trójki między ${doc.docType} i ${targetType} w żadnym kierunku, więc powiązanie przepada.`;
}

// Przebieg skryptu: odczyt opcji, wczytanie matrycy, migracja plików, sprawdzenie
// starych powiązań, raport i kod wyjścia.
function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const fixMode = args.includes('--fix');
  const unknown = args.filter(arg => arg.startsWith('-') && arg !== '--fix');
  const inputs = args.filter(arg => !arg.startsWith('-'));
  if (unknown.length || !inputs.length) {
    if (unknown.length) console.error(`Nieznana opcja: ${unknown.join(' ')}\n`);
    console.error(USAGE);
    return 2;
  }
  const missing = inputs.filter(input => !fs.existsSync(input));
  if (missing.length) {
    console.error(`Nie ma takiej ścieżki: ${missing.join(', ')}`);
    return 2;
  }
  let matrix;
  try {
    matrix = loadMatrix(MATRIX_FILE);
  } catch (error) {
    console.error(`Nie da się odczytać matrycy relacji: ${error.message}`);
    return 2;
  }

  const files = uniq(inputs.flatMap(input => collectFiles(path.resolve(input))))
    .sort((a, b) => (displayPath(a) < displayPath(b) ? -1 : 1));
  const report = [];
  const migrated = [];
  const current = new Map();
  let unchanged = 0;
  for (const file of files) {
    let result;
    try {
      result = migrateDocument(file, fs.readFileSync(file, 'utf8'), matrix);
    } catch (error) {
      report.push({ file, items: [{ level: 'manual', label: 'błąd odczytu', subject: 'plik', detail: error.message }] });
      continue;
    }
    if (result === null) {
      unchanged++;
      const doc = parseDocument(file, fs.readFileSync(file, 'utf8'), matrix);
      current.set(doc.docId, { ...doc, entries: doc.entries.filter(entry => !entry.invalid) });
      continue;
    }
    if (result.kind === 'not-document') continue;
    if (result.kind === 'error') {
      report.push({ file, docId: result.docId, items: [{ level: 'manual', label: 'front matter', subject: 'plik', detail: result.error }] });
      continue;
    }
    migrated.push({ file, ...result });
    current.set(result.doc.docId, result.doc);
  }

  // Stare powiązanie ma relację, gdy jeden z dwóch dokumentów ma wpis do drugiego
  // albo do jego wiersza.
  const targets = new Map([...current].map(([docId, doc]) => [docId, new Set(linksOf(doc, matrix).map(link => link.targetDoc))]));
  const linked = (a, b) => (targets.get(a) || new Set()).has(b) || (targets.get(b) || new Set()).has(a);
  for (const item of migrated) {
    const lost = item.oldLinks.filter(target => !linked(item.doc.docId, target));
    for (const target of lost) {
      item.manual.push({ label: 'stare powiązanie bez relacji', subject: target, detail: lostLinkReason(item.doc, target, current.get(target), matrix) });
    }
    if (fixMode) fs.writeFileSync(item.file, item.text, 'utf8');
    report.push({
      file: item.file,
      docId: item.doc.docId,
      items: [...item.changes.map(change => ({ level: 'change', ...change })), ...item.manual.map(entry => ({ level: 'manual', ...entry }))],
    });
  }

  report.sort((a, b) => (displayPath(a.file) < displayPath(b.file) ? -1 : 1));
  for (const { file, docId, items } of report) {
    console.log(docId ? `${displayPath(file)} (${docId})` : displayPath(file));
    for (const item of items) {
      const label = LABELS[item.level === 'change' && fixMode ? 'changed' : item.level];
      console.log(`  ${label.padEnd(10)}  ${item.label}: ${item.subject} — ${item.detail}`);
    }
    console.log('');
  }
  const manual = report.reduce((sum, item) => sum + item.items.filter(entry => entry.level === 'manual').length, 0);
  console.log(`Dokumenty do migracji: ${migrated.length}. Dokumenty już w nowym formacie: ${unchanged}.`);
  console.log(`${fixMode ? 'Zapisane pliki' : 'Pliki do zapisania przez --fix'}: ${migrated.length}. Do poprawy ręcznej: ${manual}.`);
  if (fixMode) return manual ? 1 : 0;
  return manual || migrated.length ? 1 : 0;
}

module.exports = { migrateDocument };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
