'use strict';

// Odczyt matrycy relacji standards/config/relation-matrix.yaml.

const fs = require('fs');
const path = require('path');
const { isDocType, isRowType } = require('./ids');
const { displayPath } = require('./report');

const MATRIX_FILE = path.join(__dirname, '..', '..', 'standards', 'config', 'relation-matrix.yaml');
const CONTAINS = 'contains';

// Wczytuje matrycę relacji. Skrypt działa bez dodatkowych pakietów, więc nie
// używa parsera YAML, tylko czyta plik linia po linii. Zwraca:
//   relationTypes  dozwolone rodzaje relacji z sekcji relation_types,
//   triples        trójki w kolejności z pliku: { source, relation, target, cardinality },
//   relation       rodzaj relacji dla pary typów (źródło, cel),
//   cardinality    liczebność dla pary typów, na przykład „1:N”,
//   rank           pozycję pary typów w matrycy; według niej skrypt układa wpisy,
//   owners         typy dokumentów, które zawierają dany typ wiersza,
//   owns           czy dany typ dokumentu zawiera dany typ wiersza,
//   rowTypesOf     typy wierszy, które zawiera dany typ dokumentu.
function loadMatrix(file = MATRIX_FILE) {
  const relationTypes = new Set();
  const relations = new Map();
  const cardinalities = new Map();
  const ranks = new Map();
  const triples = [];
  let section = null;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    const fail = message => { throw new Error(`${displayPath(file)}:${index + 1}: ${message}`); };
    const key = /^([\w-]+):/.exec(line);
    if (key) {
      section = key[1];
      return;
    }
    const item = /^\s+-\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (!item) return;
    if (section === 'relation_types') {
      if (!/^[a-z_]+$/.test(item[1])) fail(`nie da się odczytać rodzaju relacji „${item[1]}”; dozwolone są tylko małe litery i podkreślenie`);
      relationTypes.add(item[1]);
      return;
    }
    if (section !== 'matrix') return;
    const map = /^\{(.*)\}$/.exec(item[1]);
    if (!map) fail('wpis matrycy musi mieć postać { source: …, relation: …, target: … }');
    const entry = {};
    for (const part of map[1].split(',')) {
      const pair = /^\s*([\w-]+)\s*:\s*"?([^"]*)"?\s*$/.exec(part);
      if (!pair) fail(`nie da się odczytać fragmentu wpisu „${part.trim()}”`);
      entry[pair[1]] = pair[2];
    }
    const { source, relation, target, cardinality } = entry;
    if (!source || !relation || !target) fail('wpis matrycy nie ma klucza source, relation albo target');
    if (!relationTypes.has(relation)) fail(`rodzaj relacji „${relation}” nie występuje na liście relation_types`);
    if (!isDocType(source)) fail(`źródło „${source}” nie jest typem dokumentu, który zna skrypt (DOC_FORMATS)`);
    if (!isDocType(target) && !isRowType(target)) fail(`cel „${target}” nie jest typem dokumentu ani wiersza, który zna skrypt (DOC_FORMATS, ROW_FORMATS)`);
    if (cardinality !== undefined && !/^(1|N):(1|N)$/.test(cardinality)) fail(`liczebność „${cardinality}” nie ma postaci 1:N, N:1, N:N albo 1:1`);
    const pairKey = `${source}>${target}`;
    if (relations.has(pairKey) && relations.get(pairKey) !== relation) {
      fail(`para typów ${source} → ${target} ma dwa różne rodzaje relacji, a każda para może mieć tylko jeden`);
    }
    relations.set(pairKey, relation);
    if (cardinality) cardinalities.set(pairKey, cardinality);
    if (!ranks.has(pairKey)) ranks.set(pairKey, ranks.size);
    triples.push({ source, relation, target, cardinality });
  });
  if (!relations.size) throw new Error(`${displayPath(file)}: sekcja matrix nie ma żadnych wpisów`);
  if (!relationTypes.has(CONTAINS)) throw new Error(`${displayPath(file)}: lista relation_types nie ma rodzaju relacji ${CONTAINS}`);

  // Typ dokumentu zawiera typ wiersza, gdy matryca ma dla tej pary relację
  // contains, na przykład BFS contains REQ.
  const owners = new Map();
  for (const [pairKey, relation] of relations) {
    const [source, target] = pairKey.split('>');
    if (relation !== CONTAINS || !isRowType(target)) continue;
    if (!owners.has(target)) owners.set(target, []);
    owners.get(target).push(source);
  }
  return {
    file,
    relationTypes,
    triples,
    relation: (source, target) => relations.get(`${source}>${target}`),
    cardinality: (source, target) => cardinalities.get(`${source}>${target}`),
    rank: (source, target) => ranks.get(`${source}>${target}`),
    owners: rowType => owners.get(rowType) || [],
    owns: (docType, rowType) => (owners.get(rowType) || []).includes(docType),
    rowTypesOf: docType => [...owners].filter(([, docTypes]) => docTypes.includes(docType)).map(([rowType]) => rowType),
  };
}

module.exports = { MATRIX_FILE, CONTAINS, loadMatrix };
