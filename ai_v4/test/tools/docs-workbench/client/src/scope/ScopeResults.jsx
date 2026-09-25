import { useData } from '../state/data';
import { navigate } from '../state/route';
import { plural } from '../components/TopBar';
import { groupFiles, lastHop, readableVia } from './paths';
import { setHoveredFile, useScopeResult } from './useScope';

// Lista wyniku zasięgu w inspektorze (ekrany 1c i 2c).
export default function ScopeResults({ params }) {
  const { graph, docIndex, nodeInfo } = useData();
  const { result, loading, error, empty, request } = useScopeResult(params);
  const simulate = request.simulateRemoval;

  if (empty) return <div className="empty">Koszyk jest pusty. Zaznacz węzeł i naciśnij <span className="kbd">Z</span>.</div>;
  if (error) return <div className="empty" style={{ color: 'var(--t-error)' }}>{error}</div>;
  // Po zmianie plików zostaje poprzedni wynik, aż przyjdzie nowy.
  if (!result) return <div className="empty">Liczenie wyniku…</div>;

  const layerName = new Map(graph.layers.map(layer => [layer.id, layer.name]));
  const groups = groupFiles(result, params.lista || 'wzorzec', id => docIndex.get(id)?.layer || 'other', id => layerName.get(id) || id);
  const startFolders = new Set(result.starts.map(key => docIndex.get(nodeInfo(key)?.doc || key)?.group));
  const count = result.files.length;
  const patterns = new Set(result.nodes.map(node => node.pattern).filter(Boolean)).size;
  const title = simulate ? 'Do przejrzenia' : request.query === 'implementation' ? 'Do przeczytania' : 'Wynik';

  return (
    <div className="scope-results">
      <div className="scope-results-head">
        <span className="tt" style={{ background: `color-mix(in srgb, ${simulate ? 'var(--t-error)' : 'var(--t-scope)'} 18%, transparent)`, color: simulate ? 'var(--t-error)' : 'var(--t-scope)' }}>
          {simulate ? 'SYMULACJA' : request.query === 'implementation' ? 'IMPLEMENTACJA' : 'WYNIK'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{count} {plural(count, 'plik', 'pliki', 'plików')}</span>
        <span className="mu" style={{ marginLeft: 'auto', fontSize: 11 }}>start + {patterns} {plural(patterns, 'wzorzec', 'wzorce', 'wzorców')}</span>
      </div>

      {loading && <div className="mu" style={{ padding: '6px 14px 0', fontSize: 11 }}>Odświeżanie wyniku…</div>}
      {simulate && <div className="k" style={{ padding: '10px 14px 0', margin: 0 }}>{title}<b>{count}</b></div>}
      {groups.map(group => (
        <div key={group.key} className="scope-group">
          <div className="scope-group-label m">{group.label}</div>
          {group.files.map(file => {
            const doc = docIndex.get(file.docId);
            const otherFolder = doc && !startFolders.has(doc.group);
            const isStart = file.nodes.some(item => result.starts.includes(item.node));
            return (
              <div key={`${group.key}-${file.path}/${file.fileName}`} className={`scope-file ${file.nodes.some(item => item.node === params.sel) ? 'is-selected' : ''}`}
                style={{ borderLeftColor: isStart ? 'var(--t-scope)' : `var(--l-${doc?.layer || 'other'})` }}
                onMouseEnter={() => setHoveredFile(file)} onMouseLeave={() => setHoveredFile(null)}
                onClick={() => navigate({ sel: file.nodes[0].node })} role="button" tabIndex={0}
                onKeyDown={event => { if (event.key === 'Enter') navigate({ sel: file.nodes[0].node }); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className="m scope-path" title={`${file.path}/${file.fileName}`}>{file.path.replace(`${graph.root}/`, '')}/{file.fileName}</span>
                  {isStart && <span className="bdg" style={{ color: simulate ? 'var(--t-error)' : 'var(--t-scope)' }}>{simulate ? 'usunięcie' : 'start'}</span>}
                  {otherFolder && !isStart && <span className="bdg mu" title="Plik leży w innym procesie albo folderze niż węzeł startowy">inny folder</span>}
                </div>
                {file.nodes.map(item => (
                  <div key={item.node} className="m mu scope-via" title={readableVia(item.via)}>
                    {result.starts.includes(item.node) ? <>{item.node === file.docId ? 'dokument startowy' : 'wiersz'} <span style={{ color: `var(--l-${nodeInfo(item.node)?.layer || 'other'}-t)` }}>{item.node}</span></> : lastHop(item.via)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}

      {simulate && result.removal && (
        <>
          <div className="k" style={{ padding: '14px 14px 0', margin: 0 }}>Po usunięciu zepsuje się<b style={{ color: result.removal.broken.length ? 'var(--t-error)' : undefined }}>{result.removal.broken.length}</b></div>
          {result.removal.broken.length === 0 && <div className="mu" style={{ padding: '4px 14px', fontSize: 12 }}>Żaden wpis nie straci celu.</div>}
          {result.removal.broken.map(entry => (
            <div key={`${entry.source}-${entry.relation}-${entry.target}`} className="broken-line">
              <button type="button" className="linkish m" style={{ color: `var(--l-${nodeInfo(entry.source)?.layer || 'other'}-t)` }} onClick={() => navigate({ sel: entry.source })}>{entry.source}</button>
              <span className="m mu">{entry.relation}</span>
              <span className="m" style={{ color: `var(--l-${nodeInfo(entry.target)?.layer || 'other'}-t)`, textDecoration: 'line-through' }}>{entry.target}</span>
              <span className="chip" style={{ marginLeft: 'auto', color: 'var(--t-error)', fontFamily: 'var(--font-body)' }}>{entry.reason}</span>
            </div>
          ))}
          {result.removal.disconnected.length > 0 && (
            <>
              <div className="k" style={{ padding: '14px 14px 0', margin: 0 }}>Straci połączenie z grafem<b style={{ color: 'var(--t-error)' }}>{result.removal.disconnected.length}</b></div>
              {result.removal.disconnected.map(key => (
                <div key={key} className="broken-line">
                  <button type="button" className="linkish m" style={{ color: `var(--l-${nodeInfo(key)?.layer || 'other'}-t)` }} onClick={() => navigate({ sel: key })}>{key}</button>
                  <span className="mu">{docIndex.get(key)?.title}</span>
                </div>
              ))}
            </>
          )}
          <div className="mu scope-note">Pliki się nie zmieniają. Relacje usuwa się na końcu (metodyka, sekcja 6).</div>
        </>
      )}
    </div>
  );
}
