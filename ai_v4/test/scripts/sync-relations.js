#!/usr/bin/env node
'use strict';

// Synchronizacja pola relations z treścią dokumentów.
//
// Skrypt szuka w treści dokumentu identyfikatorów innych dokumentów i wierszy,
// na przykład UC-001 albo BFS-001.REQ-01. Każde takie wystąpienie to wzmianka.
// Treść to wszystko w pliku poza front matter. Każda wzmianka wymaga wpisu
// w polu relations w front matter. Rodzaj relacji skrypt bierze z matrycy
// standards/config/relation-matrix.yaml: dla każdej pary typów (typ dokumentu,
// który wspomina, i typ wspomnianego celu) matryca podaje jeden rodzaj relacji.
//
// Skrypt porównuje wpisy wyliczone z treści z wpisami zapisanymi w pliku
// i wypisuje niezgodności. Z opcją --fix sam poprawia pole relations.

const fs = require('fs');
const path = require('path');
const { ID_PATTERN, DOC_MATCHERS, ROW_MATCHERS, typeOf, parseId } = require('./lib/ids');
const { MATRIX_FILE, CONTAINS, loadMatrix } = require('./lib/matrix');
const { uniq, collectFiles, readDocument } = require('./lib/documents');
const { displayPath } = require('./lib/report');

const USAGE = `Użycie: node scripts/sync-relations.js <plik.md|folder> [...] [--fix]

Skrypt szuka identyfikatorów dokumentów i wierszy w treści dokumentów, czyli
poza front matter, i porównuje je z polem relations. Rodzaj relacji wynika
z pary typów zapisanej w standards/config/relation-matrix.yaml.

  bez opcji  Wypisuje niezgodności i niczego nie zmienia w plikach.
  --fix      Nadpisuje pole relations w dokumentach, w których są niezgodności.

Jeśli podasz folder, skrypt sprawdzi wszystkie pliki .md w tym folderze i jego
podfolderach, które mają w front matter pole doc-id.

Kod wyjścia:
  0  nie ma niezgodności
  1  są niezgodności
  2  błędne wywołanie skryptu albo nie da się odczytać matrycy`;

// Etykiety w raporcie:
//   manual  niezgodność trzeba poprawić ręcznie,
//   fix     niezgodność naprawi opcja --fix,
//   fixed   opcja --fix już naprawiła niezgodność.
const LABELS = { manual: 'RĘCZNIE', fix: 'DO NAPRAWY', fixed: 'NAPRAWIONE' };

// Zbiera wzmianki, czyli wszystkie ID w liniach po front matter. Każda wzmianka
// pamięta numer linii, w której wystąpiła.
function findMentions(doc) {
  const mentions = [];
  doc.lines.forEach((line, index) => {
    if (index <= doc.frontMatterEnd) return;
    for (const [, docId, rowId, bareRow] of line.matchAll(ID_PATTERN)) {
      mentions.push(bareRow
        ? { id: bareRow, row: bareRow, line: index + 1 }
        : { id: rowId ? `${docId}.${rowId}` : docId, doc: docId, row: rowId, line: index + 1 });
    }
  });
  return mentions;
}

// Klucz, po którym skrypt porównuje cele wpisów. Własny wiersz dokumentu ma ten
// sam klucz bez względu na zapis: w BFS-001 zarówno REQ-01, jak i BFS-001.REQ-01
// dają klucz BFS-001.REQ-01. Cel, którego nie da się rozpoznać, albo wiersz
// innego dokumentu zapisany bez ID dokumentu dostaje klucz ze znakiem ? na początku.
function nodeKey(doc, target, matrix) {
  const id = parseId(target);
  if (!id) return `?${target}`;
  if (id.doc) return target;
  return matrix.owns(doc.docType, id.rowType) ? `${doc.docId}.${id.row}` : `?${target}`;
}

