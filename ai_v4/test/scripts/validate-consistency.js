#!/usr/bin/env node
'use strict';

// Walidator zgodności informacji w dokumentach.
//
// Sprawdza, czy ta sama informacja podana w dwóch miejscach się zgadza: wpis
// w polu relations i miejsce w treści, w którym szablon każe podać cel wpisu
// (na przykład wpis realizes CAP i pole „Zdolność”). Sprawdza też, czy dokument
// nie powtarza progu NFR swojej zdolności, czy krok user-task ma rolę i API,
// które go kończy, oraz czy API nie powtarza wywołań swojego przepływu.

const { findIds, parseId } = require('./lib/ids');
const { loadMatrix } = require('./lib/matrix');
const { loadDocuments, buildIndex } = require('./lib/documents');
const { displayPath, parseArgs, printFindings } = require('./lib/report');

const USAGE = `Użycie: node scripts/validate-consistency.js <folder|plik.md> [...] [--json]

Sprawdza zgodność informacji w dokumentach: wpisy relations z polami, kolumnami
i sekcjami szablonu, progi NFR powtórzone po zdolności, kroki user-task
i wywołania API powtórzone po przepływie.
Część sprawdzeń czyta dokumenty wskazywane przez wpisy, więc podaj folder całej
dokumentacji.

  --json  Wypisuje wynik jako JSON.

Kod wyjścia:
  0  nie ma błędów (mogą być ostrzeżenia)
  1  jest co najmniej jeden błąd
  2  błędne wywołanie skryptu albo nie da się odczytać matrycy`;

const CHECKS = {
  'CONS-01': 'ta sama informacja w dwóch miejscach',
  'CONS-02': 'powtórzony próg NFR zdolności',
  'CONS-03': 'krok user-task bez API albo roli',
  'CONS-04': 'wywołanie powtórzone po przepływie',
};

