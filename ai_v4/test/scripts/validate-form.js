#!/usr/bin/env node
'use strict';

// Walidator formy dokumentu.
//
// Sprawdza, czy dokument ma pola front matter, sekcje i tabele z szablonu swojego
// typu (standards/templates/{typ}/template.md), czy pola z listą wartości mają
// wartość z tej listy oraz czy plik ma właściwą nazwę i leży we właściwym
// folderze (standards/methodology.md, sekcja 11).

const path = require('path');
const { CONTAINS, loadMatrix } = require('./lib/matrix');
const { loadDocuments, buildIndex } = require('./lib/documents');
const { loadTemplates } = require('./lib/templates');
const { displayPath, parseArgs, printFindings } = require('./lib/report');

const USAGE = `Użycie: node scripts/validate-form.js <folder|plik.md> [...] [--json]

Sprawdza formę dokumentów: pola front matter, sekcje i tabele z szablonu typu,
wartości z listy, nazwę pliku i folder. Folder dokumentu wynika z relacji, więc
podaj folder całej dokumentacji, a nie pojedynczy plik.

  --json  Wypisuje wynik jako JSON.

Kod wyjścia:
  0  nie ma błędów (mogą być ostrzeżenia)
  1  jest co najmniej jeden błąd
  2  błędne wywołanie skryptu albo nie da się odczytać matrycy lub szablonów`;

const CHECKS = {
  'FORM-01': 'pola front matter',
  'FORM-02': 'wartość spoza listy',
  'FORM-03': 'sekcje',
  'FORM-04': 'tabele',
  'FORM-05': 'nazwa pliku',
  'FORM-06': 'folder',
};

// Tekst porównywany bez wielkości liter, spacji i znaków interpunkcyjnych.
// Służy tylko do podpowiedzi poprawnej nazwy.
const loose = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Wartość pasuje do listy, gdy jest jedną z wartości albo zaczyna się od niej,
// a po niej stoi znak inny niż litera i cyfra: „tak przy składaniu” pasuje do
// listy „tak / nie”, a „takie” nie pasuje.
function matchesChoice(value, options) {
  return options.some(option => value === option
    || (value.startsWith(option) && /^[^\p{L}\p{N}]/u.test(value.slice(option.length))));
}

function sameIgnoringCase(value, options) {
  return options.find(option => option.toLowerCase() === value.toLowerCase());
}

// ── FORM-01 i FORM-02 w front matter ────────────────────────────────────────
function checkFrontMatter(doc, template, add) {
  const names = template.fields.map(field => field.name);
  const firstLine = new Map();
  for (const field of doc.fields) {
    if (firstLine.has(field.name)) {
      add('FORM-01', field.line, `Pole ${field.name} występuje drugi raz. Pierwsze jest w linii ${firstLine.get(field.name)}.`, null);
    } else {
      firstLine.set(field.name, field.line);
    }
  }
  const missing = names.filter(name => !firstLine.has(name));
  for (const [name, line] of firstLine) {
    if (names.includes(name)) continue;
    add('FORM-01', line, `Pola ${name} nie ma w szablonie typu ${doc.docType} (templates/${template.folder}/template.md).`,
      missing.length === 1 ? `Zmień nazwę pola ${name} na ${missing[0]}.` : `Usuń pole ${name}.`);
  }
  const unknownCount = [...firstLine.keys()].filter(name => !names.includes(name)).length;
  for (const name of missing) {
    if (unknownCount === 1 && missing.length === 1) continue;
    const field = template.fields.find(item => item.name === name);
    let fix = `Dopisz pole ${name}.`;
    if (name === 'relations') fix = `Uruchom: node scripts/sync-relations.js ${displayPath(doc.file)} --fix`;
    else if (name === 'status') fix = 'Dopisz pole status: draft.';
    else if (field.choices) fix = `Dopisz pole ${name} z jedną z wartości: ${field.choices.join(' | ')}.`;
    add('FORM-01', doc.frontMatterEnd + 1, `Front matter nie ma pola ${name} z szablonu typu ${doc.docType}.`, fix);
  }
  for (const field of template.fields) {
    if (!field.choices) continue;
    const value = doc.fields.find(item => item.name === field.name);
    if (!value || field.choices.includes(value.value)) continue;
    const similar = sameIgnoringCase(value.value, field.choices);
    add('FORM-02', value.line, `Pole ${field.name} ma wartość „${value.value}”, a dozwolone są: ${field.choices.join(' | ')}.`,
      similar ? `Zmień wartość na ${similar}.` : null);
  }
}

