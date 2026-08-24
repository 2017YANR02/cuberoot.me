'use client';

import { useParams } from 'next/navigation';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import Link from '@/components/AppLink';
import MoveNotationDemo, { type MoveNotationOption } from '@/components/MoveNotationDemo/MoveNotationDemo';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { useT } from '@/hooks/useT';
import { formatAlgNotation } from '@/lib/alg-notation-display';
import {
  BIG_CUBE_MOVES,
  CUBE_ALL_MOVES,
  FTO_FACE_MOVES,
  FTO_MACRO_MOVES,
  FTO_ROTATION_MOVES,
  FTO_SLICE_MOVES,
  FTO_WIDE_MOVES,
  MEGAMINX_WCA_MOVES,
  PYRAMINX_EXTENSION_MOVES,
  PYRAMINX_WCA_MOVES,
  SKEWB_EXTENSION_MOVES,
  SKEWB_WCA_MOVES,
  SQUARE1_MOVES,
} from '@/lib/move-notation-catalog';
import {
  formatMegaminxMoveDescription,
  formatPyraminxMoveDescription,
  formatSkewbMoveDescription,
  formatSquare1MoveDescription,
} from '@/lib/puzzle-notation-display';
import { eventDisplayName } from '@/lib/wca-events';
import '@/components/NotationGuide/notation-guide.css';

const NOTATION_PUZZLES = ['333', 'minx', 'pyram', 'skewb', 'sq1', 'clock', 'fto'] as const;
type NotationPuzzle = (typeof NOTATION_PUZZLES)[number];

function compactDemoOptions(): MoveNotationOption[] {
  return CUBE_ALL_MOVES.map(move => ({
    move,
    symbol: formatAlgNotation(move, 'zh-compact'),
  }));
}

