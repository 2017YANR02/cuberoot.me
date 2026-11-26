'use client';

import { useMemo, useState } from 'react';
import CubeModel from './CubeModel';
import { ArrowLeft, ArrowUpRight, BookOpen } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import Walkthrough from './Walkthrough';
import BoolToggle from '@/components/BoolToggle';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { CUBE_FILL } from '@/lib/cube-colors';
import { kernelPaper } from '../paper';
import { faces, notation, parseTurns, reduce } from './reduction';
import s from './demo.module.css';

const examples = [
  { zh: '转动一层', en: 'One slice', n: 16, k: 1, alg: "10D'" },
  { zh: '两步抵消', en: 'Two turns cancel', n: 16, k: 1, alg: "5R 5R' 10D'" },
  { zh: '一步不够', en: 'One move short', n: 16, k: 1, alg: "10D' 5R" },
  { zh: '奇数阶中层', en: 'Odd middle layer', n: 17, k: 1, alg: "9D'" },
];
const numbers = (n: number, first = 0) => Array.from({ length: n }, (_, i) => first + i);

function CubeView({ title, n, alg, grid, face, faded, solution }: {
  title: string; n: number; alg: string; grid: number[][]; face: number;
  faded?: number[]; solution?: string;
}) {
  const t = useT();
  const params = new URLSearchParams({ puzzle: String(n), setup: alg });
  if (solution) params.set('alg', solution);
  return <section className={s.cube} data-site-surface="panel">
    <div className={s.cubeHead}><h2>{title}</h2><b>{n} × {n} × {n}</b></div>
    <div className={s.viewport}>
      {face < 0 ? <CubeModel n={n} alg={alg}/> :
        <svg role="img" aria-label={t(`${n} 阶魔方的 ${faces[face]} 面`, `Face ${faces[face]} of the size-${n} cube`)} viewBox={`0 0 ${n} ${n}`} width="100%" style={{ maxWidth: 228 }}>
          {grid[face].map((colour, i) => <rect key={i} x={i % n + .045} y={Math.floor(i / n) + .045} width={.91} height={.91} rx={.09}
            fill={CUBE_FILL[faces[colour]]} opacity={faded && (!faded.includes(i % n) || !faded.includes(Math.floor(i / n))) ? .16 : 1} />)}
        </svg>}
    </div>
    <div className={s.caption}><div><small>{t('打乱', 'Scramble')}</small><code>{alg || t('已复原', 'Solved')}</code></div>
      <AppLink href={'/sim?' + params}>{t('在 /sim 打开', 'Open in /sim')}<ArrowUpRight size={14}/></AppLink></div>
  </section>;
}

