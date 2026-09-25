'use strict';

// Wspólny format wyniku walidatorów i wspólna obsługa wiersza poleceń.
//
// Każda niezgodność to obiekt:
//   file      ścieżka pliku,
//   line      numer linii, której dotyczy niezgodność,
//   docId     doc-id dokumentu, jeśli plik go ma,
//   severity  error (błąd) albo warning (ostrzeżenie),
//   code      kod sprawdzenia, na przykład REL-02,
//   check     nazwa sprawdzenia, na przykład „cel nie istnieje”,
//   message   opis niezgodności,
//   fix       sugestia naprawy; null, gdy naprawa nie jest jednoznaczna.

const fs = require('fs');
const path = require('path');

const SEVERITY_LABELS = { error: 'BŁĄD', warning: 'OSTRZEŻENIE' };

// Ścieżka do wypisania w raporcie. Jest względna do bieżącego folderu, a gdy
// plik leży poza nim, jest pełna. Zawsze używa ukośników /.
function displayPath(file) {
  const relative = path.relative(process.cwd(), file);
  const shown = relative.startsWith('..') || path.isAbsolute(relative) ? file : relative;
  return shown.split(path.sep).join('/') || '.';
}

// Odczytuje argumenty walidatora. Zwraca { inputs, json } albo { exitCode },
// gdy skrypt ma się zakończyć od razu.
function parseArgs(args, usage) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
    return { exitCode: 0 };
  }
  const json = args.includes('--json');
  const unknown = args.filter(arg => arg.startsWith('-') && arg !== '--json');
  const inputs = args.filter(arg => !arg.startsWith('-'));
  if (unknown.length || !inputs.length) {
    if (unknown.length) console.error(`Nieznana opcja: ${unknown.join(' ')}\n`);
    console.error(usage);
    return { exitCode: 2 };
  }
  const missing = inputs.filter(input => !fs.existsSync(input));
  if (missing.length) {
    console.error(`Nie ma takiej ścieżki: ${missing.join(', ')}`);
    return { exitCode: 2 };
  }
  return { inputs, json };
}

// Wypisuje niezgodności i zwraca kod wyjścia: 1, gdy jest co najmniej jeden
// błąd, w pozostałych przypadkach 0. Ostrzeżenia nie zmieniają kodu wyjścia.
//   json       wynik jako JSON zamiast tekstu,
//   documents  liczba sprawdzonych dokumentów,
//   notes      zdania dopisane do podsumowania, na przykład o pominiętym sprawdzeniu.
function printFindings(findings, { json, documents, notes = [] }) {
  const sorted = [...findings].sort((a, b) => (displayPath(a.file) < displayPath(b.file) ? -1 : displayPath(a.file) > displayPath(b.file) ? 1 : 0)
    || (a.line || 0) - (b.line || 0) || a.code.localeCompare(b.code));
  const errors = sorted.filter(finding => finding.severity === 'error').length;
  const warnings = sorted.length - errors;
  if (json) {
    const output = sorted.map(finding => ({ ...finding, file: displayPath(finding.file) }));
    console.log(JSON.stringify({ documents, errors, warnings, notes, findings: output }, null, 2));
    return errors ? 1 : 0;
  }
  for (const finding of sorted) {
    const where = finding.line ? `${displayPath(finding.file)}:${finding.line}` : displayPath(finding.file);
    console.log(`${where}  ${SEVERITY_LABELS[finding.severity]}  ${finding.code} ${finding.check}${finding.docId ? `  (${finding.docId})` : ''}`);
    console.log(`  ${finding.message}`);
    if (finding.fix) console.log(`  Naprawa: ${finding.fix}`);
    console.log('');
  }
  console.log(`Dokumenty: ${documents}. Błędy: ${errors}. Ostrzeżenia: ${warnings}.`);
  for (const note of notes) console.log(note);
  return errors ? 1 : 0;
}

module.exports = { displayPath, parseArgs, printFindings };
