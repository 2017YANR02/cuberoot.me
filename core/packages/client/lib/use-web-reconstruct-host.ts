import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import ReconCaseLink from '@/components/ReconCaseLink';
import { ReconLineDiagramProvider } from '@/components/ReconLineDiagrams';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { reconInspectionOrientations, reconWasteBrackets } from '@/lib/recon-alg-utils';
import { createElement, Fragment, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { installedCommunityDisabled, useInstalledCommunityDisabled, useInstalledGenerativeAiDisabled } from '@/lib/installed-content';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { canUseAssistant } from '@/lib/assistant-auth-continuation';
import { ASSISTANT_PAGE_DRAFT_EVENT, assistantOwner, type AssistantPageDraft } from '@/lib/assistant-conversations';
import { formatReplayAssistantDraft } from '@/lib/assistant-replay-draft';
import { loadLibrarySource } from '@/lib/alg-library-cache';
import { tr } from '@/i18n/tr';
import { useSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';
import { encodeReplayUrl } from '@/app/[lang]/timer/_lib/share/encode';
import { createServerReplayShare } from '@/app/[lang]/timer/_lib/share/server';

const ReconIntakeAction = dynamic(() => import('@/components/recon/ReconIntakeAction'), { ssr: false });
const ReconCaptureAction = dynamic(() => import('@/components/recon/ReconCaptureAction'), { ssr: false });
const ReplayFormulaTraining = dynamic(() => import('@/components/ReplayFormulaTraining'), { ssr: false });

const prepareAssistantFormula: NonNullable<ReconstructHost['prepareAssistantFormula']> = set => {
  // The component reads the same public library cache. Start both requests
  // together so waiting for the card chunk never delays the library request.
  void loadLibrarySource('3x3', set).catch(() => {});
  void import('@/components/ReplayFormulaTraining').catch(() => {});
};

/** Website-only host capabilities for both full details and the inline recap. */
export function useWebReconstructHost(): ReconstructHost {
  const communityDisabled = useInstalledCommunityDisabled();
  const aiDisabled = useInstalledGenerativeAiDisabled();
  const douyin = useDouyinToolSurface();
  const user = useAuthUser();
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
    replayUrl: communityDisabled ? undefined : async (solve) => {
      if (installedCommunityDisabled()) return null;
      const id = await createServerReplayShare(solve);
      if (installedCommunityDisabled()) return null;
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
  if (!aiDisabled && !douyin && canUseAssistant(user)) {
    host.prepareAssistantFormula = prepareAssistantFormula;
    host.renderAssistantFormula = (target, focus, fallback) =>
      createElement(ReplayFormulaTraining, { ...target, focus, fallback, key: `${target.set}/${target.caseName}/${focus}` });
    host.renderAssistantTrainingLink = (href, label) => createElement(AppLink, {
      href, prefetch: false, target: '_blank', rel: 'noopener noreferrer', className: 'rc-action',
    }, label);
    host.renderAssistantAction = (summary, followUp) => createElement('div', { className: 'rc-actions', 'data-no-timer': true },
      createElement('button', {
        type: 'button',
        className: 'rc-action rc-action--ghost',
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          window.dispatchEvent(new CustomEvent<AssistantPageDraft>(ASSISTANT_PAGE_DRAFT_EVENT, {
            detail: { owner: assistantOwner(user), draft: formatReplayAssistantDraft(summary, tr), trigger: event.currentTarget },
          }));
        },
      }, tr(followUp ? { zh: '在 Agent 里追问', en: 'Ask Agent a follow-up' }
        : { zh: '用 Agent 分析这局', en: 'Analyze this solve with Agent' })));
  }
  if (admin) {
    host.renderIntakeAction = (solve, snapshot) =>
      createElement(Fragment, null, createElement(ReconIntakeAction, { solve, snapshot, host }),
        createElement(ReconCaptureAction, { solve }));
  }
  return host;
}