// ── FORM-03 sekcje ──────────────────────────────────────────────────────────
// Zwraca sekcje dokumentu, które są w szablonie: { section, index, heading, end }.
function checkSections(doc, template, add) {
  const headings = doc.body.headings;
  const titles = template.sections.map(section => section.title);
  const lastLine = doc.lines.length;

  const h1 = headings.filter(heading => heading.level === 1);
  if (!h1.length) {
    const title = (doc.fields.find(field => field.name === 'title') || {}).value;
    add('FORM-03', doc.frontMatterEnd + 2, 'Dokument nie ma nagłówka H1.', title ? `Dodaj nagłówek „# ${title}” pod front matter.` : null);
  }
  for (const heading of h1.slice(1)) add('FORM-03', heading.line, `Dokument ma drugi nagłówek H1 „${heading.text}”. Szablon ma jeden.`, null);

  const present = [];
  const seen = new Map();
  const h2 = headings.filter(heading => heading.level <= 2);
  h2.forEach((heading, position) => {
    if (heading.level === 1) return;
    const end = position + 1 < h2.length ? h2[position + 1].line : lastLine + 1;
    const index = titles.indexOf(heading.text);
    if (index < 0) {
      const similar = titles.find(title => loose(title) === loose(heading.text));
      add('FORM-03', heading.line, `Sekcji „${heading.text}” nie ma w szablonie typu ${doc.docType}.`, similar ? `Zmień nagłówek na „## ${similar}”.` : null);
      return;
    }
    if (seen.has(heading.text)) {
      add('FORM-03', heading.line, `Sekcja „${heading.text}” występuje drugi raz. Pierwsza jest w linii ${seen.get(heading.text)}.`,
        `Przenieś treść do sekcji z linii ${seen.get(heading.text)} i usuń ten nagłówek.`);
      return;
    }
    seen.set(heading.text, heading.line);
    present.push({ section: template.sections[index], index, heading, end });
  });

  let highest = null;
  for (const item of present) {
    if (highest && item.index < highest.index) {
      const before = present.find(other => other.index > item.index);
      add('FORM-03', item.heading.line, `Sekcja „${item.section.title}” stoi za sekcją „${highest.section.title}”, a w szablonie jest przed nią.`,
        `Przenieś sekcję „${item.section.title}” przed sekcję „${before.section.title}”.`);
    } else {
      highest = item;
    }
  }

  template.sections.forEach((section, index) => {
    if (section.optional || seen.has(section.title)) return;
    const next = present.find(item => item.index > index);
    add('FORM-03', next ? next.heading.line : lastLine,
      `Brak sekcji „${section.title}” z szablonu. Sekcję można pominąć tylko w wariancie opisanym w templates/${template.folder}/guide.md.`,
      next ? `Dodaj sekcję „## ${section.title}” przed sekcją „${next.section.title}”.` : `Dodaj sekcję „## ${section.title}” na końcu dokumentu.`,
      'warning');
  });

  for (const item of present) {
    const subheadings = headings.filter(heading => heading.level === 3 && heading.line > item.heading.line && heading.line < item.end);
    const found = new Set();
    let highestSub = null;
    item.blocks = [{ heading: item.heading, title: null, end: subheadings.length ? subheadings[0].line : item.end }];
    subheadings.forEach((heading, position) => {
      const end = position + 1 < subheadings.length ? subheadings[position + 1].line : item.end;
      const index = item.section.headings.findIndex(expected => expected.regex.test(heading.text));
      if (index < 0) {
        const similar = item.section.headings.find(expected => expected.literal && loose(expected.title) === loose(heading.text));
        add('FORM-03', heading.line, `Nagłówka „${heading.text}” nie ma w sekcji „${item.section.title}” szablonu.`,
          similar ? `Zmień nagłówek na „### ${similar.title}”.` : null);
        return;
      }
      const expected = item.section.headings[index];
      if (highestSub && index < highestSub.index) {
        add('FORM-03', heading.line, `Nagłówek „${heading.text}” stoi za „${highestSub.heading.text}”, a w szablonie jest przed nim.`,
          `Przenieś „${heading.text}” przed „${highestSub.heading.text}”.`);
      } else {
        highestSub = { index, heading };
      }
      found.add(index);
      item.blocks.push({ heading, title: expected.title, end });
    });
    item.section.headings.forEach((expected, index) => {
      if (!expected.literal || found.has(index)) return;
      add('FORM-03', item.heading.line, `W sekcji „${item.section.title}” brakuje nagłówka „### ${expected.title}” z szablonu.`,
        `Dodaj nagłówek „### ${expected.title}” w sekcji „${item.section.title}”.`, 'warning');
    });
  }
  return present;
}

