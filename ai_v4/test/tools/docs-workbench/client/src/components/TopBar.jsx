import { MODES } from '../state/route';
import { useData } from '../state/data';
import { Segmented } from './common';

const plural = (n, one, few, many) => {
  if (n === 1) return one;
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
};

export default function TopBar({ mode, onMode, onSearch, onValidation, validationOpen, theme, onTheme }) {
  const { meta, validation } = useData();
  return (
    <header className="tb">
      <div className="brand"><i />Warsztat</div>
      <Segmented
        name="mode"
        value={mode}
        onChange={onMode}
        options={MODES.map(m => ({ value: m.id, label: m.name, hint: m.key }))}
      />
      {meta?.branch && (
        <div className="git" title={`Folder dokumentacji: ${meta.root}`}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="4" cy="3" r="1.6" /><circle cx="4" cy="13" r="1.6" /><circle cx="12" cy="6" r="1.6" /><path d="M4 4.6v6.8M12 7.6c0 3-8 1.5-8 4" /></svg>
          <span className="m">{meta.branch}</span>· stan roboczy
        </div>
      )}
      <div className={`val ${validationOpen ? 'is-open' : ''}`} title={validationOpen ? 'Zamknij panel walidacji (Esc)' : 'Otwórz panel walidacji'}>
        {!validation && <span className="mu">Walidacja…</span>}
        {validation && validation.errors === 0 && validation.warnings === 0 && (
          <button type="button" className="ok" onClick={onValidation}><i />0 problemów</button>
        )}
        {validation && validation.errors > 0 && (
          <button type="button" className="e" onClick={onValidation}><i />{validation.errors} {plural(validation.errors, 'błąd', 'błędy', 'błędów')}</button>
        )}
        {validation && validation.warnings > 0 && (
          <button type="button" className="w" onClick={onValidation}><i />{validation.warnings} {plural(validation.warnings, 'ostrzeżenie', 'ostrzeżenia', 'ostrzeżeń')}</button>
        )}
      </div>
      <button type="button" className="search" onClick={onSearch} aria-label="Szukaj (Ctrl K)">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
        Szukaj…<span className="kbd" style={{ marginLeft: 'auto' }}>Ctrl K</span>
      </button>
      <button type="button" className="icon-btn" onClick={onTheme} title={theme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny'} aria-label={theme === 'dark' ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'}>
        {theme === 'dark'
          ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></svg>
          : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" /></svg>}
      </button>
    </header>
  );
}

export { plural };
