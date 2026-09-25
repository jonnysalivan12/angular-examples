'use strict';

// Dane widoków przepływu pracy w trybie Przepływ:
//   NAV   → przejścia między ekranami z diagramu Mermaid, ekrany SCR z makietą i sekcjami SCRSEC,
//   FLOW  → kroki z tabeli „Opis przepływu” z aktywnością ACT i wywołaniem,
//   BPMN  → zadania z tabeli „Zadania procesu” z krokiem SPEC-WF, zależności danych
//           z kolumny „Źródło” wejścia kroków, tekst bramek, plik BPMN XML, jeśli istnieje,
//   UCMAP → aktorzy, obszary i relacje UC/TUC z diagramu Mermaid oraz uzasadnienia z tabeli „Opis relacji”.
//
// Makieta ekranu albo sekcji to obraz o nazwie pliku dokumentu (scr-001.png obok
// scr-001.md, także w podfolderze assets/).

const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];

const toPosix = file => file.split(path.sep).join('/');

// Treść sekcji `## Nagłówek` (albo `### Nagłówek`) do następnego nagłówka tego samego lub wyższego poziomu.
function section(content, title) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(line => {
    const match = line.match(/^(#{2,4})\s+(.*?)\s*$/);
    return match && match[2].toLowerCase() === title.toLowerCase();
  });
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((line, index) => index > start && /^#{1,6}\s/.test(line) && line.match(/^#+/)[0].length <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

// Pierwsza tabela Markdown w tekście: nagłówek i wiersze komórek.
function table(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(line => line.trim());
  const start = lines.findIndex((line, index) => line.startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[index + 1] || ''));
  if (start < 0) return null;
  const cells = line => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  const rows = [];
  for (let index = start + 2; index < lines.length && lines[index].startsWith('|'); index++) rows.push(cells(lines[index]));
  return { header: cells(lines[start]), rows };
}

const column = (tableData, pattern) => tableData.header.findIndex(cell => pattern.test(cell));
const plain = text => (text || '').replace(/`/g, '').trim();

function mermaidBlock(content) {
  const match = content.match(/```mermaid\s*\r?\n([\s\S]*?)```/);
  return match ? match[1] : null;
}

// Diagram flowchart Mermaid w zakresie używanym w dokumentach: węzły z kształtem
// i etykietą, łańcuchy linii (-->, ---, -.->, -.-, ==>, z |etykietą| albo
// „-- tekst -->”, „-. tekst .->”), podgrafy, klasy (:::klasa, class a,b klasa).
const OPENERS = ['([', '[[', '[(', '((', '{{', '[/', '[\\', '[', '(', '{', '>'];
const CLOSERS = { '([': '])', '[[': ']]', '[(': ')]', '((': '))', '{{': '}}', '[/': '/]', '[\\': '\\]', '[': ']', '(': ')', '{': '}', '>': ']' };
const SHAPES = { '([': 'stadium', '((': 'circle', '{': 'diamond', '{{': 'hexagon', '[(': 'database', '[[': 'subroutine' };

function parseFlowchart(code) {
  const nodes = new Map();
  const edges = [];
  const groups = [];
  let direction = 'TD';
  let current = null;

  const addNode = node => {
    const known = nodes.get(node.id);
    if (!known) nodes.set(node.id, { id: node.id, label: node.label ?? node.id, shape: node.shape || 'box', cls: node.cls || null, group: current?.id || null });
    else {
      if (node.label !== undefined && known.label === known.id) { known.label = node.label; known.shape = node.shape || known.shape; }
      if (node.cls) known.cls = node.cls;
      if (!known.group && current) known.group = current.id;
    }
  };

  const readNode = (line, at) => {
    const idMatch = line.slice(at).match(/^\s*([A-Za-z0-9_]+)/);
    if (!idMatch) return null;
    let index = at + idMatch[0].length;
    const node = { id: idMatch[1] };
    const opener = OPENERS.find(open => line.startsWith(open, index));
    if (opener) {
      index += opener.length;
      const closer = CLOSERS[opener];
      if (line[index] === '"') {
        const endQuote = line.indexOf('"', index + 1);
        node.label = line.slice(index + 1, endQuote < 0 ? undefined : endQuote);
        index = endQuote < 0 ? line.length : endQuote + 1;
        const closeAt = line.indexOf(closer, index);
        index = closeAt < 0 ? line.length : closeAt + closer.length;
      } else {
        const closeAt = line.indexOf(closer, index);
        node.label = line.slice(index, closeAt < 0 ? undefined : closeAt).trim();
        index = closeAt < 0 ? line.length : closeAt + closer.length;
      }
      node.shape = SHAPES[opener] || 'box';
    }
    const cls = line.slice(index).match(/^:::(\w+)/);
    if (cls) { node.cls = cls[1]; index += cls[0].length; }
    return { node, index };
  };

  const readLink = (line, at) => {
    const rest = line.slice(at);
    const patterns = [
      [/^\s*--\s+"?(.*?)"?\s+(-->|---)\s*/, m => ({ label: m[1], token: m[2] })],
      [/^\s*-\.\s+"?(.*?)"?\s+\.(->|-)\s*/, m => ({ label: m[1], token: `-.${m[2]}` })],
      [/^\s*==\s+"?(.*?)"?\s+(==>|===)\s*/, m => ({ label: m[1], token: m[2] })],
      [/^\s*(<?-\.->|-\.-|<?-->|---|<?==>|===|--[xo])\s*(?:\|"?([^|"]*)"?\|)?\s*/, m => ({ label: m[2] || '', token: m[1] })],
    ];
    for (const [pattern, pick] of patterns) {
      const match = rest.match(pattern);
      if (match) {
        const { label, token } = pick(match);
        return {
          link: { label: label.replace(/[«»]/g, '').trim(), dotted: token.includes('.'), arrow: token.endsWith('>'), thick: token.includes('=') },
          index: at + match[0].length,
        };
      }
    }
    return null;
  };

  for (const raw of code.split(/\r?\n/)) {
    const line = raw.replace(/%%.*$/, '').trim();
    if (!line) continue;
    let match;
    if ((match = line.match(/^(?:flowchart|graph)\s+(\w+)/))) { direction = match[1]; continue; }
    if (/^(classDef|style|linkStyle|click|direction)\b/.test(line)) continue;
    if ((match = line.match(/^class\s+([\w,]+)\s+(\w+)/))) {
      for (const id of match[1].split(',')) { addNode({ id }); nodes.get(id).cls = match[2]; }
      continue;
    }
    if ((match = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s*(?:\[\s*"?(.*?)"?\s*\])?\s*$/))) {
      current = { id: match[1], title: match[2] || match[1] };
      groups.push(current);
      continue;
    }
    if (line === 'end') { current = null; continue; }
    let read = readNode(line, 0);
    if (!read) continue;
    addNode(read.node);
    let from = read.node.id;
    let index = read.index;
    for (;;) {
      const link = readLink(line, index);
      if (!link) break;
      const next = readNode(line, link.index);
      if (!next) break;
      addNode(next.node);
      edges.push({ from, to: next.node.id, ...link.link });
      from = next.node.id;
      index = next.index;
    }
  }
  return { direction, nodes: [...nodes.values()], edges, groups };
}

function buildWorkflows({ docs, edges, repoRoot, rootDir }) {
  const docIndex = new Map(docs.map(doc => [doc.id, doc]));
  const contentCache = new Map();
  const contentOf = doc => {
    if (!contentCache.has(doc.id)) {
      let content = '';
      try { content = fs.readFileSync(path.join(repoRoot, doc.path, doc.fileName), 'utf8'); } catch { /* plik zniknął między synchronizacjami */ }
      contentCache.set(doc.id, content);
    }
    return contentCache.get(doc.id);
  };
  const outgoing = (docId, relation) => edges
    .filter(edge => edge.source === docId && edge.relation === relation && edge.targetDoc === edge.target && docIndex.has(edge.target))
    .sort((a, b) => a.line - b.line)
    .map(edge => edge.target);

  // Obraz o nazwie pliku dokumentu obok pliku albo w podfolderze assets/.
  const imageOf = doc => {
    const base = path.basename(doc.fileName, path.extname(doc.fileName));
    const dir = path.join(repoRoot, doc.path);
    for (const folder of [dir, path.join(dir, 'assets')]) {
      for (const extension of IMAGE_EXTENSIONS) {
        const file = path.join(folder, base + extension);
        if (fs.existsSync(file)) return toPosix(path.relative(repoRoot, file));
      }
    }
    return null;
  };
  const expectedImage = doc => `${path.basename(doc.fileName, path.extname(doc.fileName))}.png`;

  // Węzeł diagramu → dokument: ID w etykiecie (SCR-004 Zgłoszenie…) albo w identyfikatorze węzła (uc001, SCR010).
  const docOfNode = node => {
    for (const token of node.label.match(/[A-Za-z]+(?:-[A-Za-z]+)*-[A-Za-z0-9]+/g) || []) if (docIndex.has(token)) return token;
    const match = node.id.match(/^([A-Za-z]+(?:_[A-Za-z]+)*)_?(\d+)$/);
    if (match) {
      const candidate = `${match[1].toUpperCase().replace(/_/g, '-')}-${match[2]}`;
      if (docIndex.has(candidate)) return candidate;
    }
    return null;
  };
  const labelWithoutId = (label, docId) => (docId ? label.replace(docId, '').replace(/^[\s:—-]+/, '').trim() : label);

  const screenInfo = scrId => {
    const doc = docIndex.get(scrId);
    return {
      id: scrId, title: doc.title, image: imageOf(doc), expectedImage: expectedImage(doc),
      sections: outgoing(scrId, 'contains').filter(id => docIndex.get(id).type === 'SCRSEC').map(id => {
        const sectionDoc = docIndex.get(id);
        return { id, title: sectionDoc.title, image: imageOf(sectionDoc), expectedImage: expectedImage(sectionDoc) };
      }),
    };
  };

  const navigation = docs.filter(doc => doc.type === 'NAV').map(doc => {
    const code = mermaidBlock(contentOf(doc));
    const diagram = code ? parseFlowchart(code) : null;
    const grouped = outgoing(doc.id, 'groups').filter(id => docIndex.get(id).type === 'SCR');
    let nodes;
    let links;
    if (diagram && diagram.nodes.length) {
      nodes = diagram.nodes.map(node => {
        const docId = docOfNode(node);
        const kind = docId && docIndex.get(docId).type === 'SCR' ? 'screen'
          : /^wej[śs]cie/i.test(node.label) ? 'entry'
            : /^wyj[śs]cie|wyj[śs]cie z przep/i.test(node.label) ? 'exit'
              : node.shape === 'stadium' || node.shape === 'circle' ? 'terminal' : 'note';
        return { id: node.id, label: labelWithoutId(node.label, docId), doc: docId, kind, group: node.group };
      });
      links = diagram.edges;
    } else {
      nodes = grouped.map(id => ({ id, label: docIndex.get(id).title, doc: id, kind: 'screen', group: null }));
      links = [];
    }
    const screenIds = [...new Set([...nodes.filter(node => node.doc && docIndex.get(node.doc).type === 'SCR').map(node => node.doc), ...grouped])];
    return {
      id: doc.id, title: doc.title, group: doc.group, direction: diagram?.direction || 'TD', fromDiagram: Boolean(diagram),
      nodes, links, groups: diagram?.groups || [], screens: Object.fromEntries(screenIds.map(id => [id, screenInfo(id)])),
    };
  });

  const flows = docs.filter(doc => doc.type === 'FLOW').map(doc => {
    const content = contentOf(doc);
    const steps = [];
    const stepTable = table(section(content, 'Opis przepływu'));
    if (stepTable) {
      const nr = column(stepTable, /^nr/i);
      const step = column(stepTable, /^krok/i);
      const activity = column(stepTable, /aktywno/i);
      const call = column(stepTable, /wywo/i);
      for (const row of stepTable.rows) {
        const ids = cell => (plain(cell).match(/[A-Za-z]+(?:-[A-Za-z]+)*-[A-Za-z0-9]+/g) || []).filter(id => docIndex.has(id));
        steps.push({ nr: plain(row[nr]), text: plain(row[step]), activities: activity >= 0 ? ids(row[activity]) : [], calls: call >= 0 ? ids(row[call]) : [] });
      }
    }
    return {
      id: doc.id, title: doc.title, description: doc.description, group: doc.group,
      caps: outgoing(doc.id, 'realizes'), activities: outgoing(doc.id, 'contains').filter(id => docIndex.get(id).type === 'ACT'),
      preconditions: plain(section(content, 'Warunki wstępne')), steps,
    };
  });

  // Plik BPMN XML z tabeli „Diagram procesu”: ścieżka względem folderu
  // dokumentacji albo repozytorium, a gdy jej nie ma, plik o tej nazwie w folderze dokumentacji.
  const rootAbs = path.resolve(repoRoot, rootDir);
  let filesByName = null;
  const findByName = name => {
    if (!filesByName) {
      filesByName = new Map();
      const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(bpmn|svg|png)$/i.test(entry.name) && !filesByName.has(entry.name.toLowerCase())) filesByName.set(entry.name.toLowerCase(), full);
        }
      };
      walk(rootAbs);
    }
    return filesByName.get(name.toLowerCase()) || null;
  };
  const resolveResource = reference => {
    if (!reference) return null;
    const candidates = [path.resolve(rootAbs, reference), path.resolve(repoRoot, reference)];
    const found = candidates.find(file => (file === rootAbs || file.startsWith(rootAbs + path.sep)) && fs.existsSync(file)) || findByName(path.basename(reference));
    return found ? toPosix(path.relative(repoRoot, found)) : null;
  };

  const specInputs = specId => {
    const doc = docIndex.get(specId);
    if (!doc) return [];
    const inputTable = table(section(contentOf(doc), 'Wejście'));
    if (!inputTable) return [];
    const variable = column(inputTable, /zmienna/i);
    const source = column(inputTable, /źródło|zrodlo/i);
    if (source < 0) return [];
    return inputTable.rows
      .map(row => ({ variable: plain(row[variable]), from: plain(row[source]) }))
      .filter(input => docIndex.has(input.from));
  };

  const processes = docs.filter(doc => doc.type === 'BPMN').map(doc => {
    const content = contentOf(doc);
    const tasks = [];
    const taskTable = table(section(content, 'Zadania procesu'));
    if (taskTable) {
      const taskId = column(taskTable, /id zadania/i);
      const name = column(taskTable, /nazwa/i);
      const spec = column(taskTable, /spec-wf/i);
      for (const row of taskTable.rows) tasks.push({ taskId: plain(row[taskId]), name: plain(row[name]), spec: docIndex.has(plain(row[spec])) ? plain(row[spec]) : null });
    }
    const resources = table(section(content, 'Diagram procesu'));
    const resource = pattern => {
      const row = resources?.rows.find(cells => pattern.test(cells[0]));
      return row ? plain(row[1]) || null : null;
    };
    const xmlReference = resource(/bpmn xml/i);
    const svgReference = resource(/eksport|svg|png/i);
    const specs = tasks.map(task => task.spec).filter(Boolean);
    const dataLinks = [];
    for (const spec of specs) {
      for (const input of specInputs(spec)) dataLinks.push({ from: input.from, to: spec, variable: input.variable });
    }
    return {
      id: doc.id, title: doc.title, description: doc.description, group: doc.group, caps: outgoing(doc.id, 'realizes'),
      tasks, specs: outgoing(doc.id, 'contains').filter(id => docIndex.get(id).type === 'SPEC-WF'),
      dataLinks, gateways: (section(content, 'Bramki i warunki') || '').trim(),
      bpmnXml: { reference: xmlReference, path: resolveResource(xmlReference) },
      bpmnImage: { reference: svgReference, path: resolveResource(svgReference) },
    };
  });

  const scenarioMaps = docs.filter(doc => doc.type === 'UCMAP').map(doc => {
    const content = contentOf(doc);
    const code = mermaidBlock(content);
    const diagram = code ? parseFlowchart(code) : null;
    const reasons = [];
    const reasonTable = table(section(content, 'Opis relacji'));
    if (reasonTable) {
      const source = column(reasonTable, /źródło/i);
      const relation = column(reasonTable, /relacja/i);
      const target = column(reasonTable, /^cel/i);
      const why = column(reasonTable, /uzasadnienie/i);
      for (const row of reasonTable.rows) reasons.push({ from: plain(row[source]), relation: plain(row[relation]).replace(/[«»]/g, ''), to: plain(row[target]), text: plain(row[why]) });
    }
    const grouped = outgoing(doc.id, 'groups');
    let nodes;
    let links;
    if (diagram && diagram.nodes.length) {
      nodes = diagram.nodes.map(node => {
        const docId = docOfNode(node);
        const kind = docId ? 'scenario' : node.cls === 'aktor' || node.shape === 'stadium' ? 'actor' : 'note';
        return { id: node.id, label: labelWithoutId(node.label, docId), doc: docId, kind, group: node.group };
      });
      links = diagram.edges.map(link => {
        const from = nodes.find(node => node.id === link.from);
        const to = nodes.find(node => node.id === link.to);
        const reason = reasons.find(entry => entry.from === from?.doc && entry.to === to?.doc && (!link.label || entry.relation === link.label));
        return { ...link, reason: reason?.text || null };
      });
    } else {
      nodes = grouped.map(id => ({ id, label: docIndex.get(id).title, doc: id, kind: 'scenario', group: null }));
      links = [];
    }
    return {
      id: doc.id, title: doc.title, description: doc.description, group: doc.group,
      direction: diagram?.direction || 'LR', fromDiagram: Boolean(diagram), nodes, links, groups: diagram?.groups || [],
    };
  });

  return { navigation, flows, processes, scenarioMaps };
}

module.exports = { buildWorkflows, parseFlowchart, section, table };