// ── FORM-04 tabele i FORM-02 wartości w tabelach ────────────────────────────
// Nagłówki, które szablon dopuszcza: pełny i bez każdego podzbioru kolumn
// opcjonalnych, w kolejności z szablonu.
function allowedHeaders(expected) {
  let headers = [expected.header];
  for (const column of expected.optional || []) {
    headers = headers.flatMap(header => [header, header.filter(name => name !== column)]);
  }
  return headers;
}

function checkTable(expected, actual, add) {
  const header = `| ${expected.header.join(' | ')} |`;
  const allowed = allowedHeaders(expected);
  const matched = allowed.find(candidate => candidate.join('|') === actual.header.join('|'));
  if (!matched) {
    const optional = (expected.optional || []).length ? ` Kolumny opcjonalne: ${expected.optional.map(name => `„${name}”`).join(', ')}.` : '';
    add('FORM-04', actual.line, `Tabela ma nagłówek „| ${actual.header.join(' | ')} |”, a szablon „${header}”.${optional}`, `Zmień nagłówek tabeli na „${header}”.`);
  }
  // Liczba komórek wiersza wynika z nagłówka dokumentu, gdy szablon go dopuszcza.
  const columnCount = (matched || expected.header).length;
  for (const row of actual.rows) {
    if (row.cells.length !== columnCount) {
      add('FORM-04', row.line, `Wiersz tabeli ma ${row.cells.length} komórek, a nagłówek ${matched ? 'tabeli' : 'w szablonie'} ma ${columnCount} kolumn.`, null);
    }
  }
  if (expected.keyValue) {
    const expectedKeys = expected.rows.map(row => row.cells[0]);
    const keys = actual.rows.map(row => row.cells[0]);
    const missing = expectedKeys.filter(key => !keys.includes(key));
    const unknown = actual.rows.filter(row => !expectedKeys.includes(row.cells[0]));
    let highest = null;
    actual.rows.forEach((row, position) => {
      const key = row.cells[0];
      if (keys.indexOf(key) < position) {
        add('FORM-04', row.line, `Wiersz „${key}” występuje w tabeli drugi raz.`, null);
        return;
      }
      const index = expectedKeys.indexOf(key);
      if (index < 0) {
        add('FORM-04', row.line, `Wiersza „${key}” nie ma w tej tabeli w szablonie.`,
          missing.length === 1 && unknown.length === 1 ? `Zmień „${key}” na „${missing[0]}”.` : `Usuń wiersz „${key}”.`);
        return;
      }
      if (highest && index < highest.index) {
        add('FORM-04', row.line, `Wiersz „${key}” stoi za wierszem „${highest.key}”, a w szablonie jest przed nim.`, `Przenieś wiersz „${key}” przed wiersz „${highest.key}”.`);
      } else {
        highest = { index, key };
      }
    });
    if (!(missing.length === 1 && unknown.length === 1)) {
      for (const key of missing) {
        const next = actual.rows.find(row => expectedKeys.indexOf(row.cells[0]) > expectedKeys.indexOf(key));
        add('FORM-04', actual.line, `Tabeli brakuje wiersza „${key}” z szablonu.`,
          next ? `Dodaj wiersz „| ${key} | … |” przed wierszem „${next.cells[0]}”.` : `Dodaj wiersz „| ${key} | … |” na końcu tabeli.`);
      }
    }
  }

  const columns = new Map();
  for (const row of expected.rows) {
    row.choices.forEach((options, column) => {
      if (!options) return;
      if (expected.keyValue) columns.set(`${row.cells[0]}|${column}`, { key: row.cells[0], column, options });
      else if (!columns.has(column)) columns.set(column, { column, options });
    });
  }
  for (const { key, column, options } of columns.values()) {
    const rows = key === undefined ? actual.rows : actual.rows.filter(row => row.cells[0] === key);
    // Bez kolumny opcjonalnej kolejne kolumny dokumentu przesuwają się w lewo.
    const actualColumn = matched ? matched.indexOf(expected.header[column]) : column;
    if (actualColumn < 0) continue;
    for (const row of rows) {
      const value = row.cells[actualColumn];
      if (value === undefined || matchesChoice(value, options)) continue;
      if (key === undefined && row.cells[0] === '—' && value === '—') continue;
      const similar = sameIgnoringCase(value, options);
      const where = key === undefined ? `Kolumna „${expected.header[column]}”` : `Wiersz „${key}”`;
      add('FORM-02', row.line, `${where} ma wartość „${value}”, a dozwolone są: ${options.join(' / ')}.`, similar ? `Zmień wartość na „${similar}”.` : null);
    }
  }
}

