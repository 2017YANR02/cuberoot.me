'use client';

import { lazy } from 'react';
import type { TrainingTarget } from '@/lib/timer-training-catalog';
import type { Sq1Tool } from '@/components/Sq1ToolsClient';

// Load the existing client surfaces only. Their server route wrappers keep
// owning metadata/SSG for the standalone pages and never enter this bundle.
const Cross = lazy(() => import('../../alg/3x3/cross/CrossTrainingClient'));
// This client wrapper retains Roux's ssr:false boundary for localStorage init.
const Roux = lazy(() => import('../../alg/roux/page'));
const Skewb = lazy(() => import('../../alg/skewb-trainer/page'));
const BldHub = lazy(() => import('../../alg/3bld/_components/Bld3Hub').then(module => ({ default: module.Bld3Hub })));
const BldCode = lazy(() => import('../../alg/3bld/_components/CodeTrainer').then(module => ({ default: module.CodeTrainer })));
const BldFloat = lazy(() => import('../../alg/3bld/_components/FloatTrainer').then(module => ({ default: module.FloatTrainer })));
const BldTwoTwo = lazy(() => import('../../alg/3bld/_components/TwoTwoTrainer').then(module => ({ default: module.TwoTwoTrainer })));
const BLD_PAGES = {
  parity: lazy(() => import('../../alg/3bld/parity/page')),
  flip: lazy(() => import('../../alg/3bld/flip/page')),
  twist: lazy(() => import('../../alg/3bld/twist/page')),
  ltct: lazy(() => import('../../alg/3bld/ltct/page')),
  memo: lazy(() => import('../../alg/3bld/memo/page')),
  timer: lazy(() => import('../../alg/3bld/timer/page')),
  helper: lazy(() => import('../../alg/3bld/helper/page')),
  lookup: lazy(() => import('../../alg/3bld/lookup/page')),
  comm: lazy(() => import('../../alg/3bld/comm/page')),
  tables: lazy(() => import('../../alg/3bld/tables/page')),
  sheets: lazy(() => import('../../alg/3bld/sheets/page')),
  resources: lazy(() => import('../../alg/3bld/resources/page')),
  readme: lazy(() => import('../../alg/3bld/readme/page')),
};
const Sq1Tools = lazy(() => import('@/components/Sq1ToolsClient'));
const Sq1Notation = lazy(() => import('../../alg/sq1/karnaukh-notation/page'));
const Recognize = lazy(() => import('@/components/RecognizeTrainer'));
const RecognitionGuide = lazy(() => import('../../recognize/[algSetId]/guide/RecognitionGuideClient'));
const Sq1ShapeTraining = lazy(() => import('../../sq1/cs/name/train/Sq1ShapeNameTrainerClient'));
const Sq1ShapeGuide = lazy(() => import('../../sq1/cs/name/Sq1ShapeGuideClient'));
const Predict = lazy(() => import('../../predict/page'));
const Notation = lazy(() => import('../../notation/page'));
const ColorPositions = lazy(() => import('../../color-test/positions/page'));
const ColorRelations = lazy(() => import('../../color-test/relations/page'));

function BldTraining({ tool }: { tool: string }) {
  switch (tool) {
    case '': return <BldHub />;
    case 'edge': return <BldCode pieceType="edge" />;
    case 'corner': return <BldCode pieceType="corner" />;
    case 'edge-float': return <BldFloat piece="edge" />;
    case 'corner-float': return <BldFloat piece="corner" />;
    case '2e2e': return <BldTwoTwo piece="edge" />;
    case '2c2c': return <BldTwoTwo piece="corner" />;
    default: {
      if (!Object.hasOwn(BLD_PAGES, tool)) return null;
      const Page = BLD_PAGES[tool as keyof typeof BLD_PAGES];
      return <Page />;
    }
  }
}

/** Suspense and the error boundary are supplied by TimerTrainingContent. */
export default function TimerSpecializedTrainingContent({ target }: { target: TrainingTarget }) {
  switch (target.kind) {
    case 'cross': return <Cross />;
    case 'roux': return <Roux />;
    case 'skewb': return <Skewb />;
    case 'bld': return <BldTraining tool={target.params.tool} />;
    case 'sq1-tool': return target.params.tool === 'karnaukh-notation'
      ? <Sq1Notation />
      : <Sq1Tools tool={target.params.tool as Sq1Tool} />;
    case 'recognize': return target.params.algSetId === 'sq1-shape'
      ? <Sq1ShapeTraining />
      : <Recognize algSetId={target.params.algSetId} />;
    case 'recognize-guide': return <RecognitionGuide />;
    case 'sq1-shape-guide': return <Sq1ShapeGuide />;
    case 'predict': return <Predict />;
    case 'notation': return <Notation />;
    case 'color-positions': return <ColorPositions />;
    case 'color-relations': return <ColorRelations />;
    default: return null;
  }
}
