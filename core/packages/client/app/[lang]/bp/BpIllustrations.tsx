import { ArrowRight, ArrowUpRight, BookOpen, Code2, GraduationCap, ScanSearch, UserRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';

// Illustrations for this BP only. They describe workflows, not operating data.
export function ProductAtlas() {
  return <div className="bp-atlas">
    <article className="bp-atlas-alg" data-site-surface="panel">
      <div className="bp-atlas-heading"><BookOpen size={21} /><span>{tr({ zh: '公式与识别', en: 'Algorithms & recognition' })}</span><span className="bp-illustration-label">{tr({ zh: '功能示意', en: 'ILLUSTRATION' })}</span></div>
      <div className="bp-case-sheet" aria-hidden>{['', "R U R' U'", "F R U R' U' F'", "R U2 R' U' R U' R'"].map(algorithm => <div key={algorithm}><VisualCube view="iso" algorithm={algorithm} size={100} local /></div>)}</div>
      <div className="bp-atlas-caption"><div><h3>{tr({ zh: '看懂状态，再反复练习。', en: 'Understand the state. Practise it.' })}</h3><p>{tr({ zh: '状态图示 · 公式 · 动画 · 识别训练', en: 'States · algorithms · animation · recognition' })}</p></div><AppLink href="/alg" prefetch={false} aria-label={tr({ zh: '体验公式库', en: 'Explore algorithms' })}><ArrowUpRight /></AppLink></div>
    </article>
    <article className="bp-atlas-recon" data-site-surface="panel">
      <div className="bp-atlas-heading"><ScanSearch size={21} /><span>{tr({ zh: '解法与复盘', en: 'Solutions & reconstruction' })}</span><span className="bp-illustration-label">{tr({ zh: '流程示意', en: 'WORKFLOW' })}</span></div>
      <div className="bp-recon-sequence"><VisualCube view="iso" algorithm="R U R' U'" size={120} local /><ArrowRight size={24} /><div><span className="bp-recon-moves">R U R′ U′</span><span>{tr({ zh: '逐步理解转动与解法', en: 'Study a solution move by move' })}</span></div></div>
      <div className="bp-recon-track" aria-hidden>{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>
      <div className="bp-atlas-caption"><div><h3>{tr({ zh: '把解法，变成可研究的过程。', en: 'Make a solve a process to study.' })}</h3><p>{tr({ zh: '解法记录 · 动画 · 逐帧工具', en: 'Solve records · animation · frame tools' })}</p></div><AppLink href="/recon" prefetch={false} aria-label={tr({ zh: '体验复盘工具', en: 'Explore reconstruction' })}><ArrowUpRight /></AppLink></div>
    </article>
  </div>;
}

export function FounderEvidence() {
  return <div className="bp-founder-evidence">
    <a href="/images/ruimin/awards/high-school-chinese-mathematical-olympiad-third-prize-2012.webp" target="_blank" rel="noopener noreferrer" className="bp-certificate" data-site-surface="panel">
      <img src="/images/ruimin/awards/high-school-chinese-mathematical-olympiad-third-prize-2012.webp" width={2400} height={3600} alt={tr({ zh: '颜瑞民中国数学奥林匹克获奖证书', en: 'Ruimin Yan’s Chinese Mathematical Olympiad award certificate' })} loading="lazy" />
      <span>{tr({ zh: '公开获奖档案', en: 'PUBLIC AWARD RECORD' })}<ArrowUpRight size={16} /></span>
    </a>
    <div className="bp-evidence-notes"><div><GraduationCap size={22} /><strong>{tr({ zh: '数学与物理背景', en: 'Mathematics & physics' })}</strong><p>{tr({ zh: '南开大学 · 乔治华盛顿大学', en: 'Nankai University · George Washington University' })}</p></div><div><Code2 size={22} /><strong>{tr({ zh: '从专业积累到产品开发', en: 'From expertise to development' })}</strong><p>{tr({ zh: '求解 · 训练 · 复盘 · 数据', en: 'Solving · training · reconstruction · data' })}</p></div></div>
    <div className="bp-team-visual"><div><span className="bp-margin-label">{tr({ zh: '创始人全职投入', en: 'FULL-TIME FOUNDER' })}</span><strong>{tr({ zh: '教学 × 产品', en: 'Teaching × product' })}</strong><p>{tr({ zh: '连接课程内容、训练工具与教师社群中的实际需求。', en: 'Connecting courses, training tools and real needs from the teacher community.' })}</p></div><div className="bp-team-people" aria-hidden><span><UserRound /></span><i>+</i><span><BookOpen /></span></div></div>
  </div>;
}
