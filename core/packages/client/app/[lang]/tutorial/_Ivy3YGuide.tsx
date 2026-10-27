'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import LazyVisible from '@/components/LazyVisible';
import JsonLd from '@/components/JsonLd';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { T, tr, useLang } from '@/i18n/tr';
import {
  IVY_3Y_EXAMPLES, IVY_3Y_RECOGNITION, IVY_3Y_SOURCES, IVY_3Y_SUPPLEMENT,
  IVY_CENTER_PRACTICE, IVY_METHOD_STAGES, ivyTimestamp, ivyVideoUrl, type Ivy3YSource,
} from './_ivy3y-data';
import { IVY_VIDEO_CHAPTERS, IVY_2Y_RECOGNITION_INDEX } from './_ivy3y-video-index';
import './ivy-3y.css';

function VideoMoment({ source, seconds }: { source: Ivy3YSource; seconds: number }) {
  return <a className="ivy-3y-source-link" href={ivyVideoUrl(source, seconds)} target="_blank" rel="noreferrer">
    {tr(IVY_3Y_SOURCES[source].title)} · {ivyTimestamp(seconds)}
  </a>;
}

function CenterPractice() {
  const [caseId, setCaseId] = useState(IVY_CENTER_PRACTICE[0].id);
  const selected = IVY_CENTER_PRACTICE.find(item => item.id === caseId) ?? IVY_CENTER_PRACTICE[0];
  const simulatorParams = new URLSearchParams({ puzzle: 'ivy', setup: selected.setup, alg: selected.alg, anchor: 'start' });
  return <section id="ivy-practice-cases">
    <h3><T zh="中心循环基本功：看图、判断方向、连续完成" en="Center-cycle practice: recognize the direction and execute continuously" /></h3>
    <p><T zh="这五组练习采用本站固定持握下的标准记号，用于理解三心换和四心换。它们不是原视频全部手法的逐条转录；下方视频索引保留了 1Y、2Y 的具体情况与拿方示范。" en="These five exercises use the site's fixed holding orientation and standard notation to teach center cycles. They are not a transcription of every move in the videos; the index below links the specific 1Y and 2Y cases and their holding orientations." /></p>
    <label className="ivy-3y-select-label">
      <span><T zh="练习情况" en="Practice case" /></span>
      <select className="ivy-3y-case-select" value={caseId} onChange={event => setCaseId(event.target.value)}>
        {IVY_CENTER_PRACTICE.map(item => <option key={item.id} value={item.id}>{tr(item.title)}</option>)}
      </select>
    </label>
    <div className="ivy-3y-case-layout">
      <div className="ivy-3y-case-diagram" role="img" aria-label={tr(selected.recognition)}>
        <ScramblePreview2D event="ivy" scramble={selected.setup} size={130} />
        <p><T zh="初始状态 · 上 U、右 R、前 F、后 B、左 L、下 D" en="Starting state · U up, R right, F front, B back, L left, D down" /></p>
      </div>
      <div className="ivy-3y-case-copy">
        <h4>{tr(selected.title)}</h4><p>{tr(selected.recognition)}</p>
        <code className="ivy-3y-alg">{selected.alg}</code>
        <p className="ivy-3y-muted"><T zh="四角保持原方向，箭头表示中心色块的移动方向。" en="Corners retain their orientation; arrows describe how center pieces move." /></p>
        <Link href={`/sim?${simulatorParams}`} prefetch={false} className="tutorial-sim-link"><T zh="在模拟器中练习" en="Practice in the simulator" /></Link>
      </div>
    </div>
    <LazyVisible className="ivy-3y-player" minHeight={340} unmountWhenHidden rootMargin="100px">
      <AlgPlayer key={selected.id} puzzle="ivy" set="" setup={selected.setup} alg={selected.alg}
        size={300} moveDurationMs={650} stepMarkers={selected.id === 'four-center-exchange' ? [4] : undefined} />
    </LazyVisible>
    <details className="ivy-3y-details">
      <summary><T zh="本站的转动记号与持握" en="The site's move notation and holding orientation" /></summary>
      <p><T zh="字母表示绕相应角的转轴转动 120°。从该轴外侧看，裸字母为顺时针，撇号为逆时针；这与三阶魔方的 90° 面转不同。" en="Each letter turns 120° about its corner axis. Looking inward along that axis, a bare letter is clockwise and a prime is counterclockwise; these differ from 90° face turns." /></p>
      <dl className="ivy-3y-notation">
        <div><dt>R</dt><dd><T zh="上后右角（UBR）" en="Upper-back-right corner (UBR)" /></dd></div>
        <div><dt>L</dt><dd><T zh="上前左角（UFL）" en="Upper-front-left corner (UFL)" /></dd></div>
        <div><dt>D</dt><dd><T zh="下前右角（DFR）" en="Lower-front-right corner (DFR)" /></dd></div>
        <div><dt>B</dt><dd><T zh="下后左角（DBL）" en="Lower-back-left corner (DBL)" /></dd></div>
        <div><dt>U</dt><dd><T zh="上后左侧（UBL）的互补转动；不是 D 的改名" en="Complementary UBL-side turn; not a renaming of D" /></dd></div>
      </dl>
      <p><T zh="两个实例的 R / L / U / B 打乱已与本站状态图核对。练习中仍要对齐拿方；D 与 U 不能直接替换。" en="Both examples' R / L / U / B scrambles have been checked against the site's diagrams. Match the holding orientation; D and U are not interchangeable." /></p>
    </details>
  </section>;
}

