import { useData } from '../state/data';
import useNode from '../state/useNode';
import { NodeActions, NodeHeader, NodeRelations, NodeRows, NodeValidation } from './NodeDetails';
import { listParam, navigate } from '../state/route';
import { groupKeyFor, groupKeyOf, isGroupNode } from '../map/model';
import { useCatalog } from '../catalog/CatalogCanvas';
import { summary } from '../catalog/model';
import { Segmented, layerText } from './common';
import ScopeResults from '../scope/ScopeResults';
import LineInspector from '../flow/LineInspector';
import ValidationPanel from '../validation/ValidationPanel';
import { plural } from './TopBar';

export { vscodeLink } from '../state/useNode';

// Grupa na Mapie: zawartość według warstw, relacje i walidacja.
function GroupInspector({ params }) {
  const { graph, validation, docIndex } = useData();
  const key = groupKeyOf(params.sel);
  const grouping = params.grupuj || 'proces';
  const docs = graph.documents.filter(doc => groupKeyFor(doc, grouping, graph.root) === key);
  const ids = new Set(docs.map(doc => doc.id));
  const info = grouping === 'proces' ? graph.groups.find(group => group.id === key) : null;
  const layerName = new Map(graph.layers.map(layer => [layer.id, layer.name]));
  const byLayer = {};
  for (const doc of docs) byLayer[doc.layer] = (byLayer[doc.layer] || 0) + 1;
  let inside = 0;
  let outside = 0;
  for (const edge of graph.edges) {
    // Wpis do własnego wiersza też jest relacją wewnątrz grupy.
    const a = ids.has(edge.source);
    const b = ids.has(edge.targetDoc);
    if (a && b) inside++; else if (a || b) outside++;
  }
  const findings = (validation?.findings || []).filter(finding => ids.has(finding.docId));
  const errors = findings.filter(finding => finding.severity === 'error').length;
  const perDoc = {};
  for (const finding of findings) perDoc[finding.docId] = (perDoc[finding.docId] || 0) + 1;
  const expanded = listParam(params.rozwin);
  const isExpanded = expanded.includes(key);
  const title = info?.title || (grouping === 'warstwa' ? layerName.get(key) : null);

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag tag-neutral">GRUPA</span>
          {grouping !== 'warstwa' && <span className="nid" style={{ color: docIndex.get(key) ? layerText(docIndex.get(key).layer) : undefined }}>{key}</span>}
        </div>
        {title && <div className="ttl">{title}</div>}
        <div className="path">{grouping === 'warstwa' ? 'warstwa' : info?.kind === 'process' ? `processes/${key}` : key} · {docs.length} {plural(docs.length, 'dokument', 'dokumenty', 'dokumentów')}</div>
      </div>
      <div>
        <div className="k">Zawartość według warstw</div>
        {Object.entries(byLayer).sort((a, b) => b[1] - a[1]).map(([layer, count]) => (
          <div className="row" key={layer} style={{ gap: 8 }}>
            <span className="dot" style={{ background: `var(--l-${layer})` }} />
            <span style={{ flex: 1 }}>{layerName.get(layer) || layer}</span>
            <span className="m" style={{ fontSize: 11.5 }}>{count}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="k">Relacje</div>
        <div className="row" style={{ justifyContent: 'space-between' }}>Z innymi grupami<span className="m" style={{ fontSize: 11.5 }}>{outside}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>Wewnątrz grupy<span className="m" style={{ fontSize: 11.5 }}>{inside}</span></div>
      </div>
      <div>
        <div className="k">Walidacja</div>
        {!validation && <div className="mu">trwa…</div>}
        {validation && findings.length === 0 && <div style={{ color: 'var(--t-ok)' }}>0 problemów</div>}
        {validation && findings.length > 0 && (
          <>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ color: errors ? 'var(--t-error)' : 'var(--t-muted)' }}>{errors} {plural(errors, 'błąd', 'błędy', 'błędów')}</span>
              <span style={{ color: findings.length - errors ? 'var(--t-scope)' : 'var(--t-muted)' }}>{findings.length - errors} {plural(findings.length - errors, 'ostrzeżenie', 'ostrzeżenia', 'ostrzeżeń')}</span>
            </div>
            <div className="m mu" style={{ fontSize: 11 }}>
              {Object.entries(perDoc).map(([id, count], index) => <span key={id}>{index ? ' · ' : ''}{id} <span style={{ color: 'var(--color-text)' }}>{count}</span></span>)}
            </div>
          </>
        )}
      </div>
      <div className="acts" style={{ marginTop: 'auto' }}>
        {grouping !== 'brak' && !params.zakres && (
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate({ rozwin: (isExpanded ? expanded.filter(k => k !== key) : [...expanded, key]).join(',') || undefined }, { replace: true })}>
            {isExpanded ? 'Zwiń grupę' : 'Rozwiń grupę'}
          </button>
        )}
        {info?.kind === 'process' && (
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate({ zakres: 'proces', grupa: key, rozwin: undefined })}>
            Tylko ten proces
          </button>
        )}
      </div>
    </>
  );
}

