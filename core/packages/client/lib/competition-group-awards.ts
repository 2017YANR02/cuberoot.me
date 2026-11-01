import { useEffect, useState } from 'react';
import { apiUrl } from './api-base';
import type { CompetitionGroupAwardsResponse } from '@cuberoot/shared/cubing-live';
export type { CompetitionGroupAward } from '@cuberoot/shared/cubing-live';
export function useGroupAwards(kind: 'competitions' | 'persons', id: string, cubingSlug?: string) {
  const path = '/v1/group-awards/' + kind + '/' + encodeURIComponent(id) + '?v=1' + (cubingSlug ? '&cubingSlug=' + encodeURIComponent(cubingSlug) : '');
  const [state, setState] = useState<{ path: string; data?: CompetitionGroupAwardsResponse; error?: boolean }>({ path: '' });
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl(path), { signal: controller.signal });
        if (response.status === 404) { setState({ path, data: { rows: [], coverage: 'collected', stale: false } }); return; }
        if (!response.ok) throw new Error('Awards unavailable');
        const data = await response.json() as CompetitionGroupAwardsResponse;
        if (!Array.isArray(data.rows)) throw new Error('Invalid awards response');
        if (!controller.signal.aborted) setState({ path, data });
      } catch {
        if (!controller.signal.aborted) setState(previous => ({ path, data: previous.path === path ? previous.data : undefined, error: true }));
      }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [id, path]);
  return state.path === path ? state : { path };
}
