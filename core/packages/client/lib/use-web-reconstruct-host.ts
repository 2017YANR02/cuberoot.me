import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import BoolToggle from '@/components/BoolToggle';
import ReconCaseLink from '@/components/ReconCaseLink';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { reconInspectionOrientations, reconWasteBrackets } from '@/lib/recon-alg-utils';
import { createElement, Fragment } from 'react';
import dynamic from 'next/dynamic';
import { useIsAdmin } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';
import { useSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';
import { encodeReplayUrl } from '@/app/[lang]/timer/_lib/share/encode';
import { createServerReplayShare } from '@/app/[lang]/timer/_lib/share/server';

const ReconIntakeAction = dynamic(() => import('@/components/recon/ReconIntakeAction'), { ssr: false });
const ReconCaptureAction = dynamic(() => import('@/components/recon/ReconCaptureAction'), { ssr: false });

/** Website-only host capabilities for both full details and the inline recap. */
export function useWebReconstructHost(): ReconstructHost {
  const settings = useSettings();
  const admin = useIsAdmin();
  const host: ReconstructHost = {
    localize: tr,
    LineDiagramProvider: ReconLineDiagramProvider,
    renderScrambleDiagram: scramble => createElement(ScramblePreview2D, { event: '333', scramble, size: 14, enlargeable: true }),
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
  if (admin) {
    host.renderIntakeAction = (solve, snapshot) =>
      createElement(Fragment, null, createElement(ReconIntakeAction, { solve, snapshot, host }),
        createElement(ReconCaptureAction, { solve }));
  }
  return host;
}
