'use client';

// /regulation/fewest-moves — Appendix E (Fewest Moves Solving).
//
// The "thinking" event: 60 minutes, pen and paper, write the shortest solution
// you can. Visual centrepiece is a styled solution-sheet mockup (scramble +
// solution line + a 22 / 80 move counter) that anchors the 80-move ceiling.
// Content paraphrases the official Appendix E verbatim source (E2, E2a–E2e,
// E3, E5). Move-count nuance preserved: the result is counted in Outer Block
// Turn Metric (E2d), while the 80-move cap is Execution Turn Metric incl.
// rotations (E2d1).

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Cuboid, Ban, ListChecks } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/E.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import { FM_SCRAMBLE, FM_SOLUTION, FM_COUNT } from './_example';
import './fewest-moves.css';

/** Inline mono token for prose. */
function K({ children }: { children: ReactNode }) {
  return <code className="fm-k">{children}</code>;
}

export default function FewestMovesChapter() {
  const { i18n } = useTranslation(); // subscribe to language toggle
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  return (
    <RegArticleLayout slug="fewest-moves">
      {/* ── 1. What the event is ─────────────────────────────────── */}
      <RegSection
        eyebrow={t('它和别的项目不一样', 'Not like the other events', "它和別的項目不一樣")}
        title={t('不比手速,比脑子', 'A puzzle of the mind, not the hands', "不比手速,比腦子")}
        lede={t(
          '三阶最少步(Fewest Moves,FM)给所有选手同一条打乱,每人有 60 分钟,在纸上写出一个尽量短的还原解法。成绩不是用时,而是解法的步数 —— 越少越好。',
          'In 3×3×3 Fewest Moves (FM) every competitor gets the same scramble and 60 minutes to write down, on paper, the shortest solution they can find. The result is not a time but the number of moves in the solution — fewer is better.', "三階最少步(Fewest Moves,FM)給所有選手同一條打亂,每人有 60 分鐘,在紙上寫出一個儘量短的還原解法。成績不是用時,而是解法的步數 —— 越少越好。"
        )}
      >
        {/* the solution-sheet mockup */}
        <figure className="fm-sheet">
          <div className="fm-sheet-head">
            <span className="fm-sheet-title">{t('三阶最少步 · 答题纸', '3×3×3 Fewest Moves · Solution sheet', "三階最少步 · 答題紙")}</span>
            <span className="fm-sheet-id">{t('选手 / WCA ID', 'Name / WCA ID', "選手 / WCA ID")}</span>
          </div>

          <div className="fm-sheet-row">
            <span className="fm-sheet-label">{t('打乱', 'Scramble', "打亂")}</span>
            <code className="fm-sheet-scramble">{FM_SCRAMBLE}</code>
          </div>

          <div className="fm-sheet-row">
            <span className="fm-sheet-label">{t('解法', 'Solution')}</span>
            <code className="fm-sheet-solution">{FM_SOLUTION}</code>
          </div>

          <div className="fm-sheet-foot">
            <span className="fm-sheet-metric">{t('步数 · OBTM', 'Moves · OBTM', "步數 · OBTM")}</span>
            <span className="fm-counter">
              <b className="fm-counter-n">{FM_COUNT}</b>
              <span className="fm-counter-sep">/</span>
              <span className="fm-counter-max">80</span>
            </span>
          </div>
          <div className="fm-bar" aria-hidden="true">
            <span className="fm-bar-fill" style={{ width: `${(FM_COUNT / 80) * 100}%` }} />
            <span className="fm-bar-cap" />
          </div>
        </figure>
        <figcaption className="fm-sheet-note">
          {t(
            '示例:同一条打乱,这条 21 步的解法离 80 步上限还很远 —— 而世界级选手往往能压到 20 步出头。',
            'Example: for this scramble, a 21-move solution sits well under the 80-move ceiling — world-class solvers routinely get into the low 20s.', "示例:同一條打亂,這條 21 步的解法離 80 步上限還很遠 —— 而世界級選手往往能壓到 20 步出頭。"
          )}
        </figcaption>

        <RegQuote num="E2d · E2d1">
          {t(
            '选手的成绩是其解法的步数,按 Outer Block Turn Metric 计算;解法按 Execution Turn Metric(含整体旋转)计不得超过 80 步,否则取消该次资格(DNF)。',
            'The result is the number of moves in the solution, counted in Outer Block Turn Metric; the solution must not exceed 80 moves (including rotations) when counted in Execution Turn Metric, or the attempt is disqualified (DNF).', "選手的成績是其解法的步數,按 Outer Block Turn Metric 計算;解法按 Execution Turn Metric(含整體旋轉)計不得超過 80 步,否則取消該次資格(DNF)。"
          )}
        </RegQuote>
      </RegSection>

      {/* ── 2. The 60-minute budget ──────────────────────────────── */}
      <RegSection
        eyebrow={t('一次性的一小时', 'One hour, one shot', "一次性的一小時")}
        title={t('60 分钟,然后交卷', '60 minutes, then hand it in', "60 分鐘,然後交卷")}
        lede={t(
          '裁判发下打乱和纸张、喊“开始”后,所有选手共享同一段 60 分钟。时间一到必须立刻交出一张写好的解法。',
          'The judge hands out the scramble and paper, calls "GO", and all competitors share the same 60 minutes. When time is up you must immediately submit one written solution.', "裁判發下打亂和紙張、喊“開始”後,所有選手共享同一段 60 分鐘。時間一到必須立刻交出一張寫好的解法。"
        )}
      >
        <Callout tone="info" label={t('计时与提交', 'Timing and submission', "計時與提交")} icon={<Clock size={17} />}>
          {i18n.language === 'zh-Hant'
            ? (
              <>
                  裁判在第 <b>55 分鐘</b>提醒“還剩 5 分鐘”,在 <b>60 分鐘</b>喊“停”(E2b1)。<br />
                  想清楚了可以提前交卷結束(E2b+)。開賽前不得在答題紙上寫打亂以外的內容,也不得提前看/洩露打亂(E2a1 / E2a2)。
                </>
            )
            : (isZh
              ? (
                <>
                  裁判在第 <b>55 分钟</b>提醒“还剩 5 分钟”,在 <b>60 分钟</b>喊“停”(E2b1)。<br />
                  想清楚了可以提前交卷结束(E2b+)。开赛前不得在答题纸上写打乱以外的内容,也不得提前看/泄露打乱(E2a1 / E2a2)。
                </>
              )
              : (
                <>
                  The judge calls "5 minutes remaining" at <b>55 minutes</b> and "STOP" at <b>60</b> (E2b1).<br />
                  You may hand in early to end the attempt (E2b+). Before "GO" you must not write on the paper (beyond ID info) and must not see or reveal the scramble (E2a1 / E2a2).
                </>
              ))}
        </Callout>

        <Callout tone="warn" label={t('解法必须清晰无歧义', 'The solution must be unambiguous', "解法必須清晰無歧義")}>
          {t(
            '交上去的必须是一份按顺序写清楚、可被唯一解读的步骤序列(E2c2)。多个解法没标清哪个、字母含糊不清(像 B 又像 R)、用箭头/星号把步骤写得乱序、或夹带没写成合法记号的“插入”和“预打乱”—— 都算歧义,直接 DNF。要排除的步骤要划掉,或给最终解法圈一个轮廓(E2c3)。',
            'What you hand in must be one clearly ordered, single-reading sequence of moves (E2c2). Multiple solutions with none marked, ambiguous letters (a glyph that is neither clearly B nor R), arrows or stars reordering moves, or "insertions" / "pre-moves" not written in valid inline notation all count as ambiguous and are a DNF. Cross out moves to drop, or draw one outline around your final solution (E2c3).', "交上去的必須是一份按順序寫清楚、可被唯一解讀的步驟序列(E2c2)。多個解法沒標清哪個、字母含糊不清(像 B 又像 R)、用箭頭/星號把步驟寫得亂序、或夾帶沒寫成合法記號的“插入”和“預打亂”—— 都算歧義,直接 DNF。要排除的步驟要劃掉,或給最終解法圈一個輪廓(E2c3)。"
          )}
        </Callout>
      </RegSection>

      {/* ── 3. What you may bring ────────────────────────────────── */}
      <RegSection
        eyebrow={t('桌上能放什么', 'What may be on the table', "桌上能放什麼")}
        title={t('允许的工具', 'Permitted tools', "允許的工具")}
        lede={t(
          'FM 是少数允许用实体魔方边试边想的项目,但工具清单是封闭的:只有规则 E3 列出的东西能用,其它一律 DNF(没占便宜的可由 WCA 代表酌情保留)。',
          'FM is one of the few events where you may test ideas on a real cube, but the tool list is closed: only the items in Regulation E3 are allowed; anything else is a DNF (the Delegate may let it stand if no advantage was gained).', "FM 是少數允許用實體魔方邊試邊想的項目,但工具清單是封閉的:只有規則 E3 列出的東西能用,其它一律 DNF(沒佔便宜的可由 WCA 代表酌情保留)。"
        )}
      >
        <div className="fm-tools">
          <div className="fm-tool fm-tool-ok">
            <div className="fm-tool-head">
              <ListChecks size={18} />
              {t('可以用', 'Allowed')}
            </div>
            <ul className="fm-tool-list">
              <li>{t('白纸与答题纸(裁判提供)', 'Blank paper and the solution sheet (from the judge)', "白紙與答題紙(裁判提供)")}</li>
              <li>{t('该次打乱的图片 + 笔 / 铅笔(裁判提供,也可自备笔)', 'A picture of the scramble + pen / pencil (from the judge; pens may be self-supplied)', "該次打亂的圖片 + 筆 / 鉛筆(裁判提供,也可自備筆)")}</li>
              <li>
                {i18n.language === 'zh-Hant'
                  ? (<>最多 <b>3 個三階魔方</b>(自備,須符合第三章;開始時不必是還原態)</>)
                  : (isZh
                    ? (<>最多 <b>3 个三阶魔方</b>(自备,须符合第三章;开始时不必是还原态)</>)
                    : (<>Up to <b>three 3×3×3 cubes</b> (self-supplied, must meet Article 3; need not start solved)</>))}
              </li>
              <li>{t('贴纸;以及修正液 / 修正带 / 橡皮(自备)', 'Stickers; and correction fluid / tape / erasers (self-supplied)', "貼紙;以及修正液 / 修正帶 / 橡皮(自備)")}</li>
              <li>{t('经 WCA 代表认可的秒表或手表 —— 不得带任何帮你找解的功能', 'A stopwatch or watch approved by the Delegate — with no function that helps find a solution', "經 WCA 代表認可的秒錶或手錶 —— 不得帶任何幫你找解的功能")}</li>
            </ul>
          </div>

          <div className="fm-tool fm-tool-bad">
            <div className="fm-tool-head">
              <Ban size={18} />
              {t('不可以用', 'Not allowed')}
            </div>
            <ul className="fm-tool-list">
              <li>{t('任何带计算 / 求解 / 上网功能的电子或智能设备', 'Any electronic or smart device with compute / solving / online functions', "任何帶計算 / 求解 / 上網功能的電子或智慧裝置")}</li>
              <li>{t('清单以外的额外物品(第 4 个魔方、模板、参考资料等)', 'Extra items beyond the list (a 4th cube, templates, reference material, …)', "清單以外的額外物品(第 4 個魔方、模板、參考資料等)")}</li>
              <li>{t('和 WCA 代表 / 裁判以外的任何人交流求解(E5)', 'Help deriving the solution from anyone but the Delegate or judge (E5)')}</li>
              <li>{t('直接照搬打乱公式或其逆序的解法(E2e)', 'A solution copied from the scramble sequence or its inverse (E2e)', "直接照搬打亂公式或其逆序的解法(E2e)")}</li>
            </ul>
          </div>
        </div>

        <p className="fm-foot-note">
          {t(
            '注意细节:个人秒表只供自己掌握时间,不算正式时间,裁判喊“停”就必须交(E3d++)。',
            'A fine point: a personal watch is only for your own pacing, never the official time — when the judge calls "STOP" you must hand in (E3d++).', "注意細節:個人秒錶只供自己掌握時間,不算正式時間,裁判喊“停”就必須交(E3d++)。"
          )}
        </p>
      </RegSection>

      {/* ── 4. How moves are counted ─────────────────────────────── */}
      <RegSection
        eyebrow={t('80 步怎么数', 'How the moves are counted', "80 步怎麼數")}
        title={t('两种度量,各管一件事', 'Two metrics, two jobs', "兩種度量,各管一件事")}
        lede={t(
          '“步数”不是随便数的。FM 用到两套度量:一套给你的成绩计步,另一套卡那条 80 步红线。',
          'Counting moves is precise here. FM uses two metrics: one scores your result, the other enforces the 80-move red line.', "“步數”不是隨便數的。FM 用到兩套度量:一套給你的成績計步,另一套卡那條 80 步紅線。"
        )}
      >
        <div className="fm-metric-grid">
          <div className="fm-metric">
            <div className="fm-metric-tag">OBTM</div>
            <div className="fm-metric-name">{t('成绩计步', 'Scores your result', "成績計步")}</div>
            <p className="fm-metric-text">
              {i18n.language === 'zh-Hant'
                ? (<>Outer Block Turn Metric:外層(含寬層)的每次轉動算 <b>1 步</b>,整體旋轉 <K>x/y/z</K> <b>不計步</b>。這就是寫在成績單上的那個數字(E2d)。</>)
                : (isZh
                  ? (<>Outer Block Turn Metric:外层(含宽层)的每次转动算 <b>1 步</b>,整体旋转 <K>x/y/z</K> <b>不计步</b>。这就是写在成绩单上的那个数字(E2d)。</>)
                  : (<>Outer Block Turn Metric: each outer-layer turn (wide turns included) is <b>1 move</b>; whole-cube rotations <K>x/y/z</K> <b>do not count</b>. This is the number on your scorecard (E2d).</>))}
            </p>
          </div>
          <div className="fm-metric">
            <div className="fm-metric-tag">ETM</div>
            <div className="fm-metric-name">{t('守 80 步上限', 'Caps you at 80')}</div>
            <p className="fm-metric-text">
              {i18n.language === 'zh-Hant'
                ? (<>Execution Turn Metric:把<b>整體旋轉也算進去</b>。解法按 ETM 數<b>不得超過 80 步</b>(E2d1)。所以紅線管的是“寫了多長”,不是“值多少分”。</>)
                : (isZh
                  ? (<>Execution Turn Metric:把<b>整体旋转也算进去</b>。解法按 ETM 数<b>不得超过 80 步</b>(E2d1)。所以红线管的是“写了多长”,不是“值多少分”。</>)
                  : (<>Execution Turn Metric: here whole-cube rotations <b>do count</b>. The solution must be <b>at most 80 ETM moves</b> (E2d1). The ceiling limits how long the writing is, not what it scores.</>))}
            </p>
          </div>
        </div>

        <Callout tone="info" label={t('记号怎么写', 'Which notation to use', "記號怎麼寫")} icon={<Cuboid size={17} />}>
          {i18n.language === 'zh-Hant'
            ? (
              <>
                  解法只能用<Link href="/regulation/notation">規則 12a(轉動表示方法)</Link>裡為三階定義的記號:面字母、撇號、<K>2</K>、寬層、以及 <K>x/y/z</K> 整體旋轉。只有數字、字母和撇號計入解法,其它符號被忽略(E2c4)。<br />
                  舊的方括號寫法(如 <K>[r]</K>)已廢止,只保留 <K>x/y/z</K> 轉體(E2c2++)。
                </>
            )
            : (isZh
              ? (
                <>
                  解法只能用<Link href="/regulation/notation">规则 12a(转动表示方法)</Link>里为三阶定义的记号:面字母、撇号、<K>2</K>、宽层、以及 <K>x/y/z</K> 整体旋转。只有数字、字母和撇号计入解法,其它符号被忽略(E2c4)。<br />
                  旧的方括号写法(如 <K>[r]</K>)已废止,只保留 <K>x/y/z</K> 转体(E2c2++)。
                </>
              )
              : (
                <>
                  Solutions may only use the 3×3×3 notation from <Link href="/regulation/notation">Article 12a (Notation)</Link>: face letters, primes, <K>2</K>, wide turns and <K>x/y/z</K> rotations. Only numbers, letters and apostrophes count toward the solution; other symbols are ignored (E2c4).<br />
                  The old bracket notation (e.g. <K>[r]</K>) is gone — only <K>x/y/z</K> rotations remain (E2c2++).
                </>
              ))}
        </Callout>
      </RegSection>

      {/* ── 5. When it is a DNF ──────────────────────────────────── */}
      <RegSection
        eyebrow={t('什么时候算作废', 'When it does not count', "什麼時候算作廢")}
        title={t('被判 DNF 的情形', 'The ways to get a DNF')}
        lede={t(
          '附则 E 的处罚几乎都是 DNF —— 没有 +2 这种小罚。常见的作废情形集中如下。',
          'Almost every penalty in Appendix E is a DNF — there is no "+2" here. The common ways to lose an attempt are gathered below.', "附則 E 的處罰幾乎都是 DNF —— 沒有 +2 這種小罰。常見的作廢情形集中如下。"
        )}
      >
        <RegList
          items={[
            <span key="wrong"><strong>{t('解法不正确。', 'The solution is wrong.', "解法不正確。")}</strong>{' '}
              {t('打乱后接上解法,魔方没有回到还原态(E2c)。', 'Applying the solution after the scramble does not leave a solved cube (E2c).', "打亂後接上解法,魔方沒有回到還原態(E2c)。")}{' '}
              <span className="fm-tag">E2c</span></span>,
            <span key="over"><strong>{t('超过 80 步。', 'Over 80 moves.', "超過 80 步。")}</strong>{' '}
              {t('按 ETM(含整体旋转)算超过 80 步(E2d1)。', 'More than 80 moves counted in ETM, rotations included (E2d1).', "按 ETM(含整體旋轉)算超過 80 步(E2d1)。")}{' '}
              <span className="fm-tag">E2d1</span></span>,
            <span key="ambig"><strong>{t('解法有歧义。', 'The solution is ambiguous.', "解法有歧義。")}</strong>{' '}
              {t('看不出唯一一条按顺序的步骤序列(E2c2);用了未定义的符号刻意增加判读难度(E2c8)。', 'No single clearly ordered move sequence (E2c2); or deliberately obfuscated with undefined symbols (E2c8).', "看不出唯一一條按順序的步驟序列(E2c2);用了未定義的符號刻意增加判讀難度(E2c8)。")}{' '}
              <span className="fm-tag">E2c2</span></span>,
            <span key="id"><strong>{t('缺少识别信息。', 'No identifying info.', "缺少識別資訊。")}</strong>{' '}
              {t('纸上没写姓名 / WCA ID / 报名号中至少一项(E2c1)。', 'The paper lacks at least one of name / WCA ID / registrant ID (E2c1).', "紙上沒寫姓名 / WCA ID / 報名號中至少一項(E2c1)。")}{' '}
              <span className="fm-tag">E2c1</span></span>,
            <span key="derive"><strong>{t('解法源自打乱。', 'Derived from the scramble.', "解法源自打亂。")}</strong>{' '}
              {t('解法直接取自打乱或其逆序(如前 4 步与逆序打乱一致);代表可要求逐步解释用途(E2e / E2e1)。', 'The solution is taken from the scramble or its inverse (e.g. first 4 moves match the inverse); the Delegate may ask you to justify each move (E2e / E2e1).', "解法直接取自打亂或其逆序(如前 4 步與逆序打亂一致);代表可要求逐步解釋用途(E2e / E2e1)。")}{' '}
              <span className="fm-tag">E2e</span></span>,
            <span key="tools"><strong>{t('用了违规物品或交流。', 'Banned tools or communication.', "用了違規物品或交流。")}</strong>{' '}
              {t('使用 E3 清单以外的物品,或向他人寻求求解帮助(E3 / E5)。', 'Using anything outside the E3 list, or getting solving help from others (E3 / E5).', "使用 E3 清單以外的物品,或向他人尋求求解幫助(E3 / E5)。")}{' '}
              <span className="fm-tag">E3 · E5</span></span>,
          ]}
        />
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
