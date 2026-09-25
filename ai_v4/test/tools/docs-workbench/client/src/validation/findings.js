// Problemy walidacji: klucz do adresu strony i prompt dla agenta, który ma
// problem naprawić.

// Klucz problemu w adresie: walidator, kod, dokument, linia i numer wśród
// identycznych krotek, więc nie zależy od kolejności całej listy.
export const findingKey = (finding, ordinal) => `${finding.validator}|${finding.code}|${finding.docId || ''}|${finding.line || 0}|${ordinal}`;

export function keyedFindings(validation) {
  const seen = new Map();
  return (validation?.findings || []).map(finding => {
    const base = findingKey(finding, 0);
    const ordinal = (seen.get(base) || 0) + 1;
    seen.set(base, ordinal);
    return { ...finding, key: findingKey(finding, ordinal) };
  });
}

export const severityLabel = severity => (severity === 'error' ? 'błąd' : 'ostrzeżenie');

// Fragment pliku wokół linii z numerami; linia z problemem ma znacznik „>”.
export function excerpt(content, line, radius = 4) {
  const lines = (content || '').split(/\r?\n/);
  if (!line || line > lines.length) return null;
  const from = Math.max(1, line - radius);
  const to = Math.min(lines.length, line + radius);
  const width = String(to).length;
  return {
    from, to,
    text: lines.slice(from - 1, to).map((text, index) => {
      const number = from + index;
      return `${number === line ? '>' : ' '}${String(number).padStart(width)} | ${text}`;
    }).join('\n'),
  };
}

const scriptOf = (validation, id) => {
  const validator = validation?.validators.find(item => item.id === id);
  return { validator, script: validator?.script ? `scripts/${validator.script}` : 'walidator dokumentacji' };
};

// Prompt dla agenta: co jest nie tak, gdzie, jak sprawdzić naprawę.
export function agentPrompt({ finding, validation, meta, content, docType }) {
  const { validator, script } = scriptOf(validation, finding.validator);
  const root = meta?.root || '<folder dokumentacji>';
  const part = excerpt(content, finding.line);
  const lines = [
    'Napraw jeden problem walidacji dokumentacji w tym repozytorium.',
    '',
    `Plik: ${finding.file}${finding.line ? `:${finding.line}` : ''}`,
    finding.docId ? `Dokument: ${finding.docId}${docType ? ` (typ ${docType})` : ''}` : null,
    `Walidator: ${script}${validator?.name ? ` (${validator.name})` : ''}`,
    `Problem: ${finding.code} ${finding.check}, poziom: ${severityLabel(finding.severity)}`,
    `Komunikat walidatora: ${finding.message}`,
    finding.fix ? `Podpowiedź walidatora: ${finding.fix}` : 'Podpowiedź walidatora: brak. Ustal zmianę na podstawie komunikatu i standardu.',
  ].filter(line => line !== null);
  if (part) lines.push('', `Fragment pliku (linie ${part.from}–${part.to}, „>” oznacza linię z problemem):`, '```', part.text, '```');
  lines.push(
    '',
    'Zasady:',
    '1. Zmień tylko to, czego dotyczy ten problem. Nie przepisuj pozostałych części dokumentu.',
    `2. Trzymaj się szablonu i guide.md typu${docType ? ` ${docType}` : ''} w standards/templates (folder typu podaje standards/templates/_00-meta.md) oraz komentarzy w standards/config/relation-matrix.yaml.`,
    `3. Jeśli zmiana dodaje albo usuwa wzmianki o ID innych dokumentów, uzgodnij pole relations: node scripts/sync-relations.js ${finding.file} --fix`,
    `4. Po zmianie uruchom: node ${script} ${root}`,
    `   Potwierdź, że ${finding.code} dla ${finding.docId || 'tego pliku'} już nie występuje i że nie pojawiły się nowe problemy.`,
    '5. Na końcu napisz w jednym, dwóch zdaniach, co zmieniłeś i dlaczego.',
  );
  return lines.join('\n');
}

