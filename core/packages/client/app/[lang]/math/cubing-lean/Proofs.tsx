'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Boxes, Check, CheckCheck, ChevronDown, Code2, Copy, Download, GitBranch, GitPullRequest, ShieldCheck, Terminal } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
import HeaderToggles from '@/components/HeaderToggles';
import { TeX, TeXBlock } from '@/components/math/Tex';
import { useCopy } from '@/hooks/useCopy';
import { useT } from '@/hooks/useT';
import CountingExample from './CountingExample';
import OrbitFigure from './OrbitFigure';
import { kernelPaper, paper } from './paper';
import proofs from './proofs.json';
import s from './research.module.css';

const repo = 'https://github.com/2017YANR02/cuberoot.me';
const folder = 'research/cubing-lean';
const commands = 'cd research/cubing-lean\nbash cache.sh\nlake build\nlake env lean -DwarningAsError=true Audit.lean\nLEAN_NUM_THREADS=2 lake env leanchecker --verbose CubeDiameter CubeComm CubeKernel CubeMixing CubingLean';
const topics = [
  { id: 'diameter', zh: '上帝之数', en: 'Cube diameter', icon: BookOpen },
  { id: 'commutators', zh: '三阶换位子', en: 'Commutators', icon: Boxes },
  { id: 'short-solutions', zh: '高阶魔方短解', en: 'Short solutions', icon: Boxes },
  { id: 'verify', zh: '本地复核', en: 'Verification', icon: ShieldCheck },
  { id: 'contribute', zh: '参与证明', en: 'Contribute', icon: GitPullRequest },
] as const;