function checkTables(doc, template, present, add) {
  // Pierwszy blok to treść między front matter a pierwszą sekcją H2.
  const firstH2 = doc.body.headings.find(heading => heading.level === 2);
  const blocks = [{ h2: null, title: null, start: doc.frontMatterEnd + 1, end: firstH2 ? firstH2.line : doc.lines.length + 1, line: doc.frontMatterEnd + 2 }];
  for (const item of present) {
    item.blocks.forEach(block => blocks.push({ h2: item.section.title, title: block.title, start: block.heading.line, end: block.end, line: block.heading.line }));
  }
  for (const block of blocks) {
    // W bloku, w którym szablon dopuszcza dowolne tabele, tabel się nie sprawdza.
    if (template.freeTables.some(item => item.h2 === block.h2 && (item.h3 === null || item.h3 === block.title))) continue;
    const expected = template.tables.filter(table => table.h2 === block.h2 && (table.h3 || null) === block.title);
    const actual = doc.body.tables.filter(table => table.line > block.start && table.line < block.end);
    expected.forEach((table, index) => {
      if (actual[index]) checkTable(table, actual[index], add);
      else if (block.h2) add('FORM-04', block.line, `W sekcji „${block.title || block.h2}” brakuje tabeli „| ${table.header.join(' | ')} |” z szablonu.`,
        `Dodaj tabelę z nagłówkiem „| ${table.header.join(' | ')} |”.`);
      // Tabela pod nagłówkiem H1 nie należy do żadnej sekcji, więc jej brak jest
      // ostrzeżeniem jak brak sekcji: wariant z guide.md może ją pominąć.
      else add('FORM-04', block.line, `Pod nagłówkiem H1 brakuje tabeli „| ${table.header.join(' | ')} |” z szablonu. Tabelę można pominąć tylko w wariancie opisanym w templates/${template.folder}/guide.md.`,
        `Dodaj pod nagłówkiem H1 tabelę z nagłówkiem „| ${table.header.join(' | ')} |”.`, 'warning');
    });
    for (const table of actual.slice(expected.length)) {
      add('FORM-04', table.line, `Tabela „| ${table.header.join(' | ')} |” nie występuje w tym miejscu szablonu.`, null);
    }
  }

  for (const choice of template.choices) {
    for (const item of blocks.filter(other => other.h2 === choice.h2 && other.title === (choice.h3 || null))) {
      for (const line of doc.body.lines) {
        if (line.line <= item.start || line.line >= item.end || line.code || line.table || line.heading) continue;
        const text = line.text.trim();
        if (!text.startsWith(`${choice.label}:`)) continue;
        const value = text.slice(choice.label.length + 1).trim();
        if (matchesChoice(value, choice.options)) continue;
        const similar = sameIgnoringCase(value, choice.options);
        add('FORM-02', line.line, `„${choice.label}” ma wartość „${value}”, a dozwolone są: ${choice.options.join(' / ')}.`, similar ? `Zmień wartość na „${similar}”.` : null);
      }
    }
  }
}

// ── FORM-06 folder ──────────────────────────────────────────────────────────
// Folder dokumentacji to folder, w którym leżą processes/BFS-… i shared/….
function docsRoot(file) {
  const parts = path.resolve(file).split(path.sep);
  for (let index = 0; index < parts.length - 1; index++) {
    if (parts[index] === 'processes' && /^BFS-\d+$/.test(parts[index + 1])) return parts.slice(0, index).join(path.sep);
    if (parts[index] === 'shared' && ['actors', 'nfr', 'conventions', 'maps', 'activities', 'domains'].includes(parts[index + 1])) return parts.slice(0, index).join(path.sep);
  }
  return null;
}