export default function NotationPage() {
  const t = useT();
  const params = useParams<{ lang: string }>();
  const isZh = params.lang === 'zh';
  const [puzzle, setPuzzle] = useQueryState(
    'puzzle',
    parseAsStringEnum<NotationPuzzle>([...NOTATION_PUZZLES])
      .withDefault('333')
      .withOptions({ history: 'push' }),
  );
  const pickerGroups: readonly PuzzlePickerGroup[] = [
    {
      id: 'wca',
      label: t('WCA 项目', 'WCA events'),
      items: NOTATION_PUZZLES.filter(id => id !== 'fto').map(id => ({
        id,
        label: eventDisplayName(id, isZh),
        iconClass: `event-${id}`,
      })),
    },
    {
      id: 'non-wca',
      label: t('非 WCA 项目', 'Non-WCA puzzles'),
      items: [{
        id: 'fto',
        label: eventDisplayName('fto', isZh),
        iconClass: 'unofficial-fto',
      }],
    },
  ];
  const ftoMoves: MoveNotationOption[] = [
    ...FTO_FACE_MOVES.map(move => ({ move, caption: t('单面', 'Face') })),
    ...FTO_WIDE_MOVES.map(move => ({ move, caption: t('宽层', 'Wide') })),
    ...FTO_SLICE_MOVES.map(move => ({ move, caption: t('中层', 'Slice') })),
    ...FTO_ROTATION_MOVES.map(move => ({ move, caption: t('转体', 'Rotation') })),
    ...FTO_MACRO_MOVES.map(move => ({ move, caption: t('组合动作', 'Macro') })),
  ];

  return (
    <main className="notation-page">
      <div className="alg-notation-shell notation-shell">
        <header className="alg-notation-hero">
          <h1>{t('转动记号', 'Move notation')}</h1>
          <Link href="/regulation/notation" className="alg-notation-reference">
            {t('查看 WCA 规则记号', 'View WCA regulation notation')}
          </Link>
        </header>

        <p className="alg-fto-notation-intro">
          {t(
            '这里集中收录 WCA 正式记号、本站公式系统支持的常用扩展，以及非 WCA 魔方记号。每节都会标明范围；动画、选择器和播放逻辑全部复用公式页的统一播放器。',
            'This guide combines official WCA notation, common extensions supported by the algorithm system, and notation for non-WCA puzzles. Each section states its scope and reuses the same player as algorithm pages.',
          )}
        </p>

        <nav className="notation-project-picker" aria-label={t('选择魔方项目', 'Choose a puzzle')}>
          <span>{t('项目', 'Puzzle')}</span>
          <PuzzlePicker
            isZh={isZh}
            selectedEvent={puzzle}
            groups={pickerGroups}
            onSelect={id => void setPuzzle(id as NotationPuzzle)}
          />
        </nav>

        {puzzle === '333' && <section id="cube" className="notation-catalog-section" aria-labelledby="cube-title">
          <div className="notation-section-heading">
            <h2 id="cube-title">3×3 / NxN</h2>
            <span>{t('WCA + 常用扩展', 'WCA + common extensions')}</span>
          </div>
          <p className="notation-section-copy">
            {t(
              "包含面转、宽层、夹层 E/M/S、整体转体 x/y/z，以及本站支持的 2'、3、3' 重复次数写法。三阶中的 3 和 3' 只用于 L 与 R。",
              "Includes face, wide and E/M/S slice moves, x/y/z rotations, plus the supported 2', 3 and 3' repeat forms. On 3×3, 3 and 3' are listed only for L and R.",
            )}
          </p>
          <div className="alg-notation-demo-section">
            <MoveNotationDemo puzzle="3x3" moves={compactDemoOptions()} variant="compact" />
          </div>

          <h3 className="notation-subheading">{t('大方块扩展', 'Big-cube extensions')}</h3>
          <p className="notation-section-copy">
            {t(
              "WCA 用 nXw 表示从某面起外侧 n 层一起转；完整公式系统还支持 2R 这类单独内层以及 2' 后缀。",
              "WCA uses nXw for the outer n layers from a face; the full algorithm system also supports single inner layers such as 2R and the 2' suffix.",
            )}
          </p>
          <MoveNotationDemo puzzle="4x4" moves={BIG_CUBE_MOVES.map(move => ({ move }))} variant="compact" />
        </section>}

        {puzzle === 'minx' && <section id="megaminx" className="notation-catalog-section" aria-labelledby="megaminx-title">
          <div className="notation-section-heading">
            <h2 id="megaminx-title">{t('五魔方', 'Megaminx')}</h2>
            <span>{t('WCA 正式记号', 'Official WCA notation')}</span>
          </div>
          <p className="notation-section-copy">{t('R 与 D 用双加号或双减号转两格，U 用原记号转一格。', 'R and D use double plus or minus for two notches; U uses the ordinary one-notch form.')}</p>
          <MoveNotationDemo puzzle="megaminx" moves={MEGAMINX_WCA_MOVES.map(move => ({ move, caption: formatMegaminxMoveDescription(move, t) }))} variant="compact" />
        </section>}

        {puzzle === 'pyram' && <section id="pyraminx" className="notation-catalog-section" aria-labelledby="pyraminx-title">
          <div className="notation-section-heading">
            <h2 id="pyraminx-title">{t('金字塔', 'Pyraminx')}</h2>
            <span>{t('WCA + 播放器扩展', 'WCA + player extensions')}</span>
          </div>
          <p className="notation-section-copy">{t('大写和小写是 WCA 记号；宽层与转体是本站播放器支持的常用扩展。', 'Capital and lowercase moves are WCA notation; wide moves and rotations are common extensions supported by the player.')}</p>
          <MoveNotationDemo puzzle="pyraminx" moves={[...PYRAMINX_WCA_MOVES, ...PYRAMINX_EXTENSION_MOVES].map(move => ({ move, caption: formatPyraminxMoveDescription(move, t) }))} variant="compact" />
        </section>}

        {puzzle === 'skewb' && <section id="skewb" className="notation-catalog-section" aria-labelledby="skewb-title">
          <div className="notation-section-heading">
            <h2 id="skewb-title">{t('斜转', 'Skewb')}</h2>
            <span>{t('WCA + 播放器扩展', 'WCA + player extensions')}</span>
          </div>
          <p className="notation-section-copy">{t('R、U、L、B 是 WCA 记号；其它握法和 x/y/z 转体是本站公式引擎扩展。', 'R, U, L and B are WCA notation; other grips and x/y/z rotations are algorithm-engine extensions.')}</p>
          <MoveNotationDemo puzzle="skewb" moves={[...SKEWB_WCA_MOVES, ...SKEWB_EXTENSION_MOVES].map(move => ({ move, caption: formatSkewbMoveDescription(move, t) }))} variant="compact" />
        </section>}

        {puzzle === 'sq1' && <section id="square1" className="notation-catalog-section" aria-labelledby="square1-title">
          <div className="notation-section-heading">
            <h2 id="square1-title">Square-1</h2>
            <span>{t('WCA 正式记号', 'Official WCA notation')}</span>
          </div>
          <p className="notation-section-copy">{t('数对表示上下层各转多少个 30 度单位，斜线表示右半部翻转 180 度。', 'A pair counts 30-degree units on the top and bottom layers; a slash flips the right half by 180 degrees.')}</p>
          <MoveNotationDemo puzzle="sq1" moves={SQUARE1_MOVES.map(move => ({ move, caption: formatSquare1MoveDescription(move, t) }))} variant="compact" />
        </section>}

        {puzzle === 'clock' && <section id="clock" className="notation-catalog-section" aria-labelledby="clock-title">
          <div className="notation-section-heading">
            <h2 id="clock-title">{t('魔表', 'Clock')}</h2>
            <span>{t('WCA 正式记号', 'Official WCA notation')}</span>
          </div>
          <p className="notation-section-copy">{t('先写拨起的针，再用 X+ 或 X- 写表盘转动小时数；y2 表示翻到背面。', 'Name the raised pins, then use X+ or X- for dial hours; y2 flips to the back face.')}</p>
          <div className="alg-fto-notation-codes notation-clock-codes">
            {['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL', 'X+', 'X-', 'y2'].map(move => <code key={move}>{move}</code>)}
          </div>
        </section>}

        {puzzle === 'fto' && <section id="fto" className="notation-catalog-section" aria-labelledby="fto-title">
          <div className="notation-section-heading">
            <h2 id="fto-title">FTO</h2>
            <span>{t('非 WCA：EIF 记号', 'Non-WCA: EIF notation')}</span>
          </div>
          <p className="notation-section-copy">
            {t('收录单面、宽层、中层、面轴转体、顶点轴转体，以及 S/H 组合动作。', 'Includes face, wide and slice turns, face-axis and vertex-axis rotations, plus S/H macros.')}{' '}
            <Link href="/alg/fto/notation" prefetch={false}>{t('查看 FTO 详细说明', 'Read the detailed FTO guide')}</Link>
          </p>
          <MoveNotationDemo puzzle="fto" moves={ftoMoves} variant="compact" />
        </section>}
      </div>
    </main>
  );
}