// Zbiorczy prompt dla agenta: wszystkie problemy jednego pliku w kolejności linii.
export function filePrompt({ findings, validation, meta, content, docType }) {
  if (findings.length === 1) return agentPrompt({ finding: findings[0], validation, meta, content, docType });
  const sorted = [...findings].sort((a, b) => (a.line || 0) - (b.line || 0));
  const first = sorted[0];
  const root = meta?.root || '<folder dokumentacji>';
  const errors = sorted.filter(finding => finding.severity === 'error').length;
  const scripts = [...new Set(sorted.map(finding => scriptOf(validation, finding.validator).script))];
  const lines = [
    `Napraw wszystkie problemy walidacji (${sorted.length}) w jednym pliku dokumentacji w tym repozytorium.`,
    '',
    `Plik: ${first.file}`,
    first.docId ? `Dokument: ${first.docId}${docType ? ` (typ ${docType})` : ''}` : null,
    `Poziomy: błędy ${errors}, ostrzeżenia ${sorted.length - errors}`,
  ].filter(line => line !== null);
  // Fragment dla danej linii jest w prompcie tylko raz; kolejne problemy z tej linii odsyłają do niego.
  const shownAt = new Map();
  sorted.forEach((finding, index) => {
    const { validator, script } = scriptOf(validation, finding.validator);
    const earlier = shownAt.get(finding.line);
    const part = earlier ? null : excerpt(content, finding.line, 2);
    if (part) shownAt.set(finding.line, index + 1);
    lines.push(
      '',
      `## Problem ${index + 1}: ${finding.code} ${finding.check}${finding.line ? ` (linia ${finding.line})` : ''}`,
      `Poziom: ${severityLabel(finding.severity)}`,
      `Walidator: ${script}${validator?.name ? ` (${validator.name})` : ''}`,
      `Komunikat walidatora: ${finding.message}`,
      finding.fix ? `Podpowiedź walidatora: ${finding.fix}` : 'Podpowiedź walidatora: brak. Ustal zmianę na podstawie komunikatu i standardu.',
    );
    if (part) lines.push(`Fragment pliku (linie ${part.from}–${part.to}, „>” oznacza linię z problemem):`, '```', part.text, '```');
    else if (earlier) lines.push(`Fragment pliku: jak w problemie ${earlier}.`);
  });
  lines.push(
    '',
    'Zasady:',
    '1. Zmień tylko to, czego dotyczą te problemy. Nie przepisuj pozostałych części dokumentu.',
    '2. Numery linii pochodzą ze stanu pliku przed zmianami. Po każdej poprawce linie niżej mogą się przesunąć, więc szukaj miejsca po fragmencie, a nie po numerze.',
    `3. Trzymaj się szablonu i guide.md typu${docType ? ` ${docType}` : ''} w standards/templates (folder typu podaje standards/templates/_00-meta.md) oraz komentarzy w standards/config/relation-matrix.yaml.`,
    `4. Jeśli zmiany dodają albo usuwają wzmianki o ID innych dokumentów, uzgodnij pole relations: node scripts/sync-relations.js ${first.file} --fix`,
    '5. Po zmianach uruchom:',
    ...scripts.map(script => `   node ${script} ${root}`),
    `   Potwierdź, że żaden z problemów powyżej dla ${first.docId || 'tego pliku'} już nie występuje i że nie pojawiły się nowe.`,
    '6. Jeśli któregoś problemu nie da się naprawić bez decyzji człowieka, zostaw go i napisz dlaczego.',
    '7. Na końcu napisz krótko, co zmieniłeś przy każdym problemie.',
  );
  return lines.join('\n');
}

// Kopiuje tekst do schowka i pokazuje komunikat.
export function copyPrompt(text, message = 'Prompt dla agenta jest w schowku') {
  const toast = detail => window.dispatchEvent(new CustomEvent('workbench:toast', { detail }));
  return navigator.clipboard?.writeText(text).then(() => toast(message), () => toast('Nie udało się skopiować'));
}