// Typy wierszy, które zawiera dokument typu docType i które dokument typu
// sourceType może wskazać relacją inną niż contains. Przykład: UC może wskazać
// wiersze REQ i RB w BFS.
function rowTargets(matrix, sourceType, docType) {
  return matrix.rowTypesOf(docType).filter(rowType => {
    const relation = matrix.relation(sourceType, rowType);
    return relation && relation !== CONTAINS;
  });
}

// Szuka trójki, w której dokument typu sourceType wskazuje dokument typu docType
// albo jeden z jego wierszy. Jeśli taka trójka jest, relację zapisuje dokument
// typu sourceType. Zwraca opis trójki, na przykład „BPMN contains SPEC-WF”, albo null.
function reverseTriple(matrix, sourceType, docType) {
  const direct = matrix.relation(sourceType, docType);
  if (direct) return `${sourceType} ${direct} ${docType}`;
  const rowType = rowTargets(matrix, sourceType, docType)[0];
  return rowType ? `${sourceType} ${matrix.relation(sourceType, rowType)} ${rowType}` : null;
}

// Wylicza wpisy relations z wzmianek w treści dokumentu. Zwraca:
//   derived    wpisy, które powinny być w polu relations,
//   mentioned  klucze wszystkich wspomnianych celów,
//   problems   wzmianki, z których nie da się wyliczyć wpisu; trzeba je poprawić ręcznie.
function deriveRelations(doc, matrix) {
  const derived = new Map();
  const mentioned = new Set();
  const problems = [];
  const reported = new Set();
  const unresolved = [];
  const sourceType = doc.docType;
  const add = (type, target, targetType, line) => {
    if (!derived.has(target)) derived.set(target, { type, target, targetType, line });
  };
  const problem = (level, label, mention, detail) => {
    if (reported.has(`${label}|${mention.id}`)) return;
    reported.add(`${label}|${mention.id}`);
    problems.push({ level, label, subject: `${mention.id} (linia ${mention.line})`, detail, line: mention.line, mention });
  };

  for (const mention of findMentions(doc)) {
    mentioned.add(nodeKey(doc, mention.id, matrix));
    // Sam wiersz, bez ID dokumentu. Poprawny jest tylko własny wiersz dokumentu
    // i daje wpis contains.
    if (!mention.doc) {
      const rowType = typeOf(ROW_MATCHERS, mention.row);
      const owners = matrix.owners(rowType);
      if (matrix.owns(sourceType, rowType)) add(CONTAINS, mention.row, rowType, mention.line);
      else problem('manual', 'wiersz bez prefiksu', mention,
        `${owners.length ? `Wiersz typu ${rowType} należy do dokumentu typu ${owners.join(' albo ')}` : `Matryca nie przypisuje wiersza typu ${rowType} do żadnego typu dokumentu`}. Wiersz z innego dokumentu zapisuje się pełnym ID, czyli z ID dokumentu i kropką na początku.`);
      continue;
    }
    const docType = typeOf(DOC_MATCHERS, mention.doc);
    const rowType = mention.row && typeOf(ROW_MATCHERS, mention.row);
    // Pełne ID wiersza. Własny wiersz daje wpis contains. Wiersz innego dokumentu
    // daje wpis do tego wiersza, jeśli matryca ma taką trójkę. Jeśli nie ma,
    // skrypt niżej próbuje wskazać cały dokument.
    if (rowType) {
      if (!matrix.owns(docType, rowType)) {
        problem('manual', 'błędne ID wiersza', mention, `Wiersz typu ${rowType} nie należy do dokumentu typu ${docType}, więc ID ${mention.id} jest błędne.`);
        continue;
      }
      if (mention.doc === doc.docId) {
        add(CONTAINS, mention.row, rowType, mention.line);
        continue;
      }
      const relation = matrix.relation(sourceType, rowType);
      if (relation && relation !== CONTAINS) {
        add(relation, mention.id, rowType, mention.line);
        continue;
      }
    } else if (mention.doc === doc.docId) {
      // Dokument wspomina sam siebie. Taka wzmianka nie tworzy wpisu.
      continue;
    }
    // Wzmianka o innym dokumencie. Jeśli matryca ma trójkę, powstaje wpis.
    // Jeśli nie ma, wzmianka czeka na sprawdzenie w pętli poniżej.
    const relation = matrix.relation(sourceType, docType);
    if (relation) add(relation, mention.doc, docType, mention.line);
    else unresolved.push({ ...mention, docType, rowType });
  }

  // Wzmianki, dla których matryca nie ma trójki od tego dokumentu do wspomnianego
  // dokumentu. Taka wzmianka jest poprawna tylko wtedy, gdy dokument ma już wpis
  // do jednego z wierszy wspomnianego dokumentu. Przykład: UC-001 wspomina BFS-001
  // i ma wpis realizes BFS-001.REQ-01. W pozostałych przypadkach skrypt zgłasza
  // wzmiankę do poprawy ręcznej i podpowiada, co zrobić.
  for (const mention of unresolved) {
    const rows = rowTargets(matrix, sourceType, mention.docType);
    if (rows.length && [...derived.keys()].some(target => target.startsWith(`${mention.doc}.`))) continue;
    const forward = uniq([
      ...(mention.rowType && matrix.relation(sourceType, mention.rowType) !== CONTAINS ? [`${sourceType} → ${mention.rowType}`] : []),
      `${sourceType} → ${mention.docType}`,
    ]);
    const reverse = reverseTriple(matrix, mention.docType, sourceType);
    if (reverse) {
      problem('manual', 'wzmianka o dokumencie wskazującym', mention,
        `Usuń tę wzmiankę. Relację zapisuje ${mention.doc} (trójka ${reverse}), a dokument nie wymienia w treści dokumentów, które go wskazują (methodology.md, sekcja 7).`);
    } else if (rows.length) {
      problem('manual', 'wzmianka bez wiersza', mention,
        `Matryca nie ma trójki ${forward.join(' ani ')}, więc nie można wskazać całego dokumentu ${mention.doc}. Wskaż jego wiersz pełnym ID; może to być wiersz typu ${rows.join(' albo ')}.`);
    } else {
      problem('manual', 'brak trójki', mention,
        `Matryca nie ma trójki ${uniq([...forward, `${mention.docType} → ${sourceType}`]).join(' ani ')}. Usuń wzmiankę albo zmień matrycę.`);
    }
  }
  return { derived: [...derived.values()], mentioned, problems };
}

