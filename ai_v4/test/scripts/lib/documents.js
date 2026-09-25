'use strict';

// Odczyt dokumentów: pliki, front matter, pole relations, treść Markdown
// i indeks powiązań między dokumentami.

const fs = require('fs');
const path = require('path');
const { DOC_MATCHERS, typeOf, parseId } = require('./ids');
const { CONTAINS } = require('./matrix');
const { displayPath } = require('./report');

// Lista bez powtórzeń, w kolejności pierwszego wystąpienia.
function uniq(values) {
  return [...new Set(values)];
}

// Odczytuje prostą wartość YAML: usuwa komentarz po znaku # i cudzysłowy wokół wartości.
function scalar(value) {
  const text = value.replace(/(^|\s)#.*$/, '').trim();
  const quoted = /^(["'])(.*)\1$/.exec(text);
  return quoted ? quoted[2] : text;
}

// Zbiera pliki do sprawdzenia. Podany plik zwraca bez zmian. Folder przegląda
// razem z podfolderami i bierze z niego pliki .md. Pomija wszystko, co zaczyna
// się od kropki, oraz folder node_modules.
function collectFiles(target) {
  if (fs.statSync(target).isFile()) return [target];
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

// Pozycja linii zamykającej front matter albo -1, gdy plik nie zaczyna się
// od front matter albo nie ma linii zamykającej.
function frontMatterEnd(lines) {
  if (!/^---\s*$/.test(lines[0])) return -1;
  return lines.findIndex((line, index) => index > 0 && /^---\s*$/.test(line));
}

// Wczytuje plik i odczytuje jego front matter. Szczegóły w parseDocument.
function readDocument(file, matrix) {
  return parseDocument(file, fs.readFileSync(file, 'utf8'), matrix);
}

// Odczytuje front matter z tekstu pliku. Zwraca obiekt z polem kind:
//   not-document  plik nie jest dokumentem, bo nie ma front matter z polem doc-id,
//   error         plik wygląda na dokument, ale jego front matter ma błąd,
//   document      poprawny dokument z odczytanym polem relations.
// Zapamiętuje też znacznik BOM i rodzaj końca linii, żeby opcja --fix zapisała
// plik w tym samym formacie, oraz pola front matter z numerami linii.
function parseDocument(file, raw, matrix) {
  const bom = raw.charCodeAt(0) === 0xfeff;
  const text = bom ? raw.slice(1) : raw;
  const doc = { file, bom, eol: text.includes('\r\n') ? '\r\n' : '\n', lines: text.split(/\r?\n/) };
  if (!/^---\s*$/.test(doc.lines[0])) return { ...doc, kind: 'not-document' };
  const end = frontMatterEnd(doc.lines);
  if (end < 0) {
    if (!doc.lines.some(line => /^doc-id\s*:/.test(line))) return { ...doc, kind: 'not-document' };
    return { ...doc, kind: 'error', error: 'Front matter nie ma linii zamykającej ---.' };
  }

  const fields = [];
  for (let index = 1; index < end; index++) {
    const field = /^([\w-]+)\s*:(.*)$/.exec(doc.lines[index]);
    if (field) fields.push({ name: field[1], value: field[2], index });
  }
  doc.fields = fields.map(field => ({ name: field.name, value: scalar(field.value), line: field.index + 1 }));
  const idField = fields.find(field => field.name === 'doc-id');
  if (!idField) return { ...doc, kind: 'not-document' };
  doc.docId = scalar(idField.value);
  doc.docType = typeOf(DOC_MATCHERS, doc.docId);
  if (!doc.docType) return { ...doc, kind: 'error', error: `doc-id „${doc.docId}” nie pasuje do żadnego znanego typu dokumentu.` };

  const relationFields = fields.filter(field => field.name === 'relations');
  if (relationFields.length > 1) return { ...doc, kind: 'error', error: 'Front matter ma więcej niż jedno pole relations.' };
  doc.frontMatterEnd = end;
  doc.entries = [];
  doc.relationsErrors = [];
  if (relationFields.length) {
    const field = relationFields[0];
    // Pole relations kończy się przed pierwszą linią, która nie jest wcięta
    // i nie zaczyna się od myślnika. Puste linie i komentarze nie kończą pola.
    let last = field.index + 1;
    for (let index = field.index + 1; index < end; index++) {
      const line = doc.lines[index];
      if (/^\s*(#.*)?$/.test(line)) continue;
      if (!/^[\s-]/.test(line)) break;
      last = index + 1;
    }
    doc.relations = { start: field.index, end: last };
    parseEntries(doc, scalar(field.value), matrix);
  }
  return { ...doc, kind: 'document' };
}

// Odczytuje wpisy z pola relations. Obsługuje dwa zapisy:
//   relations: []       pusta lista,
//   relations: i lista  każdy wpis zaczyna się od myślnika; klucze type i target
//                       mogą stać w osobnych liniach albo w jednej linii
//                       w nawiasach klamrowych: { type: …, target: … }.
// Błąd całego pola trafia do doc.relationsErrors, a błąd pojedynczego wpisu
// do pola invalid tego wpisu.
function parseEntries(doc, inline, matrix) {
  const { start, end } = doc.relations;
  if (inline === '[]') {
    if (end > start + 1) doc.relationsErrors.push({ line: start + 2, text: 'Pole ma zapis relations: [], a mimo to pod nim są wpisy.' });
    return;
  }
  if (inline !== '') {
    doc.relationsErrors.push({ line: start + 1, text: `Skrypt nie obsługuje zapisu „relations: ${inline}”. Wpisy muszą być listą w kolejnych liniach.` });
    return;
  }
  let entry = null;
  for (let index = start + 1; index < end; index++) {
    const line = doc.lines[index];
    if (/^\s*(#.*)?$/.test(line)) continue;
    const item = /^\s*-\s*(.*)$/.exec(line);
    if (item) {
      entry = { line: index + 1, fields: {} };
      doc.entries.push(entry);
    } else if (!entry) {
      doc.relationsErrors.push({ line: index + 1, text: `Linia „${line.trim()}” nie należy do żadnego wpisu, bo przed nią nie ma linii zaczynającej się od myślnika.` });
      continue;
    }
    const content = (item ? item[1] : line).trim();
    if (!content) continue;
    const flow = /^\{(.*)\}(\s+#.*)?$/.exec(content);
    for (const part of flow ? flow[1].split(',') : [content]) {
      const pair = /^\s*([\w-]+)\s*:\s*(.*)$/.exec(part);
      if (pair) entry.fields[pair[1]] = scalar(pair[2]);
      else entry.invalid = `Nie da się odczytać fragmentu „${part.trim()}”. Oczekiwany zapis to klucz: wartość.`;
    }
  }
  if (!doc.entries.length && !doc.relationsErrors.length) {
    doc.relationsErrors.push({ line: start + 1, text: 'Pole relations nie ma wpisów. Pustą listę zapisuje się jako relations: [].' });
  }
  for (const current of doc.entries) {
    const { type, target } = current.fields;
    const extra = Object.keys(current.fields).filter(name => name !== 'type' && name !== 'target');
    current.type = type;
    current.target = target;
    if (current.invalid) continue;
    if (!type || !target) current.invalid = 'Wpis nie ma klucza type albo klucza target.';
    else if (extra.length) current.invalid = `Wpis ma klucze inne niż type i target: ${extra.join(', ')}.`;
    else if (!matrix.relationTypes.has(type)) current.invalid = `Rodzaj relacji „${type}” nie występuje na liście relation_types w matrycy.`;
    else if (!parseId(target)) current.invalid = `Cel „${target}” nie jest identyfikatorem dokumentu ani wiersza.`;
  }
}

// Dzieli wiersz tabeli Markdown na komórki. Znak \| nie dzieli komórki.
function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim());
}

// Rozbiera treść Markdown od linii start (liczonej od 0). Pomija zawartość
// bloków kodu przy szukaniu nagłówków i tabel. Zwraca:
//   headings  nagłówki { level, text, line, h2 }; h2 to nagłówek sekcji nadrzędnej,
//   tables    tabele { h2, h3, header, line, rows: [{ cells, line }] },
//   lines     wszystkie linie { text, line, h2, h3, code, heading, table }.
// Numery linii liczone są od 1.
function parseBody(lines, start) {
  const body = { headings: [], tables: [], lines: [] };
  let fence = null;
  let h2 = null;
  let h3 = null;
  let table = null;
  for (let index = start; index < lines.length; index++) {
    const text = lines[index];
    const line = index + 1;
    const marker = /^\s*(```|~~~)/.exec(text);
    if (fence || marker) {
      if (marker && (!fence || marker[1] === fence)) fence = fence ? null : marker[1];
      table = null;
      body.lines.push({ text, line, h2, h3, code: true });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(text);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      if (level <= 2) { h2 = level === 2 ? title : null; h3 = null; } else if (level === 3) h3 = title;
      body.headings.push({ level, text: title, line, h2: level > 2 ? h2 : null });
      table = null;
      body.lines.push({ text, line, h2, h3, heading: true });
      continue;
    }
    if (/^\s*\|/.test(text)) {
      const cells = splitRow(text);
      if (!table) {
        table = { h2, h3, header: cells, line, rows: [], delimiter: false };
        body.tables.push(table);
      } else if (!table.delimiter && !table.rows.length && cells.every(cell => /^:?-+:?$/.test(cell))) {
        table.delimiter = true;
      } else {
        table.rows.push({ cells, line });
      }
      body.lines.push({ text, line, h2, h3, table });
      continue;
    }
    table = null;
    body.lines.push({ text, line, h2, h3 });
  }
  return body;
}

// Wczytuje dokumenty z podanych plików i folderów. Zwraca:
//   documents  poprawne dokumenty z rozebraną treścią (pole body),
//   broken     pliki, których nie da się odczytać jako dokumentu: { file, docId, line, message },
//   skipped    liczba plików .md bez doc-id znalezionych w folderach.
function loadDocuments(inputs, matrix) {
  const explicit = new Set();
  const files = new Set();
  for (const input of inputs) {
    const target = path.resolve(input);
    if (fs.statSync(target).isFile()) explicit.add(target);
    for (const file of collectFiles(target)) files.add(file);
  }
  const documents = [];
  const broken = [];
  let skipped = 0;
  const sorted = [...files].sort((a, b) => (displayPath(a) < displayPath(b) ? -1 : 1));
  for (const file of sorted) {
    let doc;
    try {
      doc = readDocument(file, matrix);
    } catch (error) {
      broken.push({ file, message: `Nie da się odczytać pliku: ${error.message}` });
      continue;
    }
    if (doc.kind === 'not-document') {
      if (explicit.has(file)) broken.push({ file, line: 1, message: 'Plik podany wprost nie ma front matter z polem doc-id, więc nie jest dokumentem.' });
      else skipped++;
      continue;
    }
    if (doc.kind === 'error') {
      broken.push({ file, docId: doc.docId, line: 1, message: doc.error });
      continue;
    }
    doc.body = parseBody(doc.lines, doc.frontMatterEnd + 1);
    documents.push(doc);
  }
  return { documents, broken, skipped };
}

// Powiązania jednego dokumentu: poprawne wpisy z pola relations, w których cel
// ma pełne ID (key). Własny wiersz, zapisany samym ID, dostaje pełne ID z doc-id
// dokumentu. Sam wiersz, którego typ dokumentu nie zawiera, jest pomijany.
function linksOf(doc, matrix) {
  const links = [];
  for (const entry of doc.entries) {
    if (entry.invalid) continue;
    const id = parseId(entry.target);
    if (!id || (!id.doc && !matrix.owns(doc.docType, id.rowType))) continue;
    links.push({
      type: entry.type,
      target: entry.target,
      key: id.doc ? entry.target : `${doc.docId}.${id.row}`,
      targetType: id.rowType || id.docType,
      targetDoc: id.doc || doc.docId,
      line: entry.line,
    });
  }
  return links;
}

// Buduje indeks powiązań. Każdy dokument dostaje pole links (linksOf). Zwraca:
//   byId      doc-id → lista dokumentów o tym doc-id,
//   docOf     pierwszy dokument o danym doc-id,
//   exists    czy węzeł o pełnym ID istnieje; wiersz istnieje, gdy jego dokument ma wpis contains,
//   incoming  wpisy innych dokumentów, które wskazują węzeł: [{ doc, link }],
//   out       wpisy dokumentu wybranego rodzaju i do wybranych typów celu.
function buildIndex(documents, matrix) {
  const byId = new Map();
  const incoming = new Map();
  for (const doc of documents) {
    if (!byId.has(doc.docId)) byId.set(doc.docId, []);
    byId.get(doc.docId).push(doc);
  }
  for (const doc of documents) {
    doc.links = linksOf(doc, matrix);
    for (const link of doc.links) {
      if (!incoming.has(link.key)) incoming.set(link.key, []);
      incoming.get(link.key).push({ doc, link });
    }
  }
  const docOf = id => (byId.get(id) || [])[0];
  const exists = key => {
    const id = parseId(key);
    if (!id || !id.doc) return false;
    if (!id.row) return byId.has(id.doc);
    return (byId.get(id.doc) || []).some(owner => owner.links.some(link => link.type === CONTAINS && link.key === key));
  };
  const out = (doc, relation, types) => doc.links.filter(link => (!relation || link.type === relation) && (!types || types.includes(link.targetType)));
  return { byId, docOf, exists, incoming: key => incoming.get(key) || [], out };
}

module.exports = {
  uniq, scalar, collectFiles, frontMatterEnd, readDocument, parseDocument, parseBody, splitRow,
  loadDocuments, linksOf, buildIndex,
};
