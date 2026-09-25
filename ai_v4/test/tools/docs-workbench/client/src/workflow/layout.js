import ELK from 'elkjs/lib/elk.bundled.js';

// Układ widoków przepływu pracy: ELK layered z liniami ortogonalnymi, miejscem
// na etykiety linii i obszarami (podgrafy Mermaid) jako węzłami złożonymi.
// Wynik ma współrzędne bezwzględne: elkjs 0.9 podaje węzeł względem rodzica,
// a linię względem wspólnego obszaru obu końców (opcje elk.json.*Coords ignoruje).

const elk = new ELK();

export const labelSize = text => ({ width: Math.min(220, Math.round(text.length * 6.3) + 14), height: 18 });

// nodes: [{ id, width, height, area?, partition? }], areas: [{ id }],
// edges: [{ id, from, to, label? }], direction: DOWN | RIGHT.
export async function layoutWorkflow(options) {
  // Kolejność z dokumentu w obszarze z liniami do innych obszarów wywraca elkjs 0.9
  // („reading 'a'”, np. UCMAP-002); wtedy układ bez kolejności z dokumentu.
  try {
    return await layoutOnce(options, true);
  } catch {
    return layoutOnce(options, false);
  }
}

async function layoutOnce({ nodes, areas = [], edges, direction = 'DOWN', partitioned = false, spacing = 1 }, modelOrder) {
  const areaIds = new Set(areas.map(area => area.id));
  const childrenOf = parent => nodes.filter(node => (node.area && areaIds.has(node.area) ? node.area : null) === parent).map(node => ({
    id: node.id, width: node.width, height: node.height,
    layoutOptions: partitioned && node.partition !== undefined ? { 'elk.partitioning.partition': String(node.partition) } : undefined,
  }));
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': direction, 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.partitioning.activate': partitioned ? 'true' : 'false',
      'elk.spacing.nodeNode': String(Math.round(40 * spacing)),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.round(70 * spacing)),
      'elk.spacing.edgeNode': '18', 'elk.spacing.edgeEdge': '10', 'elk.spacing.edgeLabel': '4',
      'elk.layered.spacing.edgeNodeBetweenLayers': '22', 'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
      'elk.edgeLabels.placement': 'CENTER', 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.spacing.componentComponent': '60',
      // Cykle (np. „Wstecz”) rozcina kolejność z dokumentu, więc wejścia stoją na początku.
      // Przy wymuszonych kolumnach (partycje) kolejność wyznaczają kolumny: rozcinanie
      // według dokumentu odwróciłoby linię z kroku spoza procesu, który stoi w modelu na końcu.
      ...(partitioned || !modelOrder ? {} : { 'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES' }),
    },
    children: [
      ...childrenOf(null),
      ...areas.map(area => ({
        id: area.id,
        // Obszar nie dziedziczy opcji kolejności, więc dostaje je wprost.
        layoutOptions: { 'elk.padding': '[top=40,left=20,bottom=20,right=20]', ...(modelOrder ? { 'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES' } : {}) },
        children: childrenOf(area.id),
      })),
    ],
    edges: edges.map(edge => ({
      id: edge.id, sources: [edge.from], targets: [edge.to],
      labels: edge.label ? [{ id: `${edge.id}:label`, text: edge.label, ...labelSize(edge.label) }] : [],
    })),
  };
  const result = await elk.layout(graph);
  const positions = new Map();
  const sizes = new Map();
  const visit = (node, dx, dy) => {
    for (const child of node.children || []) {
      positions.set(child.id, { x: child.x + dx, y: child.y + dy });
      sizes.set(child.id, { width: child.width, height: child.height });
      visit(child, child.x + dx, child.y + dy);
    }
  };
  visit(result, 0, 0);
  const areaOf = new Map(nodes.map(node => [node.id, node.area && areaIds.has(node.area) ? node.area : null]));
  const offsetOf = edgeId => {
    const edge = edges.find(item => item.id === edgeId);
    const area = edge && areaOf.get(edge.from) && areaOf.get(edge.from) === areaOf.get(edge.to) ? areaOf.get(edge.from) : null;
    return area ? positions.get(area) : { x: 0, y: 0 };
  };
  const routes = new Map();
  const labels = new Map();
  const collectEdges = node => {
    for (const edge of node.edges || []) {
      const offset = offsetOf(edge.id);
      const section = edge.sections?.[0];
      if (section) routes.set(edge.id, [section.startPoint, ...(section.bendPoints || []), section.endPoint].map(point => ({ x: point.x + offset.x, y: point.y + offset.y })));
      const label = edge.labels?.[0];
      if (label && label.x !== undefined) labels.set(edge.id, { x: label.x + offset.x + label.width / 2, y: label.y + offset.y + label.height / 2 });
    }
    for (const child of node.children || []) collectEdges(child);
  };
  collectEdges(result);
  return { positions, sizes, routes, labels };
}