// Miejsca w treści, w których szablon każe podać cel wpisu. Miejsce to:
//   { field }            wiersz o tej nazwie w tabeli „Pole | Wartość” albo „Atrybut | Wartość”,
//   { column, sections } kolumna tabel w podanych sekcjach H2,
//     where              tylko wiersze, w których kolumna where[0] ma wartość where[1],
//   { section }          cała sekcja H2,
//   { headings }         nagłówki H3 w sekcji H2.
// Reguła ma listę grup. Każda grupa musi wymienić wszystkie cele wpisów; w obrębie
// grupy wystarczy jedno z miejsc. Grupę, której żadnego miejsca nie ma w dokumencie,
// reguła pomija: brak sekcji albo pola zgłasza validate-form.js.
const STEPS = ['Kroki', 'Co może pójść inaczej', 'Co może pójść nie tak'];
const PLACES = [
  { sources: ['BFS'], relation: 'contains', targets: ['REQ'], groups: [[{ column: 'ID', sections: ['Wymagania funkcjonalne'] }]] },
  { sources: ['BFS'], relation: 'contains', targets: ['RB'], groups: [[{ column: 'ID', sections: ['Reguły biznesowe'] }]] },
  { sources: ['BFS'], relation: 'constrained_by', targets: ['NFRT'], groups: [[{ section: 'Wymagania niefunkcjonalne' }]] },
  { sources: ['NFR'], relation: 'contains', targets: ['NFRT'], groups: [[{ column: 'ID', sections: ['Macierz wymagań'] }]] },
  { sources: ['ACTOR'], relation: 'contains', targets: ['ROLE'], groups: [[{ column: 'ID', sections: ['Aktorzy'] }]] },
  { sources: ['CAP'], relation: 'consumes', targets: ['QUE'], groups: [[{ section: 'Zdarzenia i kontrakty domenowe' }]] },
  { sources: ['CAP', 'UC', 'TUC', 'API', 'INT'], relation: 'constrained_by', targets: ['NFRT'], groups: [[{ section: 'Ograniczenia NFR' }]] },
  { sources: ['UC', 'TUC'], relation: 'realizes', targets: ['REQ'], groups: [[{ field: 'Powiązane REQ' }], [{ column: 'ID z BFS', sections: ['Powiązanie z BFS'] }]] },
  { sources: ['UC', 'TUC'], relation: 'realizes', targets: ['RB'], groups: [[{ field: 'Powiązane RB' }], [{ column: 'ID z BFS', sections: ['Powiązanie z BFS'] }], [{ section: 'Reguły biznesowe' }]] },
  { sources: ['UC', 'TUC', 'API', 'INT', 'FLOW', 'BPMN', 'STM'], relation: 'realizes', targets: ['CAP'], groups: [[{ field: 'Zdolność' }]] },
  { sources: ['QUE'], relation: 'realizes', targets: ['CAP'], groups: [[{ field: 'Zdolność publikująca' }]] },
  { sources: ['UC', 'TUC'], relation: 'involves', targets: ['ROLE'], groups: [[{ section: 'Aktorzy' }]] },
  { sources: ['UC'], relation: 'consumes', targets: ['API', 'QUE'], groups: [[{ column: 'Wywołanie', sections: STEPS }]] },
  { sources: ['TUC'], relation: 'consumes', targets: ['API', 'INT', 'QUE'], groups: [[{ column: 'Wywołanie', sections: STEPS }, { field: 'Trigger' }]] },
  { sources: ['UC'], relation: 'contains', targets: ['SCR'], groups: [[{ column: 'Ekran', sections: STEPS }]] },
  { sources: ['UC'], relation: 'contains', targets: ['SCRSEC'], groups: [[{ column: 'Sekcja', sections: STEPS }]] },
  { sources: ['UC', 'TUC'], relation: 'contains', targets: ['A'], groups: [[{ headings: 'Co może pójść inaczej' }]] },
  { sources: ['UC', 'TUC'], relation: 'contains', targets: ['E'], groups: [[{ headings: 'Co może pójść nie tak' }]] },
  { sources: ['SCR'], relation: 'contains', targets: ['SCRSEC'], groups: [[{ column: 'Sekcja', sections: ['Struktura ekranu'] }]] },
  { sources: ['SCRSEC'], relation: 'consumes', targets: ['ENT'], groups: [[{ field: 'Źródło danych' }, { field: 'Miejsce utrwalenia' }]] },
  { sources: ['SCRSEC'], relation: 'consumes', targets: ['API'], groups: [[{ field: 'Zachowanie' }]] },
  { sources: ['API', 'INT', 'QUE'], relation: 'consumes', targets: ['ENT'], groups: [[{ section: 'Encje' }]] },
  { sources: ['API'], relation: 'consumes', targets: ['INT'], groups: [[{ section: 'Zależności' }]] },
  { sources: ['API'], relation: 'consumes', targets: ['FLOW', 'BPMN', 'SPEC-WF'], groups: [[{ section: 'Zachowanie' }]] },
  { sources: ['FLOW'], relation: 'contains', targets: ['ACT'], groups: [[{ column: 'Aktywność', sections: ['Opis przepływu'] }]] },
  { sources: ['FLOW'], relation: 'consumes', targets: ['INT', 'QUE', 'BPMN'], groups: [[{ column: 'Wywołanie', sections: ['Opis przepływu'] }]] },
  { sources: ['BPMN'], relation: 'contains', targets: ['SPEC-WF'], groups: [[{ column: 'SPEC-WF', sections: ['Zadania procesu'] }]] },
  { sources: ['SPEC-WF'], relation: 'consumes', targets: ['API', 'INT', 'QUE'], groups: [[{ column: 'ID', sections: ['Wywoływane zasoby'] }]] },
  { sources: ['SPEC-WF'], relation: 'consumes', targets: ['SPEC-WF'], groups: [[{ column: 'Źródło', sections: ['Zmienne procesowe'] }]] },
  { sources: ['SPEC-WF'], relation: 'involves', targets: ['ROLE'], groups: [[{ field: 'Aktor / serwis' }]] },
  { sources: ['SPEC-WF'], relation: 'contains', targets: ['AC'], groups: [[{ headings: 'Kryteria akceptacji' }]] },
  { sources: ['DDM'], relation: 'contains', targets: ['DOM'], groups: [[{ column: 'ID', sections: ['Słownik pojęć domenowych'] }]] },
  { sources: ['DDM'], relation: 'contains', targets: ['RD'], groups: [[{ column: 'ID', sections: ['Reguły i inwarianty domenowe'] }]] },
  { sources: ['LDM'], relation: 'realizes', targets: ['DOM'], groups: [[{ column: 'Pojęcie', sections: ['Mapowanie DDM → LDM'] }]] },
  { sources: ['LDM'], relation: 'contains', targets: ['ENT'], groups: [[{ section: 'Encje' }]] },
  { sources: ['ENT'], relation: 'realizes', targets: ['DOM'], groups: [[{ field: 'Realizuje pojęcie (DDM)' }]] },
  { sources: ['ENT'], relation: 'realizes', targets: ['RD'], groups: [[{ column: 'RD', sections: ['Reguły walidacyjne'] }]] },
  { sources: ['ENT'], relation: 'contains', targets: ['RW'], groups: [[{ column: 'ID', sections: ['Reguły walidacyjne'] }]] },
  { sources: ['ENT'], relation: 'contains', targets: ['ENT'], groups: [[{ column: 'Encja docelowa', sections: ['Powiązania'], where: ['Relacja', 'zawiera'] }]] },
  { sources: ['STM'], relation: 'realizes', targets: ['DOM'], groups: [[{ field: 'Obiekt (pojęcie DDM)' }]] },
  { sources: ['UCMAP'], relation: 'groups', targets: ['UC', 'TUC'], groups: [[{ section: 'Powiązanie z artefaktami szczegółowymi' }]] },
  { sources: ['NAV'], relation: 'groups', targets: ['SCR'], groups: [[{ column: 'Dokument', sections: ['Odniesienia do ekranów'] }]] },
];