// Podsumowanie katalogu typu nad inspektorem węzła.
function CatalogSummary({ params }) {
  const { all } = useCatalog(params);
  if (!all.length) return null;
  const info = summary(all);
  return (
    <div className="summary-box">
      <div className="k">Podsumowanie<b>{listParam(params.typ).join(', ')}</b></div>
      <div className="summary-grid">
        <span className="mu">Dokumenty</span><span className="m">{info.count}</span>
        <span className="mu">Status</span>
        <span className="m">{Object.entries(info.status).map(([status, count], i) => (
          <span key={status}>{i ? ' · ' : ''}<button type="button" className="linkish" onClick={() => navigate({ pokaz: status === 'active' || status === 'draft' ? status : undefined }, { replace: true })}>{count}</button> {status}</span>
        ))}</span>
        <span className="mu">Najczęściej używany</span>
        <span className="m" style={{ fontSize: 11 }}>{info.top ? <>{info.top.ids.join(', ')} <b style={{ fontWeight: 500 }}>{info.top.count}</b></> : '—'}</span>
        <span className="mu">Bez użyć</span>
        {info.unused.length
          ? <button type="button" className="linkish m" style={{ color: 'var(--t-error)', fontSize: 11, textAlign: 'right' }} onClick={() => navigate({ pokaz: 'bez-uzyc' }, { replace: true })}>{info.unused.length} · {info.unused.slice(0, 3).join(', ')}{info.unused.length > 3 ? '…' : ''}</button>
          : <span className="m mu">brak</span>}
      </div>
    </div>
  );
}

export default function Inspector(props) {
  const { mode, params } = props;
  const catalog = mode === 'map' && params.zakres === 'typ' && params.typ && params.panel !== 'walidacja';
  if (params.panel === 'walidacja') return <ValidationPanel params={params} />;
  if (mode === 'flow' && params.lin && params.poziom !== 'kontrakty') return <LineInspector params={params} />;
  // W trybie Zasięg inspektor ma dwie zakładki: wynik zapytania i zaznaczony węzeł.
  if (mode === 'scope' && params.panel !== 'walidacja') {
    const tab = params.ins === 'wezel' ? 'wezel' : 'wynik';
    return (
      <>
        <Segmented name="ins-tab" full value={tab} onChange={v => navigate({ ins: v === 'wynik' ? undefined : v }, { replace: true })}
          options={[{ value: 'wynik', label: 'Wynik' }, { value: 'wezel', label: params.sel ? `Węzeł ${params.sel}` : 'Węzeł' }]} />
        {tab === 'wynik' ? <ScopeResults params={params} /> : <NodeInspector {...props} />}
      </>
    );
  }
  return (
    <>
      {catalog && <CatalogSummary params={params} />}
      <NodeInspector {...props} />
    </>
  );
}

function NodeInspector({ params, onCopy }) {
  const { graph } = useData();
  const key = params.sel;
  const { node, error } = useNode(isGroupNode(key) ? null : key);

  if (!key) return <div className="empty">Nic nie zaznaczono. Wybierz węzeł na płótnie albo wyszukaj go: <span className="kbd">Ctrl K</span></div>;
  if (isGroupNode(key)) return graph ? <GroupInspector params={params} /> : null;
  if (error) return <div className="empty">{key}: {error}</div>;
  if (!node) return <div className="empty">Wczytywanie {key}…</div>;

  return (
    <>
      <NodeHeader node={node} />
      <NodeActions node={node} onCopy={onCopy} />
      <NodeRelations node={node} />
      <NodeRows node={node} />
      <NodeValidation node={node} />
      <div style={{ borderTop: '1px solid var(--t-line)', paddingTop: 10 }}>
        <div className="k">Treść</div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate({ podglad: '1' }, { replace: true })}>Podgląd pliku <span className="sk">Space</span></button>
      </div>
    </>
  );
}
