import { useData } from '../state/data';
import { navigate } from '../state/route';
import { layerText } from '../components/common';
import { capResolver, lineId } from './model';
import { useFlowData } from './FlowCanvas';

const KIND_LABEL = { event: 'LINIA · ZDARZENIE', call: 'LINIA · WYWOŁANIE', ambiguous: 'LINIA · NIEJEDNOZNACZNA' };

function Id({ id }) {
  const { nodeInfo } = useData();
  return (
    <button type="button" className="linkish m" style={{ color: layerText(nodeInfo(id)?.layer) }} onClick={() => navigate({ sel: id, lin: undefined })}>{id}</button>
  );
}

// Zaznaczona linia przepływu: skąd wynika kierunek, ładunek i kto jeszcze
// korzysta z kontraktu (ekran 1d).
export default function LineInspector({ params }) {
  const { graph, docIndex } = useData();
  const flow = useFlowData();
  if (!flow || !graph) return <div className="empty">Wczytywanie…</div>;
  const line = flow.lines.find(item => lineId(item) === params.lin);
  if (!line) return null;
  const capsOf = capResolver(graph);
  const title = id => docIndex.get(id)?.title;
  const contract = line.contracts.length === 1 ? docIndex.get(line.contracts[0]) : null;

  // Inni korzystający z kontraktów linii: wpisy consumes spoza obu zdolności linii.
  const others = [];
  for (const edge of graph.edges) {
    if (edge.relation !== 'consumes' || !line.contracts.includes(edge.target) || edge.sourceType === 'CAP') continue;
    if (line.via.includes(edge.source)) continue;
    const caps = capsOf(edge.source);
    others.push({ id: edge.source, note: caps.length > 1 ? 'należy do kilku CAP' : caps[0] || 'bez zdolności' });
  }

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="tag tag-accent">{KIND_LABEL[line.kind]}</span>
          {line.contracts.map(id => <Id key={id} id={id} />)}
        </div>
        {contract && <div className="ttl">{contract.title}</div>}
        {contract && <div className="path">{contract.path}/{contract.fileName}</div>}
      </div>

      <div className="line-facts">
        {line.kind === 'event' && (
          <>
            <span className="mu">Nadawca</span>
            <div><Id id={line.from} /> {title(line.from)}<div className="mu reason">bo <span className="m">{line.contracts.join(', ')} realizes {line.from}</span></div></div>
            <span className="mu">Odbiorca</span>
            <div><Id id={line.to} /> {title(line.to)}<div className="mu reason">bo <span className="m">{line.to} consumes {line.contracts.join(', ')}</span></div></div>
          </>
        )}
        {line.kind === 'call' && (
          <>
            <span className="mu">Wywołuje</span>
            <div><Id id={line.from} /> {title(line.from)}
              <div className="mu reason">bo {line.via.map(id => <span key={id} className="m">{id} {docIndex.get(id)?.type === 'SPEC-WF' ? 'należy do BPMN, który realizes' : 'realizes'} {line.from}; </span>)}</div>
            </div>
            <span className="mu">Wywoływany</span>
            <div><Id id={line.to} /> {title(line.to)}<div className="mu reason">bo <span className="m">{line.contracts.join(', ')} realizes {line.to}</span></div></div>
          </>
        )}
        {line.kind === 'ambiguous' && (
          <>
            <span className="mu">Zdolności</span>
            <div><Id id={line.from} /> · <Id id={line.to} /></div>
            <span className="mu">Przez</span>
            <div>{line.via.map(id => <span key={id}><Id id={id} /> </span>)}<div className="mu reason">należy do kilku zdolności, więc nie wiadomo, która wywołuje</div></div>
          </>
        )}
        <span className="mu">Ładunek</span>
        <div className="rel-items">{line.entities.length ? line.entities.map(id => <span key={id} className="chip" style={{ color: layerText('data') }}><Id id={id} /></span>) : <span className="mu">brak encji</span>}</div>
      </div>

      {others.length > 0 && (
        <div>
          <div className="k">Korzystają też<b>{others.length}</b></div>
          {others.map(item => (
            <div key={item.id} className="row" style={{ gap: 8, fontSize: 11.5 }}><Id id={item.id} /><span className="mu">consumes · {item.note}</span></div>
          ))}
        </div>
      )}
      {line.kind === 'event' && (
        <div className="mu scope-note" style={{ margin: 0 }}>Wpis <span className="m">consumes QUE</span> w scenariuszu, przepływie albo kroku nie mówi, czy dokument publikuje, czy odbiera zdarzenie, dlatego te dokumenty nie wyznaczają linii.</div>
      )}
      <div className="acts" style={{ marginTop: 'auto' }}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate({ mode: 'scope', start: line.contracts.join(','), zapytanie: undefined, lin: undefined })}>Zasięg kontraktu</button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate({ lin: undefined })}>Zamknij</button>
      </div>
    </>
  );
}
