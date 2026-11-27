import type { ReactNode } from 'react';
import { Check } from '@app-foundation/icons/lucide';
import type { SimLogState } from '@cuberoot/shared/timer/sim-log';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { LBL_INITIAL_VIEW } from '../content';

const phases = [
  { id: 'prepare', label: { zh: '准备', en: 'Prepare' } },
  { id: 'practice', label: { zh: '练习', en: 'Practice' } },
  { id: 'complete', label: { zh: '完成', en: 'Complete' } },
] as const;

export function PracticeWorkspace({ phase, visual, actions, tools, children }: {
  phase: (typeof phases)[number]['id'];
  visual: ReactNode;
  actions?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
}) {
  const current = phases.findIndex(step => step.id === phase);
  return <section className="lbl-smart-workspace" data-site-surface="panel" data-phase={phase} data-virtual={Boolean(tools)}>
    <ol className="lbl-smart-progress" aria-label={tr({ zh: '练习进度', en: 'Practice progress' })}>
      {phases.map((step, index) => <li key={step.id} aria-current={index === current ? 'step' : undefined}
        data-status={index < current || phase === 'complete' ? 'complete' : index === current ? 'current' : 'pending'}>
        <span className="lbl-smart-progress-mark" aria-hidden="true">{(index < current || phase === 'complete') && <Check size={11} strokeWidth={3} />}</span>
        {tr(step.label)}
      </li>)}
    </ol>
    <div className="lbl-smart-flow">
      <div className="lbl-smart-visual">{visual}</div>
      <div className="lbl-smart-instruction">
        <div className="lbl-smart-copy">{children}</div>
        {actions && <div className="lbl-smart-actions">{actions}</div>}
      </div>
    </div>
    {tools}
  </section>;
}

export function PracticeCube({ position, liveOrientation, moveHint, recovery, fixedView, moveHintStyle }: {
  position?: SimLogState;
  liveOrientation?: { current: Quat | null };
  moveHint?: string;
  moveHintStyle?: 'orbit';
  recovery?: boolean;
  fixedView?: boolean;
}) {
  if (!position) return <span className="lbl-smart-sync" role="status"><T zh="正在同步魔方状态…" en="Syncing cube state…" /></span>;
  return <AlgPlayer puzzle="3x3" engine="sim" set="" alg="" controlMode="none" sceneRot={LBL_INITIAL_VIEW}
    livePosition={position} liveOrientation={liveOrientation} interactionMode={fixedView ? 'none' : 'view'} moveHint={moveHint}
    moveHintRecovery={recovery} moveHintStyle={moveHintStyle} fillPane hideResetView />;
}
