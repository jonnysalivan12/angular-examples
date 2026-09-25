// Tryb deweloperski: serwer API (port 4180) i Vite (port 5173) naraz.
// Folder dokumentacji można podać jako pierwszy argument; domyślnie
// standards/examples. Zatrzymanie jednego procesu zatrzymuje oba.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] || path.join(here, '..', '..', 'standards', 'examples');
const viteBin = path.join(here, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [
  spawn(process.execPath, [path.join(here, 'server', 'index.js'), '--root', root], { stdio: 'inherit' }),
  spawn(process.execPath, [viteBin], { cwd: here, stdio: 'inherit' }),
];
const stop = code => {
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(code ?? 0);
};
for (const child of children) child.on('exit', stop);
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