// Wylicza folder dokumentu według methodology.md, sekcja 11. Zwraca
// { segments, reason } albo null, gdy relacje nie wyznaczają jednego folderu.
function locator(index) {
  const memo = new Map();
  const ids = links => [...new Set(links.map(link => link.targetDoc))];
  const sources = (doc, relation, types) => [...new Set(index.incoming(doc.docId)
    .filter(({ doc: source, link }) => link.type === relation && types.includes(source.docType))
    .map(({ doc: source }) => source.docId))];
  const docs = list => list.map(id => index.docOf(id)).filter(Boolean);

  // Procesy BFS, do których należy dokument.
  function processes(doc, stack = new Set()) {
    if (memo.has(doc.docId)) return memo.get(doc.docId);
    if (stack.has(doc.docId)) return new Set();
    stack.add(doc.docId);
    const through = list => new Set(docs(list).flatMap(other => [...processes(other, stack)]));
    let result;
    switch (doc.docType) {
      case 'BFS': result = new Set([doc.docId]); break;
      case 'UC': case 'TUC': result = new Set(ids(index.out(doc, 'realizes', ['REQ', 'RB']))); break;
      case 'CAP': result = through(sources(doc, 'realizes', ['UC', 'TUC'])); break;
      case 'API': case 'INT': case 'QUE': case 'FLOW': case 'BPMN': case 'STM': result = through(ids(index.out(doc, 'realizes', ['CAP']))); break;
      case 'SCR': result = through(sources(doc, CONTAINS, ['UC', 'TUC'])); break;
      case 'SCRSEC': result = through(sources(doc, CONTAINS, ['SCR'])); break;
      case 'ACT': result = through(sources(doc, CONTAINS, ['FLOW'])); break;
      case 'SPEC-WF': result = through(sources(doc, CONTAINS, ['BPMN'])); break;
      case 'NAV': result = through(ids(index.out(doc, 'groups', ['SCR']))); break;
      case 'UCMAP': result = through(ids(index.out(doc, 'groups', ['UC', 'TUC']))); break;
      default: result = new Set();
    }
    stack.delete(doc.docId);
    memo.set(doc.docId, result);
    return result;
  }
  const only = set => (set.size === 1 ? [...set][0] : null);
  const list = set => [...set].join(', ');
  const domainOf = doc => only(new Set(ids(index.out(doc, 'realizes', ['DOM']))));

  return doc => {
    const process = only(processes(doc));
    const inProcess = (folders, reason) => (process ? { segments: ['processes', process, ...folders], reason } : null);
    const cap = list(new Set(ids(index.out(doc, 'realizes', ['CAP']))));
    switch (doc.docType) {
      case 'BFS': return { segments: ['processes', doc.docId], reason: 'folder procesu nosi doc-id BFS' };
      case 'CAP': return inProcess(['capabilities'], `realizują ją scenariusze procesu ${process}`);
      case 'UC': case 'TUC': return inProcess(['scenarios'], `realizuje wiersze ${process}`);
      case 'API': case 'INT': case 'QUE': return inProcess(['contracts'], `realizuje ${cap} z procesu ${process}`);
      case 'FLOW': case 'BPMN': return inProcess(['flows', doc.docId], `realizuje ${cap} z procesu ${process}`);
      case 'STM': {
        const domain = domainOf(doc);
        if (domain) return { segments: ['shared', 'domains', domain], reason: `realizuje pojęcie z ${domain}` };
        return index.out(doc, 'realizes', ['DOM']).length ? null : inProcess(['flows'], `nie realizuje pojęcia i realizuje ${cap} z procesu ${process}`);
      }
      case 'SCR': return inProcess(['screens', doc.docId], `zawiera go dokument procesu ${process}`);
      case 'ACT': {
        // Aktywność nie leży przy przepływie, bo może należeć do kilku przepływów.
        const all = processes(doc);
        if (all.size > 1) return { segments: ['shared', 'activities'], reason: `zawierają ją przepływy procesów ${list(all)}` };
        return inProcess(['activities'], `zawierają ją przepływy procesu ${process}`);
      }
      case 'SCRSEC': case 'SPEC-WF': {
        const [parentType, folder, nested] = { SCRSEC: ['SCR', 'screens', 'sections'], 'SPEC-WF': ['BPMN', 'flows', 'steps'] }[doc.docType];
        const parents = sources(doc, CONTAINS, [parentType]);
        if (parents.length === 1) return inProcess([folder, parents[0], nested], `zawiera go tylko ${parents[0]}`);
        if (parents.length > 1 && doc.docType !== 'SPEC-WF') return inProcess([folder, 'shared'], `zawierają go ${parents.join(', ')}`);
        return null;
      }
      case 'NAV': return inProcess(['maps'], `zestawia ekrany procesu ${process}`);
      case 'UCMAP': {
        const all = processes(doc);
        if (all.size > 1) return { segments: ['shared', 'maps'], reason: `zestawia scenariusze procesów ${list(all)}` };
        return inProcess(['maps'], `zestawia scenariusze procesu ${process}`);
      }
      case 'ACTOR': return { segments: ['shared', 'actors'], reason: 'ACTOR leży w shared/actors' };
      case 'NFR': return { segments: ['shared', 'nfr'], reason: 'NFR leży w shared/nfr' };
      case 'CONV': return { segments: ['shared', 'conventions'], reason: 'konwencja leży w shared/conventions' };
      case 'DDM': return { segments: ['shared', 'domains', doc.docId], reason: 'folder domeny nosi doc-id DDM' };
      case 'LDM': {
        const domain = domainOf(doc);
        return domain ? { segments: ['shared', 'domains', domain], reason: `realizuje pojęcia z ${domain}` } : null;
      }
      case 'ENT': {
        const models = sources(doc, CONTAINS, ['LDM']);
        const model = models.length === 1 && index.docOf(models[0]);
        const domain = model && domainOf(model);
        return domain ? { segments: ['shared', 'domains', domain], reason: `zawiera ją ${models[0]}, który realizuje pojęcia z ${domain}` } : null;
      }
      default: return null;
    }
  };
}

