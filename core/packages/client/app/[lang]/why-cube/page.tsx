'use client';

// /why-cube — "Why learn the cube", written for parents weighing a cubing class
// for their kid (and for the kids themselves). Long-form, illustrated, honestly
// sourced.
//
// Accuracy/honesty guardrails (from the research that drove the copy):
//   • Strong, citable science = spatial-ability → STEM (Wai 2009 N≈400k; Kell 2013
//     +7.6% over 30y; Uttal 2013 meta g=0.47) + spatial skills are trainable in
//     kids (Valerie 2020 cube-specific). Lean on these.
//   • Do NOT claim: cubing "raises IQ"; the mis-attributed "+15% working memory";
//     grit/growth-mindset as cube-proven (Meinz 2023 found ~0 predictive power);
//     ADHD treatment; a China national medal ranking; UNESCO recognition.
//   • Benefits are phrased as "practices/develops", not "proven to increase".
//
// i18n: prose uses the shared useT() (imported relative so `pnpm zh:gen-localt`
// fills the Traditional 3rd arg). Author 2-arg t('zh','en'); never hand-type
// Traditional here.

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sprout, Shapes, Workflow, Hand, Target, Award, Users, Sigma,
  Lightbulb, Quote, ArrowRight, BookMarked, Box, Shuffle, Scale, Timer as TimerIcon,
  Brain, FlaskConical, MonitorOff, HelpCircle,
  Layers, Search, ListChecks, TriangleAlert,
  Sparkles, Boxes, GraduationCap, MapPin,
} from 'lucide-react';
import Link from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { EventIcon } from '@/components/EventIcon';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '../../../hooks/useT';
import LiveHero from './_LiveHero';
import SolveFlow from './_SolveFlow';
import PatternGallery from './_PatternGallery';
import RecognizeGame from './_RecognizeGame';
import ScaleLadder from './_ScaleLadder';
import GodsNumberDist from './_GodsNumberDist';
import MemoryPalace from './_MemoryPalace';
import SpeedFeel from './_SpeedFeel';
import StickyToc from './_StickyToc';
import './why_cube.css';

// Server-rendered cube SVG (api.cuberoot.me). Client-only to dodge a dev
// hydration mismatch (server picks absolute API origin, client-dev picks a
// relative path). Used for the static cube imagery throughout the page.
const VisualCube = dynamic(() => import('@/components/VisualCube').then(m => m.VisualCube), {
  loading: () => <span className="wc-cube-ph" aria-hidden="true" />,
  ssr: false,
});

/* NxN family for the size line-up. */
const SIZES = [
  { n: 2, label: '2×2' }, { n: 3, label: '3×3' }, { n: 4, label: '4×4' },
  { n: 5, label: '5×5' }, { n: 6, label: '6×6' }, { n: 7, label: '7×7' },
];

/* Source URLs cited inline beneath the research callouts (also in the footer). */
const REF = {
  wai2009:     'https://cdn.vanderbilt.edu/t2-my/my-prd/wp-content/uploads/sites/826/2013/02/Wai2009SpatialAbility.pdf',
  kell2013:    'https://pubmed.ncbi.nlm.nih.gov/23846718/',
  uttal2013:   'https://groups.psych.northwestern.edu/uttal/vittae/documents/ContentServer.pdf',
  valerie:     'https://repository.isls.org/handle/1/6719',
  maguire2003: 'https://www.nature.com/articles/nn988',
  dresler2017: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5439266/',
  meinz2023:   'https://pmc.ncbi.nlm.nih.gov/articles/PMC9866889/',
  youCanDo:    'https://www.youcandothecube.com/',
  edutopia:    'https://www.edutopia.org/article/using-rubiks-cubes-teach-math/',
  who2019:     'https://www.who.int/publications/i/item/9789241550536',
  aap:         'https://publications.aap.org/pediatrics/article/138/5/e20162591/60503/Media-and-Young-Minds',
} as const;

/* ── External reference link ─────────────────────────────────── */
function Ref({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Sec({ id, eyebrow, title, lede, children }: {
  id?: string; eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode;
}) {
  return (
    <section className="wc-sec" id={id}>
      {eyebrow != null && <div className="wc-sec-eyebrow">{eyebrow}</div>}
      <h2 className="wc-sec-title">{title}</h2>
      {lede != null && <p className="wc-sec-lede">{lede}</p>}
      {children}
    </section>
  );
}

/* ── Key callout box ─────────────────────────────────────────── */
function Callout({ tone = 'accent', icon, label, children, src }: {
  tone?: 'accent' | 'info' | 'success' | 'warn'; icon?: ReactNode; label?: ReactNode; children: ReactNode;
  src?: ReactNode;
}) {
  return (
    <div className={`wc-key wc-key-${tone}`}>
      {label != null && <div className="wc-key-label">{icon}{label}</div>}
      <div className="wc-key-text">{children}</div>
      {src != null && <div className="wc-key-src">{src}</div>}
    </div>
  );
}

/* ── Icon + title + text card (benefits & CT pillars) ────────── */
function Benefit({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <div className="wc-benefit">
      <span className="wc-benefit-icon">{icon}</span>
      <div className="wc-benefit-title">{title}</div>
      <p className="wc-benefit-text">{children}</p>
    </div>
  );
}

/* ── Stat tile ───────────────────────────────────────────────── */
function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="wc-stat">
      <div className="wc-stat-value">{value}</div>
      <div className="wc-stat-label">{label}</div>
    </div>
  );
}

/* ── WCA event row ───────────────────────────────────────────── */
function Evt({ event, name, skill }: { event: string; name: ReactNode; skill: ReactNode }) {
  return (
    <div className="wc-evt">
      <span className="wc-evt-icon"><EventIcon event={event} /></span>
      <div className="wc-evt-body">
        <span className="wc-evt-name">{name}</span>
        <span className="wc-evt-skill">{skill}</span>
      </div>
    </div>
  );
}

/* ── Parent FAQ item ─────────────────────────────────────────── */
function Faq({ q, children }: { q: ReactNode; children: ReactNode }) {
  return (
    <div className="wc-faq-item">
      <div className="wc-faq-q"><HelpCircle size={17} />{q}</div>
      <p className="wc-faq-a">{children}</p>
    </div>
  );
}

/* ── Captioned cube figure ───────────────────────────────────── */
function Fig({ children, cap }: { children: ReactNode; cap?: ReactNode }) {
  return (
    <figure className="wc-fig">
      <div className="wc-fig-img">{children}</div>
      {cap != null && <figcaption className="wc-fig-cap">{cap}</figcaption>}
    </figure>
  );
}

