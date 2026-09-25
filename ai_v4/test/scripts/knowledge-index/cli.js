#!/usr/bin/env node
'use strict';

// Wiersz poleceń indeksu dokumentacji (knowledge-index).
//
// Każde polecenie najpierw synchronizuje bazę z folderem podanym w --root,
// a potem odpowiada z bazy.

const { openIndex } = require('./index');

const USAGE = `Użycie: node scripts/knowledge-index/cli.js <polecenie> [argumenty] --root <folder> [opcje]

Polecenia:
  sync                      Synchronizuje bazę z folderem i wypisuje liczby plików.
  find <tekst>              Szuka dokumentów po ID, typie dokumentu (np. API)
                            albo słowach z doc-id, title i description.
  describe <ID>             Opisuje dokument albo wiersz: plik, wpisy relations
                            i dokumenty, które go wskazują.
  scope <ID> [ID ...]       Zapytanie change_scope: pliki do przejrzenia przy zmianie.
  impl <ID> [ID ...]        Zapytanie implementation: pliki do przeczytania przed budową.

Opcje:
  --root <folder>  Indeksowany folder z dokumentacją (wymagany).
  --db <plik>      Plik bazy. Domyślnie node_modules/.cache/knowledge-index.db.
  --type <TYP>     Tylko dla find: ogranicza wynik do typu dokumentu.
  --limit <liczba> Tylko dla find: liczba wyników, domyślnie 20.
  --json           Wypisuje wynik jako JSON.

Kod wyjścia:
  0  polecenie wykonane
  1  podany węzeł nie istnieje w dokumentacji
  2  błędne wywołanie albo nie da się odczytać matrycy, wzorców lub folderu`;

const QUERIES = { scope: 'change_scope', impl: 'implementation' };

// Odczytuje argumenty. Zwraca { command, args, options } albo { error }.
function parseArgs(argv) {
  const options = { json: false };
  const positional = [];
  const valued = { '--root': 'root', '--db': 'dbFile', '--type': 'type', '--limit': 'limit' };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (valued[arg]) {
      if (index + 1 >= argv.length) return { error: `Opcja ${arg} wymaga wartości.` };
      options[valued[arg]] = argv[++index];
    } else if (arg.startsWith('-')) return { error: `Nieznana opcja: ${arg}` };
    else positional.push(arg);
  }
  if (options.limit !== undefined) {
    if (!/^[1-9]\d*$/.test(options.limit)) return { error: 'Opcja --limit wymaga dodatniej liczby całkowitej.' };
    options.limit = Number(options.limit);
  }
  const [command, ...args] = positional;
  return { command, args, options };
}

const fileOf = item => `${item.path}/${item.fileName}`;

function printSync(counts, broken) {
  console.log(`Folder: ${counts.root}`);
  console.log(`Pliki: ${counts.files} (nowe ${counts.added}, zmienione ${counts.changed}, usunięte ${counts.removed}, bez zmian ${counts.unchanged}).`);
  console.log(`Baza zbudowana od nowa: ${counts.rebuilt ? 'tak' : 'nie'}.`);
  console.log(`Pliki z błędem front matter: ${broken.length}.`);
  for (const file of broken) console.log(`  ${fileOf(file)}: ${file.error}`);
}

function printDocuments(documents) {
  if (!documents.length) {
    console.log('Nie znaleziono dokumentów.');
    return;
  }
  for (const doc of documents) {
    console.log(`${doc.docId}  ${fileOf(doc)}`);
    console.log(`  ${doc.title || '(bez tytułu)'}`);
  }
  console.log(`\nDokumenty: ${documents.length}.`);
}

function printNode(node) {
  console.log(`${node.node}  ${node.type}${node.exists ? '' : '  (węzeł nie istnieje)'}`);
  if (node.fileName) {
    console.log(`Plik: ${fileOf(node)}`);
    console.log(`Tytuł: ${node.title || '(bez tytułu)'}`);
    if (node.status) console.log(`Status: ${node.status}`);
    if (node.description) console.log(`Opis: ${node.description}`);
  } else {
    console.log(`Nie ma dokumentu ${node.docId}.`);
  }
  for (const duplicate of node.duplicates) console.log(`Ten sam doc-id ma też plik: ${fileOf(duplicate)}`);
  if (node.outgoing.length) {
    console.log('\nWpisy relations:');
    for (const edge of node.outgoing) console.log(`  ${edge.relation} ${edge.target}${edge.exists ? '' : '  (cel nie istnieje)'}`);
  }
  if (node.incoming.length) {
    console.log('\nWskazywany przez:');
    for (const edge of node.incoming) console.log(`  ${edge.source} ${edge.relation} ${edge.target}  ${fileOf(edge)}`);
  }
}

function printQuery(result) {
  for (const start of result.missing) console.log(`Węzeł ${start} nie istnieje w dokumentacji.`);
  if (!result.nodes.length) return;
  console.log(`${result.query} dla ${result.starts.join(', ')}: węzły ${result.nodes.length}, pliki ${result.files.length}.\n`);
  const starts = new Set(result.starts);
  for (const file of result.files) {
    console.log(fileOf(file));
    for (const item of file.nodes) {
      console.log(`  ${item.node}  ${starts.has(item.node) ? 'węzeł startowy' : `przez: ${item.via}`}`);
    }
  }
}

function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.options && parsed.options.help) {
    console.log(USAGE);
    return 0;
  }
  const { command, args, options, error } = parsed;
  const needsArgs = { find: 1, describe: 1, scope: 1, impl: 1 };
  const problem = error
    || (!command && 'Nie podano polecenia.')
    || (command !== 'sync' && !needsArgs[command] && `Nieznane polecenie: ${command}`)
    || (!options.root && 'Nie podano folderu: --root <folder>.')
    || (command === 'sync' && args.length && 'Polecenie sync nie przyjmuje argumentów.')
    || (command === 'describe' && args.length !== 1 && 'Polecenie describe przyjmuje jeden identyfikator.')
    || (needsArgs[command] && !args.length && `Polecenie ${command} wymaga argumentu.`)
    || ((options.type || options.limit) && command !== 'find' && 'Opcje --type i --limit działają tylko z poleceniem find.');
  if (problem) {
    console.error(`${problem}\n\n${USAGE}`);
    return 2;
  }

  let index;
  try {
    index = openIndex({ root: options.root, dbFile: options.dbFile });
  } catch (failure) {
    console.error(failure.message);
    return 2;
  }
  try {
    const output = value => console.log(JSON.stringify(value, null, 2));
    if (command === 'sync') {
      const broken = index.brokenFiles();
      if (options.json) output({ ...index.lastSync, brokenFiles: broken });
      else printSync(index.lastSync, broken);
      return 0;
    }
    if (command === 'find') {
      const documents = index.findDocuments(args.join(' '), { type: options.type, limit: options.limit });
      if (options.json) output(documents);
      else printDocuments(documents);
      return 0;
    }
    if (command === 'describe') {
      const node = index.describeNode(args[0]);
      if (!node) {
        console.error(`„${args[0]}” nie jest identyfikatorem dokumentu ani wiersza z doc-id, na przykład UC-001 albo BFS-001.REQ-01.`);
        return 2;
      }
      if (options.json) output(node);
      else printNode(node);
      return node.exists ? 0 : 1;
    }
    const result = index.query(QUERIES[command], args);
    if (options.json) output(result);
    else printQuery(result);
    return result.missing.length ? 1 : 0;
  } finally {
    index.close();
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { main };
