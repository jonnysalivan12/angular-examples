// Drobne elementy wspólne dla paneli.

// Kolor warstwy: dot dla kropek i obwódek, text dla tekstu (w motywie jasnym
// przyciemniony do kontrastu 4,5:1).
export const layerColor = layer => `var(--l-${layer || 'other'})`;
export const layerText = layer => `var(--l-${layer || 'other'}-t)`;

// Ścieżka pliku względem folderu dokumentacji (bez prefiksu root z API).
export function relPath(node, graph) {
  const root = graph?.root;
  const dir = node.path || '';
  const relative = root && dir.startsWith(`${root}/`) ? dir.slice(root.length + 1) : dir === root ? '' : dir;
  return relative ? `${relative}/${node.fileName}` : node.fileName;
}

export function TypeTag({ type, layer, style }) {
  return (
    <span className="tt" style={{ background: `color-mix(in srgb, ${layerColor(layer)} 18%, transparent)`, color: layerText(layer), ...style }}>
      {type}
    </span>
  );
}

// Identyfikator węzła w wariancie 1g: kropka i ID kolorem warstwy.
export function NodeId({ id, layer, onClick, className = '' }) {
  const content = (
    <>
      <span className="dot" style={{ background: layerColor(layer), width: 6, height: 6 }} />
      <span className="m" style={{ color: layerText(layer) }}>{id}</span>
    </>
  );
  if (!onClick) return <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{content}</span>;
  return (
    <button type="button" className={`linkish ${className}`} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
      {content}
    </button>
  );
}

export function Status({ status }) {
  if (!status) return null;
  return <span className={`st ${status === 'active' ? 'active' : ''}`}>{status}</span>;
}

// Przełącznik segmentowy Nocturne na natywnych polach radio.
export function Segmented({ name, value, options, onChange, full = false, mono = false, vertical = false }) {
  return (
    <div className="seg" style={{ borderColor: 'var(--t-line)', width: full ? '100%' : undefined, flexDirection: vertical ? 'column' : undefined }}>
      {options.map((option, index) => (
        <label key={option.value} className="seg-opt" style={{
          flex: full ? 1 : undefined, justifyContent: vertical ? 'flex-start' : 'center', fontFamily: mono ? 'var(--mono)' : undefined,
          ...(vertical ? { borderLeft: 0, borderTop: index ? '1px solid var(--color-divider)' : 0 } : {}),
        }}>
          <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
          {option.hint && <span className="sk">{option.hint}</span>}
        </label>
      ))}
    </div>
  );
}

// Nagłówek sekcji panelu; toggleAll dodaje przycisk „zaznacz/odznacz wszystko”
// dla listy pól: { allOn, onChange(nextOn) }.
export function Section({ title, aside, toggleAll, children }) {
  return (
    <div>
      <div className="k">
        <span>{title}</span>
        {toggleAll && (
          <button type="button" className="all-toggle" onClick={() => toggleAll.onChange(!toggleAll.allOn)}>
            {toggleAll.allOn ? 'odznacz wszystko' : 'zaznacz wszystko'}
          </button>
        )}
        {aside !== undefined && <b>{aside}</b>}
      </div>
      {children}
    </div>
  );
}
