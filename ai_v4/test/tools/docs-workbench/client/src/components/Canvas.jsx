import { useData } from '../state/data';
import MapCanvas from '../map/MapCanvas';
import CatalogCanvas from '../catalog/CatalogCanvas';
import ScopeCanvas from '../scope/ScopeCanvas';
import FlowCanvas from '../flow/FlowCanvas';
import WorkflowCanvas from '../workflow/WorkflowCanvas';
import { viewOf } from '../workflow/model';

// Płótno trybu: Mapa (albo katalog typu), Zasięg, Przepływ.
export default function Canvas({ mode, params }) {
  const { graph } = useData();
  if (!graph) return <div className="cv"><div className="cv-note">Wczytywanie dokumentacji…</div></div>;
  if (mode === 'scope') return <ScopeCanvas params={params} />;
  if (mode === 'flow') return viewOf(params.widok) ? <WorkflowCanvas params={params} /> : <FlowCanvas params={params} />;
  if (params.zakres === 'typ') return <CatalogCanvas params={params} />;
  return <MapCanvas params={params} />;
}
