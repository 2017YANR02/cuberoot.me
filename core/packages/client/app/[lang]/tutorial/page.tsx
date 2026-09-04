'use client';

import BackHome from '@/components/BackHome';
import AlgPuzzlePicker, {
  TUTORIAL_PUZZLE_PICKER_IDS,
} from '@/components/AlgPuzzlePicker';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import Link from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { ArrowRight, Check, Play } from 'lucide-react';
import { useParams } from 'next/navigation';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useState } from 'react';
import '../alg/alg.css';
import './tutorial.css';

const FOUR_CENTER_SETUP = "D' B' D B L' R' L R";
const FOUR_CENTER_MOVES = ["R'", "L'", 'R', 'L', "B'", "D'", 'B', 'D'] as const;

function FourCenterGuide() {
  const [step, setStep] = useState<number | null>(null);
  const alg = step === null ? FOUR_CENTER_MOVES.join(' ') : FOUR_CENTER_MOVES[step];
  const setup = step === null
    ? FOUR_CENTER_SETUP
    : [FOUR_CENTER_SETUP, ...FOUR_CENTER_MOVES.slice(0, step)].join(' ');

  return (
    <section className="tutorial-four-center">
      <h2><T zh="四心法" en="Four-center method" /></h2>
      <div className="tutorial-four-center-progress" aria-hidden="true">
        <strong>4</strong><ArrowRight /><strong>3</strong><ArrowRight /><Check />
      </div>

      <div className="tutorial-four-center-player">
        <AlgPlayer
          puzzle="ivy"
          set=""
          setup={setup}
          alg={alg}
          autoPlay
          loop
          controlMode="replay"
          moveDurationMs={700}
          fillPane
        />
      </div>

      <div className="tutorial-four-center-actions">
        <button
          type="button"
          className={`tutorial-four-center-play${step === null ? ' is-active' : ''}`}
          aria-pressed={step === null}
          aria-label={tr({ zh: '连续播放全部八步', en: 'Play all eight moves' })}
          title={tr({ zh: '连续播放全部八步', en: 'Play all eight moves' })}
          onClick={() => setStep(null)}
        >
          <Play size={17} fill="currentColor" aria-hidden="true" />
          <span>1–8</span>
        </button>

        <div className="tutorial-four-center-sequence">
          {[FOUR_CENTER_MOVES.slice(0, 4), FOUR_CENTER_MOVES.slice(4)].map((cycle, cycleIndex) => (
            <div className="tutorial-four-center-cycle" key={cycleIndex}>
              {cycle.map((move, index) => {
                const moveIndex = cycleIndex * 4 + index;
                return (
                  <button
                    type="button"
                    className={`tutorial-four-center-step${step === moveIndex ? ' is-active' : ''}`}
                    aria-pressed={step === moveIndex}
                    aria-label={tr({
                      zh: `第 ${moveIndex + 1} 步：${move}`,
                      en: `Step ${moveIndex + 1}: ${move}`,
                    })}
                    title={tr({
                      zh: `第 ${moveIndex + 1} 步：${move}`,
                      en: `Step ${moveIndex + 1}: ${move}`,
                    })}
                    onClick={() => setStep(moveIndex)}
                    key={`${move}-${moveIndex}`}
                  >
                    <span>{moveIndex + 1}</span>
                    <code>{move}</code>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IvyTutorial() {
  return (
    <article className="tutorial-article">
      <p className="tutorial-lead">
        <T
          zh="枫叶魔方只有四个可转角和六个中心。每次转角都会改变一个外角，并循环它周围的三个中心；入门解法就是先复原四个外角，再处理六个中心。"
          en="The Ivy Cube has four turning corners and six centers. Each turn changes one outer corner and cycles its three neighboring centers. The beginner method solves the four outer corners first, then the six centers."
        />
      </p>

      <section>
        <h2><T zh="1. 记号" en="1. Notation" /></h2>
        <p>
          <T
            zh="R、L、D、B 表示四个可转角，字母后面的撇号表示反向转动。拖动魔方可换视角，也可以直接手拧。"
            en="R, L, D, and B name the four turning corners. A prime mark means the inverse turn. Drag to change the view or turn the puzzle directly."
          />
        </p>
        <div className="tutorial-demo">
          <AlgPlayer
            puzzle="ivy"
            set=""
            alg="R L D B"
            startSolved
            interactionMode="turn"
            size={300}
          />
        </div>
      </section>

      <section>
        <h2><T zh="2. 复原四个外角" en="2. Solve the four outer corners" /></h2>
        <ol>
          <li><T zh="找两个带有同一种颜色的外角，把这个共同色转到同一面。" en="Find two outer corners that share a color and twist them so that color faces the same side." /></li>
          <li><T zh="把这一面转到底面，再转动另外两个外角，让它们的共同色朝上。" en="Put that face on the bottom, then twist the other two outer corners so their shared color faces up." /></li>
          <li><T zh="四个外角的位置是固定的，只需调整方向；完成后先不要再单独转角，后面的四步公式会自动保护角块。" en="The four outer corners have fixed positions, so only their orientation matters. Once solved, avoid isolated corner turns; the four-move sequences below preserve them." /></li>
        </ol>
      </section>

      <section>
        <h2><T zh="3. 复原两个相对面的中心" en="3. Solve two opposite centers" /></h2>
        <p>
          <T
            zh="先找底面颜色的中心。把它放进下面公式所循环的三个位置之一，用顺换或逆换送到底面；底面完成后放在下面保护，再用同样方法复原顶面中心。"
            en="Find the bottom-color center and place it in one of the three positions cycled by the sequence below. Use the forward or reverse cycle to send it to the bottom. Keep the solved face down, then solve the opposite center the same way."
          />
        </p>
      </section>

      <section>
        <h2><T zh="4. 完成侧面中心" en="4. Finish the side centers" /></h2>
        <p>
          <T
            zh="下面的四步会循环三个中心，同时让两个参与转动的角回到原方向。反方向就使用它的逆公式。先转动整个魔方，把要循环的三个中心放到动画所示位置。"
            en="The four moves below cycle three centers while returning both turning corners to their original orientation. Use the inverse for the other direction. Reorient the whole puzzle first so the three target centers match the animated positions."
          />
        </p>
        <div className="tutorial-alg-row">
          <div className="tutorial-demo">
            <AlgPlayer puzzle="ivy" set="" alg="R' L' R L" startSolved size={300} />
          </div>
          <div className="tutorial-alg-copy">
            <p><T zh="三心顺换" en="Three-center cycle" /></p>
            <code>R&apos; L&apos; R L</code>
            <p><T zh="反方向" en="Reverse direction" /></p>
            <code>L&apos; R&apos; L R</code>
            <Link
              href="/sim?puzzle=ivy&alg=R%27%20L%27%20R%20L&anchor=start"
              prefetch={false}
              className="tutorial-sim-link"
            >
              <T zh="在完整模拟器中打开" en="Open in the full simulator" /> <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <p className="tutorial-note">
          <T
            zh="若三个待换中心排成另一种直线结构，可用 R L′ R′ L。它同样只循环三个中心，不会破坏已经复原的外角。"
            en="If the three centers form the other straight-line pattern, use R L′ R′ L. It also cycles only three centers without disturbing the solved outer corners."
          />
        </p>
        <div className="tutorial-demo">
          <AlgPlayer puzzle="ivy" set="" alg="R L' R' L" startSolved size={300} />
        </div>
      </section>

      <FourCenterGuide />

      <section>
        <h2><T zh="进阶：邻心法" en="Advanced: neighboring-center method" /></h2>
        <p>
          <T
            zh="你朋友说的“六三法”也可能是“邻心法”。这是另一套公开的提速思路：检查时先规划约四步的第一阶段，再按中心是否已经连色、能否直接插入来判断后半程，而不是每做一步就停下来重新找块。"
            en="What sounded like “six-three” may have been the neighboring-center method. This is a separate public speedsolving approach: plan an approximately four-move first phase during inspection, then classify the remainder by whether matching centers are connected and whether they can be inserted directly, instead of stopping to search after every move."
          />
        </p>
        <p className="tutorial-note">
          <T zh="公开视频给出的六类后半程情况：" en="The public video lists six second-phase cases:" />
        </p>
        <ol>
          <li><T zh="单角翻：6/36，约 7 步。" en="Single-corner twist: 6/36, about 7 moves." /></li>
          <li><T zh="有连色且能直接插入：12/36，约 3 步。" en="Connected colors with a direct insertion: 12/36, about 3 moves." /></li>
          <li><T zh="有连色但不能直接插入：6/36，约 4 步。" en="Connected colors without a direct insertion: 6/36, about 4 moves." /></li>
          <li><T zh="无连色但能直接插入：6/36，约 6 步。" en="No connected colors, but a direct insertion is available: 6/36, about 6 moves." /></li>
          <li><T zh="无连色且不能直接插入：3/36，约 7 步。" en="No connected colors and no direct insertion: 3/36, about 7 moves." /></li>
          <li><T zh="跳步：3/36，0 步。" en="Skip: 3/36, 0 moves." /></li>
        </ol>
        <p className="tutorial-note">
          <T
            zh="作者给出的估算含 AUF 后约为 9.08 步。练习时先只做识别：完成第一阶段后，立即报出“有连/无连”和“能插/不能插”，再开始转动；熟练后才追求全程无转体。"
            en="The author estimates about 9.08 moves including AUF. Begin by drilling recognition only: after the first phase, call out “connected/not connected” and “direct/not direct” before turning. Add rotationless execution only after recognition is reliable."
          />
        </p>
      </section>

      <section>
        <h2><T zh="63 法：目前公开到哪里" en="63 method: what is public" /></h2>
        <p>
          <T
            zh="63 法确实存在，但不是邻心法的另一个名字。作者把它描述为完全自研、仍在深度打磨的独家枫叶提速体系，公开页面没有完整步骤、判断规则或公式表。因此本站只能准确记录它的定位，不能把普通入门公式或邻心法改名成 63 法。等作者公开或授权完整资料后，再补成可验证的动画教程。"
            en="The 63 method does exist, but it is not another name for the neighboring-center method. Its creator describes it as a proprietary Ivy speedsolving system that is still under active development; the public page provides no complete step order, recognition rules, or algorithm set. This page therefore records its status accurately instead of relabeling beginner algorithms or the neighboring-center method as 63. An animated, verifiable guide can be added if full material is published or authorized."
          />
        </p>
      </section>

      <footer className="tutorial-sources">
        <span><T zh="调查来源" en="Research sources" /></span>
        <a href="https://ramkrishna-js.github.io/learn-cube/puzzles/ivy-cube/" target="_blank" rel="noreferrer">Learn Cube</a>
        <a href="https://1hrbld.tw/maple-cube-tutorial/" target="_blank" rel="noreferrer"><T zh="一小时学盲解" en="1hrBLD" /></a>
        <a href="https://cube.pinpincuber.com/%E5%A5%87%E8%97%9D%E9%AD%94%E6%96%B9%E6%A0%BC%E6%A5%93%E8%91%89%E8%A7%A3%E6%B3%95%E6%95%99%E5%AD%B8/" target="_blank" rel="noreferrer"><T zh="中心结构图解" en="Center patterns" /></a>
        <a href="https://www.bilibili.com/video/BV1iwbrzPEi6/" target="_blank" rel="noreferrer"><T zh="四心换识别" en="Four-center recognition" /></a>
        <a href="https://www.bilibili.com/video/BV1oFy7BHEtR/" target="_blank" rel="noreferrer"><T zh="邻心法公开视频" en="Neighboring-center video" /></a>
        <a href="https://www.bilibili.com/video/BV13bAFz5E3s/" target="_blank" rel="noreferrer"><T zh="63 法公开介绍" en="Public 63 overview" /></a>
      </footer>
    </article>
  );
}

export default function TutorialPage() {
  const isZh = useParams()?.lang === 'zh';
  const [puzzle] = useQueryState(
    'puzzle',
    parseAsStringEnum([...TUTORIAL_PUZZLE_PICKER_IDS])
      .withDefault('3x3'),
  );

  return (
    <main className="alg-root">
      <header className="alg-cat-header alg-cat-header--puzzle">
        <div className="alg-puzzle-back-row"><BackHome /></div>
        <h1 className="alg-cat-title"><T zh="教程" en="Tutorials" /></h1>
        <AlgPuzzlePicker
          current={puzzle}
          isZh={isZh}
          includeIvy
          groupLabel={tr({ zh: '教程项目', en: 'Tutorial puzzles' })}
          linkFor={(id) => ({ href: `/tutorial?puzzle=${id}` })}
        />
        <Link href="/tutorial-legacy" prefetch={false} className="alg-back">
          <T zh="旧版教程" en="Legacy tutorials" /> <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>
      {puzzle === 'ivy' ? <IvyTutorial /> : null}
    </main>
  );
}
