import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import BoolToggle from '@/components/BoolToggle';
import ReconCaseLink from '@/components/ReconCaseLink';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import { reconInspectionOrientations, reconWasteBrackets } from '@/lib/recon-alg-utils';
import { createElement } from 'react';
import { tr } from '@/i18n/tr';
import { useSettings, updateSettings } from '../_lib/settings';
import { encodeReplayUrl } from '../_lib/share/encode';
import { createServerReplayShare } from '../_lib/share/server';

/** Website-only host capabilities for both full details and the inline recap. */
export function useWebReconstructHost(): ReconstructHost {
  const settings = useSettings();
  return {
    localize: tr,
    LineDiagramProvider: ReconLineDiagramProvider,
    inspectionColors: moves => reconInspectionOrientations(`${moves} // insp`)[0]?.colors,
    wasteBrackets: reconWasteBrackets,
    // Keep the timer mounted so visiting a case does not dispose its Bluetooth session.
    renderCaseLink: (href, label, className) => createElement(ReconCaseLink, { href, className, children: label }),
    writeClipboardText: (text) => navigator.clipboard.writeText(text),
    replayUrl: async (solve) => {
      const id = await createServerReplayShare(solve);
      if (!id) return encodeReplayUrl(solve);
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('share', id);
      return url.toString();
    },
    recordGyro: settings.recordGyro,
    onEnableGyro: () => updateSettings({ recordGyro: true }),
    BoolToggle,
  };
}
