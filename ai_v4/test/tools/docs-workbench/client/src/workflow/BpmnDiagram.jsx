import { useEffect, useRef, useState } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import { navigate } from '../state/route';
import { fileUrl } from './model';

// Diagram BPMN z pliku XML (bpmn-js, tylko do odczytu: przesuwanie i zoom).
// Zadanie z tabeli „Zadania procesu” dostaje etykietę swojego kroku SPEC-WF;
// klik w zadanie zaznacza krok, dwuklik otwiera jego podgląd.
export default function BpmnDiagram({ process, selectedId }) {
  const container = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const styles = getComputedStyle(container.current);
    const viewer = new NavigatedViewer({
      container: container.current,
      bpmnRenderer: {
        defaultFillColor: styles.getPropertyValue('--color-surface').trim() || '#ffffff',
        defaultStrokeColor: styles.getPropertyValue('--color-text').trim() || '#1f2130',
        defaultLabelColor: styles.getPropertyValue('--color-text').trim() || '#1f2130',
      },
    });
    viewerRef.current = viewer;
    const specOf = elementId => process.tasks.find(task => task.taskId === elementId)?.spec || null;
    (async () => {
      const response = await fetch(fileUrl(process.bpmnXml.path));
      if (!response.ok) throw new Error(`plik ${process.bpmnXml.path} nie jest dostępny`);
      const xml = await response.text();
      if (cancelled) return;
      const { warnings } = await viewer.importXML(xml);
      if (warnings?.length) console.warn('BPMN: ostrzeżenia importu', warnings);
      const overlays = viewer.get('overlays');
      const registry = viewer.get('elementRegistry');
      for (const task of process.tasks) {
        if (!task.spec || !registry.get(task.taskId)) continue;
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'bpmn-spec-badge';
        badge.textContent = task.spec;
        badge.addEventListener('click', event => { event.stopPropagation(); navigate({ sel: task.spec }); });
        overlays.add(task.taskId, { position: { bottom: 10, left: -4 }, html: badge });
      }
      const events = viewer.get('eventBus');
      events.on('element.click', event => { const spec = specOf(event.element.id); if (spec) navigate({ sel: spec }); });
      events.on('element.dblclick', event => { const spec = specOf(event.element.id); if (spec) navigate({ sel: spec, podglad: '1' }); });
      viewer.get('canvas').zoom('fit-viewport', 'auto');
    })().catch(reason => { if (!cancelled) setError(reason.message || String(reason)); });
    return () => { cancelled = true; viewer.destroy(); viewerRef.current = null; };
  }, [process]);

  // Zaznaczony krok SPEC-WF podświetla swoje zadanie.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const canvas = viewer.get('canvas');
    const registry = viewer.get('elementRegistry');
    for (const task of process.tasks) {
      if (!registry.get(task.taskId)) continue;
      if (task.spec && task.spec === selectedId) canvas.addMarker(task.taskId, 'is-selected-task');
      else canvas.removeMarker(task.taskId, 'is-selected-task');
    }
  }, [selectedId, process]);

  return (
    <>
      <div ref={container} className="wf-bpmn" />
      {error && <div className="cv-note" style={{ color: 'var(--t-error)' }}>Nie udało się wczytać diagramu BPMN: {error}</div>}
    </>
  );
}
