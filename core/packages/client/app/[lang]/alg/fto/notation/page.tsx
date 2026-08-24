'use client';

import Link from '@/components/AppLink';
import MoveNotationDemo, { type MoveNotationOption } from '@/components/MoveNotationDemo/MoveNotationDemo';
import { useT } from '@/hooks/useT';
import { FTO_EIF_ACTION_SEQUENCES } from '@/lib/fto-eif-image';
import {
  FTO_FACE_MOVES,
  FTO_FACE_ROOTS,
  FTO_MACRO_MOVES,
  FTO_ROTATION_MOVES,
  FTO_FACE_ROTATION_ROOTS,
  FTO_SLICE_MOVES,
  FTO_SLICE_ROOTS,
  FTO_VERTEX_ROTATION_ROOTS,
  FTO_WIDE_MOVES,
  FTO_WIDE_ROOTS,
} from '@/lib/move-notation-catalog';
import '../../alg.css';
import '@/components/NotationGuide/notation-guide.css';

export default function FtoNotationPage() {
  const t = useT();
  const options: MoveNotationOption[] = [
    ...FTO_FACE_MOVES.map(move => ({ move, caption: t('单面', 'Face') })),
    ...FTO_WIDE_MOVES.map(move => ({ move, caption: t('宽层', 'Wide') })),
    ...FTO_SLICE_MOVES.map(move => ({ move, caption: t('中层', 'Slice') })),
    ...FTO_ROTATION_MOVES.map(move => ({ move, caption: t('转体', 'Rotation') })),
    ...FTO_MACRO_MOVES.map(move => ({ move, caption: t('公式', 'Macro') })),
  ];

  return (
    <main className="alg-root alg-notation-page">
      <div className="alg-notation-shell alg-fto-notation-shell">
        <header className="alg-notation-hero">
          <h1>{t('FTO 转动记号', 'FTO move notation')}</h1>
          <Link href="/alg/fto" className="alg-notation-reference" prefetch={false}>
            {t('返回 FTO 公式库', 'Back to FTO algorithms')}
          </Link>
        </header>

        <p className="alg-fto-notation-intro">
          {t(
            '这里使用 LowCubes 的 EIF 记号。点击任意记号即可从还原状态播放真实分层动画，也可以拖动画面查看另一侧。',
            'This guide uses LowCubes EIF notation. Select any move to play its real layer animation from solved, and drag the puzzle to inspect another side.',
          )}
        </p>

        <section className="alg-notation-demo-section" aria-label={t('FTO 记号动画', 'FTO notation animation')}>
          <MoveNotationDemo puzzle="fto" moves={options} variant="compact" />
        </section>

        <div className="alg-fto-notation-rules">
          <section aria-labelledby="fto-suffix-title">
            <h2 id="fto-suffix-title">{t('方向和后缀', 'Direction and suffixes')}</h2>
            <p>{t(
              '不加后缀表示从该面正对着看顺时针转 120°；撇号表示反向转。面层、宽层和中层的 2 表示连续转两次 120°。',
              'No suffix means a 120° clockwise turn as viewed straight at that face; a prime reverses it. On face, wide and slice moves, 2 means two successive 120° turns.',
            )}</p>
            <div className="alg-fto-notation-codes"><code>U</code><code>U&apos;</code><code>U2</code></div>
          </section>

          <section aria-labelledby="fto-face-title">
            <h2 id="fto-face-title">{t('单面转动', 'Face turns')}</h2>
            <p>{t(
              'U、F、R、L、D、Bl、Br、B 分别转动一个三角面。Bl 和 Br 是左后面与右后面。',
              'U, F, R, L, D, Bl, Br and B turn one triangular face. Bl and Br are the back-left and back-right faces.',
            )}</p>
            <div className="alg-fto-notation-codes">{FTO_FACE_ROOTS.map(move => <code key={move}>{move}</code>)}</div>
          </section>

          <section aria-labelledby="fto-wide-title">
            <h2 id="fto-wide-title">{t('宽层和中层', 'Wide and slice turns')}</h2>
            <p>{t(
              'w 表示该面连同相邻中层一起转；s 表示只转对应的中层。它们是同时转动的层，不是为了画图临时拼出来的多步。',
              'w turns the face and its adjacent middle layer together; s turns only the corresponding middle layer. These are simultaneous layers, not a visual approximation made from separate moves.',
            )}</p>
            <div className="alg-fto-notation-codes">{[...FTO_WIDE_ROOTS, ...FTO_SLICE_ROOTS].map(move => <code key={move}>{move}</code>)}</div>
          </section>

          <section aria-labelledby="fto-rotation-title">
            <h2 id="fto-rotation-title">{t('整体转体', 'Whole-puzzle rotations')}</h2>
            <p>{t(
              'Uo、Fo、Ro、Lo 围绕对应面的轴转 120°。Rt、Lt、Ft 围绕对应顶点的轴转 90°，撇号反向，2 表示 180°。',
              'Uo, Fo, Ro and Lo rotate 120° around the corresponding face axis. Rt, Lt and Ft rotate 90° around the corresponding vertex axis; a prime reverses it and 2 means 180°.',
            )}</p>
            <div className="alg-fto-notation-codes">{[...FTO_FACE_ROTATION_ROOTS, ...FTO_VERTEX_ROTATION_ROOTS].map(move => <code key={move}>{move}</code>)}</div>
          </section>

          <section className="alg-fto-macro-rule" aria-labelledby="fto-macro-title">
            <h2 id="fto-macro-title">{t('组合记号', 'Macros')}</h2>
            <p>{t(
              'S 和 H 是 Bencisco 公式里常用的组合动作。播放器会把内部每一步都完整转出来，因此能看清手法，而不是直接跳到最终状态。',
              'S and H are common macros in Bencisco algorithms. The player animates every internal turn so the execution is visible instead of jumping straight to the final state.',
            )}</p>
            <dl className="alg-fto-macro-list">
              <div><dt><code>S</code></dt><dd><code>{FTO_EIF_ACTION_SEQUENCES.S.join(' ')}</code></dd></div>
              <div><dt><code>S&apos;</code></dt><dd><code>{FTO_EIF_ACTION_SEQUENCES["S'"].join(' ')}</code></dd></div>
              <div><dt><code>H</code></dt><dd><code>{FTO_EIF_ACTION_SEQUENCES.H.join(' ')}</code></dd></div>
              <div><dt><code>H&apos;</code></dt><dd><code>{FTO_EIF_ACTION_SEQUENCES["H'"].join(' ')}</code></dd></div>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
