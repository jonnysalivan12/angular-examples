#!/usr/bin/env node
'use strict';

// Serwer MCP indeksu dokumentacji (knowledge-index).
//
// Działa przez stdio: każda linia wejścia i wyjścia to jedna wiadomość
// JSON-RPC 2.0. Komunikaty diagnostyczne idą na stderr, bo stdout przenosi
// tylko wiadomości protokołu. Serwer nie wymaga żadnych pakietów.
//
// Uruchomienie: node scripts/knowledge-index/mcp-server.js --root <folder> [--db <plik>]
// Folder --root jest liczony względem folderu repozytorium, a nie bieżącego
// folderu, bo klient MCP może uruchomić serwer z dowolnego miejsca.
//
// Przed każdym wywołaniem narzędzia serwer synchronizuje bazę z folderem, więc
// odpowiedź zawsze uwzględnia bieżący stan plików.

const path = require('path');
const readline = require('readline');
const { openIndex } = require('./index');
const { REPO_ROOT } = require('./sync');

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'knowledge-index', version: '1.0.0' };

const INSTRUCTIONS = `Indeks dokumentacji projektowej. Dokumentacja jest grafem: dokument albo wiersz dokumentu (np. BFS-001.REQ-01) to węzeł, a wpis relations w front matter to krawędź.
Zamiast przeszukiwać foldery:
- find_document znajduje dokument po ID, typie (API, ENT, UC…) albo słowach z tytułu i opisu,
- change_scope zwraca pliki do przejrzenia, gdy zmieniasz węzły,
- implementation zwraca pliki do przeczytania, zanim zbudujesz to, co opisuje węzeł,
- describe_node pokazuje wpisy relations węzła i dokumenty, które go wskazują.
Każdy wynik podaje folder (path) i nazwę pliku (fileName) względem folderu repozytorium. Treść czytaj z pliku.`;

const log = message => process.stderr.write(`[knowledge-index] ${message}\n`);

// Odczytuje argumenty serwera. Zwraca { root, dbFile } albo rzuca błąd.
function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg !== '--root' && arg !== '--db') throw new Error(`Nieznany argument: ${arg}`);
    if (index + 1 >= argv.length) throw new Error(`Opcja ${arg} wymaga wartości.`);
    options[arg === '--root' ? 'root' : 'dbFile'] = path.resolve(REPO_ROOT, argv[++index]);
  }
  if (!options.root) throw new Error('Nie podano folderu z dokumentacją: --root <folder>.');
  return options;
}

// Sprawdza argumenty narzędzia według prostego schematu i rzuca błąd z opisem.
function checkArguments(tool, args) {
  const { properties, required = [] } = tool.inputSchema;
  for (const name of required) {
    if (args[name] === undefined) throw new Error(`Brak argumentu ${name}.`);
  }
  for (const [name, value] of Object.entries(args)) {
    const schema = properties[name];
    if (!schema) throw new Error(`Nieznany argument ${name}.`);
    if (schema.type === 'string' && (typeof value !== 'string' || !value.trim())) throw new Error(`Argument ${name} musi być niepustym tekstem.`);
    if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`Argument ${name} musi mieć wartość true albo false.`);
    if (schema.type === 'integer' && !(Number.isInteger(value) && value >= 1)) throw new Error(`Argument ${name} musi być dodatnią liczbą całkowitą.`);
    if (schema.type === 'array' && !(Array.isArray(value) && value.length && value.every(item => typeof item === 'string' && item.trim()))) {
      throw new Error(`Argument ${name} musi być niepustą listą identyfikatorów.`);
    }
  }
}

// Wynik zapytania dla agenta: tylko pliki z węzłami, bez listy węzłów, która
// powtarza te same dane.
const queryOutput = result => ({ query: result.query, starts: result.starts, missing: result.missing, files: result.files });

const IDS_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
  description: 'Identyfikatory węzłów: doc-id dokumentu (UC-001, ENT-Disposition) albo pełne ID wiersza (BFS-001.REQ-01, DDM-001.DOM-Dyspozycja).',
};

