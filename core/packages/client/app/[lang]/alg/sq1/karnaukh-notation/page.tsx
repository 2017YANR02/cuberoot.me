'use client';

import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import {
  SQ1_PBL_MNEMONIC_GROUPS,
  SQ1_PBL_MNEMONIC_SOURCE,
  SQ1_PBL_UNDEFINED_MNEMONICS,
  SQ1_PBL_MNEMONIC_VARIANT_NOTE,
  type Sq1PblMnemonicGroup,
} from '@/lib/sq1-pbl-mnemonics';
import '../../alg.css';
import '@/components/NotationGuide/notation-guide.css';

function MnemonicTable({ group }: { group: Sq1PblMnemonicGroup }) {
  const t = useT();

  return (
    <section className="alg-mnemonic-section" aria-labelledby={`mnemonic-${group.id}`}>
      <h2 id={`mnemonic-${group.id}`}>{t(group.title.zh, group.title.en)}</h2>
      <p>{t(group.intro.zh, group.intro.en)}</p>
      <div className="alg-mnemonic-table-scroll" tabIndex={0} role="region" aria-label={t(`${group.title.zh}对照表`, `${group.title.en} reference table`)}>
        <table className="alg-mnemonic-table">
          <thead>
            <tr>
              <th scope="col">{t('记号', 'Notation')}</th>
              <th scope="col">{t('原表定义（英文原文）', 'Source definition')}</th>
            </tr>
          </thead>
          <tbody>
            {group.entries.map(entry => (
              <tr key={entry.symbol}>
                <th scope="row"><code>{entry.symbol}</code></th>
                <td>
                  <code>{entry.expansion}</code>
                  {entry.sourceNote && <span className="alg-mnemonic-alt"><code>{entry.sourceNote}</code></span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Sq1PblNotationPage() {
  const t = useT();

  return (
    <main className="alg-root alg-notation-page">
      <div className="alg-notation-shell alg-mnemonic-shell">
        <header className="alg-notation-hero">
          <h1>{t('SQ1 卡脑壳记号', 'Square-1 Karnaukh notation')}</h1>
          <nav className="alg-notation-links" aria-label={t('PBL 页面', 'PBL pages')}>
            <Link href="/alg/sq1/pbl" className="alg-notation-reference" prefetch={false}>
              {t('PBL 公式集', 'PBL algorithms')}
            </Link>
            <Link href="/alg/sq1/pbl-finder" className="alg-notation-reference" prefetch={false}>
              {t('高级查找', 'Advanced finder')}
            </Link>
          </nav>
        </header>

        <div className="alg-mnemonic-intro">
          <p>{t(
            '公式卡片里括号标出的“原表记号”来自 Daniel’s Public PBL Doc。它是为批量记忆设计的卡脑壳记号，不是播放器接受的标准 Square-1 公式。',
            'The “source mnemonic” in parentheses on each algorithm card comes from Daniel’s Public PBL Doc. Karnaukh notation is designed for memorising many algorithms; it is not executable Square-1 notation for the player.',
          )}</p>
          <p>{t(
            '卡片主行的 (a,b) / … 才是可复制、可播放的公式。卡脑壳记号始终只作阅读提示，不参与解析、动画或训练。',
            'The main (a,b) / … line is the executable formula to copy or play. Mnemonics remain reading aids and never enter parsing, animation, or training.',
          )}</p>
        </div>

        <section className="alg-mnemonic-section" aria-labelledby="mnemonic-reading">
          <h2 id="mnemonic-reading">{t('怎样读', 'How to read it')}</h2>
          <dl className="alg-mnemonic-rules">
            <div>
              <dt>{t('紧凑数对', 'Packed number pairs')}</dt>
              <dd>
                <code>10</code> = <code>(1, 0)</code>, <code>0-1</code> = <code>(0, -1)</code>,{' '}
                <code>-54</code> = <code>(-5, 4)</code>, <code>-4-3</code> = <code>(-4, -3)</code>
              </dd>
            </div>
            <div>
              <dt><code>/</code></dt>
              <dd>{t('标准 Square-1 切层；展开式会保留前导或末尾切层。', 'A regular Square-1 slice; expansions may intentionally begin or end with one.')}</dd>
            </div>
            <div>
              <dt><code>\</code></dt>
              <dd>{t('原表所称的“下层起始切层”；它是卡脑壳记号的方向标记，不是网站标准公式输入。', 'The source’s “down starting slice”; it is a mnemonic direction marker, not site-standard algorithm input.')}</dd>
            </div>
            <div>
              <dt><code>//</code></dt>
              <dd>{t('相邻组合之间抵消切层，例如 JJ//RJ。', 'Cancels a slice where two combinations meet, for example JJ//RJ.')}</dd>
            </div>
            <div>
              <dt><code>&apos;</code></dt>
              <dd>{t('使用表中明确列出的反向或配对展开式；不要只凭字面猜测。', 'Use the explicitly listed reverse or paired expansion; do not infer it from the spelling alone.')}</dd>
            </div>
            <div>
              <dt>{t('空格与换行', 'Spaces and line breaks')}</dt>
              <dd>{t('空格分隔记号片段；同一格换行通常是另一套写法。原表没有定义括号、方括号、冒号和自然语言的通用语法，本站不解析这些写法。', 'Spaces separate mnemonic chunks; a new line in one cell usually starts an alternative. The source does not define general syntax for parentheses, brackets, colons, or prose, so this site does not parse them.')}</dd>
            </div>
          </dl>
        </section>

        <section className="alg-mnemonic-section" aria-labelledby="mnemonic-example">
          <h2 id="mnemonic-example">{t('卡片示例', 'Card example')}</h2>
          <p><code>10 u f W&apos; T u&apos; -10</code></p>
          <div className="alg-mnemonic-example">
            <span><code>10</code><b>→</b><code>(1, 0)</code></span>
            <span><code>u</code><b>→</b><code>(2, -1)</code></span>
            <span><code>f</code><b>→</b><code>(1, 4)</code></span>
            <span><code>W&apos;</code><b>→</b><code>-3,0/3,0/</code></span>
            <span><code>T</code><b>→</b><code>(2, -4)</code></span>
            <span><code>u&apos;</code><b>→</b><code>(-2, 1)</code></span>
            <span><code>-10</code><b>→</b><code>(-1, 0)</code></span>
          </div>
          <p className="alg-mnemonic-example-note">{t(
            '第二行 10 jJ 20 JJ 也按同样方式逐段查表；其中 jJ 和 JJ 必须使用下面的完整组合展开式。',
            'Read the second line, 10 jJ 20 JJ, chunk by chunk in the same way; jJ and JJ use the complete combination expansions below.',
          )}</p>
        </section>

        <div className="alg-mnemonic-sections">
          {SQ1_PBL_MNEMONIC_GROUPS.map(group => <MnemonicTable key={group.id} group={group} />)}
        </div>

        <section className="alg-mnemonic-section" aria-labelledby="mnemonic-undefined">
          <h2 id="mnemonic-undefined">{t('原表未完整说明', 'Not fully defined by the source')}</h2>
          <p>{t(
            '下面 31 个形式确实出现在推荐记号中，但 Help 页及其复制页都没有给出数值展开式。本站原样保留，不根据名称猜解。M′、m′ 如何从 M、m 的两个候选值中选择，原表也没有说明。',
            'These 31 forms do occur in recommendations, but neither Help sheet provides a numeric expansion. This site preserves them verbatim and does not guess from their names. The source also does not explain how M′ and m′ select between the two values listed for M and m.',
          )}</p>
          <div className="alg-mnemonic-undefined-list">
            {SQ1_PBL_UNDEFINED_MNEMONICS.map(symbol => <code key={symbol}>{symbol}</code>)}
          </div>
          <p>{t(
            `原表在 ${SQ1_PBL_MNEMONIC_VARIANT_NOTE.sourceCell} 只留下以下补充说明，仍未提供这些变体的数值展开式：`,
            `The source only leaves the following note at ${SQ1_PBL_MNEMONIC_VARIANT_NOTE.sourceCell}; it still provides no numeric expansion for those variants:`,
          )}</p>
          <pre className="alg-mnemonic-source-note">{SQ1_PBL_MNEMONIC_VARIANT_NOTE.text}</pre>
          <p>{t(
            '方括号与冒号、+、单独插入的 /、形如 (e′ D)3 的括号重复，以及孤立的 5 或 -5 也没有通用语法定义；自然语言 also、but 等只是作者备注。遇到这些内容时，请直接使用同一卡片的标准 SQ1 公式。',
            'Brackets and colons, +, an inserted single /, grouped repetitions such as (e′ D)3, and isolated 5 or -5 also have no general syntax definition; prose such as “also” and “but” is editorial. When these appear, use the standard Square-1 algorithm on the same card.',
          )}</p>
        </section>

        <section className="alg-mnemonic-section alg-mnemonic-source" aria-labelledby="mnemonic-source">
          <h2 id="mnemonic-source">{t('来源与方向', 'Source and orientation')}</h2>
          <p>{t(
            `本页定义逐项移植自 ${SQ1_PBL_MNEMONIC_SOURCE.definitionRange}，分组说明来自 ${SQ1_PBL_MNEMONIC_SOURCE.headingsRange}，原表简介位于 ${SQ1_PBL_MNEMONIC_SOURCE.introductionCell}。原作者特别说明，JJ 的“正面”取向采用自己的观察习惯。这是来源陈述；本站另建议认图时对照公式卡片的 PBL 图。`,
            `Every definition is transcribed from ${SQ1_PBL_MNEMONIC_SOURCE.definitionRange}; group descriptions come from ${SQ1_PBL_MNEMONIC_SOURCE.headingsRange}, and the source introduction is at ${SQ1_PBL_MNEMONIC_SOURCE.introductionCell}. The author explicitly notes that the “front” orientation for JJ follows their own viewpoint. Separately, this site recommends checking the PBL image on the algorithm card when recognising a case.`,
          )}</p>
          <div className="alg-notation-links">
            <a href={SQ1_PBL_MNEMONIC_SOURCE.tutorial} target="_blank" rel="noreferrer" className="alg-notation-reference">
              {t('卡脑壳记号教程', 'Karnaukh notation tutorial')}
            </a>
            <a href={SQ1_PBL_MNEMONIC_SOURCE.spreadsheet} target="_blank" rel="noreferrer" className="alg-notation-reference">
              {t('原始公开表格', 'Original public spreadsheet')}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
