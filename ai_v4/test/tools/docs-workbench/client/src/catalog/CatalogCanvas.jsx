import { useMemo } from 'react';
import { useData } from '../state/data';
import { listParam, navigate } from '../state/route';
import { plural } from '../components/TopBar';
import { Segmented } from '../components/common';
import CatalogGraph from './CatalogGraph';
import CatalogTable from './CatalogTable';
import { catalogColumns, catalogRows, filterRows, ownerLabel } from './model';

export function useCatalog(params) {
  const { graph } = useData();
  const types = listParam(params.typ);
  return useMemo(() => {
    if (!graph || !types.length) return { types, columns: [], rows: [], all: [] };
    const columns = catalogColumns(types, graph.triples || []);
    const all = catalogRows(graph, types, columns);
    return { types, columns, all, rows: filterRows(all, params.filtr, params.pokaz) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, params.typ, params.filtr, params.pokaz]);
}

export default function CatalogCanvas({ params }) {
  const { types, columns, rows, all } = useCatalog(params);
  const view = params.widok === 'tabela' ? 'tabela' : 'graf';
  const sortLabel = params.sort ? `${params.sort === 'uzycia' ? 'użycia' : params.sort === 'tytul' ? 'tytuł' : params.sort === 'id' ? 'ID' : columns.find(c => c.key === params.sort)?.label || params.sort} ${params.kier === 'desc' ? '↓' : '↑'}` : 'ID ↑';

  return (
    <div className="cv catalog-cv">
      <div className="catalog-bar">
        <div className="vl-inline">
          <b>Katalog</b> · <span className="m">{types.join(', ') || 'wybierz typ w panelu'}</span>
          {types.length > 0 && <> · {rows.length === all.length ? `${all.length}` : `${rows.length} z ${all.length}`} {plural(all.length, 'dokument', 'dokumenty', 'dokumentów')}</>}
          {types.length > 0 && (view === 'tabela' ? <> · posortowano: {sortLabel}</> : <> · grupy: {params.kgrupuj === 'proces' ? 'proces' : params.kgrupuj === 'status' ? 'status' : params.kgrupuj === 'brak' ? 'bez grup' : ownerLabel(types)}</>)}
          {params.pokaz && <> · filtr: {params.pokaz === 'bez-uzyc' ? 'bez użyć' : params.pokaz} <button type="button" className="linkish" onClick={() => navigate({ pokaz: undefined }, { replace: true })}>×</button></>}
        </div>
        <Segmented name="widok" value={view} onChange={v => navigate({ widok: v === 'graf' ? undefined : v }, { replace: true })}
          options={[{ value: 'graf', label: 'Graf' }, { value: 'tabela', label: 'Tabela' }]} />
      </div>
      {types.length === 0 && <div className="cv-note">Wybierz typ dokumentu w panelu po lewej albo wpisz typ:API w wyszukiwaniu (Ctrl K).</div>}
      {types.length > 0 && view === 'tabela' && <CatalogTable rows={rows} columns={columns} params={params} />}
      {types.length > 0 && view === 'graf' && <CatalogGraph rows={rows} params={params} />}
      {types.length > 0 && view === 'tabela' && <div className="hint"><span>Klik w wiersz zaznacza dokument</span><span>Klik w nagłówek sortuje</span></div>}
    </div>
  );
}
