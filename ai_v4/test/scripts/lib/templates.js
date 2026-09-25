'use strict';

// Odczyt szablonów dokumentów ze standards/templates.
//
// Spis typów bierze z tabel w _00-meta.md: kolumna „Typ” to nazwa folderu,
// a kolumna „Prefiks” to prefiks doc-id. Z każdego template.md odczytuje:
//   fields    pola front matter; pole z komentarzem „# a | b” ma listę wartości,
//   sections  sekcje H2 w kolejności; sekcja z komentarzem HTML „Opcjonalnie”
//             jest opcjonalna, ale komentarz o kolumnie opcjonalnej tego nie
//             robi; każda sekcja ma listę nagłówków H3,
//   tables    tabele z nagłówkiem, wierszami i listami wartości w komórkach;
//             komentarz HTML „Kolumna „X” opcjonalna” w bloku tabeli (ta sama
//             sekcja H2 i nagłówek H3) oznacza kolumnę, której dokument nie musi mieć,
//   freeTables  bloki z komentarzem HTML o „dowolnych tabelach”; komentarz pod
//             nagłówkiem H2 obejmuje całą sekcję razem z jej nagłówkami H3,
//   choices   linie „Etykieta: a / b / c” poza tabelami.

const fs = require('fs');
const path = require('path');
const { rowTypeOf } = require('./ids');
const { frontMatterEnd, parseBody } = require('./documents');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'standards', 'templates');
const OPTIONAL_COLUMN = /<!--.*?[Kk]olumna\s+[„"](.+?)[”"]\s+opcjonaln/;
const FREE_TABLES = /<!--.*dowoln\w*\s+tabel/i;

// Wartość komórki albo linii, która podaje listę wartości: „tak / nie”. Lista
// nie ma nawiasów klamrowych, bo placeholder „{cron 02:00 / harmonogram}” to
// opis, a nie lista.
function choiceList(text) {
  if (!/ \/ /.test(text) || /[{}]/.test(text)) return null;
  return text.split(' / ').map(option => option.trim());
}

// Wyrażenie, które rozpoznaje nagłówek H3 dokumentu na podstawie nagłówka
// z szablonu. Placeholder {…} pasuje do dowolnego tekstu. Wiersz na początku
// nagłówka (A1, E1, AC-01) pasuje do wiersza o dowolnym numerze.
function headingPattern(text) {
  const first = /^([A-Z][A-Z-]*?-?)(\d+)(\.?)(?=\s|$)/.exec(text);
  const rowType = first && rowTypeOf(first[1] + first[2]);
  let pattern = '';
  let rest = text;
  if (rowType) {
    pattern = `${first[1]}\\d+${first[3] ? '\\.' : ''}`;
    rest = text.slice(first[0].length);
  }
  pattern += rest.split(/(\{[^}]*\})/).map(part => (part.startsWith('{') ? '.+' : part.replace(/[.*+?^$()[\]\\|]/g, '\\$&'))).join('');
  return { regex: new RegExp(`^${pattern}$`, 'u'), literal: !rowType && !/\{/.test(text), rowType };
}

function loadTemplate(prefix, folder, dir) {
  const file = path.join(dir, folder, 'template.md');
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const end = frontMatterEnd(lines);
  const fields = [];
  for (let index = 1; index < end; index++) {
    const field = /^([\w-]+)\s*:\s*(.*?)(?:\s+#\s*(.*))?$/.exec(lines[index]);
    if (!field) continue;
    const comment = field[3] || '';
    fields.push({ name: field[1], choices: comment.includes('|') ? comment.split('|').map(value => value.trim()) : null });
  }
  const body = parseBody(lines, end + 1);
  const sections = [];
  for (const heading of body.headings) {
    if (heading.level === 2) sections.push({ title: heading.text, optional: false, headings: [] });
    else if (heading.level === 3 && sections.length) {
      sections[sections.length - 1].headings.push({ title: heading.text, ...headingPattern(heading.text) });
    }
  }
  for (const line of body.lines) {
    if (line.h2 && !line.h3 && /<!--.*opcjonal/i.test(line.text) && !OPTIONAL_COLUMN.test(line.text)) {
      sections.find(section => section.title === line.h2).optional = true;
    }
  }
  const optionalColumns = body.lines
    .map(line => ({ line, match: OPTIONAL_COLUMN.exec(line.text) }))
    .filter(({ match }) => match)
    .map(({ line, match }) => ({ h2: line.h2, h3: line.h3, column: match[1] }));
  const tables = body.tables.map(table => {
    const keyValue = table.header.length === 2 && table.header[1] === 'Wartość' && table.rows.every(row => !row.cells[0].includes('{'));
    return {
      h2: table.h2,
      h3: table.h3,
      header: table.header,
      optional: optionalColumns
        .filter(item => item.h2 === table.h2 && item.h3 === table.h3 && table.header.includes(item.column))
        .map(item => item.column),
      keyValue,
      rows: table.rows.map(row => ({
        cells: row.cells,
        choices: row.cells.map((cell, column) => (keyValue && column === 0 ? null : choiceList(cell))),
      })),
    };
  });
  const freeTables = body.lines
    .filter(line => line.h2 && FREE_TABLES.test(line.text))
    .map(line => ({ h2: line.h2, h3: line.h3 || null }));
  const choices = body.lines
    .filter(line => !line.code && !line.table && !line.heading)
    .map(line => ({ line, match: /^([^{|:]+):\s+(.+)$/.exec(line.text.trim()) }))
    .filter(({ match }) => match && choiceList(match[2]))
    .map(({ line, match }) => ({ h2: line.h2, h3: line.h3, label: match[1], options: choiceList(match[2]) }));
  return { prefix, folder, file, fields, sections, tables, freeTables, choices };
}

// Zwraca mapę prefiks → szablon.
function loadTemplates(dir = TEMPLATES_DIR) {
  const templates = new Map();
  const meta = fs.readFileSync(path.join(dir, '_00-meta.md'), 'utf8');
  for (const line of meta.split(/\r?\n/)) {
    const row = /^\|\s*`([a-z0-9-]+)`\s*\|.*\|\s*([A-Z][A-Z-]*)\s*\|[^|]*\|\s*$/.exec(line);
    if (row) templates.set(row[2], loadTemplate(row[2], row[1], dir));
  }
  if (!templates.size) throw new Error(`${path.join(dir, '_00-meta.md')}: spis treści nie ma żadnego typu dokumentu`);
  return templates;
}

module.exports = { TEMPLATES_DIR, loadTemplates, choiceList };