const TOOLS = [
  {
    name: 'find_document',
    description: 'Szuka dokumentów. Tekst może być identyfikatorem (UC-001; BFS-001.REQ-01 zwraca BFS-001), typem dokumentu (API zwraca wszystkie API) albo słowami z doc-id, tytułu i opisu. Słowa są dopasowywane od początku, bez rozróżniania wielkości liter i polskich znaków. Zwraca docId, type, title, description, status, path i fileName.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'ID, typ dokumentu albo słowa.' },
        type: { type: 'string', description: 'Opcjonalnie: tylko dokumenty tego typu, np. API.' },
        limit: { type: 'integer', description: 'Opcjonalnie: liczba wyników, domyślnie 20.' },
      },
      required: ['query'],
    },
    run: (index, args) => index.findDocuments(args.query, { type: args.type, limit: args.limit }),
  },
  {
    name: 'describe_node',
    description: 'Opisuje dokument albo wiersz: plik (path, fileName), tytuł, opis, status, wpisy relations dokumentu (outgoing) i wpisy innych dokumentów, które wskazują węzeł albo wiersze dokumentu (incoming). Pole exists mówi, czy węzeł istnieje.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: IDS_SCHEMA.description.replace('Identyfikatory węzłów', 'Identyfikator węzła') } },
      required: ['id'],
    },
    run(index, args) {
      const node = index.describeNode(args.id.trim());
      if (!node) throw new Error(`„${args.id}” nie jest identyfikatorem dokumentu ani wiersza z doc-id, na przykład UC-001 albo BFS-001.REQ-01.`);
      return node;
    },
  },
  {
    name: 'change_scope',
    description: 'Zasięg zmiany: pliki, które trzeba przejrzeć, gdy zmieniasz podane węzły. Wynik zawęża przegląd; nie każdy plik musi się zmienić. Zwraca files: path, fileName, docId, title i nodes (node, type, via). Pole via to droga po relacjach, np. „BFS-001.REQ-01 <-realizes- UC-001” (UC-001 ma wpis realizes BFS-001.REQ-01). Węzły startowe są w wyniku; missing to węzły, których nie ma.',
    inputSchema: { type: 'object', properties: { ids: IDS_SCHEMA }, required: ['ids'] },
    run: (index, args) => queryOutput(index.query('change_scope', args.ids.map(id => id.trim()))),
  },
  {
    name: 'implementation',
    description: 'Implementacja: pliki, które trzeba przeczytać, zanim zbudujesz to, co opisują podane węzły (wymagania, zdolności, kontrakty, konwencje, encje, reguły, progi NFR, ekrany). Zwraca files w tym samym formacie co change_scope.',
    inputSchema: { type: 'object', properties: { ids: IDS_SCHEMA }, required: ['ids'] },
    run: (index, args) => queryOutput(index.query('implementation', args.ids.map(id => id.trim()))),
  },
  {
    name: 'reindex',
    description: 'Synchronizuje bazę z plikami i zwraca liczby plików oraz pliki z błędem front matter. Każde inne narzędzie i tak synchronizuje bazę przed odpowiedzią; full=true buduje całą bazę od nowa.',
    inputSchema: {
      type: 'object',
      properties: { full: { type: 'boolean', description: 'Opcjonalnie: zbuduj całą bazę od nowa.' } },
    },
    run: (index, args, counts) => ({ ...(args.full ? index.sync({ full: true }) : counts), brokenFiles: index.brokenFiles() }),
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map(tool => [tool.name, tool]));

function createServer({ root, dbFile }, send) {
  let index = null;

  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const replyError = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  const toolError = (id, message) => reply(id, { content: [{ type: 'text', text: message }], isError: true });

  // Otwiera indeks przy pierwszym wywołaniu, a przy kolejnych synchronizuje bazę.
  function freshIndex() {
    if (!index) {
      index = openIndex({ root, dbFile });
      log(`baza otwarta: ${JSON.stringify(index.lastSync)}`);
      return index.lastSync;
    }
    return index.sync();
  }

  function callTool(id, params) {
    const tool = TOOL_BY_NAME.get(params && params.name);
    if (!tool) return toolError(id, `Nieznane narzędzie: ${params && params.name}`);
    const args = (params && params.arguments) || {};
    try {
      checkArguments(tool, args);
      const counts = freshIndex();
      const result = tool.run(index, args, counts);
      return reply(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (error) {
      log(`błąd narzędzia ${tool.name}: ${error.message}`);
      return toolError(id, `Błąd w ${tool.name}: ${error.message}`);
    }
  }

  function handle(message) {
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
      return replyError(message && message.id !== undefined ? message.id : null, -32600, 'Nieprawidłowa wiadomość JSON-RPC.');
    }
    // Powiadomienie nie ma id i nie wymaga odpowiedzi.
    if (message.id === undefined || message.id === null) return undefined;
    switch (message.method) {
      case 'initialize':
        return reply(message.id, {
          protocolVersion: (message.params && message.params.protocolVersion) || PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      case 'ping':
        return reply(message.id, {});
      case 'tools/list':
        return reply(message.id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case 'tools/call':
        return callTool(message.id, message.params);
      default:
        return replyError(message.id, -32601, `Nieznana metoda: ${message.method}`);
    }
  }

  function handleLine(line) {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      replyError(null, -32700, 'Linia nie jest poprawnym JSON.');
      return;
    }
    try {
      handle(message);
    } catch (error) {
      log(`błąd obsługi wiadomości: ${error.message}`);
      if (message && message.id !== undefined && message.id !== null) replyError(message.id, -32603, `Błąd wewnętrzny: ${error.message}`);
    }
  }

  return { handleLine, close: () => index && index.close() };
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    log(error.message);
    process.exitCode = 2;
    return;
  }
  const server = createServer(options, message => process.stdout.write(`${JSON.stringify(message)}\n`));
  const input = readline.createInterface({ input: process.stdin, terminal: false });
  input.on('line', server.handleLine);
  input.on('close', server.close);
  log(`gotowy (folder: ${path.relative(REPO_ROOT, options.root) || '.'})`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { TOOLS, createServer, parseArgs };
