// Ścieżki zapytań zasięgu. Serwer zapisuje drogę do węzła w polu via, na
// przykład „BFS-001.REQ-01 <-realizes- UC-001 -consumes-> API-001”.
//   -relacja->  bieżący węzeł ma wpis relacji do następnego,
//   <-relacja-  następny węzeł ma wpis relacji do bieżącego.

// Kroki drogi: [{ from, to, relation, direction: 'out' | 'in' }].
export function parseVia(via) {
  const tokens = (via || '').trim().split(/\s+/).filter(Boolean);
  const steps = [];
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    const arrow = tokens[i];
    const out = arrow.match(/^-([a-z_]+)->$/);
    const inc = arrow.match(/^<-([a-z_]+)-$/);
    if (!out && !inc) continue;
    steps.push({ from: tokens[i - 1], to: tokens[i + 1], relation: (out || inc)[1], direction: out ? 'out' : 'in' });
  }
  return steps;
}

// Linia na płótnie biegnie od dokumentu, który ma wpis relacji, do celu.
export const stepEdge = step => (step.direction === 'out'
  ? { source: step.from, target: step.to, relation: step.relation }
  : { source: step.to, target: step.from, relation: step.relation });

export const edgeKey = edge => `${edge.source}>${edge.relation}>${edge.target}`;

// Krótki zapis ostatniego kroku: „SCR-001 › SCRSEC-001” albo „CAP-001 ‹ FLOW-001”.
export function lastHop(via) {
  const steps = parseVia(via);
  if (!steps.length) return null;
  const step = steps[steps.length - 1];
  return `${step.from} ${step.direction === 'out' ? '›' : '‹'} ${step.to}`;
}

// Pełny zapis drogi z nazwami relacji, do eksportu i podpowiedzi.
export function readableVia(via) {
  const steps = parseVia(via);
  if (!steps.length) return 'start';
  return [steps[0].from, ...steps.map(step => `${step.direction === 'out' ? `—${step.relation}→` : `←${step.relation}—`} ${step.to}`)].join(' ');
}

// Grupy plików do listy wyniku.
//   wzorzec  węzły startowe, potem wzorce w kolejności pierwszego wystąpienia,
//   folder   folder pliku,
//   warstwa  warstwa dokumentu.
export function groupFiles(result, grouping, layerOf, layerName) {
  const groups = new Map();
  const add = (key, label, file) => {
    if (!groups.has(key)) groups.set(key, { key, label, files: [] });
    const group = groups.get(key);
    if (!group.files.includes(file)) group.files.push(file);
  };
  const nodeFile = new Map();
  for (const file of result.files) for (const item of file.nodes) nodeFile.set(item.node, file);
  for (const node of result.nodes) {
    const file = nodeFile.get(node.node);
    if (!file) continue;
    if (grouping === 'folder') add(file.path, file.path, file);
    else if (grouping === 'warstwa') { const layer = layerOf(file.docId); add(layer, layerName(layer), file); }
    else if (!node.pattern || result.starts.includes(node.node)) add('start', 'Start', file);
    else add(node.pattern, node.pattern, file);
  }
  return [...groups.values()];
}

export function exportMarkdown({ result, query, branch, removal, simulate, root = null }) {
  const relative = path => (root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);
  const date = new Date().toISOString().slice(0, 10);
  const starts = result.starts.join(', ');
  const title = simulate ? `Symulacja usunięcia: ${starts}` : query === 'implementation' ? `Do przeczytania przed budową: ${starts}` : `Zasięg zmiany: ${starts}`;
  const count = result.files.length;
  const filesWord = count === 1 ? 'plik' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'pliki' : 'plików';
  const starting = new Set(result.starts);
  const lines = [`## ${title}`, '', `${query} · ${count} ${filesWord}${branch ? ` · ${branch}` : ''} · ${date}`, ''];
  for (const file of result.files) {
    const notes = file.nodes.map(item => (starting.has(item.node) ? `start: ${item.node}` : readableVia(item.via))).join('; ');
    lines.push(`- [ ] ${relative(file.path)}/${file.fileName} — ${notes}`);
  }
  if (simulate && removal) {
    lines.push('', `### Po usunięciu zepsuje się (${removal.broken.length})`, '');
    for (const entry of removal.broken) lines.push(`- ${entry.source} ${entry.relation} ${entry.target} — ${entry.reason}`);
    if (removal.disconnected.length) {
      lines.push('', `### Straci połączenie z grafem (${removal.disconnected.length})`, '');
      for (const key of removal.disconnected) lines.push(`- ${key}`);
    }
    lines.push('', 'Pliki się nie zmieniają. Relacje usuwa się na końcu (metodyka, sekcja 6).');
  }
  return `${lines.join('\n')}\n`;
}