function main(args) {
  const options = parseArgs(args, USAGE);
  if (options.exitCode !== undefined) return options.exitCode;
  let matrix;
  let templates;
  try {
    matrix = loadMatrix();
    templates = loadTemplates();
  } catch (error) {
    console.error(`Nie da się odczytać standardu: ${error.message}`);
    return 2;
  }
  const { documents, broken } = loadDocuments(options.inputs, matrix);
  const index = buildIndex(documents, matrix);
  const findings = [];
  const notes = [];
  for (const item of broken) {
    findings.push({ file: item.file, line: item.line, docId: item.docId, severity: 'error', code: 'FORM-01', check: CHECKS['FORM-01'], message: item.message, fix: null });
  }

  const roots = new Map();
  for (const doc of documents) {
    const root = docsRoot(doc.file);
    if (root) roots.set(root, (roots.get(root) || 0) + 1);
  }
  const root = [...roots].sort((a, b) => b[1] - a[1])[0];
  if (!root) notes.push('FORM-06 pominięte: żaden plik nie leży w processes/BFS-… ani w shared/….');
  const locate = locator(index);

  for (const doc of documents) {
    const add = (code, line, message, fix, severity = 'error') => findings.push({ file: doc.file, line, docId: doc.docId, severity, code, check: CHECKS[code], message, fix });
    const template = templates.get(doc.docType);
    if (!template) {
      add('FORM-01', 1, `Typ ${doc.docType} nie ma szablonu w templates/_00-meta.md.`, null);
      continue;
    }
    checkFrontMatter(doc, template, add);
    const present = checkSections(doc, template, add);
    checkTables(doc, template, present, add);

    const name = `${doc.docId.toLowerCase()}.md`;
    if (path.basename(doc.file) !== name) add('FORM-05', 1, `Plik nazywa się ${path.basename(doc.file)}, a powinien nosić doc-id małymi literami: ${name}.`, `Zmień nazwę pliku na ${name}.`);
    if (root) {
      const place = locate(doc);
      if (place) {
        const folder = path.join(root[0], ...place.segments);
        if (path.resolve(path.dirname(doc.file)) !== folder) {
          const target = displayPath(path.join(folder, name));
          add('FORM-06', 1, `Plik leży w ${displayPath(path.dirname(doc.file))}/, a powinien w ${displayPath(folder)}/, bo ${place.reason} (methodology.md, sekcja 11).`, `Przenieś plik do ${target}.`);
        }
      }
    }
  }
  return printFindings(findings, { json: options.json, documents: documents.length, notes });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
