'use strict';

// Zapis identyfikatorów dokumentów i wierszy.

// Zapis części identyfikatora, która stoi po prefiksie.
// NUMBER: myślnik i numer, na przykład -001 w UC-001.
// NAME: myślnik i nazwa zaczynająca się wielką literą, na przykład -Disposition
// w ENT-Disposition albo -Dyspozycja w DOM-Dyspozycja.
const NUMBER = '-\\d+';
const NAME = '-\\p{Lu}[\\p{L}\\p{N}]*';

// Typy dokumentów z methodology.md, sekcja 10. Klucz to prefiks, a wartość to
// zapis reszty doc-id.
const DOC_FORMATS = {
  BFS: NUMBER, NFR: NUMBER, ACTOR: NUMBER, CAP: NUMBER, UC: NUMBER, TUC: NUMBER,
  SCR: NUMBER, SCRSEC: NUMBER, API: NUMBER, INT: NUMBER, QUE: NUMBER, CONV: NUMBER,
  FLOW: NUMBER, ACT: NUMBER, BPMN: NUMBER, 'SPEC-WF': NUMBER,
  DDM: NUMBER, LDM: NUMBER, ENT: NAME, STM: NUMBER, UCMAP: NUMBER, NAV: NUMBER,
};

// Typy wierszy z methodology.md, sekcja 3. Klucz to prefiks, a wartość to zapis
// reszty ID. NFRT ma w środku kategorię progu, na przykład NFRT-PERF-01.
// Warianty przebiegu A i sytuacje błędne E mają numer bez myślnika: A1, E1.
const ROW_FORMATS = {
  REQ: NUMBER, RB: NUMBER, DOM: NAME, RD: NUMBER, RW: NUMBER,
  NFRT: '-[A-Z][A-Z0-9]*-\\d+', ROLE: NUMBER, AC: NUMBER, A: '\\d+', E: '\\d+',
};

const isDocType = type => Object.prototype.hasOwnProperty.call(DOC_FORMATS, type);
const isRowType = type => Object.prototype.hasOwnProperty.call(ROW_FORMATS, type);

const alternatives = formats => Object.keys(formats).map(prefix => prefix + formats[prefix]).join('|');
// Znak, który może należeć do identyfikatora. Przed wzmianką i po niej nie może
// stać taki znak. Dzięki temu skrypt nie znajdzie UC-001 wewnątrz TUC-001.
const ID_CHAR = '[\\p{L}\\p{N}\\-]';

// Wzorzec wzmianki. Pasuje na dwa sposoby:
//   1. ID dokumentu, opcjonalnie z wierszem po kropce: UC-001, BFS-001.REQ-01.
//   2. Sam wiersz, bez ID dokumentu: REQ-01, A1. Przed takim wierszem nie może
//      stać kropka, bo wtedy wiersz jest częścią pełnego ID z punktu 1.
const ID_PATTERN = new RegExp(
  `(?<!${ID_CHAR})(${alternatives(DOC_FORMATS)})(?:\\.(${alternatives(ROW_FORMATS)}))?(?!${ID_CHAR})` +
  `|(?<![\\p{L}\\p{N}.\\-])(${alternatives(ROW_FORMATS)})(?!${ID_CHAR})`,
  'gu');

// Dla każdego prefiksu wyrażenie, które sprawdza, czy całe ID jest tego typu.
const matchers = formats => Object.keys(formats).map(prefix => [prefix, new RegExp(`^${prefix}${formats[prefix]}$`, 'u')]);
const DOC_MATCHERS = matchers(DOC_FORMATS);
const ROW_MATCHERS = matchers(ROW_FORMATS);
// Zwraca prefiks typu, do którego pasuje ID, albo undefined, gdy ID nie pasuje do żadnego typu.
const typeOf = (list, id) => (list.find(([, pattern]) => pattern.test(id)) || [])[0];
const docTypeOf = id => typeOf(DOC_MATCHERS, id);
const rowTypeOf = id => typeOf(ROW_MATCHERS, id);

// Rozbiera ID na części:
//   ID dokumentu (UC-001) daje { doc, docType },
//   sam wiersz (REQ-01) daje { row, rowType },
//   pełne ID wiersza (BFS-001.REQ-01) daje wszystkie cztery pola,
//   ID, które nie pasuje do żadnego typu, daje null.
function parseId(id) {
  const [doc, row, rest] = id.split('.');
  if (rest !== undefined) return null;
  if (row === undefined) {
    const docType = docTypeOf(doc);
    if (docType) return { doc, docType };
    const rowType = rowTypeOf(doc);
    return rowType ? { row: doc, rowType } : null;
  }
  const docType = docTypeOf(doc);
  const rowType = rowTypeOf(row);
  return docType && rowType ? { doc, docType, row, rowType } : null;
}

// Wszystkie ID w tekście. Każde ID to { id, doc, row }: pełne ID wiersza ma oba
// pola, ID dokumentu tylko doc, a sam wiersz tylko row.
function findIds(text) {
  return [...text.matchAll(ID_PATTERN)].map(([, docId, rowId, bareRow]) => (bareRow
    ? { id: bareRow, row: bareRow }
    : { id: rowId ? `${docId}.${rowId}` : docId, doc: docId, row: rowId }));
}

module.exports = {
  DOC_FORMATS, ROW_FORMATS, ID_PATTERN, DOC_MATCHERS, ROW_MATCHERS,
  isDocType, isRowType, typeOf, docTypeOf, rowTypeOf, parseId, findIds,
};