// Pola, których wartość wynika z innych informacji w dokumencie: doc-id albo
// dokumenty, w których leżą wskazywane wiersze.
const DERIVED_FIELDS = [
  { sources: ['UC', 'TUC'], field: 'BFS', value: (doc, index) => owners(index.out(doc, 'realizes', ['REQ', 'RB'])), reason: 'dokumenty BFS wierszy REQ i RB z wpisów realizes' },
  { sources: ['LDM'], field: 'Źródło DDM', value: (doc, index) => owners(index.out(doc, 'realizes', ['DOM'])), reason: 'dokumenty DDM pojęć z wpisów realizes' },
  { sources: ['LDM', 'ENT'], field: 'ID', value: doc => [doc.docId], reason: 'doc-id dokumentu' },
];

const owners = links => [...new Set(links.map(link => link.targetDoc))].sort();

// Pełne ID wszystkich identyfikatorów w tekście. Własny wiersz zapisany samym
// ID dostaje doc-id dokumentu.
function keysIn(text, doc) {
  return findIds(text).map(id => (id.doc ? id.id : `${doc.docId}.${id.row}`));
}

// Wiersze tabel „Pole | Wartość” i „Atrybut | Wartość” o danej nazwie.
function fieldRows(doc, name) {
  return doc.body.tables
    .filter(table => table.header.length === 2 && table.header[1] === 'Wartość')
    .flatMap(table => table.rows.filter(row => row.cells[0] === name));
}

// Zwraca { found, keys, line } dla miejsca: found mówi, czy miejsce jest
// w dokumencie, keys to pełne ID w tym miejscu, line to linia do raportu.
function readPlace(doc, place) {
  const lines = doc.body.lines;
  if (place.field) {
    const rows = fieldRows(doc, place.field);
    return { found: rows.length > 0, keys: rows.flatMap(row => keysIn(row.cells[1] || '', doc)), line: rows.length ? rows[0].line : null };
  }
  if (place.section) {
    const inside = lines.filter(line => line.h2 === place.section && !line.heading);
    const heading = doc.body.headings.find(item => item.level === 2 && item.text === place.section);
    return { found: Boolean(heading), keys: inside.flatMap(line => keysIn(line.text, doc)), line: heading && heading.line };
  }
  if (place.headings) {
    const heading = doc.body.headings.find(item => item.level === 2 && item.text === place.headings);
    const subheadings = doc.body.headings.filter(item => item.level === 3 && item.h2 === place.headings);
    const keys = subheadings.flatMap(item => {
      const first = findIds(item.text)[0];
      return first && item.text.startsWith(first.id) ? keysIn(first.id, doc) : [];
    });
    return { found: Boolean(heading), keys, line: heading && heading.line };
  }
  const tables = doc.body.tables.filter(table => place.sections.includes(table.h2) && table.header.includes(place.column));
  const keys = [];
  for (const table of tables) {
    const column = table.header.indexOf(place.column);
    const filter = place.where && table.header.indexOf(place.where[0]);
    for (const row of table.rows) {
      if (place.where && row.cells[filter] !== place.where[1]) continue;
      keys.push(...keysIn(row.cells[column] || '', doc));
    }
  }
  return { found: tables.length > 0, keys, line: tables.length ? tables[0].line : null };
}