function SupplementCase() {
  const example = IVY_3Y_SUPPLEMENT;
  const simulatorParams = new URLSearchParams({ puzzle: 'ivy', setup: example.setup, alg: example.alg, anchor: 'start' });
  return <section className="ivy-3y-supplement" id="ivy-supplement">
    <h3><T zh="补录漏例：三步拼顶面，八步完成" en="The supplementary case: top face in three moves, solved in eight" /></h3>
    <p><T zh="补录属于 1Y 的“三步拼好顶面”一组。下面的字母公式根据视频逐帧重建并转换为本站记号；原片用实物演示，没有显示字母公式。" en="The supplement adds a 1Y case to the three-move top-face group. The notation below was reconstructed frame by frame and converted to the site's notation; the original demonstrates physical turns without a written algorithm." /></p>
    <div className="ivy-3y-case-layout">
      <div className="ivy-3y-case-diagram" role="img" aria-label={tr({ zh: '补录公式的初始状态：左面和底面完整', en: 'Supplementary case: the left and bottom faces are complete' })}>
        <ScramblePreview2D event="ivy" scramble={example.setup} size={130} />
      </div>
      <div className="ivy-3y-case-copy">
        <h4><T zh="识别与持握" en="Recognition and holding orientation" /></h4>
        <p><T zh="左面和底面完整；顶面中心与左角同色，右角朝上的颜色不对。前面两片角同色，但前中心还没归位。" en="The left and bottom faces are complete. The top center matches the left corner sticker, but the right corner is misoriented. The front corner stickers match while their center is displaced." /></p>
        <code className="ivy-3y-alg">{example.alg}</code>
        <p className="ivy-3y-muted"><T zh="原片为黄顶、绿前、橙右；本站图采用默认配色，块的关系与转动一致。" en="The video uses yellow on top, green in front and orange on the right. The diagram uses the site's default colors with the same piece relationships and turns." /></p>
        <VideoMoment source="supplement" seconds={11} />
        <Link href={`/sim?${simulatorParams}`} prefetch={false} className="tutorial-sim-link"><T zh="在模拟器中练习" en="Practice in the simulator" /></Link>
      </div>
    </div>
    <LazyVisible className="ivy-3y-player" minHeight={340} unmountWhenHidden rootMargin="100px">
      <AlgPlayer puzzle="ivy" set="" setup={example.setup} alg={example.alg} size={300}
        moveDurationMs={650} stepMarkers={[example.topFaceSteps]} pauseAfterSteps={[example.topFaceSteps]} />
    </LazyVisible>
    <ol className="ivy-3y-steps">
      <li><strong><T zh="前 3 步：" en="First 3 moves: " /></strong><code>L′ R L</code><T zh=" 把顶面拼好，此时还有侧面中心待处理。" en=" completes the top face, but side centers still need to be solved." /></li>
      <li><strong><T zh="后 5 步：" en="Last 5 moves: " /></strong><code>R′ L′ R′ L R′</code><T zh=" 完成剩余结构。第 4 步会再次拆开顶面，直到第 8 步才整颗复原。" en=" finishes the remaining pieces. Move 4 breaks up the top again; the whole puzzle is solved after move 8." /></li>
    </ol>
    <p className="ivy-3y-note"><T zh="“三步拼好顶面”是识别这一组情况的局部特征，不是三步整解。" en="“Top face in three moves” describes this group's intermediate structure, not a three-move full solution." /></p>
  </section>;
}

