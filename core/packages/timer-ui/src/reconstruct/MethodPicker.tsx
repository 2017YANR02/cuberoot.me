import { METHODS, METHOD_ORDER, type MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import { useReconstructHost } from './ReconstructHost';

export default function MethodPicker({ method, onChange }: { method: MethodId; onChange: (method: MethodId) => void }) {
  const { localize: tr } = useReconstructHost();
  return <label className="sa-method">
    <select className="sa-method-select" value={method}
      onChange={event => onChange(event.target.value as MethodId)}
      aria-label={tr({ zh: '还原方法', en: 'Method' })}>
      {METHOD_ORDER.map(id => <option key={id} value={id}>{tr(METHODS[id])}</option>)}
    </select>
  </label>;
}
