'use client';

import dynamic from 'next/dynamic';
import { ExternalLink } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import { faceShowingColor, orientedFaceColors } from '@/lib/cube-orientation';
import { parseForumSimLink } from '@/lib/forum-sim-link';

const AlgPlayer = dynamic(() => import('@/components/AlgPlayer/AlgPlayer'), { ssr: false });

export default function ForumSimEmbed({ href }: { href: string }) {
  const sim = parseForumSimLink(href);
  if (!sim) return null;

  const bottomFace = faceShowingColor(orientedFaceColors(sim.orientation), 'D');
  const stage = sim.stickering === 'Cross'
    ? tr({ zh: `Cross ${CUBE_COLOR_NAMES[bottomFace].zh}底`, en: `Cross ${CUBE_COLOR_NAMES[bottomFace].en} base` })
    : sim.stickering;

  return (
    <div className="forum-sim-embed">
      <div className="forum-sim-embed-head">
        <strong>{sim.puzzleOrder}×{sim.puzzleOrder} {stage !== 'full' && stage}</strong>
        <AppLink href={sim.href} prefetch={false}>
          {tr({ zh: '在模拟中打开', en: 'Open in simulator' })}
          <ExternalLink size={14} aria-hidden />
        </AppLink>
      </div>
      <div className="forum-sim-embed-main">
        <div className="forum-sim-embed-player">
          <AlgPlayer
            alg={sim.alg}
            puzzle={sim.puzzle}
            puzzleOrder={sim.puzzleOrder}
            set={sim.stickering}
            setup={sim.setup}
            orientation={sim.orientation}
            size={240}
            controlMode="full"
            interactionMode="view"
          />
        </div>
        {(sim.setup || sim.alg) && (
          <dl className="forum-sim-embed-formulas">
            {sim.setup && <><dt>{tr({ zh: '打乱', en: 'Setup' })}</dt><dd><code>{sim.setup}</code></dd></>}
            {sim.alg && <><dt>{tr({ zh: '公式', en: 'Algorithm' })}</dt><dd><code>{sim.alg}</code></dd></>}
          </dl>
        )}
      </div>
    </div>
  );
}
