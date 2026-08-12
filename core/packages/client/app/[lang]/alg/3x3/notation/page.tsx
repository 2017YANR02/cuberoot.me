'use client';

import { ArrowLeft, Play } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { formatAlgNotation } from '@/lib/alg-notation-display';
import '../../alg.css';
import './notation.css';

interface GuideMove {
  alg: string;
  source?: string;
  zh: string;
  en: string;
}

const FACE_MOVES: GuideMove[] = [
  { alg: 'U', zh: '上面一层', en: 'top layer' },
  { alg: 'D', zh: '下面一层', en: 'bottom layer' },
  { alg: 'L', zh: '左面一层', en: 'left layer' },
  { alg: 'R', zh: '右面一层', en: 'right layer' },
  { alg: 'F', zh: '前面一层', en: 'front layer' },
  { alg: 'B', zh: '后面一层', en: 'back layer' },
];

const WIDE_MOVES: GuideMove[] = [
  { alg: 'u', source: 'u / Uw', zh: '上面两层', en: 'top two layers' },
  { alg: 'd', source: 'd / Dw', zh: '下面两层', en: 'bottom two layers' },
  { alg: 'l', source: 'l / Lw', zh: '左面两层', en: 'left two layers' },
  { alg: 'r', source: 'r / Rw', zh: '右面两层', en: 'right two layers' },
  { alg: 'f', source: 'f / Fw', zh: '前面两层', en: 'front two layers' },
  { alg: 'b', source: 'b / Bw', zh: '后面两层', en: 'back two layers' },
];

const SPECIAL_MOVES: GuideMove[] = [
  { alg: 'x', zh: '绕左右轴转体', en: 'rotate around the left–right axis' },
  { alg: 'y', zh: '绕上下轴转体', en: 'rotate around the up–down axis' },
  { alg: 'z', zh: '绕前后轴转体', en: 'rotate around the front–back axis' },
  { alg: 'E', zh: '上下之间的中层', en: 'slice between U and D' },
  { alg: 'M', zh: '左右之间的中层', en: 'slice between L and R' },
  { alg: 'S', zh: '前后之间的中层', en: 'slice between F and B' },
];

const SUFFIX_EXAMPLES = [
  { alg: 'R', zh: '顺时针 90°', en: 'clockwise 90°' },
  { alg: "R'", zh: '逆时针 90°', en: 'counterclockwise 90°' },
  { alg: 'R2', zh: '180°', en: '180°' },
];

function simHref(alg: string): string {
  return `/sim?puzzle=3&alg=${encodeURIComponent(alg)}`;
}

function MoveRows({ moves }: { moves: GuideMove[] }) {
  const t = useT();
  return (
    <div className="alg-notation-moves">
      {moves.map(move => (
        <Link
          key={move.alg}
          href={simHref(move.alg)}
          prefetch={false}
          className="alg-notation-move"
          aria-label={t(`在模拟器中查看 ${move.alg} 动画`, `Animate ${move.alg} in the simulator`)}
        >
          <code className="alg-notation-source">{move.source ?? move.alg}</code>
          <span className="alg-notation-glyph">{formatAlgNotation(move.alg, 'zh-compact')}</span>
          <span className="alg-notation-scope">{t(move.zh, move.en)}</span>
          <span className="alg-notation-play"><Play size={14} aria-hidden="true" />{t('动画', 'Animate')}</span>
        </Link>
      ))}
    </div>
  );
}

export default function NotationPage() {
  const t = useT();

  return (
    <main className="alg-root alg-notation-page">
      <div className="alg-notation-shell">
        <Link href="/alg/3x3" className="alg-back">
          <ArrowLeft size={15} aria-hidden="true" />
          {t('返回三阶公式库', 'Back to 3×3 algorithms')}
        </Link>

        <header className="alg-notation-hero">
          <p className="alg-notation-kicker">3×3</p>
          <h1>{t('转动记号', 'Move notation')}</h1>
          <p>{t(
            '紧凑模式用一个汉字代替英文面名，2 和撇号的规则不变。点击下面任意一行，即可在模拟器中查看对应动画。',
            'Compact mode replaces each English face letter with one Chinese character while keeping the standard 2 and prime suffixes. Select any row below to animate that move in the simulator.',
          )}</p>
          <div className="alg-notation-wide-line" aria-label={t('双层转动助记字', 'Double-layer move mnemonics')}>
            {'让 吓 佐 佑 剪 垢'.split(' ').map(glyph => <span key={glyph}>{glyph}</span>)}
          </div>
          <p className="alg-notation-wide-note">{t(
            '这六个字里依次藏着上、下、左、右、前、后，专门表示双层转动。',
            'These six characters contain the shapes for up, down, left, right, front, and back, and always mean a double-layer turn.',
          )}</p>
        </header>

        <section className="alg-notation-suffixes" aria-labelledby="notation-suffix-title">
          <div>
            <h2 id="notation-suffix-title">{t('后缀', 'Suffixes')}</h2>
            <p>{t('顺逆以正对该面时为准。', 'Clockwise and counterclockwise are judged while facing that side.')}</p>
          </div>
          <div className="alg-notation-suffix-list">
            {SUFFIX_EXAMPLES.map(example => (
              <Link key={example.alg} href={simHref(example.alg)} prefetch={false}>
                <code>{formatAlgNotation(example.alg, 'zh-compact')}</code>
                <span>{t(example.zh, example.en)}</span>
                <Play size={13} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className="alg-notation-group">
          <h2>{t('单层转动', 'Single-layer turns')}</h2>
          <p>{t('每次只转一面的一层。', 'Turn one outer layer at a time.')}</p>
          <MoveRows moves={FACE_MOVES} />
        </section>

        <section className="alg-notation-group">
          <h2>{t('双层转动', 'Double-layer turns')}</h2>
          <p>{t('u 和 Uw 是同一种转动，其余五个面也一样。', 'u and Uw mean the same move; the other five faces follow the same rule.')}</p>
          <MoveRows moves={WIDE_MOVES} />
        </section>

        <section className="alg-notation-group">
          <h2>{t('转体和中层', 'Rotations and slices')}</h2>
          <p>{t('x、y、z 用天、地、人；E、M、S 用赤、中、经。', 'x, y, and z use 天, 地, and 人; E, M, and S use 赤, 中, and 经.')}</p>
          <MoveRows moves={SPECIAL_MOVES} />
        </section>

        <p className="alg-notation-footnote">{t(
          '傻瓜模式会直接写成“右面顺时针转90度”这类完整描述；本页重点解释紧凑模式。',
          'Foolproof mode writes full descriptions such as “right face clockwise 90 degrees”; this page focuses on compact mode.',
        )}</p>
      </div>
    </main>
  );
}
