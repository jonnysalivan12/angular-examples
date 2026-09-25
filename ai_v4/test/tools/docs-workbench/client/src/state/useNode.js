import { useEffect, useState } from 'react';
import { api, useData } from './data';

// Opis węzła z /api/doc. Pobiera ponownie po zmianie danych na serwerze.
export default function useNode(key) {
  const { graph } = useData();
  const [state, setState] = useState({ node: null, error: null, key: null });

  useEffect(() => {
    let cancelled = false;
    if (!key || key.startsWith('grupa:')) { setState({ node: null, error: null, key }); return undefined; }
    api(`/api/doc?id=${encodeURIComponent(key)}`)
      .then(node => { if (!cancelled) setState({ node, error: null, key }); })
      .catch(error => { if (!cancelled) setState({ node: null, error: error.message, key }); });
    return () => { cancelled = true; };
  }, [key, graph?.version]);

  // Poprzedni węzeł nie jest pokazywany jako bieżący.
  return state.key === key ? state : { node: null, error: null, key };
}

// Link vscode://file/…:linia do pliku węzła.
export const vscodeLink = (meta, node, line) => {
  if (!meta || !node?.path || !node?.fileName) return null;
  const file = `${meta.repoRoot}/${node.path}/${node.fileName}`.replace(/\\/g, '/');
  return `vscode://file/${file}${line ? `:${line}` : ''}`;
};
