// Modele widoków przepływu pracy z danych /api/workflows: węzły z rozmiarem,
// obszary i linie do ułożenia. Rozmiary kart muszą zgadzać się ze stylami w app.css.

export const VIEWS = [
  { id: 'nawigacja', type: 'NAV', key: 'navigation', name: 'Nawigacja ekranów', short: 'NAV' },
  { id: 'flow', type: 'FLOW', key: 'flows', name: 'Przepływy i aktywności', short: 'FLOW' },
  { id: 'bpmn', type: 'BPMN', key: 'processes', name: 'Procesy BPMN i kroki', short: 'BPMN' },
  { id: 'ucmap', type: 'UCMAP', key: 'scenarioMaps', name: 'Mapy scenariuszy', short: 'UCMAP' },
];

export const viewOf = id => VIEWS.find(view => view.id === id) || null;

export const fileUrl = file => `/api/file?path=${encodeURIComponent(file)}`;

const SCREEN = { width: 300, header: 46, image: 170, section: 52, padding: 10 };
const lineCount = (text, perLine) => Math.max(1, Math.ceil((text || '').length / perLine));

// Karta ekranu: nagłówek, makieta, sekcje z miniaturą.
export const screenHeight = screen => SCREEN.header + SCREEN.image + SCREEN.padding + (screen?.sections.length || 0) * SCREEN.section + SCREEN.padding;
export const SCREEN_SIZE = SCREEN;

function textNode(id, kind, label, extra = {}) {
  const width = kind === 'note' ? 230 : Math.min(250, Math.max(150, Math.round(label.length * 6.6) + 40));
  const height = 22 + lineCount(label, Math.floor((width - 30) / 6.6)) * 16;
  return { id, kind, label, width, height, ...extra };
}

export function navigationModel(nav) {
  const nodes = nav.nodes.map(node => {
    if (node.kind === 'screen') {
      const screen = nav.screens[node.doc];
      return { id: node.id, kind: 'screen', doc: node.doc, label: node.label, screen, area: node.group, width: SCREEN.width, height: screenHeight(screen) };
    }
    return textNode(node.id, node.kind, node.label, { area: node.group });
  });
  // Ekrany z relacji groups, których diagram nie pokazuje.
  const shown = new Set(nav.nodes.map(node => node.doc).filter(Boolean));
  for (const screen of Object.values(nav.screens)) {
    if (shown.has(screen.id)) continue;
    nodes.push({ id: `extra:${screen.id}`, kind: 'screen', doc: screen.id, screen, width: SCREEN.width, height: screenHeight(screen), outside: true });
  }
  const edges = nav.links.map((link, index) => ({ id: `l${index}`, from: link.from, to: link.to, label: link.label, dotted: link.dotted, arrow: link.arrow }));
  return { nodes, edges, areas: nav.groups.map(group => ({ id: group.id, title: group.title })), direction: nav.direction === 'LR' ? 'RIGHT' : 'DOWN' };
}

export function flowModel(flow) {
  const nodes = [];
  const edges = [];
  if (flow.preconditions) nodes.push({ id: 'start', kind: 'start', label: flow.preconditions, width: 420, height: 36 + Math.min(6, lineCount(flow.preconditions, 64)) * 16 });
  flow.steps.forEach((step, index) => {
    const chips = step.activities.length + step.calls.length;
    nodes.push({ id: `s${index}`, kind: 'step', step, width: 420, height: 44 + Math.min(7, lineCount(step.text, 64)) * 16 + (chips ? 32 : 0) });
    const previous = index ? `s${index - 1}` : flow.preconditions ? 'start' : null;
    if (previous) edges.push({ id: `e${index}`, from: previous, to: `s${index}`, arrow: true });
  });
  // Aktywności FLOW, których żaden krok nie wskazuje.
  const used = new Set(flow.steps.flatMap(step => step.activities));
  for (const act of flow.activities.filter(id => !used.has(id))) nodes.push({ id: `act:${act}`, kind: 'doc', doc: act, note: 'aktywność bez kroku w tabeli', width: 240, height: 60 });
  // Kroki czyta się z góry na dół jak procedurę; poziomo widok byłby bardzo szeroki.
  return { nodes, edges, areas: [], direction: 'DOWN' };
}

// BPMN bez pliku XML: zadania w kolejności z tabeli (kolumny układu), linie to
// zmienne procesowe przekazywane między krokami (kolumna „Źródło” wejścia).
export function processModel(process) {
  const nodes = process.tasks.map((task, index) => ({ id: `t${index}`, kind: 'task', task, doc: task.spec, width: 260, height: 96, partition: index + 1 }));
  const nodeOfSpec = new Map(process.tasks.map((task, index) => [task.spec, `t${index}`]));
  const pairs = new Map();
  for (const link of process.dataLinks) {
    if (!nodeOfSpec.has(link.from)) {
      const id = `ext:${link.from}`;
      if (!nodes.some(node => node.id === id)) {
        nodes.push({ id, kind: 'doc', doc: link.from, note: 'krok spoza procesu', width: 240, height: 60, partition: 0 });
        nodeOfSpec.set(link.from, id);
      }
    }
    const key = `${link.from}>${link.to}`;
    if (!pairs.has(key)) pairs.set(key, { from: nodeOfSpec.get(link.from), to: nodeOfSpec.get(link.to), variables: [] });
    pairs.get(key).variables.push(link.variable);
  }
  const edges = [...pairs.values()].map((pair, index) => ({ id: `d${index}`, from: pair.from, to: pair.to, label: pair.variables.join(', '), dotted: true, arrow: true }));
  return { nodes, edges, areas: [], direction: 'RIGHT', partitioned: true };
}

export function scenarioMapModel(map) {
  const nodes = map.nodes.map(node => (node.kind === 'scenario'
    ? { id: node.id, kind: 'doc', doc: node.doc, area: node.group, width: 250, height: 60 }
    : textNode(node.id, node.kind, node.label, { area: node.group })));
  const edges = map.links.map((link, index) => ({ id: `l${index}`, from: link.from, to: link.to, label: link.label, dotted: link.dotted, arrow: link.arrow, reason: link.reason }));
  return { nodes, edges, areas: map.groups.map(group => ({ id: group.id, title: group.title })), direction: map.direction === 'TD' || map.direction === 'TB' ? 'DOWN' : 'RIGHT' };
}

export function modelFor(view, item) {
  if (!item) return null;
  if (view === 'nawigacja') return navigationModel(item);
  if (view === 'flow') return flowModel(item);
  if (view === 'bpmn') return processModel(item);
  if (view === 'ucmap') return scenarioMapModel(item);
  return null;
}