// Układa wpisy w kolejności trójek w matrycy, a w obrębie jednej trójki rosnąco
// według ID. Dzięki temu ta sama treść dokumentu zawsze daje tę samą listę.
function sortEntries(doc, entries, matrix) {
  return [...entries].sort((a, b) => matrix.rank(doc.docType, a.targetType) - matrix.rank(doc.docType, b.targetType)
    || a.target.localeCompare(b.target, 'en', { numeric: true }));
}

// Wyjaśnia, dlaczego wpis zapisany w pliku jest zbędny, czyli nie wynika z treści dokumentu.
function unwantedReason(doc, target, mentioned, matrix) {
  const id = parseId(target);
  if (!id.doc && !matrix.owns(doc.docType, id.rowType)) return 'Cel to wiersz innego dokumentu zapisany bez ID tego dokumentu na początku.';
  if (!mentioned) return 'Treść dokumentu nie wspomina tego celu.';
  const targetType = id.rowType || id.docType;
  if (id.doc && id.row && matrix.relation(doc.docType, targetType) === CONTAINS) {
    return `Dokument typu ${doc.docType} może zawierać tylko własne wiersze typu ${targetType}, a ten wiersz należy do innego dokumentu.`;
  }
  return `Matryca nie ma trójki, w której ${doc.docType} wskazuje ${targetType}.`;
}

