import { useEffect, useRef, useState } from 'react';
import { useData } from '../state/data';
import { listParam, navigate } from '../state/route';
import { Status } from '../components/common';

const CHIP_LIMIT = 3;

// Identyfikator w komórce: wiersz tego samego dokumentu bez prefiksu doc-id.
function Chips({ ids, ownerId, nodeInfo }) {
  const [open, setOpen] = useState(false);
  if (!ids.length) return <span className="mu">—</span>;
  const shown = open ? ids : ids.slice(0, CHIP_LIMIT);
  return (
    <span className="cell-chips">
      {shown.map(id => {
        const info = nodeInfo(id);
        const label = ownerId && id.startsWith(`${ownerId}.`) ? id.slice(ownerId.length + 1) : id;
        return (
          <button key={id} type="button" className="chip-link m" style={{ color: `var(--l-${info?.layer || 'other'}-t)` }} title={id}
            onClick={event => { event.stopPropagation(); navigate({ sel: id }); }}>{label}</button>
        );
      })}
      {ids.length > CHIP_LIMIT && (
        <button type="button" className="chip-link mu m" title={open ? 'Zwiń listę' : ids.slice(CHIP_LIMIT).join(', ')}
          onClick={event => { event.stopPropagation(); setOpen(o => !o); }}>{open ? '‹' : `+${ids.length - CHIP_LIMIT}`}</button>
      )}
    </span>
  );
}

export function sortRows(rows, sort, direction) {
  const factor = direction === 'desc' ? -1 : 1;
  const value = row => {
    if (sort === 'tytul') return row.doc.title || '';
    if (sort === 'status') return row.doc.status || '';
    if (sort === 'uzycia') return row.users.length;
    if (sort && sort !== 'id') return (row.cells[sort] || []).length;
    return row.doc.id;
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const result = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pl', { numeric: true });
    return result * factor || a.doc.id.localeCompare(b.doc.id, 'pl', { numeric: true });
  });
}

export default function CatalogTable({ rows, columns, params }) {
  const { nodeInfo } = useData();
  const sort = params.sort || 'id';
  const direction = params.kier || 'asc';
  const hidden = new Set(listParam(params.bez_kolumn));
  const visibleColumns = columns.filter(column => !hidden.has(column.key));
  const sorted = sortRows(rows, sort, direction);
  const bodyRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.querySelector('tr[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [params.sel]);

  const header = (key, label, extra = {}) => {
    const active = sort === key;
    return (
      <th key={key} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} {...extra}>
        <button type="button" className={`th-sort ${active ? 'is-active' : ''}`}
          onClick={() => navigate({ sort: key === 'id' && active && direction === 'desc' ? undefined : key, kier: active && direction === 'asc' ? 'desc' : undefined }, { replace: true })}>
          {label}{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
      </th>
    );
  };

  return (
    <div className="catalog-table-wrap">
      <table className="table catalog-table">
        <thead>
          <tr>
            {header('id', 'ID')}
            {header('tytul', 'Tytuł')}
            {!hidden.has('status') && header('status', 'Status')}
            {header('uzycia', 'Używany przez')}
            {visibleColumns.map(column => header(column.key, column.label, { className: 'm', title: column.direction === 'out' ? `Wpisy ${column.relation} do ${column.type}` : `Dokumenty ${column.type}, które mają wpis ${column.relation} do tego dokumentu` }))}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {sorted.map(row => (
            <tr key={row.doc.id} aria-selected={row.doc.id === params.sel} onClick={() => navigate({ sel: row.doc.id, panel: undefined })}>
              <td><span className="m" style={{ fontWeight: 500, color: `var(--l-${row.doc.layer}-t)`, whiteSpace: 'nowrap' }}>{row.doc.id}</span></td>
              <td className="cell-title">{row.doc.title}</td>
              {!hidden.has('status') && <td><Status status={row.doc.status} /></td>}
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`use-badge m ${row.users.length ? '' : 'is-zero'}`}>{row.users.length ? row.users.length : '0 użyć'}</span>
                  {row.users.length > 0 && <Chips ids={row.users} nodeInfo={nodeInfo} />}
                </div>
              </td>
              {visibleColumns.map(column => <td key={column.key}><Chips ids={row.cells[column.key]} ownerId={row.doc.id} nodeInfo={nodeInfo} /></td>)}
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={4 + visibleColumns.length} className="mu">Żaden dokument nie pasuje do filtra.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
