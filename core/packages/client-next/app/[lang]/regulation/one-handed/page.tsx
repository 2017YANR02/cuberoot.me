'use client';

// /regulation/one-handed — Article C (One-Handed Solving).
//
// Illustrated guide to the one-handed event. The whole article is short: it
// inherits Article A's speed-solve procedure and only adds the "one hand only"
// rules. The visual centrepiece is a do / don't pair (one Hand icon = allowed,
// two = forbidden). Content paraphrases the official Article C verbatim source
// (regulations C1, C1b, C1b+, C1b++, C1b2, C1b3, C1b4, C1c).

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, Eye, Wrench, Timer } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/C.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './one-handed.css';

/** A do / don't hand panel: tone ok (one hand) / bad (two hands). */
function HandPanel({
  hands, tone, title, sub,
}: { hands: 1 | 2; tone: 'ok' | 'bad'; title: ReactNode; sub: ReactNode }) {
  return (
    <figure className={`oh-panel oh-panel-${tone}`}>
      <div className="oh-panel-icons" aria-hidden="true">
        <Hand size={46} strokeWidth={1.6} />
        {hands === 2 && <Hand size={46} strokeWidth={1.6} className="oh-hand-2" />}
      </div>
      <figcaption className="oh-panel-cap">
        <span className="oh-panel-title">{title}</span>
        <span className="oh-panel-sub">{sub}</span>
      </figcaption>
    </figure>
  );
}