// Porównuje wpisy zapisane w polu relations z wpisami wyliczonymi z treści. Zwraca:
//   issues   niezgodności, które naprawi opcja --fix,
//   entries  listę wpisów po naprawie: zbędne wpisy wypadają, brakujące są
//            dopisywane, a cała lista stoi w kolejności z matrycy.
function reconcile(doc, derivation, matrix) {
  const issues = [];
  const fix = (label, subject, detail, line) => issues.push({ level: 'fix', label, subject, detail, line });
  const fieldLine = doc.relations ? doc.relations.start + 1 : 1;
  const keyOf = target => nodeKey(doc, target, matrix);
  const wanted = new Map(derivation.derived.map(entry => [keyOf(entry.target), entry]));
  const entries = [];
  const matched = new Set();

  if (!doc.relations) fix('brak pola relations', 'front matter', 'Dokument nie ma pola relations.', 1);
  for (const error of doc.relationsErrors) fix('nieczytelne pole relations', `linia ${error.line}`, error.text, error.line);

  // Najpierw zaznacza wpisy, które dokładnie zgadzają się z wyliczonymi: ten sam
  // cel, ten sam rodzaj relacji i ten sam zapis celu. Dzięki temu, gdy jeden cel
  // ma kilka wpisów, zostaje wpis poprawny, a nie pierwszy z brzegu.
  const exact = new Set();
  for (const entry of doc.entries) {
    if (entry.invalid) continue;
    const key = keyOf(entry.target);
    const want = wanted.get(key);
    if (want && want.type === entry.type && want.target === entry.target && !exact.has(key)) {
      exact.add(key);
      entry.exact = true;
    }
  }
  for (const entry of doc.entries) {
    const subject = `${entry.type || '?'} ${entry.target || '?'}`;
    if (entry.invalid) {
      fix('błędny wpis', `${subject} (linia ${entry.line})`, entry.invalid, entry.line);
      continue;
    }
    const key = keyOf(entry.target);
    const want = wanted.get(key);
    if (entry.exact) {
      matched.add(key);
      entries.push(want);
    } else if (!want) {
      fix('zbędny wpis', subject, unwantedReason(doc, entry.target, derivation.mentioned.has(key), matrix), entry.line);
    } else if (exact.has(key) || matched.has(key)) {
      if (entry.type === want.type) fix('duplikat', subject, `To drugi taki sam wpis dla celu ${want.target}.`, entry.line);
      else fix('zbędny wpis', subject, `To drugi wpis dla celu ${want.target}, z innym rodzajem relacji. Według matrycy poprawna trójka to ${doc.docType} ${want.type} ${want.targetType}.`, entry.line);
    } else {
      matched.add(key);
      entries.push(want);
      if (want.type !== entry.type) fix('zły typ', subject, `Według matrycy poprawna trójka to ${doc.docType} ${want.type} ${want.targetType}.`, entry.line);
      else fix('zapis celu', subject, `Własny wiersz dokumentu zapisuje się samym ID, bez ID dokumentu na początku: ${want.target}.`, entry.line);
    }
  }
  // Wpisy, które zostają, muszą stać w kolejności z matrycy. Jeśli nie stoją,
  // skrypt zgłasza pierwszy wpis nie na swoim miejscu. Taki wpis stoi w
  // uporządkowanej liście dalej niż w pliku, więc zawsze ma poprzednika.
  const ordered = sortEntries(doc, entries, matrix);
  const misplaced = entries.findIndex((entry, index) => entry !== ordered[index]);
  if (misplaced >= 0) {
    const entry = entries[misplaced];
    const previous = ordered[ordered.indexOf(entry) - 1];
    fix('kolejność wpisów', `${entry.type} ${entry.target}`,
      `Ten wpis powinien stać za wpisem ${previous.type} ${previous.target}. Wpisy układa się w kolejności trójek w matrycy, a w obrębie jednej trójki rosnąco według ID.`, fieldLine);
  }
  const missing = sortEntries(doc, derivation.derived.filter(want => !matched.has(keyOf(want.target))), matrix);
  for (const want of missing) {
    fix('brak wpisu', `${want.type} ${want.target}`, `Treść wspomina ten cel w linii ${want.line}, a pole relations nie ma dla niego wpisu.`, fieldLine);
  }
  return { issues, entries: sortEntries(doc, [...entries, ...missing], matrix) };
}

