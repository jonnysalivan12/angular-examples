'use strict';

// Zapytania do grafu dokumentacji według wzorców
// standards/config/query-patterns.yaml.
//
// Zapytanie nie zależy od tego, skąd pochodzi graf. Dostaje obiekt z pięcioma
// funkcjami, a graphFromIndex tworzy taki obiekt z indeksu powiązań
// (documents.js, buildIndex):
//   typeOf(key)            typ węzła: typ dokumentu albo typ wiersza,
//   docOf(key)             doc-id dokumentu, do którego należy węzeł,
//   exists(key)            czy węzeł istnieje,
//   out(key, relation)     węzły wskazane wpisami tej relacji węzła: [{ key, type }],
//   in(key, relation)      dokumenty, których wpisy tej relacji wskazują węzeł: [{ key, type }].
// Kluczem węzła jest doc-id (UC-001) albo pełne ID wiersza (BFS-001.REQ-01).

const fs = require('fs');
const path = require('path');
const { isDocType, isRowType, parseId } = require('./ids');
const { displayPath } = require('./report');

const PATTERNS_FILE = path.join(__dirname, '..', '..', 'standards', 'config', 'query-patterns.yaml');

// Kroki wzorca: "-relacja->" idzie po wpisach bieżącego węzła, a "<-relacja-"
// po wpisach innych dokumentów, które wskazują bieżący węzeł.
const OUT_ARROW = /^-([a-z_]+)->$/;
const IN_ARROW = /^<-([a-z_]+)-$/;
const ANY_TYPE = '*';

// Rozbiera wzorzec, na przykład "<-realizes- UC|TUC -consumes-> API|INT|QUE",
// na kroki { direction: 'out' | 'in', relation, types }. Pole types to lista
// typów albo null, gdy krok ma gwiazdkę. Rzuca błąd z opisem, gdy wzorca nie da
// się odczytać albo gdy krok nie pasuje do matrycy relacji.
//   startTypes  typy węzła startowego, czyli klucz, pod którym stoi wzorzec.
function parsePattern(text, startTypes, matrix) {
  const tokens = text.trim().split(/\s+/);
  if (!tokens[0] || tokens.length % 2) throw new Error(`wzorzec „${text}” musi być ciągiem par: strzałka i typ`);
  const steps = [];
  let current = startTypes;
  for (let index = 0; index < tokens.length; index += 2) {
    const arrow = tokens[index];
    const out = OUT_ARROW.exec(arrow);
    const inbound = IN_ARROW.exec(arrow);
    if (!out && !inbound) throw new Error(`„${arrow}” nie jest strzałką; oczekiwany zapis to -relacja-> albo <-relacja-`);
    const direction = out ? 'out' : 'in';
    const relation = (out || inbound)[1];
    if (!matrix.relationTypes.has(relation)) throw new Error(`rodzaj relacji „${relation}” nie występuje na liście relation_types w matrycy`);

    // Typy, do których wolno przejść z bieżących typów po tej relacji.
    const allowed = new Set(matrix.triples
      .filter(triple => triple.relation === relation && current.includes(direction === 'out' ? triple.source : triple.target))
      .map(triple => (direction === 'out' ? triple.target : triple.source)));
    const typeToken = tokens[index + 1];
    let types = null;
    if (typeToken === ANY_TYPE) {
      if (!allowed.size) throw new Error(`krok „${arrow} ${typeToken}”: matryca nie ma żadnej trójki z relacją ${relation} dla typów ${current.join('|')}`);
      current = [...allowed];
    } else {
      types = typeToken.split('|');
      const unknown = types.filter(type => !isDocType(type) && !isRowType(type));
      if (unknown.length) throw new Error(`„${unknown.join(', ')}” nie jest typem dokumentu ani wiersza`);
      // Każdy typ w kroku musi mieć trójkę, bo typ bez trójki nigdy niczego nie
      // dopasuje. Przykład błędu: krok "<-contains- UC|TUC" od ekranu, bo matryca
      // nie ma trójki TUC contains SCR.
      for (const type of types.filter(candidate => !allowed.has(candidate))) {
        const triple = direction === 'out' ? `${current.join('|')} ${relation} ${type}` : `${type} ${relation} ${current.join('|')}`;
        throw new Error(`krok „${arrow} ${typeToken}”: matryca nie ma trójki ${triple}`);
      }
      current = types;
    }
    steps.push({ direction, relation, types });
  }
  return steps;
}