function Contents() {
  const t = useT();
  const [current, setCurrent] = useState<string>('diameter');
  useEffect(() => {
    const sections = topics.map(topic => document.getElementById(topic.id));
    let frame = 0;
    function update() {
      frame = 0;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const visible = sections.filter(el => el && el.getBoundingClientRect().top <= 106);
      setCurrent(atBottom ? 'contribute' : visible.at(-1)?.id ?? 'diameter');
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return <nav className={s.contents} aria-label={t('本页目录', 'On this page')}>
    <p>{t('本页目录', 'On this page')}</p>
    <div>{topics.map(({id, zh, en, icon: Icon}) => <a key={id} href={`#${id}`} aria-current={current === id ? 'location' : undefined}>
      <Icon size={16} aria-hidden="true" />{t(zh,en)}
    </a>)}</div>
  </nav>;
}

function CodeBlock({ text, title }: {text: string; title: string}) {
  const t = useT();
  const { copy, copied } = useCopy();
  return <div className={s.code}>
    <div className={s.codeHead}><span><Terminal size={15} />{title}</span>
      <button className={s.codeCopy} type="button" onClick={() => copy(text)} aria-label={t('复制代码', 'Copy code')}>
        {copied ? <Check size={15} /> : <Copy size={15} />}<span aria-live="polite">{copied ? t('已复制', 'Copied') : t('复制', 'Copy')}</span>
      </button>
    </div>
    <pre dir="ltr" tabIndex={0} aria-label={title}><code>{text}</code></pre>
  </div>;
}

function ProofBody({ name, project }: {name: string; project: string}) {
  const t = useT();
  const proof = proofs.find(p => p.name === name)!;
  const text = proof.statement ? [proof.statement.source, proof.source].join('\n\n') : proof.source;
  return <>
    <CodeBlock title={proof.file} text={text} />
    <div className={s.sourceLinks}>
      {proof.statement && <a href={`${project}/${proof.statement.file}#L${proof.statement.line}`}>{t('命题定义', 'Statement definition')} <ArrowUpRight /></a>}
      <a href={`${project}/${proof.file}#L${proof.line}`}>{t('完整证明模块', 'Full proof module')} <ArrowUpRight /></a>
    </div>
  </>;
}

function ProofToggle({ name, open, toggle }: {name: string; open: boolean; toggle: () => void}) {
  const t = useT();
  return <button className={s.proofToggle} type="button" onClick={toggle} aria-expanded={open} aria-controls={`source-${name}`}>
    <Code2 size={17} />{t('Lean 证明', 'Lean proof')}<ChevronDown size={15} className={s.chevron} />
  </button>;
}

export default function Proofs({ revision }: {revision: string}) {
  const t = useT();
  const project = `${repo}/blob/${revision}/${folder}`;
  const [diameterProof, setDiameterProof] = useState<string | null>(null);
  const [commProof, setCommProof] = useState(false);
  const switchProof = (name: string) => setDiameterProof(selected => selected === name ? null : name);
  return <main className={s.page}>
    <div className={s.topbar}>
      <div className={s.breadcrumb}><PageBackLink fallback="/math" /><AppLink href="/math">{t('数学', 'Math')}</AppLink><span aria-hidden="true">/</span><b>Cubing Lean</b></div>
      <div className={s.tools}><a href={repo}><GitBranch size={16} />GitHub<ArrowUpRight size={13} /></a><HeaderToggles /></div>
    </div>
    <header className={s.hero}>
      <div className={s.heroText}>
        <a className={s.checked} href="#verify"><ShieldCheck size={16} />{t('已通过 Lean 内核核验', 'Lean kernel verified')}</a>
        <h1>Cubing <span>Lean</span></h1>
        <p className={s.subtitle}>{t('魔方数学的形式化证明库', 'Formal proofs of cube mathematics')}</p>
        <p className={s.lede}>{t('从任意阶魔方的最少复原步数，到三阶魔方群的换位子。阅读数学结论，展开对应的 Lean 证明。', 'Explore optimal move counts for cubes of any size and commutators in the 3×3×3 group. Each result comes with its Lean proof.')}</p>
        <div className={s.heroActions}><a className={s.primary} href="#diameter"><BookOpen size={17} />{t('阅读定理', 'Read the theorems')}</a>
          <a className={s.secondary} href="#contribute">{t('参与证明', 'Contribute a proof')}<ArrowRight size={16} /></a></div>
      </div>
      <OrbitFigure />
    </header>
    <div className={s.bodyGrid}>
      <Contents />
      <div className={s.article}>
        <section id="diameter" className={s.section}>
          <h2>{t('任意阶魔方的上帝之数', 'God’s number for an n-layer cube')}</h2>
          <p>{t('任选一层转 90°、−90° 或 180° 都算一步。固定六面的目标颜色，取所有合法状态中最大的最短复原步数，记为', 'Count a quarter or half turn of any single layer as one move. With the six target colours fixed, the largest optimal solution length over reachable states is')} <TeX src="D(n)" withMathML />{t('。以下记', '. Write')} <TeX src={String.raw`L(n)=n^2/\log_2 n`} withMathML />{t('。', '.')}</p>
          <div className={s.results}>
            <article className={s.result}>
              <div className={s.resultHead}><span>2011</span><a href="https://arxiv.org/abs/1106.5736">{t('原论文', 'Paper')}<ArrowUpRight /></a></div>
              <h3>{t('确定增长阶', 'Order of growth')}</h3>
              <div className={s.formula}><TeXBlock src={String.raw`D(n)=\Theta\!\big(L(n)\big)`} withMathML /></div>
              <p>{t('阶数充分大时，上帝之数被 L(n) 的两个正常数倍夹住。', 'For all sufficiently large n, two positive constant multiples of L(n) bound the diameter.')}</p>
              <small>{t('Demaine 等', 'Demaine et al.')}</small>
              <ProofToggle name="paper2011" open={diameterProof==='paper2011'} toggle={() => switchProof('paper2011')} />
            </article>
            <div id="source-paper2011" className={s.resultSource} hidden={diameterProof !== 'paper2011'}><ProofBody name="paper2011" project={project} /></div>
            <article className={s.result}>
              <div className={s.resultHead}><span>2026</span><a href="https://arxiv.org/abs/2611.11018">{t('预印本', 'Preprint')}<ArrowUpRight /></a></div>
              <h3>{t('收紧上界系数', 'Sharper upper coefficient')}</h3>
              <div className={s.formula}><TeXBlock src={String.raw`C-\varepsilon\le\frac{D(n)}{L(n)}\le30.5+\varepsilon`} withMathML /></div>
              <p>{t('对每个 ε > 0，阶数充分大时成立。下界系数 C 约为 12.882。', 'For every ε > 0 the bounds hold for all sufficiently large n. The lower coefficient C is about 12.882.')}</p>
              <small>Mrzyglocki, Rokicki, Perroni-Scharf &amp; Demaine</small>
              <ProofToggle name="paper2026" open={diameterProof==='paper2026'} toggle={() => switchProof('paper2026')} />
            </article>
            <div id="source-paper2026" className={s.resultSource} hidden={diameterProof !== 'paper2026'}><ProofBody name="paper2026" project={project} /></div>
          </div>
          <p className={s.note}>{t('下界来自可达配色计数，', 'Counting reachable colourings gives ')}<TeX src={String.raw`C=\tfrac14\log_2\!\big(24!/(4!)^6\big)`} withMathML />{t('。本库用 2026 年的上界推出 2011 年结论的上界。', '. The library derives the 2011 upper bound from the stronger 2026 result.')}</p>
          <CountingExample />
        </section>
        <section id="commutators" className={s.section}>
          <h2>{t('三阶魔方群的换位子', 'Commutators in the 3×3×3 cube group')}</h2>
          <p>{t('在固定中心的块坐标模型中，如果角块和棱块的位置置换都是偶置换，每个合法状态 g 都可以表示为两个 24 阶元素的换位子。', 'In the fixed-centre cubie model, every legal state g with even corner and edge permutations is the commutator of two elements of order 24.')}</p>
          <div className={s.equation}><TeXBlock src={String.raw`g=ABA^{-1}B^{-1},\qquad |A|=|B|=24`} withMathML /></div>
          <p>{t('A 和 B 各自都让八个角块形成一个循环、十二个棱块形成一个循环。重复同一个因子 24 次才首次复原。模型用角扭转和、棱翻转和以及置换奇偶性刻画合法性。', 'Each factor cycles all eight corners and all twelve edges. Its 24th power is the first positive power returning to the identity. The model describes legality by the twist sum, flip sum and permutation parity.')}</p>
          <aside className={s.paperEntry} aria-labelledby="commutator-paper">
            <h3 id="commutator-paper" lang="en"><AppLink href={paper.href}>{paper.title}</AppLink></h3>
            <p>{paper.author} <span aria-hidden="true">/</span> <time dateTime={paper.date}>{paper.date}</time> <span aria-hidden="true">/</span> {t('英文预印本', 'English preprint')}</p>
            <div className={s.rowActions}>
              <AppLink className={s.primary} href={paper.href}><BookOpen size={16} />{t('在线阅读论文', 'Read paper online')}</AppLink>
              <a href={paper.pdf} download><Download />{t('下载 PDF', 'Download PDF')}</a>
              <a href={paper.source} download><Code2 />{t('LaTeX 与 Lean 源码（ZIP）', 'LaTeX and Lean source (ZIP)')}</a>
            </div>
          </aside>
          <div className={s.rowActions}><ProofToggle name="every_even_cube" open={commProof} toggle={() => setCommProof(!commProof)} />
            <a href={`${project}/CubeComm/README.md`}>{t('模型与文献', 'Model and references')}<ArrowUpRight /></a></div>
          <div id="source-every_even_cube" hidden={!commProof}><ProofBody name="every_even_cube" project={project} /></div>
        </section>
        <section id="short-solutions" className={s.section}>
          <h2>{t('高阶魔方的短解', 'Short solutions on large cubes')}</h2>
          <p>{t('允许至多 k 步时，可以直接判定无解，或构造阶数至多为 4k+7 的小魔方，保留相同的判定答案。', 'For a budget of k moves, the reduction rejects the instance or produces an equivalent cube of side at most 4k+7.')}</p>
          <aside className={s.paperEntry}>
            <h3 lang="en"><AppLink href={kernelPaper.href}>{kernelPaper.title}</AppLink></h3>
            <p>{kernelPaper.author} · {t('英文审阅稿，优先权待核实', 'English working manuscript, priority under review')}</p>
            <div className={s.rowActions}>
              <AppLink className={s.primary} href="/math/cubing-lean/short-solutions"><Boxes size={16}/>{t('试着缩小魔方', 'Try the cube reduction')}</AppLink>
              <AppLink href={kernelPaper.href}><BookOpen size={16}/>{t('在线阅读论文', 'Read paper online')}</AppLink>
              <a href={kernelPaper.pdf} download><Download/>{t('下载 PDF', 'Download PDF')}</a>
              <a href={kernelPaper.source} download><Code2/>{t('LaTeX 与 Lean 源码（ZIP）', 'LaTeX and Lean source (ZIP)')}</a>
            </div>
          </aside>
        </section>
        <section id="verify" className={s.section}>
          <h2>{t('本地复核', 'Verify locally')}</h2>
          <div className={s.record}><CheckCheck size={20} /><b>{t('内核重检通过', 'Kernel replay passed')}</b><span>Lean 4.35.0</span><time dateTime="2026-11-26">2026-11-26</time></div>
          <p>{t('在已安装 elan 的环境中，从仓库根目录运行以下命令，重新构建证明并检查公理依赖。', 'With elan installed, run these commands from the repository root to rebuild the proofs and audit their axiom dependencies.')}</p>
          <CodeBlock title={t('终端', 'Terminal')} text={commands} />
          <p>{t('主定理的传递公理', 'Transitive axioms of the main theorems')}　<code>propext</code> · <code>Classical.choice</code> · <code>Quot.sound</code></p>
          <div className={s.sourceLinks}><a href={`${project}/Audit.lean`}>{t('公理审计源码', 'Axiom audit source')}<ArrowUpRight /></a><a href={`${repo}/actions/workflows/cubing_lean.yml`}>{t('GitHub 检查记录', 'GitHub verification runs')}<ArrowUpRight /></a></div>
        </section>
        <section id="contribute" className={s.section}>
          <h2>{t('参与证明', 'Contribute a proof')}</h2>
          <p>{t('可以从一个小引理或一次模型审阅开始。Lean 代码、纸笔证明、文献和反例都可以提交。', 'Start with a small lemma or review the model. Lean code, a paper proof, references and counterexamples are all welcome.')}</p>
          <div className={s.tasks}><a href={`${project}/CONTRIBUTING.md#one-move`}><Code2 /><span>{t('证明一步转动至多改变一步最短距离', 'Prove that a single turn changes optimal distance by at most one')}</span><ArrowUpRight /></a>
            <a href={`${project}/CONTRIBUTING.md#reachability`}><BookOpen /><span>{t('审阅固定中心三阶魔方的可达性条件', 'Review reachability conditions for the fixed-centre cube')}</span><ArrowUpRight /></a></div>
          <div className={s.rowActions}><a className={s.primary} href={`${repo}/issues/new?template=cubing_lean.yml`}><GitPullRequest size={16} />{t('认领或提议题目', 'Claim or propose a task')}</a>
            <a href={`${repo}/issues?q=is%3Aissue+%22%5BCubing+Lean%5D%22+in%3Atitle`}>{t('浏览已有讨论', 'Browse discussions')}<ArrowUpRight /></a></div>
        </section>
      </div>
    </div>
  </main>;
}