export default function ShortSolutions() {
  const t = useT();
  const [explore, setExplore] = useState(false);
  const [n, setN] = useState(16);
  const [k, setK] = useState(1);
  const [input, setInput] = useState(examples[0].alg);
  const [face, setFace] = useState(2);
  const [fade, setFade] = useState(true);
  const turns = useMemo(() => parseTurns(input, n), [input, n]);
  const result = useMemo(() => turns && reduce(n, k, turns), [n, k, turns]);
  const small = result?.small;
  const m = small?.kept.length ?? 0;
  const total = 6 * m * m;
  const projected = small && notation(small.projected);
  const alreadySolved = small?.restricted.every((grid, f) => grid.every(colour => colour === f));
  const inverse = alreadySolved ? [] : small && small.projected.length <= k ? [...small.projected].reverse().map(move => ({
    ...move, suffix: move.suffix === '2' ? '2' : move.suffix ? '' : "'",
  })) : undefined;
  const lifted = inverse && small && notation(inverse.map(move => ({ ...move, layer: small.kept[move.layer - 1] + 1 })));
  const applyExample = (e: typeof examples[number]) => {
    setN(e.n); setK(e.k); setInput(e.alg); setFace(2); setFade(true);
  };
  return <main className={s.page}>
    <nav className={s.nav}><AppLink href="/math/cubing-lean#short-solutions"><ArrowLeft size={16}/>Cubing Lean</AppLink>
      <div><AppLink href={kernelPaper.href}><BookOpen size={16}/>{t('论文原文', 'Read the paper')}</AppLink><HeaderToggles/></div></nav>
    <header className={s.hero}><h1>{t('在小魔方上找大魔方的短解', 'Find short solutions on a smaller cube')}</h1>
      <p>{t('给定一个魔方状态，能在指定步数内复原吗？可以先看六面的颜色，把问题缩到更小的魔方上。同样的步数限制，两个魔方的答案相同。', 'Can a position be solved within a given number of moves? The colours on all six faces can let you reduce the question to a smaller cube. With the same move limit, both answers agree.')}</p></header>
    <div className={s.modes}>
      <button aria-pressed={!explore} onClick={() => setExplore(false)}>{t('分步演示', 'Walkthrough')}</button>
      <button aria-pressed={explore} onClick={() => setExplore(true)}>{t('自由实验', 'Try a scramble')}</button>
    </div>
    {!explore ? <>
      <Walkthrough onExplore={() => { applyExample(examples[1]); setExplore(true); }} />
      <section className={s.takeaway}><h2>{t('什么时候用得上？', 'When is this useful?')}</h2>
        <p>{t('只拿到打乱后的魔方，不知道别人转过什么，也可以用这个方法。比如要找 4 步以内的解：先根据颜色排除 4 步内无法复原的状态，再到缩小后的魔方上找解。这里的“4 步”限制的是复原，打乱可以有任意多步。', 'You only need the scrambled colours, even if you never saw the scramble. Suppose you want a solution in at most four moves. The colour check can rule some positions out immediately. For the rest, you can search the reduced cube. The limit is on solving moves. The scramble can be any length.')}</p>
        <details><summary>{t('为什么偏偏删图里这几层？', 'How did it pick those layers?')}</summary>
          <p>{t('从上下两端各往里数第二层，这两层算一对。第三层和倒数第三层又是一对。程序试着把两对的位置互换，左右、前后也照样换。如果六个面每一格的颜色都和原来一样，这两对就可以互相代替。只看正面都是绿色还不够。', 'Pair the second layer from the bottom with the second from the top. Pair the third with the third from the other end, and so on. Try exchanging two pairs, making the same exchange left to right and front to back. The pairs count as interchangeable only if every sticker on all six faces still has its original colour.')}</p>
          <p>{t('在这个一步的例子里，有六对可以互换。程序留下其中三对，把另外三对去掉。一对有两层，所以 16 层减去 6 层，还剩 10 层。', 'In this one-move example six pairs are interchangeable. The program keeps three of them and drops the other three. Each pair accounts for two layers, so sixteen layers become ten.')}</p>
          <AppLink href={kernelPaper.href}>{t('看论文里的证明', 'Read the proof in the paper')} ↗</AppLink>
        </details>
      </section>
    </> : <>
    <h2 className={s.tryTitle}>{t('选个打乱，再决定给自己几步', 'Pick a scramble, then set your move limit')}</h2>
    <div className={s.examples}>{examples.map(e => <button key={e.en} aria-pressed={n === e.n && k === e.k && input === e.alg}
      onClick={() => applyExample(e)}>{t(e.zh, e.en)}</button>)}</div>
    <div className={s.controls}>
      <label>{t('原魔方阶数', 'Original size')}<select value={n} onChange={e => setN(+e.target.value)}>{numbers(23, 2).map(i => <option key={i}>{i}</option>)}</select></label>
      <label>{t('怎样打乱', 'Scramble moves')}<input aria-describedby="notation" aria-invalid={!turns} value={input} maxLength={256} spellCheck={false} onChange={e => setInput(e.target.value)} /></label>
      <label>{t('最多用几步复原？', 'How many moves to solve?')}<select value={k} onChange={e => setK(+e.target.value)}>{numbers(9).map(i => <option key={i}>{i}</option>)}</select></label>
    </div>
    <p className={s.hint} id="notation">{t("10D′ 是一个动作：从底面数到第 10 层，看着底面逆时针转一下。每次只转一层，转 90° 或 180° 都算一步。", "10D′ is one move. Count ten layers in from the bottom and turn just that layer counterclockwise as seen from below. A quarter or half turn of one layer counts as one move.")}</p>
    {!turns || !result ? <p role="alert">{t("请用单层转动，例如 R、3F2 或 U'，层号不能超过当前阶数。清空打乱可查看复原状态。", "Enter single-layer turns such as R, 3F2 or U'. Layer numbers must fit the cube. Clear the field for the solved state.")}</p> : <>
      <div className={s.question} aria-live="polite"><strong>{t(`打乱用了 ${turns.length} 步。限 ${k} 步复原，能做到吗？`, `Scrambled in ${turns.length} moves. Can you solve it in ${k}?`)}</strong>
        <p>{!small ? t(`不能。六个面的颜色表明，${k} 步不够。`, `No. The colours on the six faces rule out a solution in ${k} moves.`) :
          alreadySolved ? t('能。这个打乱结束时，魔方已经复原了。', 'Yes. The scramble already finishes on a solved cube.') :
          inverse ? t(`能。在原魔方上转 ${lifted} 就能复原，共 ${inverse.length} 步。`, `Yes. Play ${lifted} on the original cube to solve it in ${inverse.length} moves.`) :
          k === 0 ? t('不能。魔方还没复原，至少要转一下。', 'No. At least one turn is needed because the cube is scrambled.') :
          t(`还需搜索。已把问题转到 ${m} 阶魔方上，是否有足够短的解法还未确定。`, `You can now look for a solution on the size-${m} cube. The reduction alone hasn’t settled this case.`)}</p>
        <small>{t('只改“最多用几步复原”，手里仍是同一只打乱的魔方。', 'Change just the move limit and you still start with exactly the same scramble.')}</small></div>
      <div className={s.views}><label>{t('查看', 'View')} <select value={face} onChange={e => setFace(+e.target.value)}>
        {faces.map((f, i) => <option key={f} value={i}>{t(['上面','右面','正面','底面','左面','背面'][i], ['Top','Right','Front','Bottom','Left','Back'][i])} ({f})</option>)}
        <option value={-1}>{t('可旋转的 3D 魔方', 'Rotatable 3D cubes')}</option></select></label>
        {face >= 0 && small && m < n && <BoolToggle value={fade} onChange={setFade} label={t('淡化要删的行列', 'Fade rows and columns to remove')}/>}</div>
      <div className={s.comparison}>
        <CubeView title={t('原来的魔方', 'Original cube')} n={n} alg={notation(turns)} grid={result.original} face={face} faded={fade ? small?.kept : undefined} solution={lifted || undefined}/>
        {small ? <CubeView title={t(m === n ? '保留所有层' : '缩小后的魔方', m === n ? 'All layers retained' : 'Reduced cube')} n={m}
          alg={projected!} grid={small.restricted} face={face} solution={inverse && notation(inverse)}/> :
          <section className={s.rejected} data-site-surface="panel"><h2>{t(`${k} 步内无法复原`, `No solution within ${k} moves`)}</h2>
            <p>{t(`共有 ${result.depths.length} 对内层。任意 ${k} 步至多碰到 ${k} 对，所以至少 ${result.depths.length-k} 对应该可以互换而不改变六面颜色。当前最大的一组只有 ${result.largest} 对。`, `There are ${result.depths.length} mirror pairs. At most ${k} can be touched in ${k} moves, so at least ${result.depths.length-k} must be interchangeable without changing any colour. The largest such group has only ${result.largest}.`)}</p></section>}
      </div>
      {small && <section className={s.explanation}>
        <h2>{t('从同一面数，每一层现在排第几？', 'Counting from the same face, where does each layer end up?')}</h2>
        <p>{m === n ? t(`允许 ${k} 步时，${n} 阶已经够小，这次全部保留。`, `With a ${k}-move limit, size ${n} is already small enough. All layers stay.`) :
          t('上面是原来的层号，下面是新层号。看到 × 就跳过去，只给留下的层重新数数。', 'Read the old layer number on top and the new number below. Skip every × when counting the layers that remain.')}</p>
        <div className={s.layerMap} aria-label={t('层号对应表', 'Layer number mapping')}>
          {numbers(n).map(i => {const rank = small.kept.indexOf(i); return <div key={i} data-removed={rank < 0 || undefined}><span>{i+1}</span><strong>{rank < 0 ? '×' : rank+1}</strong></div>;})}
        </div>
        <details><summary>{t('检查六个面的颜色，查看论文中的上界', 'Check the colours and the size bound')}</summary>
          <p>{t(`把原魔方六个面上的多余行列拿走，再和小魔方执行打乱后的颜色逐格对照。${small.matched} / ${total} 张贴纸颜色相同。`, `Remove the extra rows and columns from the six original faces and compare with the scrambled smaller cube. The colours agree on ${small.matched} of ${total} stickers.`)}</p>
          <p>{t(`论文用 k 表示允许的复原步数。取 k = ${k} 时，输出的魔方最多是 4k + 7 = ${4*k+7} 阶。这次实际得到 ${m} 阶。`, `In the paper k is your move limit. At k = ${k}, the output size is at most 4k + 7 = ${4*k+7}. This cube has size ${m}.`)}</p>
        <p><AppLink href={kernelPaper.href}>{t('阅读定理与完整证明', 'Read the theorem and proof')} ↗</AppLink></p>
        </details>
      </section>}
    </>}
    </>}
  </main>;
}
