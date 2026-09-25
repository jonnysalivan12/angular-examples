import { useData } from '../state/data';
import { navigate } from '../state/route';
import { vscodeLink } from '../state/useNode';
import { Status, TypeTag, layerText, relPath } from './common';
import { plural } from './TopBar';
import { copyPrompt, filePrompt, keyedFindings } from '../validation/findings';

// Części inspektora węzła wspólne dla panelu i podglądu pliku.

// Lista pogrupowana według rodzaju relacji: [{ relation, items: [{ key, note, missing }] }].
function byRelation(entries, pick) {
  const groups = new Map();
  for (const entry of entries) {
    const { relation, key, note, missing } = pick(entry);
    if (!groups.has(relation)) groups.set(relation, new Map());
    const items = groups.get(relation);
    if (!items.has(key)) items.set(key, { key, notes: new Set(), missing });
    if (note) items.get(key).notes.add(note);
  }
  return [...groups].map(([relation, items]) => ({ relation, items: [...items.values()] }));
}

function IdButton({ id, missing, note, chip }) {
  const { nodeInfo } = useData();
  const layer = nodeInfo(id)?.layer;
  return (
    <button type="button" className={`${chip ? 'chip' : ''} idbtn m`} onClick={() => navigate({ sel: id })}
      title={missing ? `${id}: cel nie istnieje` : note || id}
      style={{ color: missing ? 'var(--t-error)' : layerText(layer), textDecoration: missing ? 'line-through' : undefined, borderColor: chip ? 'currentColor' : undefined }}>
      {id}{note ? <span className="mu" style={{ fontFamily: 'var(--font-body)' }}> → {note}</span> : null}
    </button>
  );
}

export function NodeHeader({ node, compact = false }) {
  const { nodeInfo, graph } = useData();
  const isRow = node.node !== node.docId;
  const layer = nodeInfo(node.node)?.layer || node.layer;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TypeTag type={node.type} layer={layer} />
        <span className="nid" style={{ color: layerText(layer), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.node}</span>
        <span style={{ marginLeft: 'auto' }}><Status status={isRow ? null : node.status} /></span>
      </div>
      <div className="ttl">{isRow ? node.rowLabel || node.node : node.title}</div>
      {isRow && (
        <div className="mu" style={{ fontSize: 11.5, marginTop: 2 }}>
          wiersz dokumentu <IdButton id={node.docId} /> · {node.title}
        </div>
      )}
      {!isRow && node.owner && <div className="mu" style={{ fontSize: 11.5, marginTop: 2 }}>Właściciel: {node.owner}</div>}
      {!compact && !isRow && node.description && <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{node.description}</div>}
      <div className="path" title={`${node.path}/${node.fileName}`}>{relPath(node, graph)}</div>
    </div>
  );
}

export function NodeActions({ node, onCopy, extra }) {
  const { meta } = useData();
  const link = vscodeLink(meta, node);
  return (
    <div className="acts">
      {link && <a className="btn btn-primary" href={link}>Otwórz w VS Code <span className="sk">O</span></a>}
      <button type="button" className="btn btn-secondary" onClick={() => navigate({ mode: 'scope', start: node.node, zapytanie: undefined, podglad: undefined })}>Zasięg <span className="sk">Z</span></button>
      <button type="button" className="btn btn-secondary" onClick={() => navigate({ mode: 'scope', start: node.node, zapytanie: 'implementation', podglad: undefined })}>Implementacja <span className="sk">I</span></button>
      <button type="button" className="btn btn-ghost" onClick={() => onCopy(node.node)}>Kopiuj ID</button>
      {extra}
    </div>
  );
}