function describe(place) {
  if (place.field) return `pole „${place.field}”`;
  if (place.section) return `sekcja „${place.section}”`;
  if (place.headings) return `nagłówki H3 w sekcji „${place.headings}”`;
  const where = place.where ? ` w wierszach z wartością „${place.where[1]}” w kolumnie „${place.where[0]}”` : '';
  return `kolumna „${place.column}”${where} (sekcje: ${place.sections.join(', ')})`;
}

function suggest(place, link) {
  if (place.field) return `Dopisz ${link.target} w polu „${place.field}”.`;
  if (place.section) return `Wymień ${link.target} w sekcji „${place.section}”.`;
  if (place.headings) {
    const row = parseId(link.key).row;
    return `Dodaj nagłówek „### ${row}${link.targetType === 'AC' ? '' : '. {nazwa}'}” w sekcji „${place.headings}”.`;
  }
  const where = place.where ? ` z wartością „${place.where[1]}” w kolumnie „${place.where[0]}”` : '';
  return `Wpisz ${link.target} w kolumnie „${place.column}” w wierszu${where}, którego dotyczy (sekcje: ${place.sections.join(', ')}).`;
}

// ── CONS-01 ─────────────────────────────────────────────────────────────────
function checkPlaces(doc, index, add) {
  for (const rule of PLACES) {
    if (!rule.sources.includes(doc.docType)) continue;
    const links = index.out(doc, rule.relation, rule.targets);
    if (!links.length) continue;
    for (const group of rule.groups) {
      const read = group.map(place => ({ place, ...readPlace(doc, place) })).filter(item => item.found);
      if (!read.length) continue;
      const keys = new Set(read.flatMap(item => item.keys));
      for (const link of links) {
        if (keys.has(link.key)) continue;
        add('CONS-01', read[0].line,
          `${doc.docId} ma wpis ${link.type} ${link.target}, a ${read.map(item => describe(item.place)).join(' ani ')} go nie wymienia.`,
          suggest(read[0].place, link));
      }
    }
  }
  for (const rule of DERIVED_FIELDS) {
    if (!rule.sources.includes(doc.docType)) continue;
    const rows = fieldRows(doc, rule.field);
    if (!rows.length) continue;
    const expected = rule.value(doc, index);
    const actual = [...new Set(findIds(rows[0].cells[1] || '').map(id => id.id))].sort();
    if (actual.join(',') === expected.join(',')) continue;
    add('CONS-01', rows[0].line,
      `Pole „${rule.field}” ma wartość „${rows[0].cells[1] || ''}”, a ${rule.reason} to: ${expected.length ? expected.join(', ') : 'brak'}.`,
      expected.length ? `Wpisz w polu „${rule.field}”: ${expected.join(', ')}.` : null);
  }
}

