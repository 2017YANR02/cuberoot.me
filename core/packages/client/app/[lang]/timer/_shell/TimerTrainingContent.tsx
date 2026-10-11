'use client';

import { lazy, Suspense } from 'react';
import type { TrainingTarget } from '@/lib/timer-training-catalog';
import { ClientLoadStatus } from '@/components/StartupStatus';
import { TimerRuntimeBoundary } from '../_components/TimerBootstrap';
import { tr } from '@/i18n/tr';

// These are the existing clients, not parallel implementations of the trainers.
const Run = lazy(() => import('../../alg/[puzzle]/[set]/run/TrainerRunClient'));
const Select = lazy(() => import('../../alg/[puzzle]/[set]/select/TrainerSetClient'));
const Library = lazy(() => import('../../alg/[puzzle]/AlgPuzzleClient'));
const Set = lazy(() => import('../../alg/[puzzle]/[set]/AlgSetClient'));
const Case = lazy(() => import('../../alg/[puzzle]/[set]/[subgroup]/AlgSubOrCaseClient'));
const Simple = lazy(() => import('../../alg/[puzzle]/[set]/simple/SimpleAlgSetClient'));
const Lsll = lazy(() => import('../../alg/lsll/page'));
const LsllGroup = lazy(() => import('../../alg/lsll/[group]/LsllGroupClient'));
const LsllCase = lazy(() => import('../../alg/lsll/case/LsllCaseClient'));
const LsllRoute = lazy(() => import('../../alg/lsll/route/LsllRouteClient'));
const Progress = lazy(() => import('../../alg/progress/page'));
const ProgressCases = lazy(() => import('../../alg/progress/cases/page'));
const CaseOrder = lazy(() => import('../../alg/time-attack/page'));
const Legacy = lazy(() => import('@/components/IframePage'));
const Specialized = lazy(() => import('./TimerSpecializedTrainingContent'));

function TrainingSurface({ target }: { target: TrainingTarget }) {
  switch (target.kind) {
    case 'alg-run': return <Run />;
    case 'alg-select': return <Select />;
    case 'alg-library': return <Library />;
    case 'alg-set': return <Set />;
    case 'alg-case': return <Case />;
    case 'alg-simple': return <Simple />;
    case 'lsll': return <Lsll />;
    case 'lsll-group': return <LsllGroup />;
    case 'lsll-case': return <LsllCase />;
    case 'lsll-route': return <LsllRoute />;
    case 'progress': return <Progress />;
    case 'progress-cases': return <ProgressCases />;
    case 'time-attack': return <CaseOrder />;
    case 'legacy': return <Legacy src={target.params.src} title={tr(target.title)} trainingGroup={target.params.trainingGroup} syncDocumentTitle={false} />;
    default: return <Specialized target={target} />;
  }
}

export default function TimerTrainingContent({ target }: { target: TrainingTarget }) {
  return (
    <TimerRuntimeBoundary key={target.path} onRetry={() => window.location.reload()}>
      <Suspense fallback={<ClientLoadStatus />}>
        <TrainingSurface target={target} />
      </Suspense>
    </TimerRuntimeBoundary>
  );
}
