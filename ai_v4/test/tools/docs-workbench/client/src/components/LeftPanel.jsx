import { useMemo } from 'react';
import { listParam, navigate } from '../state/route';
import { useData } from '../state/data';
import { layerColor, layerText, NodeId, Section, Segmented } from './common';
import { RELAYOUT_EVENT, lineModes, lineParam } from '../map/MapCanvas';
import { useCatalog } from '../catalog/CatalogCanvas';
import { useScopeResult } from '../scope/useScope';
import { exportMarkdown } from '../scope/paths';
import NodePicker from './NodePicker';
import { VIEWS, viewOf } from '../workflow/model';
import { currentItem, useWorkflows } from '../workflow/WorkflowCanvas';

const RELATIONS = ['contains', 'realizes', 'consumes', 'constrained_by', 'applies', 'involves', 'groups'];

// Opis ustawienia linii Mapy pod polami.
function linesHint({ groups, relations, hover }) {
  const shown = [groups && (relations ? 'linie między grupami' : 'linie między grupami i wiązki'), relations && 'wszystkie relacje dokumentów'].filter(Boolean);
  const base = shown.length ? `Widać ${shown.join(' i ')}.` : 'Bez linii na stałe.';
  return hover ? `${base} Najedź na kartę albo ją zaznacz, żeby wyróżnić jej relacje.` : base;
}

// Pole wyboru, które zapisuje listę wyłączonych wartości w parametrze adresu.
function toggleInList(params, key, value, extra = {}) {
  const list = new Set(listParam(params[key]));
  if (list.has(value)) list.delete(value); else list.add(value);
  navigate({ [key]: [...list].join(',') || undefined, ...extra }, { replace: true });
}

function MapPanel({ params }) {
  const { graph } = useData();
  const counts = useMemo(() => {
    const layers = {};
    const relations = {};
    for (const doc of graph.documents) layers[doc.layer] = (layers[doc.layer] || 0) + 1;
    // Liczone są wpisy, które mogą być linią: wpis do własnego wiersza nią nie jest.
    for (const edge of graph.edges) if (edge.exists && edge.source !== edge.targetDoc) relations[edge.relation] = (relations[edge.relation] || 0) + 1;
    return { layers, relations };
  }, [graph]);
  const hiddenLayers = new Set(listParam(params.bez_warstw));
  const hiddenRelations = new Set(listParam(params.bez_relacji));
  const set = patch => navigate(patch, { replace: true });

  const scope = params.zakres || 'calosc';
  const scopeKind = scope === 'proces' ? 'process' : null;
  const expanded = listParam(params.rozwin);

  return (
    <>
      <Section title="Zakres">
        <select className="sel" value={scope} aria-label="Zakres" onChange={e => {
          const value = e.target.value;
          const kind = value === 'proces' ? 'process' : null;
          const first = kind ? graph.groups.find(group => group.kind === kind)?.id : undefined;
          // Sąsiedztwo startuje od zaznaczonego dokumentu albo wiersza, jeśli jest.
          const center = value === 'sasiedztwo' && params.sel && !params.sel.startsWith('grupa:') ? params.sel : undefined;
          set({
            zakres: value === 'calosc' ? undefined : value,
            grupa: kind ? params.grupa && graph.groups.some(g => g.id === params.grupa && g.kind === kind) ? params.grupa : first : undefined,
            wezel: value === 'sasiedztwo' ? params.wezel || center : undefined,
          });
        }}>
          <option value="calosc">Całość</option>
          <option value="proces">Proces</option>
          <option value="typ">Typ dokumentu</option>
          <option value="sasiedztwo">Sąsiedztwo węzła</option>
        </select>
        {scopeKind && (
          <select className="sel" style={{ marginTop: 6 }} value={params.grupa || ''} onChange={e => set({ grupa: e.target.value })} aria-label="Proces">
            {graph.groups.filter(group => group.kind === scopeKind).map(group => <option key={group.id} value={group.id}>{group.id} · {group.title}</option>)}
          </select>
        )}
        {scope === 'sasiedztwo' && (
          <div style={{ marginTop: 6 }}>
            <Segmented name="kroki" full value={params.kroki || '1'} onChange={v => set({ kroki: v === '1' ? undefined : v })}
              options={[{ value: '1', label: '1 krok' }, { value: '2', label: '2 kroki' }, { value: '3', label: '3 kroki' }]} />
            <div className="k" style={{ marginTop: 10 }}>Środek<b>{params.wezel || '—'}</b></div>
            <NodePicker compact placeholder={params.wezel ? 'Zmień środek: ID albo tytuł…' : 'Wybierz środek: ID albo tytuł…'}
              onPick={id => set({ wezel: id, sel: id })} />
            {params.sel && params.sel !== params.wezel && !params.sel.startsWith('grupa:') && (
              <button type="button" className="btn btn-ghost" style={{ marginTop: 4, padding: '2px 6px' }} onClick={() => set({ wezel: params.sel })}>
                Środek z zaznaczenia: <span className="m">{params.sel}</span>
              </button>
            )}
          </div>
        )}
      </Section>
      {scope === 'typ' && <TypeSections params={params} />}
      {scope !== 'typ' && <MapSections params={params} counts={counts} hiddenLayers={hiddenLayers} hiddenRelations={hiddenRelations} scopeKind={scopeKind} scope={scope} expanded={expanded} set={set} />}
    </>
  );
}

