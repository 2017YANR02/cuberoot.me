import { useEffect, useMemo, useState } from 'react';
import { LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';

/** One verified display stream per physical cube, shared by single and multi-cube views. */
export function useLiveCubeAnchor(connection: string | null, facelets: string | null) {
  const [snapshot, setSnapshot] = useState<LiveSmartCubeAnchorSnapshot>({ moves: [], algAnchored: false });
  const anchor = useMemo(() => new LiveSmartCubeAnchor({
    solve: async state => {
      const { solve333 } = await import('../_lib/scramble/kociemba/random_state');
      return solve333(state);
    },
    onChange: setSnapshot,
  }), []);
  useEffect(() => {
    anchor.setConnection(connection);
    return () => anchor.setConnection(null);
  }, [anchor, connection]);
  useEffect(() => {
    if (connection) anchor.observeFacelets(facelets);
  }, [anchor, connection, facelets]);
  return { anchor, ...snapshot };
}
