import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Building2, Code2, GraduationCap, Layers3, Radio, ScanSearch, Timer, UserRound, Users } from 'lucide-react';
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

export function ServiceMap() {
  const layers = [
    { Icon: Radio, title: { zh: '内容与专业积累', en: 'Content & expertise' }, parts: { zh: '教程 / 公式 / 高手解法', en: 'Lessons / algorithms / expert solutions' } },
    { Icon: Timer, title: { zh: '日常练习入口', en: 'Everyday practice' }, parts: { zh: '计时 / 训练 / 记录 / 复盘', en: 'Timing / training / records / reconstruction' } },
    { Icon: Layers3, title: { zh: '持续的会员服务', en: 'Continuing member services' }, parts: { zh: '专业帮助 / 教学资源 / 服务交付', en: 'Specialist help / teaching resources / delivery' } },
  ];
  return <div className="bp-service-map">
    <div className="bp-service-intro"><span className="bp-margin-label">{tr({ zh: '产品与收入的关系', en: 'PRODUCT TO REVENUE' })}</span><h3>{tr({ zh: '一个平台。\n两类长期服务。', en: 'One platform.\nTwo ongoing services.' })}</h3><p>{tr({ zh: '用工具承接练习，用专业服务形成订阅价值。', en: 'Tools support practice. Specialist services create subscription value.' })}</p></div>
    <div className="bp-service-layers">{layers.map(({ Icon, title, parts }, index) => <div className="bp-service-layer" key={title.en}><span className="bp-service-index">0{index + 1}</span><Icon size={23} /><div><strong>{tr(title)}</strong><span>{tr(parts)}</span></div>{index < 2 && <ArrowDown className="bp-service-connector" size={18} aria-hidden />}</div>)}<div className="bp-service-destinations"><span><Users size={17} />{tr({ zh: '个人订阅', en: 'Individuals' })}</span><span><Building2 size={17} />{tr({ zh: '企业订阅', en: 'Organisations' })}</span></div></div>
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

export function ReadingGuide() {
  return <div className="bp-reading-guide overview-wrap">
    <div><span className="bp-margin-label">{tr({ zh: '本计划的三个重点', en: 'THREE REASONS TO READ' })}</span><strong>{tr({ zh: '先看价值，再看如何实现。', en: 'The value, then the path to delivery.' })}</strong></div>
    {([
      ['#bp-market-size', { zh: '市场有多大', en: 'How large is the market' }, { zh: '爱好者、机构与培训消费', en: 'Enthusiasts, institutions and training spending' }],
      ['#bp-advantages', { zh: '为什么由我们做', en: 'Why this team' }, { zh: '专业、内容与产品的组合', en: 'Expertise, content and product' }],
      ['#bp-business', { zh: '如何形成收入', en: 'How revenue develops' }, { zh: '订阅、课程与线上赛事', en: 'Subscriptions, courses and online events' }],
    ] as const).map(([href, title, subtitle], i) => <a href={href} key={href}><span className="bp-guide-number">0{i + 1}</span><strong>{tr(title)}</strong><span>{tr(subtitle)}</span><ArrowUpRight size={17} /></a>)}
  </div>;
}
