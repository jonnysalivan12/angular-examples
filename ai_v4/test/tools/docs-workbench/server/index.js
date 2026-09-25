#!/usr/bin/env node
'use strict';

// Serwer Warsztatu dokumentacji.
//
// Czyta dokumentację z podanego folderu przez knowledge-index, udostępnia dane
// interfejsowi pod /api i obserwuje pliki. Po zmianie pliku synchronizuje
// indeks i wysyła zdarzenie „change” do otwartych kart przeglądarki.
// Serwer słucha tylko na 127.0.0.1 i niczego nie zapisuje w dokumentacji.

const { execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { REPO_ROOT } = require('../../../scripts/knowledge-index/sync');
const { openWorkbench, DB_FILE } = require('./workbench');

const USAGE = `Użycie: node tools/docs-workbench/server/index.js --root <folder> [--port 4180] [--db <plik>]

  --root  folder dokumentacji, na przykład standards/examples (wymagany)
  --port  port serwera; domyślnie 4180
  --db    plik bazy indeksu; domyślnie node_modules/.cache/docs-workbench.db`;

const CLIENT_DIR = path.join(__dirname, '..', 'dist');
const CONFIG_DIR = path.join(REPO_ROOT, 'standards', 'config');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
// Rozszerzenia plików dokumentacji, które serwer udostępnia pod /api/file (obrazy z treści).
const DOC_FILES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.md', '.txt', '.bpmn']);

function parseArgs(argv) {
  const options = { port: 4180, dbFile: DB_FILE };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--root') options.root = argv[++i];
    else if (arg === '--port') options.port = Number(argv[++i]);
    else if (arg === '--db') options.dbFile = path.resolve(argv[++i]);
    else throw new Error(`Nieznana opcja: ${arg}`);
  }
  return options;
}

// Nazwa bieżącej gałęzi git albo null poza repozytorium git.
function gitBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) reject(new Error('Za duże żądanie.'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Treść żądania nie jest poprawnym JSON.')); }
    });
  });
}

function sendFile(res, file) {
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function serveClient(url, res) {
  if (!fs.existsSync(CLIENT_DIR)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Interfejs nie jest zbudowany. Serwer API działa pod /api.');
    return;
  }
  const requested = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = path.join(CLIENT_DIR, requested);
  if (!file.startsWith(CLIENT_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(CLIENT_DIR, 'index.html');
  sendFile(res, file);
}

// Plik z folderu dokumentacji (obraz z treści dokumentu). Ścieżka jest
// względem głównego folderu repozytorium, jak `path` dokumentu w API.
function serveDocFile(url, res, rootDir) {
  const requested = url.searchParams.get('path') || '';
  const file = path.resolve(REPO_ROOT, requested);
  const root = path.resolve(REPO_ROOT, rootDir);
  const inside = file === root || file.startsWith(root + path.sep);
  if (!inside || !DOC_FILES.has(path.extname(file).toLowerCase()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return sendJson(res, 404, { error: 'Nie ma takiego pliku w folderze dokumentacji.' });
  }
  return sendFile(res, file);
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.help || !options.root) {
    console.log(USAGE);
    return options.help ? 0 : 2;
  }

  const workbench = openWorkbench({ root: options.root, dbFile: options.dbFile });
  const clients = new Set();
  const broadcast = (event, data) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Zapis pliku daje kilka zdarzeń fs.watch, więc synchronizacja czeka chwilę.
  // Zdarzenie „change” idzie tylko wtedy, gdy indeks naprawdę się zmienił
  // (pliki tymczasowe edytora i pliki spoza indeksu nic nie zmieniają).
  let timer = null;
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const counts = workbench.sync();
        if (counts) broadcast('change', counts);
      } catch (error) {
        broadcast('sync-error', { message: error.message });
      }
    }, 250);
  };
  for (const folder of [path.resolve(options.root), CONFIG_DIR]) fs.watch(folder, { recursive: true }, onChange);

  const routes = {
    'GET /api/graph': () => workbench.graph(),
    'GET /api/doc': url => {
      const node = workbench.describe(url.searchParams.get('id') || '');
      return node || { status: 404, body: { error: 'Nie ma takiego dokumentu ani wiersza.' } };
    },
    'GET /api/search': url => workbench.search(url.searchParams.get('q') || '', {
      type: url.searchParams.get('type') || undefined,
      limit: Number(url.searchParams.get('limit')) || undefined,
    }),
    'POST /api/query': async (url, req) => {
      const body = await readBody(req);
      const starts = Array.isArray(body.starts) ? body.starts.map(String) : [];
      if (!starts.length) return { status: 400, body: { error: 'Podaj co najmniej jeden węzeł startowy (starts).' } };
      return workbench.query(String(body.query || 'change_scope'), starts, { simulateRemoval: Boolean(body.simulateRemoval) });
    },
    'GET /api/flow': () => workbench.flow(),
    'GET /api/workflows': () => workbench.workflows(),
    'GET /api/validation': () => workbench.validation(),
    'GET /api/meta': () => ({
      version: workbench.version, root: workbench.root, repoRoot: REPO_ROOT, queries: workbench.queries(), branch: gitBranch(),
    }),
  };

  const server = http.createServer(async (req, res) => {
    // Cała obsługa jest w try: niepoprawny adres (np. /%zz) nie może zakończyć procesu.
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(`event: hello\ndata: ${JSON.stringify({ version: workbench.version })}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/file') return serveDocFile(url, res, workbench.root);
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) {
        if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Nie ma takiego adresu API.' });
        return serveClient(url, res);
      }
      const result = await route(url, req);
      if (result && result.status && result.body) return sendJson(res, result.status, result.body);
      sendJson(res, 200, result);
    } catch (error) {
      if (res.headersSent) return res.end();
      sendJson(res, 400, { error: error.message });
    }
  });
  server.on('error', error => {
    if (error.code !== 'EADDRINUSE') throw error;
    console.error(`Port ${options.port} jest zajęty. Prawdopodobnie Warsztat już działa (sprawdź http://127.0.0.1:${options.port}/api/meta).\n`
      + `Zamknij tamten proces albo uruchom serwer z inną wartością --port.`);
    process.exit(2);
  });
  server.listen(options.port, '127.0.0.1', () => {
    console.log(`Warsztat dokumentacji: http://127.0.0.1:${options.port}  (folder: ${workbench.root})`);
  });
  return undefined;
}

if (require.main === module) {
  const code = main(process.argv.slice(2));
  if (code !== undefined) process.exitCode = code;
}

module.exports = { main, parseArgs };
