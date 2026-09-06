'use client';

import { ArrowUpRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import HeaderToggles from '@/components/HeaderToggles';
import { tr } from '@/i18n/tr';
import { CUBE_COLOR_LETTER_FOR_FACE, CUBE_COLOR_NAMES, CUBE_FILL, CUBE_ON_FILL } from '@/lib/cube-colors';
import './color-test.css';

const TESTS = [
  {
    id: 'relations',
    href: '/color-test/relations',
    title: { zh: '对色与邻色', en: 'Opposite or Adjacent?' },
    description: {
      zh: '看两个颜色,判断它们在标准三阶魔方上是对色还是邻色。',
      en: 'Look at two colours and decide whether their faces are opposite or adjacent on a standard 3×3.',
    },
  },
  {
    id: 'positions',
    href: '/color-test/positions',
    title: { zh: '颜色位置关系', en: 'Colour Positions' },
    description: {
      zh: '选择顶面颜色,判断四个侧面的左右顺序和对色。',
      en: 'Choose the top colour, then recall each side face\'s left, right and opposite colours.',
    },
  },
  {
    id: 'stroop',
    href: '/stroop',
    title: { zh: 'Stroop 色词干扰', en: 'Stroop Interference' },
    description: {
      zh: '报出文字的墨色,不要读字本身,用计时测出色词干扰量。',
      en: 'Name each word\'s ink colour instead of reading it, then time the interference.',
    },
  },
] as const;

function TestPreview({ id }: { id: (typeof TESTS)[number]['id'] }) {
  if (id === 'relations') {
    return (
      <div className="color-test-pair-preview" aria-hidden="true">
        <span style={{ background: CUBE_FILL.R, color: CUBE_ON_FILL.R }}>{tr({ zh: '红', en: 'R' })}</span>
        <b>?</b>
        <span style={{ background: CUBE_FILL.L, color: CUBE_ON_FILL.L }}>{tr({ zh: '橙', en: 'O' })}</span>
      </div>
    );
  }
  if (id === 'positions') {
    return (
      <div className="color-test-position-preview" aria-hidden="true">
        {(['R', 'F', 'L', 'B'] as const).map((face) => (
          <span key={face} style={{ background: CUBE_FILL[face], color: CUBE_ON_FILL[face] }}>
            {tr({ zh: CUBE_COLOR_NAMES[face].zh, en: CUBE_COLOR_LETTER_FOR_FACE[face] })}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="color-test-stroop-preview" aria-hidden="true">
      <span style={{ color: CUBE_FILL.R }}>{tr({ zh: '蓝', en: 'BLUE' })}</span>
      <span style={{ color: CUBE_FILL.B }}>{tr({ zh: '绿', en: 'GREEN' })}</span>
      <span style={{ color: CUBE_FILL.F }}>{tr({ zh: '红', en: 'RED' })}</span>
    </div>
  );
}

export default function ColorTestPage() {
  return (
    <main className="color-test-page">
      <div className="color-test-topbar">
        <BackHome />
        <HeaderToggles />
      </div>

      <header className="color-test-header">
        <div className="color-test-spectrum" aria-hidden="true">
          {(['U', 'D', 'F', 'B', 'L', 'R'] as const).map((face) => (
            <i key={face} style={{ background: CUBE_FILL[face] }} />
          ))}
        </div>
        <p className="color-test-eyebrow">COLOR LAB</p>
        <h1>{tr({ zh: '颜色测试', en: 'Colour Tests' })}</h1>
      </header>

      <section className="color-test-grid" aria-label={tr({ zh: '选择颜色测试', en: 'Choose a colour test' })}>
        {TESTS.map((test) => (
          <AppLink key={test.id} href={test.href} className="color-test-card">
            <TestPreview id={test.id} />
            <span className="color-test-card-title">
              <strong>{tr(test.title)}</strong>
              <ArrowUpRight size={17} aria-hidden="true" />
            </span>
            <span className="color-test-card-description">{tr(test.description)}</span>
          </AppLink>
        ))}
      </section>
    </main>
  );
}