export default function OneHandedChapter() {
  const { i18n } = useTranslation(); // subscribe to language toggle
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  return (
    <RegArticleLayout slug="one-handed">
      {/* ── 1. The one rule that matters ─────────────────────────── */}
      <RegSection
        eyebrow={t('一句话规则', 'The whole rule in one line', "一句話規則")}
        title={t('一只手,从头到尾', 'One hand, start to finish', "一隻手,從頭到尾")}
        lede={t(
          '单手还原(3×3×3 One-Handed,OH)的项目内容和速拧完全一样 —— 还是那个三阶、那 15 秒观察、那同一台计时器。唯一的不同:从开始转动到完成,你只能用一只手操作魔方。',
          'One-Handed (3×3×3 OH) is the same event as the speed solve — the same cube, the same 15-second inspection, the same timer. The one difference: from the first turn to the last, only one hand may operate the puzzle.', "單手還原(3×3×3 One-Handed,OH)的項目內容和速擰完全一樣 —— 還是那個三階、那 15 秒觀察、那同一臺計時器。唯一的不同:從開始轉動到完成,你只能用一隻手操作魔方。"
        )}
      >
        <div className="oh-pair">
          <HandPanel
            hands={1}
            tone="ok"
            title={t('允许', 'Allowed', "允許")}
            sub={t('全程只用一只手操作魔方', 'Operate the puzzle with one hand only', "全程只用一隻手操作魔方")}
          />
          <HandPanel
            hands={2}
            tone="bad"
            title={t('禁止', 'Not allowed')}
            sub={t('还原中用另一只手操作魔方 = DNF', 'Operating the puzzle with the other hand = DNF', "還原中用另一隻手操作魔方 = DNF")}
          />
        </div>

        <RegQuote num="C1b">
          {t(
            '在还原过程中,选手只能用一只手操作魔方。违反则取消该次还原资格(DNF)。',
            'During the solve, the competitor must use only one hand to operate the puzzle. Penalty: disqualification of the attempt (DNF).', "在還原過程中,選手只能用一隻手操作魔方。違反則取消該次還原資格(DNF)。"
          )}
        </RegQuote>

        <Callout tone="danger" label={t('另一只手不得操作魔方', 'The other hand may not operate the puzzle', "另一隻手不得操作魔方")}>
          {i18n.language === 'zh-Hant'
            ? (<>關鍵限制在 <b>C1c</b>:還原一旦開始、某隻手操作了魔方,<b>另一隻手在整個這一次還原中都不能再操作魔方</b>。這意味著選手必須在開始前就選定用哪隻手 —— 中途換手操作就是 DNF。注意限制的是“操作”,不是“碰到”:另一隻手無意蹭到、又沒造成轉動,由裁判裁量,不算操作(<b>C1b3</b>)。</>)
            : (isZh
              ? (<>关键限制在 <b>C1c</b>:还原一旦开始、某只手操作了魔方,<b>另一只手在整个这一次还原中都不能再操作魔方</b>。这意味着选手必须在开始前就选定用哪只手 —— 中途换手操作就是 DNF。注意限制的是“操作”,不是“碰到”:另一只手无意蹭到、又没造成转动,由裁判裁量,不算操作(<b>C1b3</b>)。</>)
              : (<>The key limit is <b>C1c</b>: once a hand operates the puzzle during the solve, <b>the other hand may not operate it for the rest of that attempt</b>. You commit to a hand before you start — switching hands to operate mid-solve is a DNF. Note the rule is about <i>operating</i>, not merely touching: if the other hand makes accidental contact and applies no move, the judge may rule it is not operating (<b>C1b3</b>).</>))}
        </Callout>
      </RegSection>

      {/* ── 2. What still counts as fair ─────────────────────────── */}
      <RegSection
        eyebrow={t('哪些不算犯规', 'What is still fine', "哪些不算犯規")}
        title={t('单手之外,还允许什么', 'The fine print around "one hand"', "單手之外,還允許什麼")}
        lede={t(
          '“只用一只手”指的是操作魔方。规则对几种常见情况单独做了澄清,免得选手因为正常的、无意的动作被误判。',
          '"One hand only" is about operating the puzzle. The Regulations spell out a few common situations so that normal, unintentional movements are not wrongly penalized.', "“只用一隻手”指的是操作魔方。規則對幾種常見情況單獨做了澄清,免得選手因為正常的、無意的動作被誤判。"
        )}
      >
        <RegList
          items={[
            <span key="inspect">
              <Eye size={16} className="oh-li-icon" />
              <strong>{t('观察时可以用双手。', 'Both hands during inspection.', "觀察時可以用雙手。")}</strong>{' '}
              {t(
                '15 秒观察阶段不受单手限制,选手可以双手拿起魔方查看(C1b+)。限制只在“开始还原”之后生效。',
                'The 15-second inspection is not restricted — you may pick the cube up with both hands to look at it (C1b+). The limit only applies once the solve has started.', "15 秒觀察階段不受單手限制,選手可以雙手拿起魔方檢視(C1b+)。限制只在“開始還原”之後生效。"
              )}{' '}
              <span className="oh-tag">C1b+</span>
            </span>,
            <span key="surface">
              <Hand size={16} className="oh-li-icon" />
              <strong>{t('可以借桌面辅助。', 'You may brace against the surface.', "可以借桌面輔助。")}</strong>{' '}
              {t(
                '可以把魔方抵在桌面/垫子上帮助单手转动,这是单手项目的标准技巧,完全合法(C1b4,见规则 7f1d)。魔方也可以一直放在垫子上滚动。',
                'You may hold the puzzle against the table or mat to help turn it one-handed — a standard OH technique and fully legal (C1b4, see Regulation 7f1d). The cube may also rest and roll on the mat throughout.', "可以把魔方抵在桌面/墊子上幫助單手轉動,這是單手項目的標準技巧,完全合法(C1b4,見規則 7f1d)。魔方也可以一直放在墊子上滾動。"
              )}{' '}
              <span className="oh-tag">C1b4</span>
            </span>,
            <span key="contact">
              <Hand size={16} className="oh-li-icon" />
              <strong>{t('无意的碰触不算操作。', 'Accidental contact is not "operating".', "無意的碰觸不算操作。")}</strong>{' '}
              {t(
                '如果身体其他部位无意中碰到了魔方、又没有造成转动,裁判可酌情认定这不算“操作魔方”(C1b3)。掉了去捡、蹭到了不算犯规,刻意去转才算。',
                'If another body part touches the puzzle unintentionally and applies no move, the judge may rule it is not "operating" the puzzle (C1b3). Brushing it or picking up a drop is fine — deliberately turning with it is not.', "如果身體其他部位無意中碰到了魔方、又沒有造成轉動,裁判可酌情認定這不算“操作魔方”(C1b3)。掉了去撿、蹭到了不算犯規,刻意去轉才算。"
              )}{' '}
              <span className="oh-tag">C1b3</span>
            </span>,
            <span key="repair">
              <Wrench size={16} className="oh-li-icon" />
              <strong>{t('修故障只能用还原的那只手。', 'Repairs use the solving hand only.', "修故障只能用還原的那隻手。")}</strong>{' '}
              {t(
                '万一魔方掉块、解体,选手如果选择修复,必须只用还原的那只手修(C1b2);否则取消该次资格。',
                'If the puzzle pops or comes apart and the competitor chooses to repair it, they must do so with the solving hand only (C1b2); otherwise the attempt is disqualified.', "萬一魔方掉塊、解體,選手如果選擇修復,必須只用還原的那隻手修(C1b2);否則取消該次資格。"
              )}{' '}
              <span className="oh-tag">C1b2</span>
            </span>,
            <span key="switch">
              <Hand size={16} className="oh-li-icon" />
              <strong>{t('不同次还原可以换手。', 'A different attempt may use a different hand.', "不同次還原可以換手。")}</strong>{' '}
              {t(
                '同一轮五次还原,选手不必每次都用同一只手(C1b++)。限制是“一次还原内不换手”,不是“整场只准用一只手”。',
                'Across the five attempts of a round, you need not use the same hand each time (C1b++). The rule is "no switching within one attempt", not "one hand for the whole round".', "同一輪五次還原,選手不必每次都用同一隻手(C1b++)。限制是“一次還原內不換手”,不是“整場只准用一隻手”。"
              )}{' '}
              <span className="oh-tag">C1b++</span>
            </span>,
          ]}
        />
      </RegSection>

      {/* ── 3. Everything else is the speed solve ────────────────── */}
      <RegSection
        eyebrow={t('其余照速拧来', 'Otherwise, it is the speed solve', "其餘照速擰來")}
        title={t('观察、计时与赛制', 'Inspection, timing and format', "觀察、計時與賽制")}
        lede={t(
          '附则 C 很短:除了上面的单手限制,其它一切都直接沿用速拧规程。',
          'Article C is short: apart from the one-hand limit above, everything else is inherited straight from the speed-solve procedure.', "附則 C 很短:除了上面的單手限制,其它一切都直接沿用速擰規程。"
        )}
      >
        <Callout tone="info" label={t('和速拧共用的部分', 'Shared with the speed solve', "和速擰共用的部分")} icon={<Timer size={17} />}>
          {i18n.language === 'zh-Hant'
            ? (
              <>
                  15 秒觀察、雙手放計時器兩側啟動、停表、還原態判定(對齊誤差與 +2 / DNF)、罰時 —— 這些全部照 <Link href="/regulation/speed-solving">附則 A(速擰)</Link> 執行(C1)。<br />
                  賽制是 <b>五次取平均(去掉最好和最差,取中間三次)</b>,和三階速擰一樣。
                </>
            )
            : (isZh
              ? (
                <>
                  15 秒观察、双手放计时器两侧启动、停表、还原态判定(对齐误差与 +2 / DNF)、罚时 —— 这些全部照 <Link href="/regulation/speed-solving">附则 A(速拧)</Link> 执行(C1)。<br />
                  赛制是 <b>五次取平均(去掉最好和最差,取中间三次)</b>,和三阶速拧一样。
                </>
              )
              : (
                <>
                  The 15-second inspection, hands on the timer to start and stop, the solved-state judging (misalignment, +2 / DNF) and the penalties all follow <Link href="/regulation/speed-solving">Article A (Speed Solving)</Link> (C1).<br />
                  The format is the <b>Average of 5 (drop best and worst, average the middle three)</b>, exactly as in the 3×3×3 speed event.
                </>
              ))}
        </Callout>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
