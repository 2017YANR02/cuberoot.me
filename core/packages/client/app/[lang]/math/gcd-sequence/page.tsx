'use client';

/**
 * /math/gcd-sequence — 一道数论证明题(题目原文 + KaTeX 排版,暂不含解答)。
 *
 * 数列 a_1, a_2, … 各项均大于 1;a_{n+1} 取满足 a_{n+1} > a_n 且与前面每一项
 * 都有公因子(gcd > 1)的最小正整数。求证:最终呈线性周期 a_{n+T} = a_n + L。
 *
 * 本页仅收录题目;解答待补。
 */
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';

function TeX({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }),
    [src],
  );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function TeXBlock({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }),
    [src],
  );
  return <div className="cs-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function GcdSequencePage() {
  useTranslation();
  const t = useT();
  useDocumentTitle('公因子数列', 'Common-factor sequence');

  return (
    <div className="cs-page">
      <style>{INLINE_CSS}</style>

      <Link href="/math" className="cs-back">
        <ArrowLeft size={16} />
        {t('数学', 'Math')}
      </Link>

      <header className="cs-header">
        <div className="cs-tag">{t('第 6 题', 'Problem 6')}</div>
        <h1>{t('公因子数列', 'Common-factor sequence')}</h1>
        <p className="cs-sub">{t('数论 · 证明题', 'Number theory · proof')}</p>
      </header>

      <section className="cs-problem">
        <p>
          {t('设 ', 'Let ')}
          <TeX src={String.raw`a_1, a_2, a_3, \ldots`} />
          {t(
            ' 是一个各项均为大于 1 的正整数的无穷数列。假设对所有正整数 ',
            ' be an infinite sequence of positive integers, each greater than 1. Suppose that for every positive integer ',
          )}
          <TeX src={String.raw`n`} />
          {t('，', ', the term ')}
          <TeX src={String.raw`a_{n+1}`} />
          {t(
            ' 是满足下面两个条件的最小正整数:',
            ' is the smallest positive integer satisfying both of the following conditions:',
          )}
        </p>

        <ol className="cs-conds">
          <li>
            <TeX src={String.raw`a_{n+1} > a_n`} />
            {t('；', ';')}
          </li>
          <li>
            {t('对所有 ', 'for all ')}
            <TeX src={String.raw`i = 1, 2, \ldots, n`} />
            {t('，都有 ', ', ')}
            <TeX src={String.raw`\gcd(a_{n+1}, a_i) > 1`} />
            {t('。', '.')}
          </li>
        </ol>

        <p>
          {t('证明:存在正整数 ', 'Prove that there exist positive integers ')}
          <TeX src={String.raw`T`} />
          {t(' 和 ', ' and ')}
          <TeX src={String.raw`L`} />
          {t('，使得对所有正整数 ', ', such that for every positive integer ')}
          <TeX src={String.raw`n`} />
          {t(' 都有', ' one has')}
        </p>

        <TeXBlock src={String.raw`a_{n+T} = a_n + L.`} />

        <p className="cs-note">
          {t('注:', 'Note: ')}
          <TeX src={String.raw`\gcd(x, y)`} />
          {t(
            ' 表示正整数 ',
            ' denotes the greatest common divisor of the positive integers ',
          )}
          <TeX src={String.raw`x`} />
          {t(' 与 ', ' and ')}
          <TeX src={String.raw`y`} />
          {t(' 的最大公约数。', '.')}
        </p>
      </section>

      <p className="cs-pending">{t('解答待补。', 'Solution pending.')}</p>
    </div>
  );
}

const INLINE_CSS = `
.cs-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  color: var(--foreground);
  line-height: 1.7;
}
.cs-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--muted-foreground);
  text-decoration: none;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}
.cs-back:hover { color: var(--accent); }
.cs-header { margin-bottom: 1.5rem; }
.cs-tag {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.02em;
  margin-bottom: 0.4rem;
}
.cs-header h1 {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.cs-sub {
  margin: 0.3rem 0 0;
  color: var(--muted-foreground);
  font-size: 0.95rem;
}
.cs-problem { font-size: 1.05rem; }
.cs-problem p { margin: 0 0 1rem; }
.cs-conds {
  margin: 0 0 1rem;
  padding-left: 1.75rem;
  list-style: decimal outside;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.cs-conds li { padding-left: 0.25rem; }
.cs-block {
  margin: 1.25rem 0;
  text-align: center;
}
.cs-note {
  color: var(--muted-foreground);
  font-size: 0.95rem;
}
.cs-pending {
  margin-top: 2rem;
  color: var(--muted-foreground);
  font-size: 0.9rem;
  font-style: italic;
}
@media (max-width: 480px) {
  .cs-page { padding: 1rem 0.75rem 2rem; }
  .cs-header h1 { font-size: 1.5rem; }
  .cs-problem { font-size: 1rem; }
}
`;
