'use client';

import Link from '@/components/AppLink';
import MoveNotationDemo, { type MoveNotationOption } from '@/components/MoveNotationDemo/MoveNotationDemo';
import { useT } from '@/hooks/useT';
import { formatAlgNotation } from '@/lib/alg-notation-display';
import { CUBE_ALL_MOVES } from '@/lib/move-notation-catalog';
import '../../alg.css';
import '../../notation-guide.css';

const MODE_EXAMPLES = ['R', "U'", 'Rw', 'F2', "U2'", 'R3', "R3'", 'x', 'E'];

function compactDemoOptions(): MoveNotationOption[] {
  return CUBE_ALL_MOVES.map(move => ({
    move,
    symbol: formatAlgNotation(move, 'zh-compact'),
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
          <MoveNotationDemo puzzle="3x3" moves={compactDemoOptions()} variant="compact" />
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
              '直接写出面、层、方向和角度；面转、宽层、中层与整体转体使用同一套说明。',
              'Write the face, layer, direction, and angle in full; face, wide, slice, and rotation moves use one description system.',
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