// Zapisuje nowe pole relations w pliku. Zmienia tylko to pole i zachowuje znacznik
// BOM oraz końce linii. Jeśli dokument nie miał pola, dopisuje je na końcu front matter.
function writeRelations(doc, entries) {
  const block = entries.length
    ? ['relations:', ...entries.flatMap(entry => [`  - type: ${entry.type}`, `    target: ${entry.target}`])]
    : ['relations: []'];
  const lines = doc.lines.slice();
  if (doc.relations) lines.splice(doc.relations.start, doc.relations.end - doc.relations.start, ...block);
  else lines.splice(doc.frontMatterEnd, 0, ...block);
  fs.writeFileSync(doc.file, (doc.bom ? '\ufeff' : '') + lines.join(doc.eol), 'utf8');
}

// Przebieg skryptu: odczyt opcji, wczytanie matrycy, sprawdzenie plików, raport
// i kod wyjścia.
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

  // Pliki podane wprost są zapamiętane osobno: plik bez doc-id podany wprost
  // trafia do raportu, a znaleziony w folderze jest tylko liczony jako pominięty.
  const explicit = new Set();
  const files = new Map();
  for (const input of inputs) {
    const target = path.resolve(input);
    if (fs.statSync(target).isFile()) explicit.add(target);
    for (const file of collectFiles(target)) files.set(file, true);
  }

  const report = [];
  let documents = 0;
  let skipped = 0;
  let rewritten = 0;
  const sorted = [...files.keys()].sort((a, b) => (displayPath(a) < displayPath(b) ? -1 : 1));
  for (const file of sorted) {
    let doc;
    try {
      doc = readDocument(file, matrix);
    } catch (error) {
      report.push({ file, issues: [{ level: 'manual', label: 'błąd odczytu', subject: 'plik', detail: error.message }] });
      continue;
    }
    if (doc.kind === 'not-document') {
      if (explicit.has(file)) report.push({ file, issues: [{ level: 'manual', label: 'plik bez doc-id', subject: 'front matter', detail: 'Plik podany wprost nie ma front matter z polem doc-id, więc nie jest dokumentem.' }] });
      else skipped++;
      continue;
    }
    if (doc.kind === 'error') {
      report.push({ file, docId: doc.docId, issues: [{ level: 'manual', label: 'front matter', subject: 'plik', detail: doc.error }] });
      continue;
    }
    documents++;
    const derivation = deriveRelations(doc, matrix);
    const { issues, entries } = reconcile(doc, derivation, matrix);
    if (fixMode && issues.length) {
      writeRelations(doc, entries);
      rewritten++;
    }
    const all = [...derivation.problems, ...issues];
    if (all.length) report.push({ file, docId: doc.docId, issues: all });
  }

  for (const { file, docId, issues } of report) {
    console.log(docId ? `${displayPath(file)} (${docId})` : displayPath(file));
    for (const issue of issues) {
      const label = LABELS[issue.level === 'fix' && fixMode ? 'fixed' : issue.level];
      console.log(`  ${label.padEnd(10)}  ${issue.label}: ${issue.subject} — ${issue.detail}`);
    }
    console.log('');
  }
  const count = level => report.reduce((sum, item) => sum + item.issues.filter(issue => issue.level === level).length, 0);
  const manual = count('manual');
  const fixable = count('fix');
  console.log(`Dokumenty: ${documents}${skipped ? `, pominięte pliki bez doc-id: ${skipped}` : ''}`);
  if (fixMode) {
    console.log(`Naprawione: ${fixable} w plikach: ${rewritten}. Do poprawy ręcznej: ${manual}.`);
    return manual ? 1 : 0;
  }
  console.log(`Do naprawy przez --fix: ${fixable}. Do poprawy ręcznej: ${manual}.`);
  return manual || fixable ? 1 : 0;
}

module.exports = { deriveRelations, reconcile };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
