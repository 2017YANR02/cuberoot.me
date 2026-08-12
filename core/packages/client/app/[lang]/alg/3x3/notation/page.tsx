'use client';

import { ArrowUpRight } from 'lucide-react';
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
  { move: 'u', source: 'u / Uw' },
  { move: 'd', source: 'd / Dw' },
  { move: 'l', source: 'l / Lw' },
  { move: 'r', source: 'r / Rw' },
  { move: 'f', source: 'f / Fw' },
  { move: 'b', source: 'b / Bw' },
  { move: 'x' },
  { move: 'y' },
  { move: 'z' },
  { move: 'E' },
  { move: 'M' },
  { move: 'S' },
];

const FOOLPROOF_EXAMPLES = ['R', "U'", 'r', 'F2'];
const COMPACT_EXAMPLES = ['R', "U'", 'R2', 'F', "F'", 'r', "u'", 'x', 'M'];

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
          <p className="alg-notation-kicker">3×3</p>
          <h1>{t('中文转动记号', 'Chinese move notation')}</h1>
          <Link href="/regulation/notation" className="alg-notation-reference">
            {t('查看标准英文记号说明', 'Read the standard notation guide')}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </header>

        <section className="alg-notation-demo-section" aria-labelledby="compact-map-title">
          <div className="alg-notation-section-heading">
            <p>COMPACT</p>
            <h2 id="compact-map-title">{t('紧凑记号动图', 'Compact notation animation')}</h2>
            <span>{t(
              '选择右侧记号；动图会从复原状态演示一次。',
              'Choose a symbol; the player shows that move once from the solved state.',
            )}</span>
          </div>
          <MoveNotationDemo puzzle="3x3" moves={compactDemoOptions()} variant="compact" />
        </section>

        <div className="alg-notation-modes">
          <section aria-labelledby="compact-rule-title">
            <p className="alg-notation-mode-label">{t('紧凑', 'Compact')}</p>
            <h2 id="compact-rule-title">{t('保留 2 和撇号', 'Keep 2 and the prime mark')}</h2>
            <p>{t(
              '不写后缀表示顺时针 90°，撇号表示逆时针 90°，2 表示 180°。',
              'No suffix means 90° clockwise, a prime means 90° counterclockwise, and 2 means 180°.',
            )}</p>
            <div className="alg-notation-examples">
              {COMPACT_EXAMPLES.map(alg => (
                <span key={alg}>
                  <code>{alg}</code>
                  <b>→</b>
                  <strong>{formatAlgNotation(alg, 'zh-compact')}</strong>
                </span>
              ))}
            </div>
          </section>

          <section aria-labelledby="foolproof-rule-title">
            <p className="alg-notation-mode-label">{t('傻瓜', 'Foolproof')}</p>
            <h2 id="foolproof-rule-title">{t('把方向完整写出来', 'Write the direction in full')}</h2>
            <p>{t(
              '适合还不熟悉字母和后缀的用户；转体和中层转动仍显示 x、y、z、E、M、S。',
              'This is easier while learning face letters and suffixes. Rotations and slice moves remain x, y, z, E, M, and S.',
            )}</p>
            <div className="alg-notation-long-examples">
              {FOOLPROOF_EXAMPLES.map(alg => (
                <span key={alg}>
                  <code>{alg}</code>
                  <b>→</b>
                  <strong>{formatAlgNotation(alg, 'zh-cstimer')}</strong>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
