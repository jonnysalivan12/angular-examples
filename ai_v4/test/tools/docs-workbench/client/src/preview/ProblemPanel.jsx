import { useState } from 'react';
import { useData } from '../state/data';
import { navigate } from '../state/route';
import { vscodeLink } from '../state/useNode';
import { agentPrompt, copyPrompt, filePrompt, severityLabel } from '../validation/findings';

// Problem walidacji nad treścią podglądu: wyjaśnienie, podpowiedź naprawy
// i prompt dla agenta do skopiowania. Gdy plik ma kilka problemów, można
// przełączać się między nimi albo skopiować jeden prompt dla wszystkich.
export default function ProblemPanel({ finding, fileFindings, node }) {
  const { validation, meta } = useData();
  const [promptOpen, setPromptOpen] = useState(null);
  const context = { validation, meta, content: node.content, docType: node.type };
  const prompt = agentPrompt({ finding, ...context });
  const allPrompt = fileFindings.length > 1 ? filePrompt({ findings: fileFindings, ...context }) : null;
  const link = vscodeLink(meta, node, finding.line);
  const validator = validation?.validators.find(item => item.id === finding.validator);
  const color = finding.severity === 'error' ? 'var(--t-error)' : 'var(--t-scope)';
  const toggle = which => setPromptOpen(open => (open === which ? null : which));
  const index = fileFindings.findIndex(item => item.key === finding.key);

  return (
    <section className="problem-panel" style={{ borderColor: color }} aria-label="Problem walidacji">
      <div className="problem-top">
        <span className="bdg" style={{ color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="sev-dot" />{severityLabel(finding.severity)}</span>
        <span className="m" style={{ fontWeight: 500 }}>{finding.code}</span>
        <span>{finding.check}</span>
        <span className="mu">· {validator?.name || finding.validator} · linia {finding.line}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {fileFindings.length > 1 && (
            <>
              <button type="button" className="btn btn-ghost problem-nav" disabled={index <= 0} aria-label="Poprzedni problem w pliku"
                onClick={() => navigate({ problem: fileFindings[index - 1].key }, { replace: true })}>‹</button>
              <span className="m mu" style={{ fontSize: 11 }}>{index + 1} / {fileFindings.length}</span>
              <button type="button" className="btn btn-ghost problem-nav" disabled={index >= fileFindings.length - 1} aria-label="Następny problem w pliku"
                onClick={() => navigate({ problem: fileFindings[index + 1].key }, { replace: true })}>›</button>
            </>
          )}
          <button type="button" className="btn btn-ghost problem-nav" aria-label="Ukryj problem" title="Ukryj problem"
            onClick={() => navigate({ problem: undefined }, { replace: true })}>×</button>
        </span>
      </div>
      <p className="problem-msg">{finding.message}</p>
      <div className="problem-fix">
        <span className="lbl">Naprawa</span>
        {finding.fix || <span className="mu">Walidator nie podaje gotowej zmiany. Ustal ją na podstawie komunikatu; prompt poniżej prosi agenta o to samo.</span>}
      </div>
      <div className="problem-actions">
        <button type="button" className="btn btn-primary" onClick={() => copyPrompt(prompt)}>Kopiuj prompt dla agenta</button>
        <button type="button" className="btn btn-secondary" aria-expanded={promptOpen === 'one'} onClick={() => toggle('one')}>{promptOpen === 'one' ? 'Zwiń prompt' : 'Pokaż prompt'}</button>
        {allPrompt && (
          <>
            <button type="button" className="btn btn-secondary" title="Jeden prompt ze wszystkimi problemami tego pliku"
              onClick={() => copyPrompt(allPrompt, `Prompt dla ${fileFindings.length} problemów jest w schowku`)}>Kopiuj prompt dla wszystkich ({fileFindings.length})</button>
            <button type="button" className="btn btn-ghost" aria-expanded={promptOpen === 'all'} onClick={() => toggle('all')}>{promptOpen === 'all' ? 'Zwiń zbiorczy' : 'Pokaż zbiorczy'}</button>
          </>
        )}
        {link && <a className="btn btn-ghost" href={link}>Otwórz w VS Code na linii {finding.line}</a>}
      </div>
      {promptOpen === 'one' && <pre className="problem-prompt">{prompt}</pre>}
      {promptOpen === 'all' && allPrompt && <pre className="problem-prompt">{allPrompt}</pre>}
    </section>
  );
}
