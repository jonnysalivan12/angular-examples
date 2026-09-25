'use strict';

// Warstwy dokumentów do kolorowania i grupowania w interfejsie.
//
// Warstwy pochodzą z sekcji 10 metodyki (standards/methodology.md). Matryca
// relacji ich nie zawiera, bo walidator ani zapytania z nich nie korzystają.
// Typ, którego nie ma na liście, trafia do warstwy „other”.

const LAYERS = [
  { id: 'req', name: 'Wymagania', types: ['BFS', 'NFR', 'REQ', 'RB', 'NFRT'] },
  { id: 'resp', name: 'Odpowiedzialność', types: ['ACTOR', 'CAP', 'ROLE'] },
  { id: 'scen', name: 'Scenariusze', types: ['UC', 'TUC', 'A', 'E'] },
  { id: 'scr', name: 'Ekrany', types: ['SCR', 'SCRSEC'] },
  { id: 'con', name: 'Kontrakty', types: ['API', 'INT', 'QUE', 'CONV'] },
  { id: 'flow', name: 'Przepływy', types: ['FLOW', 'ACT', 'BPMN', 'SPEC-WF', 'AC'] },
  { id: 'data', name: 'Pojęcia i dane', types: ['DDM', 'LDM', 'ENT', 'STM', 'DOM', 'RD', 'RW'] },
  { id: 'map', name: 'Mapy', types: ['UCMAP', 'NAV'] },
];

const BY_TYPE = new Map(LAYERS.flatMap(layer => layer.types.map(type => [type, layer.id])));

const layerOf = type => BY_TYPE.get(type) || 'other';

module.exports = { LAYERS, layerOf };