export function NodeRelations({ node }) {
  const outgoing = byRelation(node.outgoing, entry => ({ relation: entry.relation, key: entry.target, missing: !entry.exists }));
  // Wpis wskazujący wiersz dokumentu pokazuje, który wiersz wskazuje.
  const incoming = byRelation(node.incoming, entry => ({
    relation: entry.relation, key: entry.source,
    note: entry.target !== node.node ? entry.target.slice(node.docId.length + 1) : null,
  }));
  const incomingCount = new Set(node.incoming.map(entry => entry.source)).size;
  const isRow = node.node !== node.docId;
  return (
    <>
      {!isRow && (
        <div>
          <div className="k">Relacje wychodzące<b>{node.outgoing.length}</b></div>
          {node.outgoing.length === 0 && <div className="mu" style={{ fontSize: 12 }}>Dokument nie ma wpisów w polu relations.</div>}
          <div className="rel">
            {outgoing.map(group => (
              <div className="rel-row" key={group.relation}>
                <span className="m mu">{group.relation}</span>
                <div className="rel-items">{group.items.map(item => <IdButton key={item.key} id={item.key} missing={item.missing} />)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="k">Wskazywany przez<b>{incomingCount}</b></div>
        {incomingCount === 0 && <div className="mu" style={{ fontSize: 12 }}>Żaden dokument go nie wskazuje.</div>}
        <div className="rel">
          {incoming.map(group => (
            <div className="rel-row" key={group.relation}>
              <span className="m mu">{group.relation}</span>
              <div className="rel-items">{group.items.map(item => <IdButton key={item.key} id={item.key} chip note={[...item.notes].join(', ') || null} />)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function NodeRows({ node }) {
  if (node.node !== node.docId || !node.rows.length) return null;
  return (
    <div>
      <div className="k">Wiersze<b>{node.rows.length}</b></div>
      {node.rows.map(row => (
        <button type="button" key={row.id} className="row-line" onClick={() => navigate({ sel: row.id })} title={row.label || row.id}>
          <span className="m" style={{ color: layerText(row.layer), flex: 'none' }}>{row.short}</span>
          <span className="mu row-label">{row.label}</span>
          <span className="m" style={{ fontSize: 11, flex: 'none', color: row.incoming ? 'var(--color-text)' : 'var(--t-muted)' }} title="Dokumenty, które wskazują ten wiersz">{row.incoming}</span>
        </button>
      ))}
    </div>
  );
}

export function NodeValidation({ node }) {
  const { validation, meta } = useData();
  if (!validation) return null;
  const findings = keyedFindings(validation).filter(finding => finding.docId === node.docId).sort((a, b) => (a.line || 0) - (b.line || 0));
  const copyAll = () => copyPrompt(filePrompt({ findings, validation, meta, content: node.content, docType: node.type }),
    `Prompt dla ${findings.length} ${plural(findings.length, 'problemu', 'problemów', 'problemów')} jest w schowku`);
  return (
    <div>
      <div className="k">
        <span>Walidacja</span>
        {findings.length > 0 && (
          <button type="button" className="all-toggle" title="Jeden prompt dla agenta ze wszystkimi problemami tego pliku" onClick={copyAll}>
            {findings.length > 1 ? 'kopiuj prompt dla wszystkich' : 'kopiuj prompt'}
          </button>
        )}
        <b>{findings.length}</b>
      </div>
      {findings.length === 0 && <div className="mu" style={{ fontSize: 12 }}>0 problemów w tym pliku</div>}
      {findings.map(finding => (
        <button type="button" key={finding.key} className="finding-line" title={`${finding.message}${finding.fix ? `\nNaprawa: ${finding.fix}` : ''}`}
          onClick={() => navigate({ sel: node.docId, podglad: '1', problem: finding.key }, { replace: true })}>
          <i style={{ background: finding.severity === 'error' ? 'var(--t-error)' : 'var(--t-scope)' }} />
          <span><span className="m">{finding.code}</span> {finding.check} · <span className="m">:{finding.line}</span></span>
        </button>
      ))}
      {findings.length > 0 && <div className="mu" style={{ fontSize: 11 }}>{findings.length} {plural(findings.length, 'problem', 'problemy', 'problemów')} · klik otwiera podgląd z wyjaśnieniem i promptem naprawy</div>}
    </div>
  );
}
