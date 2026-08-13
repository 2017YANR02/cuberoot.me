'use client';

import Link from '@/components/AppLink';
import MoveNotationDemo, { type MoveNotationOption } from '@/components/MoveNotationDemo/MoveNotationDemo';
import { useT } from '@/hooks/useT';
import { formatAlgNotation } from '@/lib/alg-notation-display';
import '../../alg.css';
import './notation.css';

interface DemoMove {
  move: string;
  source?: string;
}

const COMPACT_DEMO_MOVES: DemoMove[] = [
  { move: 'U' },
  { move: 'D' },
  { move: 'L' },
  { move: 'R' },
  { move: 'F' },
  { move: 'B' },
  { move: 'u', source: 'u' },
  { move: 'd', source: 'd' },
  { move: 'l', source: 'l' },
  { move: 'r', source: 'r' },
  { move: 'f', source: 'f' },
  { move: 'b', source: 'b' },
  { move: 'x' },
  { move: 'y' },
  { move: 'z' },
  { move: 'E' },
  { move: 'M' },
  { move: 'S' },
];

const MODE_EXAMPLES = ['R', "U'", 'r', 'F2'];

function compactDemoOptions(): MoveNotationOption[] {
  return COMPACT_DEMO_MOVES.map(({ move, source }) => ({
    move,
    symbol: formatAlgNotation(move, 'zh-compact'),
    caption: source ?? move,
  }));
}

export default function NotationPage() {
  const t = useT();

  return (
    <main className="alg-root alg-notation-page">
      <div className="alg-notation-shell">
        <header className="alg-notation-hero">
          <h1>{t('中文转动记号', 'Chinese move notation')}</h1>
          <Link href="/regulation/notation" className="alg-notation-reference">
            {t('英文记号', 'English notation')}
          </Link>
        </header>

        <section
          className="alg-notation-demo-section"
          aria-label={t('紧凑记号动画', 'Compact notation animation')}
        >
          <MoveNotationDemo puzzle="3x3" moves={compactDemoOptions()} variant="compact" showReplay={false} />
        </section>

        <div className="alg-notation-modes">
          <section aria-labelledby="compact-rule-title">
            <h2 id="compact-rule-title">{t('紧凑', 'Compact')}</h2>
            <p>{t(
              '顺转不加符号，逆转加撇号，180° 加 2。',
              'No suffix for clockwise, a prime for counterclockwise, and 2 for 180°.',
            )}</p>
            <div className="alg-notation-examples">
              {MODE_EXAMPLES.map(alg => (
                <span key={alg}>
                  <code>{alg}</code>
                  <b>→</b>
                  <strong>{formatAlgNotation(alg, 'zh-compact')}</strong>
                </span>
              ))}
            </div>
          </section>

          <section aria-labelledby="foolproof-rule-title">
            <h2 id="foolproof-rule-title">{t('傻瓜', 'Foolproof')}</h2>
            <p>{t(
              '直接写出方向；转体和中层仍用 x、y、z、E、M、S。',
              'Write the direction in full; rotations and slice moves remain x, y, z, E, M, and S.',
            )}</p>
            <div className="alg-notation-long-examples">
              {MODE_EXAMPLES.map(alg => (
                <span key={alg}>
                  <code>{alg}</code>
                  <b>→</b>
                  <strong>{formatAlgNotation(alg, 'dumb')}</strong>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