export default function Ivy3YGuide() {
  useLang();
  return <article className="tutorial-article ivy-3y-article">
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article',
      headline: tr({ zh: '枫叶魔方 3Y 法：从 1Y、2Y 到全预判', en: 'Ivy Cube 3Y: from 1Y and 2Y to full-solve planning' }),
      description: tr({ zh: '根据蛋小泽的四段公开视频整理方法、识别、公式情况与两组路线对比，配合中心循环练习。', en: 'Methods, recognition, algorithm cases and two route comparisons from four public videos by 蛋小泽, with center-cycle exercises.' }),
      citation: Object.keys(IVY_3Y_SOURCES).map(source => ivyVideoUrl(source as Ivy3YSource)),
    }} />
    <header className="ivy-3y-intro">

      <h2><T zh="3Y 法：从会复原，到全程预判" en="3Y: from solving to planning the whole solve" /></h2>
      <p className="tutorial-lead"><T zh="先掌握 1Y、2Y 的成面与收尾，再把整条解法连起来看：如何选底，哪些连色可以顺手做好，以及前段怎样接上更短的后段。3Y 的重点是规划整次复原，而不是固定做三个阶段。" en="Learn the setups and finishes of 1Y and 2Y, then connect the whole solve: choose a first face, build useful matching blocks along the way, and find a shorter finish. 3Y is about planning the complete solution, not following three fixed stages." /></p>
      <p className="ivy-3y-credit"><T zh="视频讲解：" en="Video series by " /><a href="https://space.bilibili.com/1664460564" target="_blank" rel="noreferrer">蛋小泽</a><T zh="；本文由 CubeRoot 整理。" en="; guide compiled by CubeRoot." /></p>
    </header>
    <nav className="ivy-3y-contents" aria-label={tr({ zh: '3Y 教程目录', en: '3Y guide contents' })}>
      <a href="#ivy-method"><T zh="方法关系" en="Methods" /></a>
      <a href="#ivy-recognition"><T zh="识别与预判" en="Recognition" /></a>
      <a href="#ivy-practice-cases"><T zh="公式练习" en="Practice cases" /></a>
      <a href="#ivy-video-cases"><T zh="视频公式索引" en="Video cases" /></a>
      <a href="#ivy-supplement"><T zh="补录公式" en="Supplement" /></a>
      <a href="#ivy-examples"><T zh="实例对比" en="Examples" /></a>
      <a href="#ivy-training"><T zh="训练顺序" en="Training" /></a>
    </nav>
    <section id="ivy-method">
      <h3><T zh="1Y、2Y、3Y 的关系" en="How 1Y, 2Y and 3Y relate" /></h3>
      <div className="ivy-3y-methods">{IVY_METHOD_STAGES.map(stage => <div className="ivy-3y-method" key={stage.name}>
        <strong className="ivy-3y-method-name">{stage.name}</strong>
        <div><h4>{tr(stage.preparation)}</h4><p>{tr(stage.finish)}</p><p className="ivy-3y-muted">{tr(stage.practice)}</p><VideoMoment source="method" seconds={stage.seconds} /></div>
      </div>)}</div>
      <p className="ivy-3y-note"><T zh="三者是按打乱选择的备选路线。3Y 所说的“最少步”是寻找短解的目标，视频没有证明每个实例都是数学上的全局最优；实战还要比较观察把握、换手和连续执行。" en="Treat these as alternative routes for each scramble. The series uses “fewest moves” as a short-solution goal, without proving each example globally optimal. Recognition confidence, regrips and smooth execution also matter." /></p>
    </section>
    <section id="ivy-recognition">
      <h3><T zh="观察什么，才能在起表前看到后半程？" en="What should you look for before starting the timer?" /></h3>
      <div className="ivy-3y-recognition">{IVY_3Y_RECOGNITION.map(item => <div key={item.title.en}><h4>{tr(item.title)}</h4><p>{tr(item.text)}</p></div>)}</div>
      <ol className="ivy-3y-steps">
        <li><strong><T zh="先找一条能确定完成的路线。" en="Find one reliable route first. " /></strong><T zh="扫描容易成面的颜色，规划一个熟悉的 1Y 或 2Y 收尾。" en="Scan for easy first faces and a familiar 1Y or 2Y finish." /></li>
        <li><strong><T zh="向后追踪关键中心。" en="Track the important centers forward. " /></strong><T zh="脑中走过准备步骤，确认连色的位置和方向；不能只知道底会好，却不知道尾段是什么。" en="Mentally execute the setup and locate the resulting matching blocks. Knowing only that the first face will be solved is not enough." /></li>
        <li><strong><T zh="比较另一底色或一次预处理。" en="Compare another face or a preparatory move. " /></strong><T zh="尝试让一次转动同时组好第二个面或多条连色，再比较整条解法。" en="Look for a move that builds another face or several blocks at once, then compare the full solutions." /></li>
        <li><strong><T zh="检查前后段能否消步。" en="Check cancellations at the join. " /></strong><T zh="准备阶段的最后一手与公式第一手要连起来看。" en="Consider the last setup move and the first algorithm move together." /></li>
      </ol>
      <div className="ivy-3y-cancellation">
        <h4><T zh="120° 转动的消步" en="Cancellations for 120° turns" /></h4>
        <p><code>q q = q′</code><span> · </span><code>q q′ = 0</code><span> · </span><code>q q q = 0</code></p>
        <p><T zh="这里 q 代表同一个转轴上的一次正向转动，0 表示不用转。实例一中，前段与公式首步的两个同向动作可以合成一次反向动作；中间若换了转轴或转体，必须重新核对。" en="Here q is one turn about the same axis, and 0 means no move. In the first example, two same-direction turns at the join become one inverse turn. Recheck the axis if the holding orientation changes." /></p>
        <VideoMoment source="examples" seconds={94} />
      </div>
      <details className="ivy-3y-details">
        <summary><T zh="为什么作者用“四个面一起好”预判跳步？" en="Why can four complete faces predict a skip?" /></summary>
        <p><T zh="对正常可达的枫叶状态，四个完整面已覆盖所有角块的方向；角块对齐后，中心只可能处于偶排列。若其余两个中心仍互换，就会是一个不可能单独出现的奇排列，所以它们也必须正确。这说的是完整面，包含中心与两片角贴片同色；四处连色不能代替四个完整面。" en="In a reachable Ivy state, four complete faces determine every corner's orientation. Once corners are aligned, the centers have even permutation parity. Swapping only the last two centers would be odd and is impossible, so they must also be correct. A complete face includes its center and both corner stickers; four matching blocks do not mean four complete faces." /></p>
        <VideoMoment source="method" seconds={273} />
      </details>
    </section>
    <CenterPractice />
    <section id="ivy-video-cases">
      <h3><T zh="原视频公式：按情况学习" en="The original algorithms: learn by case" /></h3>
      <p><T zh="作者主要通过实物转动和“上、下”等手法口令讲解。每一类都要先对齐拿方、已完成面和连色，再看动作。下面的时间索引保留了原片的讲解顺序。" en="The author mainly demonstrates physical turns with hand-movement cues. Match the holding orientation, complete faces and matching blocks before studying each sequence. This index follows the original presentation order." /></p>
      <div className="ivy-3y-video-index">{IVY_VIDEO_CHAPTERS.map(chapter => <div key={chapter.seconds}>
        <h4>{tr(chapter.title)}</h4><p>{tr(chapter.description)}</p><VideoMoment source="algorithms" seconds={chapter.seconds} />
      </div>)}</div>
      <details className="ivy-3y-details">
        <summary><T zh="2Y 连色与眼睛：逐例定位" en="2Y blocks and paired stickers: case-by-case index" /></summary>
        <p><T zh="方位以视频当时的持握为准。“眼睛”指作者用来识别的成对角贴片。相同的简短连色标签可能有不同朝向和其他块的区别，需结合原片完整状态判断。" en="Directions refer to the video's current holding orientation. The author's “eyes” are paired corner-sticker recognition patterns. Similar short labels can hide different orientations or other pieces; inspect the full case in the video." /></p>
        <ol className="ivy-3y-case-index">{IVY_2Y_RECOGNITION_INDEX.map(item => <li key={item.seconds}><a href={ivyVideoUrl('algorithms', item.seconds)} target="_blank" rel="noreferrer">{ivyTimestamp(item.seconds)} · {tr(item.label)}</a></li>)}</ol>
      </details>
    </section>
    <SupplementCase />
    <section id="ivy-examples">
      <h3><T zh="同一打乱，为什么选不同路线？" en="Why choose different routes for the same scramble?" /></h3>
      <p><T zh="下面保留视频原始打乱，并比较作者对同一局面的三种处理。状态图与手持视角可能不同；颜色只对应该实例，练习重点是连色结构与取舍。" en="The original on-screen scrambles are preserved below, with three approaches to each. The diagrams may use a different viewing angle. Colors belong to these examples; focus on block structures and decisions." /></p>
      {IVY_3Y_EXAMPLES.map(example => <div className="ivy-3y-example" key={example.id}>
        <h4>{tr(example.title)}</h4>
        <div className="ivy-3y-case-layout">
          <div className="ivy-3y-case-diagram" role="img" aria-label={tr(example.title)}><ScramblePreview2D event="ivy" scramble={example.scramble} size={130} /></div>
          <div><p className="ivy-3y-muted"><T zh="原视频打乱" en="Original video scramble" /></p><code className="ivy-3y-alg">{example.scramble}</code><VideoMoment source="examples" seconds={example.seconds} />
            <Link href={`/sim?${new URLSearchParams({ puzzle: 'ivy', setup: example.scramble, anchor: 'start' })}`} prefetch={false} className="tutorial-sim-link"><T zh="打开这个打乱" en="Open this scramble" /></Link>
          </div>
        </div>
        <dl className="ivy-3y-route-comparison">{example.routes.map(route => <div key={route.method}><dt>{route.method}<a href={ivyVideoUrl('examples', route.seconds)} target="_blank" rel="noreferrer">{ivyTimestamp(route.seconds)}</a></dt><dd>{tr(route.text)}</dd></div>)}</dl>
        <p className="ivy-3y-example-lesson">{tr(example.lesson)}</p>
      </div>)}
    </section>
    <section id="ivy-training">
      <h3><T zh="训练顺序：先看清，再提速" en="Training order: see the solution before speeding up" /></h3>
      <ol className="ivy-3y-steps">
        <li><strong><T zh="中心循环。" en="Center cycles. " /></strong><T zh="从上面的练习开始，先说出哪三个中心往哪个方向移动，再执行；把正反方向和四心换区分清楚。" en="Start with the exercises above. Name the affected centers and direction before executing; distinguish reverse cycles from four-center exchanges." /></li>
        <li><strong><T zh="1Y 连续衔接。" en="Continuous 1Y. " /></strong><T zh="不限时观察两到三个面的准备过程，提前报出后续情况，整条做完后再核对预判。" en="Use untimed inspection to prepare two or three faces and name the finish. Execute the whole route, then check the prediction." /></li>
        <li><strong><T zh="2Y 识别。" en="2Y recognition. " /></strong><T zh="做好一面后先不转，按连色的位置、方向与眼睛组合判断；再逐渐把这次判断提前到做底之前。" en="After building one face, pause and classify block positions, directions and paired stickers. Gradually move that recognition into the initial inspection." /></li>
        <li><strong><T zh="同一打乱比较路线。" en="Compare routes on one scramble. " /></strong><T zh="分别尝试 1Y、2Y，再找一次预处理能否联动多个面；记录整解步数、停顿和执行是否顺手。" en="Try both 1Y and 2Y, then look for a preparation that connects several faces. Compare total moves, pauses and execution comfort." /></li>
        <li><strong><T zh="限时观察。" en="Timed inspection. " /></strong><T zh="用视频中的 15 秒观察作为练习预算；先保留一条可靠路线，剩余时间再找更短解，不因追求 3Y 放弃已看清的 1Y / 2Y。" en="Use the video's 15-second inspection as a practice budget. Keep one reliable solution, then use the remaining time to improve it rather than abandoning a known 1Y or 2Y route." /></li>
      </ol>
      <p className="ivy-3y-note"><T zh="作者的经验目标是 1Y 冲击 sub3、1Y / 2Y 熟练后冲击 sub2，再用 3Y 尝试 sub1.5 或 sub1。这是练习参考，不是学完必达的成绩。" en="The author's reference goals are sub3 with 1Y, sub2 with fluent 1Y / 2Y, then sub1.5 or sub1 with 3Y. They are practice goals, not guaranteed outcomes." /> <VideoMoment source="method" seconds={363} /></p>
    </section>
    <section className="ivy-3y-sources" id="ivy-sources">
      <h3><T zh="来源与方法归属" en="Sources and attribution" /></h3>
      <p><T zh="本页依据蛋小泽的四段公开视频整理。作者在思路视频中将 1Y 思路归于高凯阳老师，并提到在青岛营听杜宇生老师提出“一面后接公式”的思路，后续公式由作者整理；3Y 规划也受到他学习二阶 EG 法的启发。" en="This guide follows four public videos by 蛋小泽. In the overview, the author credits Gao Kaiyang for 1Y, recalls Du Yusheng's one-face-then-algorithm idea at a Qingdao camp, and says he compiled the subsequent algorithms. His 3Y planning was also inspired by learning 2×2 EG." /></p>
      <p><VideoMoment source="method" seconds={35} /><VideoMoment source="method" seconds={129} /><VideoMoment source="method" seconds={321} /></p>
      <ol>{(Object.keys(IVY_3Y_SOURCES) as Ivy3YSource[]).map(source => <li key={source}>
        <a href={ivyVideoUrl(source)} target="_blank" rel="noreferrer">{tr(IVY_3Y_SOURCES[source].title)}</a><span className="ivy-3y-muted"> · {IVY_3Y_SOURCES[source].duration}</span><p>{tr(IVY_3Y_SOURCES[source].description)}</p>
      </li>)}</ol>
    </section>
  </article>;
}