export default function WhyCubePage() {
  useTranslation(); // subscribe to language toggle
  const t = useT();
  useDocumentTitle('玩魔方的好处', 'Why Learn the Cube');

  return (
    <div className="wc-page">
      <StickyToc />
      <div className="wc-wrap">
        {/* ── Hero ──────────────────────────────────────────── */}
        <header className="wc-hero">
          <div className="wc-hero-text">
            <div className="wc-eyebrow"><Sprout size={16} />{t('写给孩子和家长', 'For kids and parents')}</div>
            <h1 className="wc-title">
              {t('为什么让孩子', 'Why your child should ')}
              <span className="wc-accent">{t('学魔方', 'learn the cube')}</span>
            </h1>
            <p className="wc-subtitle">
              {t(
                '一块小小的方块，练的是空间想象、逻辑推理、手眼协调，还有专注与耐心。',
                'One small puzzle that trains spatial imagination, logical reasoning, hand-eye coordination, focus and patience.'
              )}
            </p>
            <p className="wc-lede">
              {t(
                '魔方不是天才的专利，而是一套可以一步一步学会的技能。下面用研究、数据和真实纪录，讲清楚孩子从玩魔方里到底能得到什么 —— 以三阶为主，也聊聊其他魔方。',
                'The cube is not reserved for prodigies — it is a skill any child can learn step by step. Below, with research, numbers and real records, is what kids actually gain from cubing — centered on the 3×3, with a look at other puzzles too.'
              )}
            </p>
          </div>
          <div className="wc-hero-cube">
            <LiveHero />
          </div>
        </header>

        {/* trust strip */}
        <div className="wc-trust">
          <Stat value="43,252,003,274,489,856,000" label={t('种可能的状态(约 4300 亿亿)', 'possible states (≈ 43 quintillion)')} />
          <Stat value={<>20</>} label={t('“上帝之数”：任意状态都能在 20 步内还原', '“God’s Number”: any state is solvable in ≤ 20 moves')} />
          <Stat value={t('3.5 亿+', '350M+')} label={t('全球累计销量，史上最畅销玩具', 'sold worldwide — the best-selling toy ever')} />
        </div>

        {/* ── Reassurance: it's a learnable skill ───────────── */}
        <Sec
          eyebrow={t('先说给家长', 'First, for parents')}
          title={t('这不是天才的游戏', 'It’s not a game for geniuses')}
          lede={t(
            '很多家长担心“我家孩子没那么聪明，学得会吗”。会的。',
            'A lot of parents worry their kid “isn’t smart enough.” They are.'
          )}
        >
          <Callout tone="success" icon={<Lightbulb size={17} />} label={t('入门法：一套能背下来的步骤', 'The beginner method is a set of memorizable steps')}>
            {t(
              '还原魔方靠的是方法，不是天赋。入门法把它拆成几个固定的、可以背下来的小公式，一层一层拼出来。任何愿意跟着做、有点耐心的孩子，都能亲手把魔方还原。那一刻“我做到了！”，才是最大的收获。',
              'Solving a cube is about method, not talent. The beginner method breaks it into a handful of fixed, memorizable little algorithms, applied layer by layer. Any child willing to follow along with a bit of patience can solve it themselves — and that first “I did it!” is the real prize.'
            )}
          </Callout>
          <p className="wc-prose">
            {t(
              '当然，要拧到比赛级别的速度，需要大量练习，也需要一点天赋 —— 就像任何一项运动。但“把它还原出来”这件事，对普通孩子来说完全够得着。一个例子：演员威尔·史密斯为了 2006 年的电影《当幸福来敲门》，在 WCA 联合创始人 Tyson Mao 指导下专门学会了还原魔方，并在镜头前真的拧好了。一个大忙人都能学会，孩子当然也可以。',
              'Getting to competition speed, of course, takes lots of practice and some aptitude — like any sport. But simply solving it is well within reach for ordinary kids. One example: actor Will Smith learned to solve the cube — coached by WCA co-founder Tyson Mao — for the 2006 film The Pursuit of Happyness, and solves it for real on camera. If a busy adult can learn it, so can a child.'
            )}
          </p>
          <p className="wc-prose">
            {t(
              '我们也不会夸大其词：没有严谨研究证明玩魔方能“提高智商”。它真正的价值，在下面这些具体而可信的能力上。',
              'We won’t overstate things either: no rigorous study shows the cube “raises IQ.” Its real value lies in the concrete, credible skills below.'
            )}
          </p>
        </Sec>

        {/* ── Six abilities ─────────────────────────────────── */}
        <Sec
          eyebrow={t('核心能力', 'Core abilities')}
          title={t('一块方块，练六种能力', 'One puzzle, six abilities')}
        >
          <SolveFlow />
          <div className="wc-benefits">
            <Benefit icon={<Shapes size={26} />} title={t('空间想象能力', 'Spatial imagination')}>
              {t(
                '还原的过程，是不断的“心理旋转”：预判一块转过去会落到哪里、在脑子里翻转整个方块。这是孩子最稀缺、也最值钱的一种思维。',
                'Solving is constant “mental rotation”: predicting where a piece lands when it turns, flipping the whole cube in your head. It is one of the scarcest — and most valuable — ways of thinking a child can build.'
              )}
            </Benefit>
            <Benefit icon={<Workflow size={26} />} title={t('逻辑与算法思维', 'Logic & algorithmic thinking')}>
              {t(
                '每一步都是“看到这个图案，就用这个公式”。先观察、再判断、再执行 —— 这正是计算机科学里“条件判断 + 算法”的雏形。',
                'Every step is “see this pattern, apply this algorithm.” Observe, decide, execute — exactly the “conditionals + algorithms” at the heart of computer science.'
              )}
            </Benefit>
            <Benefit icon={<Hand size={26} />} title={t('手眼协调', 'Hand-eye coordination')}>
              {t(
                '一次快速还原平均要拧四五十下，几秒内完成。手指的灵活度、双手的配合、眼到手到的反应速度，全都在练。',
                'A fast solve averages 40–60 turns done in a few seconds. Finger dexterity, two-handed teamwork and eye-to-hand reaction are all under training.'
              )}
            </Benefit>
            <Benefit icon={<Target size={26} />} title={t('专注与耐心', 'Focus & patience')}>
              {t(
                '一次解不开，就再来一次。魔方给孩子大量“坚持到把问题解决”的练习，也让他们慢慢学会面对挫折、不轻易放弃。',
                'If it doesn’t work, try again. The cube gives kids endless practice at sticking with a problem until it’s solved — and at facing frustration without giving up.'
              )}
            </Benefit>
            <Benefit icon={<Award size={26} />} title={t('自信与成就感', 'Confidence & achievement')}>
              {t(
                '“我会还原魔方”是一个让孩子骄傲的标签。亲手攻克一个看起来很难的东西，会悄悄变成“难的事我也能学会”的底气。',
                '“I can solve a Rubik’s Cube” is a label kids wear proudly. Conquering something that looks hard quietly becomes the belief that “I can learn hard things.”'
              )}
            </Benefit>
            <Benefit icon={<Users size={26} />} title={t('朋友与赛场', 'Friends & community')}>
              {t(
                'WCA 比赛全靠志愿者组织，气氛友善、鼓励互助。很多魔方少年最好的朋友，都是在赛场上认识的。',
                'WCA competitions are run by volunteers in a friendly, helpful spirit. Many young cubers say their best friends are the ones they met at events.'
              )}
            </Benefit>
          </div>
        </Sec>

        {/* ── What research actually says ───────────────────── */}
        <Sec
          eyebrow={t('研究怎么说', 'What the research says')}
          title={t('把“好处”交给证据', 'Letting the evidence do the talking')}
          lede={t(
            '关于魔方的好处，网上说法很多。我们只讲有据可查的部分，也老实告诉你哪些被夸大了。',
            'Plenty is claimed about the cube online. We stick to what’s actually evidenced — and we’re honest about what’s overstated.'
          )}
        >
          <div className="wc-trust wc-trust-tight">
            <Stat value={t('40 万', '400k')} label={t('Wai 等(2009)追踪约 40 万名学生 11 年的研究', 'students tracked 11+ years in Wai et al. (2009)')} />
            <Stat value={t('217 项', '217')} label={t('Uttal 等(2013)汇总 217 项训练研究的元分析', 'training studies in Uttal et al.’s (2013) meta-analysis')} />
            <Stat value="+7.6%" label={t('30 年追踪中，空间能力在数学、语文之外额外解释的成就差异(Kell 等 2013)', 'extra variance in achievement spatial ability explained over 30 years, beyond math & verbal (Kell et al. 2013)')} />
          </div>
          <Callout
            tone="info"
            icon={<FlaskConical size={17} />}
            label={t('空间能力，能预测理工科(STEM)成就', 'Spatial ability predicts STEM success')}
            src={<>{t('来源', 'Sources')}: <Ref href={REF.wai2009}>Wai et al. 2009</Ref>, <Ref href={REF.kell2013}>Kell et al. 2013</Ref></>}
          >
            {t(
              '一项追踪约 40 万名美国学生、长达十余年的研究发现：青少年时期的空间能力，能在数学和语文成绩之外，额外预测他们日后在理工科领域的成就 —— 研究者称之为人才识别中“沉睡的巨人”。一项 30 年的追踪进一步显示，空间能力相比单看数学、语文，能多解释约 7.6% 的创造性成果(专利、论文)差异。魔方，正是一种典型的空间练习。',
              'A study tracking ~400,000 U.S. students for over a decade found that spatial ability in adolescence predicts later success in STEM — over and above math and verbal scores — which researchers called a “sleeping giant” of talent identification. A 30-year follow-up found spatial ability explained about 7.6% more of real-world creative output (patents, papers) than math and verbal alone. The cube is a textbook spatial workout.'
            )}
          </Callout>
          <Callout
            tone="success"
            icon={<Sprout size={17} />}
            label={t('而且，空间能力是可以练出来的', 'And spatial skills can be trained')}
            src={<>{t('来源', 'Sources')}: <Ref href={REF.uttal2013}>Uttal et al. 2013</Ref>, <Ref href={REF.valerie}>Valerie et al. (Rubik’s &amp; mental rotation)</Ref></>}
          >
            {t(
              '一项汇总了 217 项训练研究的元分析显示，空间能力可以通过练习明显提升(平均效应量 g≈0.47)，效果能保持、还能迁移到没练过的空间任务，而且对 13 岁以下的孩子尤其明显。更直接的是，一项针对初中生的研究发现：专门的魔方训练，显著提升了他们在二维和三维“心理旋转”测试上的表现。',
              'A meta-analysis of 217 training studies found spatial skills improve markedly with practice (average effect size g≈0.47), with durable gains that transfer to untrained spatial tasks — and the effect is largest in children under 13. More directly, a study of middle-schoolers found that dedicated Rubik’s-cube practice significantly improved their scores on 2-D and 3-D mental-rotation tests.'
            )}
          </Callout>
          <Callout
            tone="warn"
            icon={<TriangleAlert size={17} />}
            label={t('我们刻意不夸大的部分', 'What we deliberately don’t claim')}
            src={<>{t('来源', 'Sources')}: <Ref href={REF.meinz2023}>Meinz et al. 2023</Ref></>}
          >
            {t(
              '没有研究证明魔方能“提高智商”。常被转发的“玩魔方让记忆力提升 15%”其实是误传 —— 那项研究是针对 50 岁以上成年人做填字、数独，而且只是相关性，跟魔方、跟孩子都无关。在一项 79 人的对照实验里，“坚毅”和“成长型思维”都预测不了谁学得更快。所以我们把魔方当作锻炼空间与逻辑的好载体，而不是包治百病的“聪明药”。',
              'No study shows the cube “raises IQ.” The often-shared “cubing improves memory by 15%” is a misattribution — that finding was about crosswords and Sudoku in adults over 50, was merely correlational, and had nothing to do with cubes or children. In a controlled study of 79 people, neither “grit” nor “growth mindset” predicted who learned faster. So we treat the cube as a great vehicle for spatial and logical practice — not a cure-all “smart pill.”'
            )}
          </Callout>
        </Sec>

        {/* ── Memory / blindfolded ──────────────────────────── */}
        <Sec
          eyebrow={t('记忆力', 'Memory')}
          title={t('记忆，也是一种可以训练的技术', 'Memory is a trainable technique, too')}
          lede={t(
            '在“盲拧”项目里，选手先看几眼、把整个魔方记进脑子，再蒙上眼睛还原。这背后是一套真实可学的记忆方法。',
            'In “blindfolded” events, a solver studies the cube, memorizes the whole thing, then solves it with eyes covered — using a real, learnable memory technique.'
          )}
        >
          <Callout
            tone="accent"
            icon={<Brain size={17} />}
            label={t('盲拧 = “记忆宫殿”的实战', 'Blindfolded solving = the memory palace, in action')}
            src={<>{t('来源', 'Sources')}: <Ref href={REF.maguire2003}>Maguire et al. 2003</Ref>, <Ref href={REF.dresler2017}>Dresler et al. 2017</Ref></>}
          >
            {t(
              '盲拧选手把每块的位置编成字母或画面，再挂到一条熟悉的“记忆路线”上 —— 这正是记忆大师用的“记忆宫殿”(位置记忆法)。一项经典研究发现：顶尖记忆者的智商并不比常人高，大脑结构也没有特别之处，十人里有九人用的就是这套方法。另一项研究让 51 名普通人训练六周，记忆力就有了可维持数月的明显提升。换句话说，记忆力是练出来的技术，不是天生的天赋 —— 而盲拧，正好在教这门技术。',
              'A blindfolded solver encodes each piece into letters or images and hangs them on a familiar “memory journey” — exactly the “memory palace” (method of loci) that memory champions use. A landmark study found top memorizers had no higher IQ and no special brain structure; nine of ten simply used this method. In another, 51 ordinary people trained for six weeks and gained lasting memory improvements. Memory, in other words, is a trainable technique — not an innate gift — and blindfolded cubing teaches it.'
            )}
          </Callout>
          <MemoryPalace />
        </Sec>

        {/* ── Math ──────────────────────────────────────────── */}
        <Sec
          eyebrow={t('魔方与数学', 'The cube & math')}
          title={t('一道你能拿在手里的数学题', 'A math problem you can hold in your hands')}
          lede={t(
            '魔方本身就是一个活生生的数学对象 —— 数学家管它叫“魔方群”。',
            'The cube is itself a living mathematical object — mathematicians call it the “Rubik’s Cube group.”'
          )}
        >
          <div className="wc-trust wc-trust-tight">
            <Stat value={<>4.3×10<sup>19</sup></>} label={t('总共 43,252,003,274,489,856,000 种状态', '43,252,003,274,489,856,000 states in total')} />
            <Stat value="20" label={t('上帝之数：2010 年由四位研究者借助谷歌约 35 个 CPU 年的算力证明', 'God’s Number — proved in 2010 with ≈ 35 CPU-years donated by Google')} />
            <Stat value={t('非阿贝尔群', 'Non-abelian')} label={t('转动顺序会改变结果(先 F 后 R ≠ 先 R 后 F)', 'order matters — F then R ≠ R then F')} />
          </div>
          <p className="wc-prose">
            {t(
              '六个面的转动，就能“生成”全部 4300 亿亿种状态。这里藏着排列组合、奇偶性这些数学概念：你没法只翻动一个棱块、只拧一个角块，或只交换一对块 —— 这些“做不到的事”正是群论里的奇偶约束。而解法里一段段“公式”，本质上是数学家说的“换位子”(commutator / conjugate)：只精准地移动几块、不破坏其余，这正是高效解法的核心思想。',
              'Just six face turns “generate” all 43 quintillion states. Hidden inside are permutations, combinations and parity: you can’t flip a single edge, twist a single corner, or swap just one pair — those “impossible” moves are exactly the parity constraints of group theory. And each solving “algorithm” is really what mathematicians call a commutator or conjugate: move a few pieces precisely while leaving the rest intact — the core idea behind every efficient method.'
            )}
          </p>
          <h3 className="wc-subhead">{t('这个数字到底有多大?', 'Just how big is that number?')}</h3>
          <ScaleLadder />
          <p className="wc-prose">
            {t(
              '“上帝之数”是 20：任何打乱都能在 20 步以内还原，这在 2010 年被证明。但绝大多数状态远用不到 20 步 —— 在那 4300 亿亿种里，真正需要满 20 步的只有大约 4.9 亿种，凤毛麟角。',
              'God’s Number is 20: any scramble can be solved in at most 20 moves, proven in 2010. But the vast majority of states need far fewer — of those 43 quintillion, only about 490 million actually require the full 20, a vanishingly small fraction.'
            )}
          </p>
          <h3 className="wc-subhead">{t('把全部状态按步数摊开', 'Every state, sorted by move count')}</h3>
          <GodsNumberDist />
          <Callout
            tone="accent"
            icon={<Sigma size={17} />}
            label={t('世界各地的学校在用魔方教数学', 'Schools worldwide use the cube to teach math')}
            src={<>{t('来源', 'Sources')}: <Ref href={REF.youCanDo}>You CAN Do the Rubik’s Cube</Ref>, <Ref href={REF.edutopia}>Edutopia</Ref></>}
          >
            {t(
              '官方教育项目“You CAN Do the Rubik’s Cube”已进入全美 50 个州、超过 1600 所学校；在一次面向 251 位老师的调查里，99% 表示满意，学校还能免费借用最多 600 个魔方、为期六周。老师们用魔方教表面积、体积和展开图，用一个面讲分数(“红色占几分之几？”)，用 9、16、25 个小方块摆出勾股定理 a²+b²=c²，还用 4300 亿亿这个数字引出阶乘。一个说“我不喜欢数学”的孩子，却愿意为了拼好魔方动脑筋 —— 这就是它的魔力。',
              'The official “You CAN Do the Rubik’s Cube” program runs in over 1,600 schools across all 50 U.S. states; in a survey of 251 teachers, 99% were satisfied, and schools can borrow up to 600 cubes free for six weeks. Teachers use cubes to teach surface area, volume and nets; a single face to explain fractions (“what fraction is red?”); 9, 16 and 25 cubies arranged into a right triangle to show the Pythagorean theorem a²+b²=c²; and that 43-quintillion figure to introduce factorials. A kid who says “I don’t like math” will still think hard to solve a cube — that’s the magic.'
            )}
          </Callout>

          <h3 className="wc-subhead"><Sparkles size={20} className="wc-subhead-icon" />{t('六面转动，拼出无穷花样', 'Six faces, endless patterns')}</h3>
          <p className="wc-prose wc-prose-tight">
            {t(
              '同样的六种转动，既能把魔方还原，也能拼出对称、规律的图案。这些图案本身就是排列组合的直观展示 —— 下面每一个，都只是那 4300 亿亿种状态里的一种。',
              'The same six turns that solve the cube can also build symmetric, rule-based patterns — each a visual taste of combinatorics. Every one below is just a single state out of those 43 quintillion.'
            )}
          </p>
          <PatternGallery />
        </Sec>

        {/* ── Computational thinking ────────────────────────── */}
        <Sec
          eyebrow={t('魔方与编程思维', 'The cube & coding')}
          title={t('解魔方，就是在写算法', 'Solving a cube is writing algorithms')}
          lede={t(
            '计算机科学家把“计算思维”拆成四块，而解魔方刚好把这四块都练了一遍。',
            'Computer scientists break “computational thinking” into four pieces — and solving a cube exercises all four.'
          )}
        >
          <div className="wc-benefits wc-benefits-4">
            <Benefit icon={<Layers size={24} />} title={t('分解', 'Decomposition')}>
              {t('不一次解完整个魔方，而是拆成一层一层、一步一步：先十字，再第一层……', 'Don’t solve it all at once — break it into layers and steps: the cross first, then the first layer…')}
            </Benefit>
            <Benefit icon={<Search size={24} />} title={t('模式识别', 'Pattern recognition')}>
              {t('认出当前是哪一种情形，立刻想到该用哪段公式 —— 和读题、套方法一模一样。', 'Recognize which case you’re in and recall which algorithm applies — just like spotting a problem type and applying a method.')}
            </Benefit>
            <Benefit icon={<Box size={24} />} title={t('抽象', 'Abstraction')}>
              {t('忽略此刻用不到的颜色，只盯着这一步要移动的那几块，抓住关键、过滤干扰。', 'Ignore the colors that don’t matter right now and track only the pieces this step moves — keep what’s relevant, filter the rest.')}
            </Benefit>
            <Benefit icon={<ListChecks size={24} />} title={t('算法', 'Algorithms')}>
              {t('一段“公式”就是一个算法：固定、可重复、结果确定的步骤序列。', 'A “formula” is an algorithm: a fixed, repeatable sequence of steps with a guaranteed result.')}
            </Benefit>
          </div>
          <p className="wc-prose wc-prose-tight">
            {t(
              '高手的最后一层就是这样解的：先“认出”是哪种情形，再“执行”对应的那段公式 —— 跟程序里的“如果…就…”一模一样。',
              'That’s exactly how experts finish the last layer: first recognize which case you’re in, then run the matching algorithm — just like an “if … then …” in code.'
            )}
          </p>
          <RecognizeGame />
          <p className="wc-prose">
            {t(
              '这也是为什么很多孩子从魔方一路走向编程：让程序或机器人自动解魔方，本身就是一道经典的算法练习。',
              'That’s why many kids go from the cube to coding: getting a program or robot to solve a cube is a classic algorithms exercise in its own right.'
            )}
          </p>
        </Sec>

        {/* ── Screen-free ───────────────────────────────────── */}
        <Sec
          eyebrow={t('不用屏幕', 'Screen-free')}
          title={t('一间装进口袋的“离线大脑健身房”', 'A pocket-sized, offline brain gym')}
          lede={t(
            '在屏幕越来越多的童年里，魔方难得地把动手、动脑和专注重新拉回到屏幕之外。',
            'In an increasingly screen-filled childhood, the cube is a rare way to put hands, mind and focus back offline.'
          )}
        >
          <p className="wc-prose">
            {t(
              '世界卫生组织(2019)建议：2 岁以下不安排看屏幕的久坐时间，2 到 4 岁每天不超过 1 小时，越少越好。美国儿科学会(AAP)的建议类似：18 个月以下除视频通话外尽量不用屏幕，2 到 5 岁每天高质量内容不超过 1 小时。魔方恰好是个反方向的选择 —— 它便携、安静、纯靠手感，不发光、没有让人停不下来的推送，坐车、课间、睡前都能玩上几分钟。',
              'The World Health Organization (2019) advises: no sedentary screen time for children under 2, and no more than 1 hour a day for ages 2–4 (“less is better”). The American Academy of Pediatrics says much the same: discourage screens (other than video chat) under 18 months, and cap ages 2–5 at 1 hour a day of high-quality content. The cube points the other way — portable, quiet, purely tactile, no glow and no endless feed, good for a few minutes on the bus, at recess or before bed.'
            )}
          </p>
          <Callout
            tone="info"
            icon={<MonitorOff size={17} />}
            label={t('我们不把屏幕一棍子打死', 'We’re not anti-screen')}
            src={<>{t('来源', 'Sources')}: <Ref href={REF.who2019}>WHO 2019</Ref>, <Ref href={REF.aap}>AAP (Media &amp; Young Minds)</Ref></>}
          >
            {t(
              '这些建议针对的是“时长和内容质量”，而不是说屏幕一无是处。魔方的价值，在于它提供了一个同样有吸引力、却完全离线的选择 —— 让孩子愿意主动放下手机。',
              'Those guidelines are about screen time and content quality, not a claim that screens are all bad. The cube’s value is offering an equally engaging but entirely offline option — something a kid will happily put the phone down for.'
            )}
          </Callout>
        </Sec>

        {/* ── Beyond 3x3 ────────────────────────────────────── */}
        <Sec
          eyebrow={t('不止三阶', 'Beyond the 3×3')}
          title={t('学会三阶，只是开始', 'The 3×3 is just the beginning')}
          lede={t(
            'WCA(世界魔方协会)一共有 17 个官方项目，每一个都在练不同的能力。孩子总能找到自己最喜欢的那一个。',
            'The WCA (World Cube Association) holds 17 official events, each training a different skill. Every kid finds a favorite.'
          )}
        >
          <div className="wc-sizes">
            {SIZES.map(s => (
              <Fig key={s.n} cap={s.label}>
                <VisualCube algorithm="" view="iso" puzzleSize={s.n} size={96} alt={`${s.label} cube`} loading="lazy" />
              </Fig>
            ))}
          </div>
          <p className="wc-prose wc-prose-tight">
            {t(
              '从二阶到七阶，玩法一脉相承 —— 阶数越高，要照顾的块越多，规划和耐心的要求也越高。',
              'From 2×2 to 7×7 the idea is the same — the more layers, the more pieces to manage, and the more planning and patience it asks for.'
            )}
          </p>
          <h3 className="wc-subhead"><Boxes size={20} className="wc-subhead-icon" />{t('17 个官方项目', 'The 17 official events')}</h3>
          <div className="wc-evt-grid">
            <Evt event="222"    name={t('二阶', '2×2')}            skill={t('只有八个角块，最快上手 —— 孩子的第一个项目', 'Just eight corners — the easiest first event')} />
            <Evt event="333"    name={t('三阶', '3×3')}            skill={t('旗舰项目：速度、识别、手指技巧的全能练习', 'The flagship — speed, recognition and finger tricks combined')} />
            <Evt event="444"    name={t('四阶', '4×4')}            skill={t('要先拼中心、配棱块，还要处理“奇偶”', 'Build centers, pair edges, and handle parity')} />
            <Evt event="555"    name={t('五阶', '5×5')}            skill={t('更大的还原规划，也更考验耐心', 'Bigger-picture planning and patience')} />
            <Evt event="666"    name={t('六阶', '6×6')}            skill={t('一致性与大方块技巧', 'Consistency and big-cube technique')} />
            <Evt event="777"    name={t('七阶', '7×7')}            skill={t('耐力与有条理的中心、棱块处理', 'Endurance and methodical center/edge work')} />
            <Evt event="333oh"  name={t('三阶单手', '3×3 One-Handed')} skill={t('单手转动，练灵活度与效率', 'One-handed turning — dexterity and efficiency')} />
            <Evt event="333bf"  name={t('三阶盲拧', '3×3 Blindfolded')} skill={t('先记忆、再蒙眼还原 —— 记忆力与空间想象', 'Memorize, then solve blind — memory and visualization')} />
            <Evt event="333fm"  name={t('三阶最少步', 'Fewest Moves')}  skill={t('一小时纸笔推演，找出最短解法', 'One hour, pencil and paper, to find the shortest solution')} />
            <Evt event="minx"   name={t('五魔方', 'Megaminx')}      skill={t('十二面体，在非立方体上做图案识别', 'A dodecahedron — pattern recognition off the cube')} />
            <Evt event="pyram"  name={t('金字塔', 'Pyraminx')}      skill={t('四面体，直觉、快速，适合孩子', 'A tetrahedron — intuitive, fast, kid-friendly')} />
            <Evt event="skewb"  name={t('斜转', 'Skewb')}          skill={t('沿角转动的立方体，纯直觉空间推理', 'A corner-turning cube — pure intuitive reasoning')} />
            <Evt event="sq1"    name={t('SQ1', 'Square-1')}        skill={t('会变形的魔方，练抽象的空间思维', 'A shape-shifting puzzle — abstract spatial thinking')} />
            <Evt event="clock"  name={t('魔表', 'Clock')}          skill={t('转盘机械结构，顺序逻辑，无需背公式', 'A dial puzzle — sequential logic, no memorized algorithms')} />
            <Evt event="444bf"  name={t('四阶盲拧', '4×4 Blindfolded')} skill={t('更大的盲拧，更长的记忆', 'Bigger blindfolded — more to memorize')} />
            <Evt event="555bf"  name={t('五阶盲拧', '5×5 Blindfolded')} skill={t('顶级的记忆与专注', 'Elite memory and concentration')} />
            <Evt event="333mbf" name={t('多个盲拧', 'Multi-Blind')} skill={t('一次记住很多个魔方，再全部蒙眼还原', 'Memorize many cubes at once, then solve them all blind')} />
          </div>

          <h3 className="wc-subhead">{t('还有这些好玩的非官方魔方', 'And these fun non-WCA puzzles')}</h3>
          <div className="wc-fun">
            <div className="wc-fun-item"><b>{t('镜面魔方', 'Mirror Cube')}</b>{t('全是同一种颜色，靠块的大小和形状分辨 —— 练形状识别。', 'All one color — you track shape and size instead, training shape recognition.')}</div>
            <div className="wc-fun-item"><b>{t('幽灵魔方', 'Ghost Cube')}</b>{t('错位切割，只有还原时才严丝合缝，纯空间挑战。', 'Offset cuts that only line up when solved — a pure spatial challenge.')}</div>
            <div className="wc-fun-item"><b>{t('齿轮魔方', 'Gear Cube')}</b>{t('外露的齿轮联动，转一圈要好几下，讲机械与旋转。', 'Visible interlocking gears — teaches mechanics and rotation.')}</div>
            <div className="wc-fun-item"><b>{t('Fisher 魔方', 'Fisher Cube')}</b>{t('把三阶旋转 45° 做成的变形，经典入门变种。', 'A 3×3 turned 45° — the classic shape-mod to start with.')}</div>
            <div className="wc-fun-item"><b>{t('2×2×3 塔形', '2×2×3 Tower')}</b>{t('长方体，温和地引入“形状会变”的概念。', 'A cuboid that gently introduces shape-changing solves.')}</div>
          </div>
        </Sec>

        {/* ── How to start ──────────────────────────────────── */}
        <Sec
          eyebrow={t('怎么开始', 'How to start')}
          title={t('一个便宜的魔方，加上几个公式', 'One cheap cube and a few formulas')}
          lede={t(
            '入门的门槛低到惊人 —— 这大概是它最适合孩子的地方之一。',
            'The barrier to entry is astonishingly low — perhaps one of the best things about it for kids.'
          )}
        >
          <div className="wc-trust wc-trust-tight">
            <Stat value={t('约 ¥30–100', '≈ $10–15')} label={t('一个不错的磁力速拧的价格，够用了', 'a good magnetic speedcube — that’s all you need')} />
            <Stat value={t('约 7 个', '≈ 7')} label={t('入门法需要背的公式数量', 'algorithms to memorize in the beginner method')} />
            <Stat value={t('几天到几周', 'Days–weeks')} label={t('大多数孩子学会第一次完整还原所需的时间', 'for most kids to reach their first full solve')} />
          </div>
          <ol className="wc-steps">
            <li>
              <b>{t('先学入门层先法。', 'Start with the beginner, layer-by-layer method.')}</b>
              {t('底层十字 → 拼好底层 → 第二层 → 顶层，整套只需要记住 6 到 7 个短公式(比如 R U R′ U′)。', 'Bottom cross → first layer → second layer → last layer. The whole thing needs just 6–7 short algorithms (like R U R′ U′).')}
            </li>
            <li>
              <b>{t('想更快，再进阶到 CFOP。', 'For speed, graduate to CFOP.')}</b>
              {t('Cross→F2L→OLL→PLL 四个阶段，全套 119 个公式(41+57+21)，但可以从约 16 个起步，慢慢往上加，不用一口气背完。', 'Four stages — Cross→F2L→OLL→PLL — 119 algorithms in full (41+57+21), but you can start with about 16 and add gradually; no need to learn them all at once.')}
            </li>
            <li>
              <b>{t('用免费资源 + 本站工具。', 'Use free resources plus the tools here.')}</b>
              {t('网上有大量免费教程(如 jperm.net)，配合 CubeRoot 的公式库、模拟魔方、计时器和打乱，就能边学边练。', 'There are tons of free tutorials online (such as jperm.net); pair them with CubeRoot’s algorithm library, cube simulator, timer and scrambles to learn and drill.')}
            </li>
          </ol>
          <p className="wc-prose">
            {t(
              '报班的好处是有同伴、有及时的正反馈、进度更系统，孩子更容易坚持；但自学也完全可行，资料免费且充足。最稳妥的做法：先给孩子买(或借)一个便宜的魔方，看他喜不喜欢，再决定要不要报课。',
              'A class brings peers, timely encouragement and a structured pace, which helps kids stick with it; but self-teaching works fine too, with free and plentiful material. The safest move: get (or borrow) a cheap cube first, see whether your child enjoys it, then decide on a class.'
            )}
          </p>
        </Sec>

        {/* ── What age ──────────────────────────────────────── */}
        <Sec
          eyebrow={t('几岁可以开始', 'What age to start')}
          title={t('比年龄更重要的，是兴趣', 'Interest matters more than age')}
        >
          <p className="wc-prose">
            {t(
              '大多数孩子在 7 到 8 岁左右就能学会入门法(魔方包装上常见的适用年龄是 8 岁以上);5 到 6 岁的小朋友，可以在大人带领下慢慢拼，或先从二阶起步 ——“二阶适合更小的孩子”是教学上的惯例，而不是官方标注的年龄。比赛其实没有最低年龄：WCA 规定任何人都能参赛，18 岁以下需要家长同意；在中国，甚至有 3 岁多的小朋友站上过赛场。说到底，没有硬性的年龄门槛 —— 决定能不能学下去的，是兴趣和愿不愿意多试几次。',
              'Most kids can pick up the beginner method around age 7–8 (cube packaging is usually rated 8+); 5- to 6-year-olds can work through it with an adult’s help, or start on a 2×2 — “the 2×2 suits younger kids” is a coaching convention, not the official age rating. Competitions actually have no minimum age: WCA rules let anyone compete, with parental consent for under-18s; in China, children as young as three have taken the stage. In the end there’s no hard cutoff — what decides whether it sticks is interest and willingness to try again.'
            )}
          </p>
        </Sec>

        {/* ── Competition culture + records ─────────────────── */}
        <Sec
          eyebrow={t('走进赛场', 'Into competition')}
          title={t('这是给所有人的运动', 'A sport for everyone')}
        >
          <div className="wc-trust wc-trust-tight">
            <Stat value={t('28 万+', '282k+')} label={t('迄今参加过 WCA 比赛的人数', 'people have competed in WCA events to date')} />
            <Stat value={t('1.6 万+', '16,600+')} label={t('已经举办过的 WCA 比赛场次', 'WCA competitions have been held')} />
            <Stat value={t('100+ 国', '100+')} label={t('举办过比赛的国家和地区数', 'countries and regions have hosted competitions')} />
            <Stat value="2004" label={t('世界魔方协会(WCA)成立的年份', 'the year the World Cube Association was founded')} />
          </div>
          <Callout tone="accent" icon={<Users size={17} />} label={t('WCA 的宗旨', 'The spirit of the WCA')}>
            {t(
              '“来自世界各地的人，在友好的氛围里一起享受乐趣，互相帮助，展现体育精神。” 任何人都能报名参赛，18 岁以下需家长同意，所有年龄、所有水平都受欢迎。第一次比赛通常轻松友好，慢一点完全没关系 —— 很多人会告诉你，比赛本身才是玩魔方最开心的部分。',
              '“People from all over the world have fun together in a friendly atmosphere, help each other and show good sportsmanship.” Anyone can enter (under-18s with a guardian’s consent), and all ages and skill levels are welcome. A first competition is usually relaxed and friendly, and being slow is perfectly fine — many cubers say the competitions are the best part of the hobby.'
            )}
          </Callout>
          <h3 className="wc-subhead">{t('一些让人热血的纪录', 'A few records to get excited about')}</h3>
          <div className="wc-trust wc-trust-tight">
            <Stat value={t('2.76 秒', '2.76 s')} label={t('三阶单次世界纪录，波兰选手 Teodor Zajder 于 2026 年创造，人类首次突破 3 秒', '3×3 single world record — set in 2026 by Poland’s Teodor Zajder, the first-ever sub-3')} />
            <Stat value={t('3.71 秒', '3.71 s')} label={t('三阶平均世界纪录，由中国选手耿暄一保持', '3×3 average world record — held by China’s Xuanyi Geng')} />
            <Stat value={t('95 岁', 'Age 95')} label={t('一位 95 岁的爷爷也在正式比赛里还原了魔方', 'a 95-year-old solved the cube at an official competition')} />
            <Stat value={t('0.103 秒', '0.103 s')} label={t('机器人最快还原纪录，由普渡大学的学生亲手打造', 'fastest robot solve — built by Purdue University students')} />
          </div>
          <p className="wc-prose">
            {t(
              '当今顶尖的纪录，有不少是由八九岁的孩子保持的，而九十多岁的长者也在同一个联盟里比赛。魔方面前，年龄从来不是门槛 —— 它只奖励愿意一次次尝试的人。',
              'Many of today’s top records are held by eight- and nine-year-olds, while people in their nineties compete in the same federation. Age has never been a barrier — the cube only rewards those willing to keep trying.'
            )}
          </p>
          <h3 className="wc-subhead">{t('2.76 秒到底有多快?', 'Just how fast is 2.76 seconds?')}</h3>
          <SpeedFeel />
        </Sec>

        {/* ── China context ─────────────────────────────────── */}
        <Sec
          eyebrow={t('中国孩子的舞台', 'China’s stage')}
          title={t('中国是名副其实的速拧强国', 'China is a true speedcubing powerhouse')}
          lede={t(
            '对中国家庭来说，这还是一项孩子真有机会站上世界顶端的运动。',
            'For Chinese families, this is also a sport where a kid can genuinely reach the very top.'
          )}
        >
          <ul className="wc-list">
            <li>{t('2018 年，一位中国选手在国内公开赛上拧出 3.47 秒，成为人类首个在正式比赛中突破 4 秒的单次成绩 —— 这个世界纪录保持了约四年半。', 'In 2018, a Chinese competitor set 3.47 seconds at a domestic open — the first-ever sub-4 single in official competition — a world record that stood for about four and a half years.')}</li>
            <li>{t('史上最年轻的三阶世界纪录保持者之一也来自中国 —— 创造单次纪录时年仅 8 岁；如今的三阶平均世界纪录(3.71 秒)同样由中国选手保持。', 'One of the youngest-ever 3×3 world-record holders is also from China — just 8 years old at the time; the current 3×3 average world record (3.71s) is held by a Chinese competitor too.')}</li>
            <li>{t('正式比赛中第一个把三阶平均成绩拧进 4 秒以内(3.91 秒)的，同样是一位中国选手，也是现任 WCA 三阶世界冠军。', 'The first person to average under 4 seconds in official competition (3.91s) is a Chinese competitor as well — the reigning WCA 3×3 world champion.')}</li>
            <li>{t('二阶单次世界纪录(0.39 秒)同样出自中国选手之手。', 'The 2×2 single world record (0.39s) is held by a Chinese competitor too.')}</li>
            <li>{t('中国队还拿下了 2025 年 WCA 世界锦标赛的国家杯。国内有成熟的赛事与统计组织，比赛遍地开花。', 'China also won the Nations Cup at the 2025 WCA World Championship. The domestic scene has mature event and ranking organizations, with competitions held all over the country.')}</li>
          </ul>
        </Sec>

        {/* ── Parent FAQ ────────────────────────────────────── */}
        <Sec
          eyebrow={t('家长最常问的', 'Parents’ FAQ')}
          title={t('报班前，你大概想知道这些', 'What you probably want to know before signing up')}
        >
          <div className="wc-faq">
            <Faq q={t('需要天赋吗？', 'Does it take talent?')}>
              {t('不需要。入门法是固定的、可以背的步骤，任何愿意跟着做的孩子都能把魔方还原。想拧得很快才需要大量练习，就像任何一项运动。', 'No. The beginner method is a fixed, memorizable set of steps that any willing child can follow to a full solve. Getting fast takes lots of practice — like any sport — but solving it does not require talent.')}
            </Faq>
            <Faq q={t('几岁合适？', 'What age is right?')}>
              {t('大多数 7–8 岁的孩子能学会入门法，5–6 岁可在大人带领下或先玩二阶；包装上常标 8 岁以上。没有硬性年龄线，兴趣最重要。', 'Most 7–8-year-olds can learn the beginner method; 5–6-year-olds can start with help or on a 2×2; packaging is usually rated 8+. There’s no hard cutoff — interest matters most.')}
            </Faq>
            <Faq q={t('要花很多钱吗？', 'Is it expensive?')}>
              {t('不用。一个不错的磁力速拧大约 ¥30–100，再加上网上免费的教程，就足够入门了。', 'No. A good magnetic speedcube runs about ¥30–100 (≈$10–15), and with free online tutorials that’s enough to start.')}
            </Faq>
            <Faq q={t('会影响学习吗？', 'Will it hurt schoolwork?')}>
              {t('它便携、自定节奏，可以利用 5–10 分钟的碎片时间，不发光也没有推送。和任何爱好一样，保持好平衡就行。', 'It’s portable and self-paced, fits into 5–10-minute gaps, with no glow and no notifications. Like any hobby, just keep it balanced.')}
            </Faq>
            <Faq q={t('自学还是报班？', 'Self-teach or take a class?')}>
              {t('都行。自学的资料免费又充足；报班的好处是有同伴、有正反馈、进度更系统，孩子更容易坚持。可以先借个魔方，看孩子喜不喜欢再决定。', 'Either works. Self-teaching material is free and plentiful; a class adds peers, encouragement and structure, helping kids persist. Borrow a cube first and see if your child enjoys it.')}
            </Faq>
            <Faq q={t('学了到底有什么用？', 'What does a kid actually gain?')}>
              {t('锻炼空间想象、逻辑与算法思维、专注力和手眼协调(上文的研究都指向这些);而最实在的，是亲手攻克难题带来的那份自信。', 'It develops spatial imagination, logical and algorithmic thinking, focus and hand-eye coordination (as the research above points to) — and, most tangibly, the confidence of conquering something hard.')}
            </Faq>
          </div>
        </Sec>

        {/* ── History ───────────────────────────────────────── */}
        <Sec
          eyebrow={t('一个为教学而生的玩具', 'A toy born to teach')}
          title={t('它一开始，就是个教具', 'It started life as a teaching tool')}
        >
          <p className="wc-prose">
            {t(
              '1974 年，匈牙利的建筑与设计教授 Ernő Rubik 做出了第一个魔方，起初叫“魔术方块”。他一半是想给学生演示三维空间关系，一半是在解决一个结构难题：怎么让一堆小块各自转动，又不散架。有意思的是，连他本人，第一次把魔方打乱后，也花了大约一个月才重新还原。1980 年，它以“Rubik’s Cube”之名走向世界，成为史上最畅销的玩具 —— 到 2018 年已售出超过 3.5 亿个。',
              'In 1974, Hungarian architecture-and-design professor Ernő Rubik built the first cube — originally the “Magic Cube.” He meant it partly to show students three-dimensional spatial relationships, and partly to crack a structural puzzle: how to let a cluster of small parts each turn freely without falling apart. Tellingly, even he took about a month to first solve it after scrambling it. In 1980 it went global as the “Rubik’s Cube,” becoming the best-selling toy in history — over 350 million sold by 2018.'
            )}
          </p>
          <figure className="wc-quote">
            <Quote className="wc-quote-mark" size={26} aria-hidden="true" />
            <blockquote>
              {t(
                '“如果你足够好奇，你会在身边发现各种各样的谜题；如果你足够坚定，你会把它们一一解开。”',
                '“If you are curious, you will find the puzzles around you. If you are determined, you will solve them.”'
              )}
            </blockquote>
            <figcaption>— Ernő Rubik</figcaption>
          </figure>
        </Sec>

        {/* ── CTA: start on CubeRoot ────────────────────────── */}
        <Sec
          eyebrow={t('在 CubeRoot 上开始', 'Start on CubeRoot')}
          title={t('准备好了，就动手试试', 'Ready? Give it a try')}
        >
          <div className="wc-cta-grid">
            <Link href="/tutorial/cfop-tutorial" className="wc-cta"><GraduationCap size={22} /><span>{t('入门教程', 'Beginner tutorial')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/alg" className="wc-cta"><BookMarked size={22} /><span>{t('公式库', 'Algorithms')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/sim" className="wc-cta"><Box size={22} /><span>{t('模拟魔方', 'Cube simulator')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/timer" className="wc-cta"><TimerIcon size={22} /><span>{t('计时器', 'Timer')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/scramble" className="wc-cta"><Shuffle size={22} /><span>{t('打乱', 'Scrambles')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/wca/comp" className="wc-cta"><MapPin size={22} /><span>{t('找比赛', 'Find a competition')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/regulation" className="wc-cta"><Scale size={22} /><span>{t('规则图解', 'Regulations')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
            <Link href="/math" className="wc-cta"><Sigma size={22} /><span>{t('魔方与数学', 'The math')}</span><ArrowRight size={16} className="wc-cta-arrow" /></Link>
          </div>
        </Sec>

        {/* ── Sources ───────────────────────────────────────── */}
        <footer className="wc-footer">
          <p>
            {t(
              '本文为面向家长和孩子的科普介绍，内容综合自下列公开资料。我们刻意保持克制：益处以“锻炼/培养”表述，空间能力等结论引自正规研究，不夸大“提高智商”一类说法；比赛纪录与人物事迹均以公开报道与官方数据为准，可能随新纪录而变化。',
              'This is an educational overview for parents and kids, compiled from the public sources below. We deliberately stay measured: benefits are framed as “practices/develops,” spatial-ability claims come from peer-reviewed research, and we avoid overclaims like “raises IQ.” Records and personal feats follow public reporting and official data, and may change as new records are set.'
            )}
          </p>
          <p className="wc-sources">
            <a href="https://www.worldcubeassociation.org/regulations/" target="_blank" rel="noopener noreferrer">WCA Regulations</a>
            <a href="https://en.wikipedia.org/wiki/World_Cube_Association" target="_blank" rel="noopener noreferrer">WCA (overview)</a>
            <a href="https://en.wikipedia.org/wiki/List_of_world_records_in_speedcubing" target="_blank" rel="noopener noreferrer">Speedcubing world records</a>
            <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">God’s Number (cube20.org)</a>
            <a href="https://en.wikipedia.org/wiki/Rubik%27s_Cube_group" target="_blank" rel="noopener noreferrer">Rubik’s Cube group</a>
            <a href="https://cdn.vanderbilt.edu/t2-my/my-prd/wp-content/uploads/sites/826/2013/02/Wai2009SpatialAbility.pdf" target="_blank" rel="noopener noreferrer">Wai, Lubinski & Benbow 2009</a>
            <a href="https://pubmed.ncbi.nlm.nih.gov/23846718/" target="_blank" rel="noopener noreferrer">Kell et al. 2013</a>
            <a href="https://groups.psych.northwestern.edu/uttal/vittae/documents/ContentServer.pdf" target="_blank" rel="noopener noreferrer">Uttal et al. 2013 (meta-analysis)</a>
            <a href="https://repository.isls.org/handle/1/6719" target="_blank" rel="noopener noreferrer">Valerie et al. (Rubik’s & mental rotation)</a>
            <a href="https://www.nature.com/articles/nn988" target="_blank" rel="noopener noreferrer">Maguire et al. 2003</a>
            <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5439266/" target="_blank" rel="noopener noreferrer">Dresler et al. 2017</a>
            <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9866889/" target="_blank" rel="noopener noreferrer">Meinz et al. 2023</a>
            <a href="https://www.who.int/publications/i/item/9789241550536" target="_blank" rel="noopener noreferrer">WHO screen-time guidance (2019)</a>
            <a href="https://publications.aap.org/pediatrics/article/138/5/e20162591/60503/Media-and-Young-Minds" target="_blank" rel="noopener noreferrer">AAP: Media and Young Minds</a>
            <a href="https://www.youcandothecube.com/" target="_blank" rel="noopener noreferrer">You CAN Do the Rubik’s Cube</a>
            <a href="https://www.edutopia.org/article/using-rubiks-cubes-teach-math/" target="_blank" rel="noopener noreferrer">Edutopia</a>
            <a href="https://en.wikipedia.org/wiki/CFOP_method" target="_blank" rel="noopener noreferrer">CFOP method</a>
            <a href="https://jperm.net/" target="_blank" rel="noopener noreferrer">J Perm</a>
            <a href="https://www.smithsonianmag.com/innovation/brief-history-rubiks-cube-180975911/" target="_blank" rel="noopener noreferrer">Smithsonian (history)</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