// ── CONS-02 ─────────────────────────────────────────────────────────────────
// UC, TUC, API i INT nie powtarzają progu NFR zdolności, do której należą
// (guide.md typów use-case, technical-use-case, api i integration).
function checkRepeatedThresholds(doc, index, add) {
  if (!['UC', 'TUC', 'API', 'INT'].includes(doc.docType)) return;
  for (const capLink of index.out(doc, 'realizes', ['CAP'])) {
    const cap = index.docOf(capLink.key);
    if (!cap) continue;
    const inherited = new Set(index.out(cap, 'constrained_by', ['NFRT']).map(link => link.key));
    for (const link of index.out(doc, 'constrained_by', ['NFRT'])) {
      if (!inherited.has(link.key)) continue;
      const lines = doc.lines.map((text, position) => ({ text, line: position + 1 }))
        .filter(item => item.line > doc.frontMatterEnd + 1 && keysIn(item.text, doc).includes(link.key))
        .map(item => item.line);
      add('CONS-02', lines[0] || link.line,
        `${doc.docId} wskazuje próg ${link.key}, który ma już jego zdolność ${cap.docId}. Próg zdolności obowiązuje dokument bez powtarzania.`,
        `Usuń wzmianki o ${link.key} (linie: ${lines.join(', ')}), a potem uruchom: node scripts/sync-relations.js ${displayPath(doc.file)} --fix`);
    }
  }
}

// ── CONS-03 ─────────────────────────────────────────────────────────────────
// Krok user-task ma rolę, a człowiek kończy go przez API, które wskazuje krok
// (guide.md typu workflow-step; relation-matrix.yaml, reguła 10).
function checkUserTask(doc, index, add) {
  if (doc.docType !== 'SPEC-WF') return;
  const field = doc.fields.find(item => item.name === 'task-type');
  if (!field || field.value !== 'user-task') return;
  const finishers = index.incoming(doc.docId).filter(({ doc: source, link }) => link.type === 'consumes' && source.docType === 'API');
  if (!finishers.length) {
    add('CONS-03', field.line, `${doc.docId} to krok user-task, którego nie kończy żadne API: żadne API nie ma wpisu consumes ${doc.docId}.`,
      `Wpisz ${doc.docId} w sekcji „Zachowanie” API, przez które człowiek kończy krok, a potem uruchom sync-relations.js --fix dla tego API.`);
  }
  if (!index.out(doc, 'involves', ['ROLE']).length) {
    add('CONS-03', field.line, `${doc.docId} to krok user-task bez roli: nie ma wpisu involves ROLE.`,
      'Wpisz pełne ID roli w polu „Aktor / serwis” w sekcji „Kontekst”, a potem uruchom sync-relations.js --fix.');
  }
}

// ── CONS-04 ─────────────────────────────────────────────────────────────────
// API nie powtarza wywołań, które zapisuje jego przepływ (relation-matrix.yaml,
// „Który dokument zapisuje wywołanie”; guide.md typu api).
function checkRepeatedFlowCalls(doc, index, add) {
  if (doc.docType !== 'API') return;
  const flowOf = new Map();
  for (const flowLink of index.out(doc, 'consumes', ['FLOW'])) {
    const flow = index.docOf(flowLink.key);
    if (!flow) continue;
    for (const link of index.out(flow, 'consumes', ['INT', 'BPMN'])) {
      if (!flowOf.has(link.key)) flowOf.set(link.key, flow.docId);
    }
  }
  for (const link of index.out(doc, 'consumes', ['INT', 'BPMN'])) {
    if (!flowOf.has(link.key)) continue;
    const lines = doc.lines.map((text, position) => ({ text, line: position + 1 }))
      .filter(item => item.line > doc.frontMatterEnd + 1 && keysIn(item.text, doc).includes(link.key))
      .map(item => item.line);
    add('CONS-04', lines[0] || link.line,
      `${doc.docId} wskazuje ${link.key}, a to wywołanie zapisuje już jego przepływ ${flowOf.get(link.key)}. API nie powtarza wywołań swojego przepływu.`,
      `Usuń wzmianki o ${link.key} (linie: ${lines.join(', ')}), a potem uruchom: node scripts/sync-relations.js ${displayPath(doc.file)} --fix`);
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
  for (const doc of documents) {
    const add = (code, line, message, fix, severity = 'error') => findings.push({ file: doc.file, line, docId: doc.docId, severity, code, check: CHECKS[code], message, fix });
    checkPlaces(doc, index, add);
    checkRepeatedThresholds(doc, index, add);
    checkUserTask(doc, index, add);
    checkRepeatedFlowCalls(doc, index, add);
  }
  return printFindings(findings, { json: options.json, documents: documents.length, notes });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
