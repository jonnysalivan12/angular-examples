import { useEffect, useMemo, useRef } from 'react';
import { api, useData } from '../state/data';
import { listParam, navigate } from '../state/route';
import { vscodeLink } from '../state/useNode';
import { Segmented, layerText } from '../components/common';
import { plural } from '../components/TopBar';
import { groupKeyFor } from '../map/model';
import { requestFocus } from '../state/focus';
import { copyPrompt, filePrompt, findingKey, keyedFindings } from './findings';

// Panel walidacji (ekran 2f): wynik trzech walidatorów z filtrami. Problem
// można pokazać na Mapie albo otworzyć w VS Code na linii.

export { findingKey };

export default function ValidationPanel({ params }) {
  const { validation, graph, docIndex, meta } = useData();
  const listRef = useRef(null);
  const level = params.w_poziom || 'wszystko';
  const docFilter = params.w_dok || '';
  const hiddenValidators = new Set(listParam(params.bez_walid));
  const selected = params.problem || null;

  const findings = useMemo(() => keyedFindings(validation), [validation]);
  const filtered = findings.filter(finding => {
    if (level === 'bledy' && finding.severity !== 'error') return false;
    if (level === 'ostrzezenia' && finding.severity === 'error') return false;
    if (docFilter && finding.docId !== docFilter) return false;
    return !hiddenValidators.has(finding.validator);
  });
  const docsWithFindings = [...new Set(findings.map(finding => finding.docId).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));

  useEffect(() => {
    listRef.current?.querySelector('.finding.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!validation) return <div className="empty">Walidacja trwa…</div>;

  const set = patch => navigate(patch, { replace: true });
  const errors = findings.filter(finding => finding.severity === 'error').length;
  const warnings = findings.length - errors;

  // Zbiorczy prompt dla wszystkich problemów pliku (bez względu na filtry).
  const countByDoc = docId => findings.filter(finding => finding.docId === docId).length;
  const copyFile = async docId => {
    const items = findings.filter(finding => finding.docId === docId);
    const node = await api(`/api/doc?id=${encodeURIComponent(docId)}`).catch(() => null);
    copyPrompt(filePrompt({ findings: items, validation, meta, content: node?.content, docType: node?.type || docIndex.get(docId)?.type }),
      `Prompt dla ${items.length} ${plural(items.length, 'problemu', 'problemów', 'problemów')} w ${docId} jest w schowku`);
  };

  const show = finding => {
    const doc = docIndex.get(finding.docId);
    const patch = { problem: finding.key, sel: finding.docId || undefined, podglad: undefined };
    if (doc) {
      const grouping = params.grupuj || 'proces';
      const key = groupKeyFor(doc, grouping, graph.root);
      const expanded = listParam(params.rozwin);
      Object.assign(patch, { mode: 'map', zakres: undefined, rozwin: key && !expanded.includes(key) ? [...expanded, key].join(',') : params.rozwin });
    }
    if (doc) requestFocus(doc.id);
    navigate(patch);
  };

  return (
    <div className="validation">
      <div className="validation-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Walidacja</span>
          <span className="mu" style={{ fontSize: 11.5 }}>
            {validation.validators[0]?.documents ?? graph.documents.length} dokumentów · {validation.validators.length} {plural(validation.validators.length, 'walidator', 'walidatory', 'walidatorów')}
          </span>
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '3px 8px' }} onClick={() => navigate({ panel: undefined, problem: undefined })}>Inspektor <span className="sk">Esc</span></button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented name="w-poziom" value={level} onChange={v => set({ w_poziom: v === 'wszystko' ? undefined : v })}
            options={[
              { value: 'wszystko', label: 'Wszystko', hint: String(findings.length) },
              { value: 'bledy', label: 'Błędy', hint: String(errors) },
              { value: 'ostrzezenia', label: 'Ostrzeżenia', hint: String(warnings) },
            ]} />
          <select className="sel" style={{ width: 170, height: 24 }} value={docFilter} aria-label="Dokument" onChange={e => set({ w_dok: e.target.value || undefined })}>
            <option value="">Dokument: wszystkie</option>
            {docsWithFindings.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          {docFilter && (
            <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11.5 }} title="Jeden prompt dla agenta ze wszystkimi problemami tego pliku"
              onClick={() => copyFile(docFilter)}>Kopiuj prompt dla pliku ({countByDoc(docFilter)})</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {validation.validators.map(validator => {
            const on = !hiddenValidators.has(validator.id);
            const count = findings.filter(finding => finding.validator === validator.id).length;
            return (
              <button key={validator.id} type="button" aria-pressed={on} className="chip validator-chip" onClick={() => {
                const next = new Set(hiddenValidators);
                if (on) next.add(validator.id); else next.delete(validator.id);
                set({ bez_walid: [...next].join(',') || undefined });
              }}>
                {validator.name} {validator.failed ? '!' : count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="validation-list" ref={listRef}>
        {validation.validators.filter(validator => validator.failed).map(validator => (
          <div key={validator.id} className="finding" style={{ color: 'var(--t-error)' }}>Walidator „{validator.name}” nie uruchomił się: {validator.failed}</div>
        ))}
        {filtered.length === 0 && <div className="empty" style={{ padding: '14px' }}>{findings.length ? 'Żaden problem nie pasuje do filtrów.' : 'Walidatory nie zgłosiły problemów.'}</div>}
        {validation.validators.filter(validator => !hiddenValidators.has(validator.id)).map(validator => {
          const items = filtered.filter(finding => finding.validator === validator.id);
          if (!items.length) return null;
          return (
            <div key={validator.id}>
              <div className="k" style={{ padding: '7px 14px 2px', margin: 0 }}>{validator.name}<b>{items.length}</b></div>
              {items.map(finding => {
                const isSelected = finding.key === selected;
                const doc = docIndex.get(finding.docId);
                const link = doc ? vscodeLink(meta, doc, finding.line) : null;
                const file = finding.file.replace(`${graph.root}/`, '');
                return (
                  <div key={finding.key} className={`finding ${isSelected ? 'is-selected' : ''}`} onClick={() => set({ problem: isSelected ? undefined : finding.key })}>
                    <div className="finding-top">
                      <span className="bdg" style={{ color: finding.severity === 'error' ? 'var(--t-error)' : 'var(--t-scope)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <i className="sev-dot" />{finding.severity === 'error' ? 'błąd' : 'ostrzeżenie'}
                      </span>
                      <span className="m" style={{ fontWeight: 500 }}>{finding.code}</span>
                      <span className="mu finding-check">{finding.check}</span>
                      {finding.docId && (
                        <button type="button" className="linkish m" style={{ marginLeft: 'auto', color: layerText(doc?.layer) }}
                          onClick={event => { event.stopPropagation(); navigate({ sel: finding.docId, panel: undefined, problem: undefined }); }}>{finding.docId}</button>
                      )}
                      <button type="button" className="btn btn-ghost" style={{ padding: '1px 7px', fontSize: 11, marginLeft: finding.docId ? 0 : 'auto' }} disabled={!doc}
                        onClick={event => { event.stopPropagation(); show(finding); }}>Pokaż</button>
                    </div>
                    <div className={`finding-msg ${isSelected ? 'is-open' : ''}`}>
                      <button type="button" className="linkish m mu finding-file" disabled={!doc} title="Podgląd pliku z podświetloną linią, wyjaśnieniem i promptem naprawy"
                        onClick={event => { event.stopPropagation(); navigate({ sel: finding.docId, podglad: '1', problem: finding.key }, { replace: true }); }}>{file}:{finding.line}</button>
                      {link && <a className="mu finding-vscode" href={link} onClick={event => event.stopPropagation()} title="Otwórz w VS Code na tej linii">VS Code</a>}
                      {isSelected && finding.docId && (
                        <button type="button" className="linkish mu finding-vscode" title="Jeden prompt dla agenta ze wszystkimi problemami tego pliku"
                          onClick={event => { event.stopPropagation(); copyFile(finding.docId); }}>
                          {countByDoc(finding.docId) > 1 ? `prompt dla pliku (${countByDoc(finding.docId)})` : 'kopiuj prompt'}
                        </button>
                      )}
                      {isSelected ? <br /> : <span className="mu"> · </span>}
                      {finding.message}
                    </div>
                    {finding.fix && (
                      <div className={`finding-fix ${isSelected ? 'is-open' : ''}`}><span className="lbl">Naprawa</span>{finding.fix}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {validation.validators.some(validator => validator.notes?.length) && (
          <div className="mu" style={{ padding: '10px 14px', fontSize: 11.5 }}>
            {validation.validators.flatMap(validator => (validator.notes || []).map((note, i) => <div key={`${validator.id}-${i}`}>{validator.name}: {typeof note === 'string' ? note : JSON.stringify(note)}</div>))}
          </div>
        )}
      </div>
    </div>
  );
}
