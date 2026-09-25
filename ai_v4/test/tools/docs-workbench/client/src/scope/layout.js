import ELK from 'elkjs/lib/elk.bundled.js';

// Układ warstwowy wyniku zasięgu: kolumna węzła to liczba kroków od węzła
// startowego (partition). elkjs układa węzły w kolumnach tak, żeby linie
// jak najmniej się krzyżowały.

const elk = new ELK();

export async function layoutScope(nodes, edges) {
  const ids = new Set(nodes.map(node => node.id));
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.partitioning.activate': 'true',
      'elk.spacing.nodeNode': '16',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.separateConnectedComponents': 'false',
    },
    children: nodes.map(node => ({ id: node.id, width: node.width, height: node.height, layoutOptions: { 'elk.partitioning.partition': String(node.column) } })),
    edges: edges.filter(edge => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target)
      .map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target] })),
  });
  return new Map(result.children.map(child => [child.id, { x: child.x, y: child.y }]));
}