// Panel katalogu typu: typy (wiele naraz), grupowanie grafu, filtr, kolumny.
function TypeSections({ params }) {
  const { graph } = useData();
  const set = patch => navigate(patch, { replace: true });
  const selected = new Set(listParam(params.typ));
  const presentTypes = new Set(graph.documents.map(doc => doc.type));
  const { columns } = useCatalog(params);
  const hiddenColumns = new Set(listParam(params.bez_kolumn));
  const toggleType = type => {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type); else next.add(type);
    set({ typ: [...next].join(',') || undefined, sort: undefined, kier: undefined, bez_kolumn: undefined });
  };
  return (
    <>
      <Section title="Typy · wiele naraz" toggleAll={{
        allOn: [...presentTypes].every(type => selected.has(type)),
        onChange: on => set({ typ: on ? graph.layers.flatMap(layer => layer.types).filter(type => presentTypes.has(type)).join(',') : undefined, sort: undefined, kier: undefined, bez_kolumn: undefined }),
      }}>
        {graph.layers.map(layer => {
          const types = layer.types.filter(type => presentTypes.has(type));
          if (!types.length) return null;
          return (
            <div key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span className="dot" style={{ background: layerColor(layer.id) }} title={layer.name} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {types.map(type => {
                  const on = selected.has(type);
                  return (
                    <button key={type} type="button" className="chip type-chip" aria-pressed={on} onClick={() => toggleType(type)}
                      style={{ borderColor: on ? layerColor(layer.id) : 'var(--t-line)', background: on ? `color-mix(in srgb, ${layerColor(layer.id)} 20%, transparent)` : 'transparent', color: on ? `var(--l-${layer.id}-t)` : 'var(--t-muted)' }}>
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Section>
      <Section title="Filtr">
        <input className="sel" type="search" placeholder="ID albo tytuł…" value={params.filtr || ''} aria-label="Filtruj po ID albo tytule"
          onChange={e => set({ filtr: e.target.value || undefined })} />
        <select className="sel" style={{ marginTop: 6 }} value={params.pokaz || ''} aria-label="Pokaż" onChange={e => set({ pokaz: e.target.value || undefined })}>
          <option value="">Wszystkie</option>
          <option value="bez-uzyc">Bez użyć</option>
          <option value="draft">Tylko draft</option>
          <option value="active">Tylko active</option>
        </select>
      </Section>
      {params.widok === 'tabela' ? (
        <Section title="Kolumny" toggleAll={{ allOn: hiddenColumns.size === 0, onChange: on => set({ bez_kolumn: on ? undefined : ['status', ...columns.map(column => column.key)].join(',') }) }}>
          {[{ key: 'status', label: 'Status' }, ...columns].map(column => (
            <div className="row" key={column.key}>
              <label>
                <input type="checkbox" checked={!hiddenColumns.has(column.key)} onChange={() => toggleInList(params, 'bez_kolumn', column.key)} />
                <span className={column.key === 'status' ? '' : 'm'} style={{ fontSize: column.key === 'status' ? 12 : 11 }}>{column.label}</span>
              </label>
            </div>
          ))}
        </Section>
      ) : (
        <Section title="Grupuj">
          <select className="sel" value={params.kgrupuj === 'brak' ? 'typ' : params.kgrupuj || 'wlasciciel'} aria-label="Grupuj katalog" onChange={e => set({ kgrupuj: e.target.value === 'wlasciciel' ? undefined : e.target.value })}>
            <option value="wlasciciel">Właściciel w procesie</option>
            <option value="proces">Proces</option>
            <option value="status">Status</option>
            <option value="typ">Typ</option>
          </select>
        </Section>
      )}
      <Section title="Koloruj">
        <Segmented name="koloruj" full value={params.koloruj || 'warstwa'} onChange={v => set({ koloruj: v === 'warstwa' ? undefined : v })}
          options={[{ value: 'warstwa', label: 'Warstwa' }, { value: 'status', label: 'Status' }]} />
      </Section>
    </>
  );
}

function MapSections({ params, counts, hiddenLayers, hiddenRelations, scopeKind, scope, expanded, set }) {
  const { graph } = useData();
  const lines = lineModes(params);
  return (
    <>
      <Section title="Grupuj">
        <select className="sel" value={scopeKind ? 'proces' : params.grupuj || 'proces'} disabled={Boolean(scopeKind)} onChange={e => set({ grupuj: e.target.value === 'proces' ? undefined : e.target.value, rozwin: undefined })} aria-label="Grupuj">
          <option value="proces">Proces</option>
          <option value="warstwa">Warstwa</option>
          <option value="folder">Folder</option>
          <option value="brak">Bez grup</option>
        </select>
      </Section>
      {!scopeKind && scope !== 'sasiedztwo' && (params.grupuj || 'proces') !== 'brak' && (
        <Section title="Rozwinięte" aside={expanded.length}>
          {expanded.length === 0 && <div className="mu" style={{ fontSize: 11 }}>Dwuklik na grupie rozwija ją w dokumenty.</div>}
          <div className="basket">
            {expanded.map(key => {
              // Grupa warstwy pokazuje nazwę warstwy („Pojęcia i dane”), nie klucz (data).
              const layer = params.grupuj === 'warstwa' ? graph.layers.find(item => item.id === key) : null;
              return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 8px', border: '1px solid var(--t-line)', borderRadius: 6 }}>
                {layer && <span className="dot" style={{ background: layerColor(layer.id) }} />}
                <span className={layer ? '' : 'm'} style={{ fontSize: layer ? 12 : 11.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{layer ? layer.name : key}</span>
                <button type="button" aria-label={`Zwiń ${layer ? layer.name : key}`} onClick={() => set({ rozwin: expanded.filter(k => k !== key).join(',') || undefined })}
                  style={{ background: 'none', border: 0, color: 'var(--t-muted)', cursor: 'pointer', fontSize: 13 }}>×</button>
              </div>
              );
            })}
          </div>
          {expanded.length > 1 && <button type="button" className="btn btn-ghost" style={{ marginTop: 4 }} onClick={() => set({ rozwin: undefined })}>Zwiń wszystkie</button>}
        </Section>
      )}
      <Section title="Koloruj">
        <Segmented name="koloruj" full value={params.koloruj || 'warstwa'} onChange={v => set({ koloruj: v === 'warstwa' ? undefined : v })}
          options={[{ value: 'warstwa', label: 'Warstwa' }, { value: 'status', label: 'Status' }]} />
      </Section>
      <Section title="Warstwy" toggleAll={{ allOn: hiddenLayers.size === 0, onChange: on => set({ bez_warstw: on ? undefined : graph.layers.map(layer => layer.id).join(',') }) }}>
        {graph.layers.map(layer => (
          <div className="row" key={layer.id}>
            <label>
              <input type="checkbox" checked={!hiddenLayers.has(layer.id)} onChange={() => toggleInList(params, 'bez_warstw', layer.id)} style={{ accentColor: layerColor(layer.id) }} />
              <span style={{ flex: 1 }}>{layer.name}</span>
            </label>
            <button type="button" className="linkish m mu cnt" title={`Katalog typu: ${layer.types.join(', ')}`}
              onClick={() => set({ zakres: 'typ', typ: layer.types.filter(type => graph.documents.some(doc => doc.type === type)).join(',') })}>{counts.layers[layer.id] || 0}</button>
          </div>
        ))}
      </Section>
      <Section title="Relacje" toggleAll={{ allOn: hiddenRelations.size === 0, onChange: on => set({ bez_relacji: on ? undefined : RELATIONS.join(',') }) }}>
        {RELATIONS.map(relation => (
          <div className="row" key={relation}>
            <label>
              <input type="checkbox" checked={!hiddenRelations.has(relation)} onChange={() => toggleInList(params, 'bez_relacji', relation)} />
              <span className="m" style={{ fontSize: 11.5, flex: 1 }}>{relation}</span>
            </label>
            <button type="button" className="linkish m mu cnt" title="Pokaż tylko tę relację; drugi klik przywraca wszystkie"
              onClick={() => {
                const solo = RELATIONS.filter(other => other !== relation);
                const isSolo = solo.every(other => hiddenRelations.has(other)) && !hiddenRelations.has(relation);
                set({ bez_relacji: isSolo ? undefined : solo.join(',') });
              }}>{counts.relations[relation] || 0}</button>
          </div>
        ))}
      </Section>
      <Section title="Układ">
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="sel" value={params.uklad || 'warstwowy'} onChange={e => set({ uklad: e.target.value === 'warstwowy' ? undefined : e.target.value })} aria-label="Układ">
            <option value="warstwowy">Warstwowy</option>
            <option value="silowy">Siłowy</option>
            <option value="kolowy">Kołowy</option>
          </select>
          <button type="button" className="btn btn-secondary" style={{ whiteSpace: 'nowrap', padding: '3px 8px' }} title="Ułóż węzły od nowa, także przeciągnięte"
            onClick={() => window.dispatchEvent(new Event(RELAYOUT_EVENT))}>Ułóż</button>
        </div>
      </Section>
      <Section title="Linie">
        {[
          { key: 'groups', label: 'Grupujące', title: 'Linie między grupami i wiązki z ramki do grupy, z liczbą relacji' },
          { key: 'relations', label: 'Relacje dokumentów', title: 'Każda relacja między dokumentami osobną linią, z nazwą; wiązki znikają' },
          { key: 'hover', label: 'Relacje po najechaniu', title: 'Karta pod kursorem albo zaznaczona pokazuje swoje relacje, reszta przygasa' },
        ].map(option => (
          <div className="row" key={option.key}>
            <label title={option.title}>
              <input type="checkbox" checked={lines[option.key]} onChange={() => set({ linie: lineParam({ ...lines, [option.key]: !lines[option.key] }, scope) })} />
              <span style={{ flex: 1 }}>{option.label}</span>
            </label>
          </div>
        ))}
        <div className="mu" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{linesHint(lines)}</div>
      </Section>
      <Section title="Etykiety">
        <Segmented name="etykiety" full value={params.etykiety || 'id-tytul'} onChange={v => set({ etykiety: v === 'id-tytul' ? undefined : v })}
          options={[{ value: 'id', label: 'ID' }, { value: 'id-tytul', label: 'ID i tytuł' }, { value: 'najechanie', label: 'Najechanie' }]} />
      </Section>
      <Section title="Znaczniki walidacji">
        {[{ id: 'bledy', label: 'Błędy', color: 'var(--t-error)' }, { id: 'ostrzezenia', label: 'Ostrzeżenia', color: 'var(--t-scope)' }].map(mark => (
          <div className="row" key={mark.id}>
            <label>
              <input type="checkbox" checked={!listParam(params.bez_znacznikow).includes(mark.id)} onChange={() => toggleInList(params, 'bez_znacznikow', mark.id)} style={{ accentColor: mark.color }} />
              {mark.label}
            </label>
          </div>
        ))}
      </Section>
      <Section title="Gęstość" aside={Number(params.gestosc ?? 0.5).toFixed(1)}>
        <input type="range" min="0" max="1" step="0.1" value={params.gestosc ?? 0.5} aria-label="Gęstość" style={{ width: '100%', margin: 0, accentColor: 'var(--color-accent)' }}
          onChange={e => set({ gestosc: e.target.value === '0.5' ? undefined : e.target.value })} />
      </Section>
    </>
  );
}

function ScopePanel({ params }) {
  const { nodeInfo } = useData();
  const starts = listParam(params.start);
  const set = patch => navigate(patch, { replace: true });
  return (
    <>
      <Section title="Zapytanie">
        <Segmented name="query" full mono vertical value={params.zapytanie || 'change_scope'} onChange={v => set({ zapytanie: v === 'change_scope' ? undefined : v })}
          options={[{ value: 'change_scope', label: 'change_scope' }, { value: 'implementation', label: 'implementation' }]} />
      </Section>
      <Section title="Koszyk" aside={starts.length}>
        <div className="basket">
          {starts.map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 8px', border: `1px solid ${params.tryb === 'usuniecie' ? 'var(--t-error)' : 'var(--t-scope)'}`, borderRadius: 6, background: `color-mix(in srgb, ${params.tryb === 'usuniecie' ? 'var(--t-error)' : 'var(--t-scope)'} 10%, transparent)` }}>
              <NodeId id={key} layer={nodeInfo(key)?.layer} className="grow" onClick={() => navigate({ sel: key })} />
              <button type="button" aria-label={`Usuń ${key} z koszyka`} onClick={() => set({ start: starts.filter(s => s !== key).join(',') || undefined })}
                style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--t-muted)', cursor: 'pointer', fontSize: 13 }}>×</button>
            </div>
          ))}
          <NodePicker compact placeholder="Dodaj: ID albo tytuł…" exclude={starts}
            onPick={id => set({ start: [...starts, id].join(','), sel: id })} />
          <div className="basket-add">albo zaznacz węzeł i naciśnij <span className="kbd">Z</span></div>
        </div>
      </Section>
      <Section title="Tryb">
        <Segmented name="tryb" full value={params.tryb || 'przeglad'} onChange={v => set({ tryb: v === 'przeglad' ? undefined : v })}
          options={[{ value: 'przeglad', label: 'Przegląd' }, { value: 'usuniecie', label: 'Symulacja usunięcia' }]} />
      </Section>
      <Section title="Grupuj listę">
        <Segmented name="lista" full value={params.lista || 'wzorzec'} onChange={v => set({ lista: v === 'wzorzec' ? undefined : v })}
          options={[{ value: 'wzorzec', label: 'Wzorzec' }, { value: 'folder', label: 'Folder' }, { value: 'warstwa', label: 'Warstwa' }]} />
      </Section>
      <Section title="Na płótnie">
        <div className="row"><label><input type="checkbox" checked={params.kontekst !== '0'} onChange={e => set({ kontekst: e.target.checked ? undefined : '0' })} />Sąsiedzi spoza wyniku</label></div>
        <div className="row"><label><input type="checkbox" checked={params.etykiety_relacji === '1'} onChange={e => set({ etykiety_relacji: e.target.checked ? '1' : undefined })} />Nazwy relacji na liniach</label></div>
      </Section>
      <ScopeExport params={params} />
    </>
  );
}

// Eksport wyniku jako lista kontrolna Markdown i link do tego widoku.
function ScopeExport({ params }) {
  const { meta } = useData();
  const { result, request } = useScopeResult(params);
  const toast = message => window.dispatchEvent(new CustomEvent('workbench:toast', { detail: message }));
  const copy = (text, message) => navigator.clipboard?.writeText(text).then(() => toast(message), () => toast('Nie udało się skopiować'));
  const markdown = () => exportMarkdown({ result, query: request.query, branch: meta?.branch, removal: result?.removal, simulate: request.simulateRemoval, root: meta?.root });
  const download = () => {
    const blob = new Blob([markdown()], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `zasieg-${result.starts.join('_').replace(/[^\w.-]+/g, '-')}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  return (
    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="btn btn-primary" disabled={!result} onClick={() => copy(markdown(), 'Lista Markdown jest w schowku')}>Kopiuj listę (Markdown)</button>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} disabled={!result} onClick={download}>Pobierz .md</button>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => copy(window.location.href, 'Link do widoku jest w schowku')}>Kopiuj link</button>
      </div>
    </div>
  );
}

// Tekst bramek z dokumentu BPMN: akapity i listy, `kod` jako tekst mono.
function GatewayText({ text }) {
  const inline = line => line.split(/(`[^`]+`)/).map((part, index) => (part.startsWith('`') ? <span key={index} className="m">{part.slice(1, -1)}</span> : part));
  const blocks = text.split(/\r?\n\s*\r?\n/).map(block => block.trim()).filter(Boolean);
  return blocks.map((block, index) => (block.split(/\r?\n/).every(line => /^\s*-\s/.test(line))
    ? <ul key={index} className="wf-gateways">{block.split(/\r?\n/).map((line, i) => <li key={i}>{inline(line.replace(/^\s*-\s/, ''))}</li>)}</ul>
    : <p key={index} className="wf-gateways">{inline(block.replace(/\r?\n/g, ' '))}</p>));
}

// Widoki przepływu pracy: lista dokumentów typu według procesu i (dla BPMN) bramki.
function WorkflowSections({ params, set }) {
  const { graph } = useData();
  const workflows = useWorkflows();
  const view = viewOf(params.widok);
  const docs = graph.documents.filter(doc => doc.type === view.type).sort((a, b) => a.id.localeCompare(b.id, 'pl', { numeric: true }));
  const item = currentItem(workflows, params);
  const groups = [...new Set(docs.map(doc => doc.group))];
  return (
    <>
      <Section title={`Dokument ${view.short}`} aside={docs.length}>
        {docs.length === 0 && <div className="mu" style={{ fontSize: 11 }}>Brak dokumentów tego typu.</div>}
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 6 }}>
            <div className="mu m" style={{ fontSize: 10.5, margin: '2px 0 3px' }}>{group}</div>
            {docs.filter(doc => doc.group === group).map(doc => (
              <button key={doc.id} type="button" className={`wf-pick ${item?.id === doc.id ? 'is-active' : ''}`} onClick={() => set({ dok: doc.id, sel: doc.id })}>
                <span className="m" style={{ color: layerText(doc.layer) }}>{doc.id}</span>
                <span className="wf-pick-title">{doc.title}</span>
              </button>
            ))}
          </div>
        ))}
      </Section>
      {view.id === 'bpmn' && item && (
        <Section title="Bramki i warunki">
          {item.gateways ? <GatewayText text={item.gateways} /> : <div className="mu" style={{ fontSize: 11 }}>Dokument nie opisuje bramek.</div>}
        </Section>
      )}
      {view.id === 'flow' && item && item.caps.length > 0 && (
        <Section title="Zdolność">
          {item.caps.map(id => <NodeId key={id} id={id} layer={graph.documents.find(doc => doc.id === id)?.layer} onClick={() => set({ sel: id })} />)}
        </Section>
      )}
    </>
  );
}

function FlowPanel({ params }) {
  const { graph } = useData();
  const processes = graph.groups.filter(group => group.kind === 'process');
  const hidden = new Set(listParam(params.bez_procesow));
  const set = patch => navigate(patch, { replace: true });
  const view = viewOf(params.widok);
  const viewSelect = (
    <Section title="Widok">
      <select className="sel" value={view ? view.id : 'dane'} aria-label="Widok przepływu" onChange={e => set({ widok: e.target.value === 'dane' ? undefined : e.target.value, dok: undefined, lin: undefined })}>
        <option value="dane">Dane między zdolnościami (CAP)</option>
        {VIEWS.map(item => <option key={item.id} value={item.id}>{item.name} ({item.short})</option>)}
      </select>
    </Section>
  );
  if (view) return <>{viewSelect}<WorkflowSections params={params} set={set} /></>;
  return (
    <>
      {viewSelect}
      <Section title="Poziom">
        <Segmented name="poziom" full value={params.poziom || 'cap'} onChange={v => set({ poziom: v === 'cap' ? undefined : v, cap: v === 'kontrakty' ? params.cap || (params.sel?.startsWith('CAP-') ? params.sel : graph.documents.find(doc => doc.type === 'CAP')?.id) : undefined, lin: undefined })}
          options={[{ value: 'cap', label: 'CAP' }, { value: 'kontrakty', label: 'Kontrakty' }]} />
        {params.poziom === 'kontrakty' && (
          <select className="sel" style={{ marginTop: 6 }} value={params.cap || ''} aria-label="Zdolność" onChange={e => set({ cap: e.target.value, sel: e.target.value })}>
            {graph.documents.filter(doc => doc.type === 'CAP').map(doc => <option key={doc.id} value={doc.id}>{doc.id} · {doc.title}</option>)}
          </select>
        )}
      </Section>
      {params.poziom !== 'kontrakty' && (
      <Section title="Procesy">
        {processes.map(group => (
          <div className="row" key={group.id}>
            <label style={{ minWidth: 0 }}>
              <input type="checkbox" checked={!hidden.has(group.id)} onChange={() => toggleInList(params, 'bez_procesow', group.id, { lin: undefined })} />
              <span className="m" style={{ fontSize: 11.5 }}>{group.id}</span>
              <span className="mu" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.title}</span>
            </label>
          </div>
        ))}
      </Section>
      )}
      {params.poziom !== 'kontrakty' && (
        <>
          <Section title="Linie">
            {[
              { id: 'event', name: 'Zdarzenia', legend: <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true"><path d="M0 5H28" stroke="var(--color-text)" strokeWidth="1.7" /><path d="M26 1.5L32 5L26 8.5z" fill="var(--color-text)" /></svg> },
              { id: 'call', name: 'Wywołania', legend: <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true"><circle cx="3" cy="5" r="2.5" fill="var(--color-text)" /><path d="M3 5H28" stroke="var(--color-text)" strokeWidth="1.2" /><path d="M26 1.5L32 5L26 8.5z" fill="var(--color-text)" /></svg> },
              { id: 'ambiguous', name: 'Niejednoznaczne', legend: <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true"><path d="M0 5H34" stroke="var(--t-muted)" strokeWidth="1.2" strokeDasharray="4 4" /></svg> },
            ].map(kind => (
              <div className="row" key={kind.id}>
                <label><input type="checkbox" checked={!listParam(params.bez_linii).includes(kind.id)} onChange={() => toggleInList(params, 'bez_linii', kind.id, { lin: undefined })} /><span style={{ flex: 1 }}>{kind.name}</span></label>
                {kind.legend}
              </div>
            ))}
          </Section>
          <Section title="Na linii">
            <Segmented name="linia" full value={params.linia || 'id'} onChange={v => set({ linia: v === 'id' ? undefined : v })}
              options={[{ value: 'id', label: 'ID kontraktu' }, { value: 'encje', label: 'Encje' }]} />
          </Section>
          <div className="mu" style={{ marginTop: 'auto', fontSize: 11, lineHeight: 1.45, borderTop: '1px solid var(--t-line)', paddingTop: 8 }}>
            Kierunek linii wynika tylko z pary <span className="m">QUE realizes CAP</span> i <span className="m">CAP consumes QUE</span> albo z wywołania przez dokument jednej zdolności.
          </div>
        </>
      )}
    </>
  );
}

export default function LeftPanel({ mode, params }) {
  const { graph } = useData();
  if (!graph) return <div className="empty">Wczytywanie…</div>;
  if (mode === 'scope') return <ScopePanel params={params} />;
  if (mode === 'flow') return <FlowPanel params={params} />;
  return <MapPanel params={params} />;
}