// Wczytuje wzorce zapytań. Plik ma trzy poziomy: nazwę zapytania, typy węzła
// startowego rozdzielone znakiem | i listę wzorców w cudzysłowach. Skrypt nie
// używa parsera YAML, tylko czyta plik linia po linii. Zwraca obiekt:
// nazwa zapytania → lista { types, text, line, steps }.
function loadPatterns(matrix, file = PATTERNS_FILE) {
  const queries = {};
  let query = null;
  let group = null;
  let seenTypes = new Set();
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const fail = message => { throw new Error(`${displayPath(file)}:${line}: ${message}`); };
    if (/^\s*(#.*)?$/.test(raw)) return;
    const top = /^([\w-]+):\s*(#.*)?$/.exec(raw);
    if (top) {
      query = top[1];
      if (queries[query]) fail(`zapytanie ${query} występuje w pliku drugi raz`);
      queries[query] = [];
      group = null;
      seenTypes = new Set();
      return;
    }
    const key = /^\s{2}([\w|-]+):\s*(#.*)?$/.exec(raw);
    if (key) {
      if (!query) fail('typy węzła startowego stoją przed nazwą zapytania');
      const types = key[1].split('|');
      const unknown = types.filter(type => !isDocType(type) && !isRowType(type));
      if (unknown.length) fail(`„${unknown.join(', ')}” nie jest typem dokumentu ani wiersza`);
      const repeated = types.filter(type => seenTypes.has(type));
      if (repeated.length) fail(`typ ${repeated.join(', ')} ma już klucz w zapytaniu ${query}; wszystkie wzorce typu muszą stać pod jednym kluczem`);
      types.forEach(type => seenTypes.add(type));
      group = types;
      return;
    }
    const item = /^\s+-\s*"([^"]*)"\s*(#.*)?$/.exec(raw);
    if (!item) fail(`nie da się odczytać linii „${raw.trim()}”`);
    if (!group) fail('wzorzec stoi przed typami węzła startowego');
    try {
      queries[query].push({ types: group, text: item[1], line, steps: parsePattern(item[1], group, matrix) });
    } catch (error) {
      fail(error.message);
    }
  });
  return queries;
}

// Typ węzła o podanym kluczu: typ wiersza albo typ dokumentu. Sam wiersz bez
// doc-id (REQ-01) nie jest kluczem węzła, więc daje undefined.
function nodeType(key) {
  const id = parseId(key);
  return id && id.doc ? id.rowType || id.docType : undefined;
}

// doc-id dokumentu, do którego należy węzeł.
function nodeDoc(key) {
  return (parseId(key) || {}).doc;
}

// Tworzy obiekt grafu dla zapytań z indeksu powiązań zbudowanego przez
// buildIndex. Wiersz nie ma własnych wpisów, więc out dla wiersza zwraca pustą listę.
function graphFromIndex(index) {
  return {
    typeOf: nodeType,
    docOf: nodeDoc,
    exists: key => index.exists(key),
    out(key, relation) {
      const id = parseId(key);
      const doc = id && id.doc && !id.row ? index.docOf(id.doc) : null;
      return doc ? index.out(doc, relation).map(link => ({ key: link.key, type: link.targetType })) : [];
    },
    in(key, relation) {
      return index.incoming(key)
        .filter(({ link }) => link.type === relation)
        .map(({ doc }) => ({ key: doc.docId, type: doc.docType }));
    },
  };
}

// Wykonuje zapytanie dla jednego albo kilku węzłów startowych.
//   patterns  wynik loadPatterns,
//   query     nazwa zapytania, na przykład change_scope,
//   starts    klucze węzłów startowych.
// Zwraca:
//   nodes    węzły w kolejności znalezienia: { node, type, doc, pattern, via }.
//            Węzeł startowy też trafia do wyniku; ma pattern null, a via równe
//            swojemu kluczowi. Pole via to droga, którą zapytanie pierwszy raz
//            doszło do węzła, na przykład „UC-001 -consumes-> API-001”,
//            a pattern to wzorzec tej drogi.
//   missing  klucze startowe, które nie są węzłem albo nie istnieją w grafie.
// Krok przechodzi tylko do węzłów, które istnieją, i tylko po trójkach, które
// są w matrycy relacji.
function runQuery(patterns, matrix, graph, query, starts) {
  if (!patterns[query]) throw new Error(`nie ma zapytania „${query}”; dostępne: ${Object.keys(patterns).join(', ')}`);
  const nodes = new Map();
  const missing = [];
  const add = (key, type, pattern, via) => {
    if (!nodes.has(key)) nodes.set(key, { node: key, type, doc: graph.docOf(key), pattern, via });
  };

  for (const start of starts) {
    const startType = graph.typeOf(start);
    if (!startType || !graph.exists(start)) {
      missing.push(start);
      continue;
    }
    add(start, startType, null, start);
    for (const pattern of patterns[query].filter(candidate => candidate.types.includes(startType))) {
      // Dalsza droga od węzła zależy tylko od węzła i numeru kroku, więc na
      // każdym kroku każdy węzeł wystarczy odwiedzić raz.
      let frontier = new Map([[start, { type: startType, via: start }]]);
      for (const step of pattern.steps) {
        const next = new Map();
        for (const [key, { type, via }] of frontier) {
          for (const neighbour of graph[step.direction](key, step.relation)) {
            if (next.has(neighbour.key)) continue;
            if (step.types && !step.types.includes(neighbour.type)) continue;
            const [source, target] = step.direction === 'out' ? [type, neighbour.type] : [neighbour.type, type];
            if (matrix.relation(source, target) !== step.relation) continue;
            if (!graph.exists(neighbour.key)) continue;
            const arrow = step.direction === 'out' ? `-${step.relation}->` : `<-${step.relation}-`;
            const route = `${via} ${arrow} ${neighbour.key}`;
            next.set(neighbour.key, { type: neighbour.type, via: route });
            add(neighbour.key, neighbour.type, pattern.text, route);
          }
        }
        if (!next.size) break;
        frontier = next;
      }
    }
  }
  return { nodes: [...nodes.values()], missing };
}

module.exports = { PATTERNS_FILE, parsePattern, loadPatterns, nodeType, nodeDoc, graphFromIndex, runQuery };
