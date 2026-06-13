'use client';

// /regulation/incidents — Article 11: Incidents (意外事件).
//
// 出了状况怎么办:一条决策流程把规则串起来 ——
//   incident → stop & call the Delegate → was it within your control? →
//   result stands / extra attempt. Plus the three kinds of incident,
//   the key "not penalised for things outside your control" principle,
//   the incorrect-scramble / duplicate-scramble branches, and the
//   Head-to-Head note. Shell (breadcrumb/hero/prev-next/footer) comes
//   from RegArticleLayout; visual classes live in ./incidents.css.

import { useTranslation } from 'react-i18next';
import {
  Power, Wrench, Users, AlertTriangle, Hand, ShieldQuestion,
  CircleCheckBig, RotateCcw, Video, Repeat, Swords,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/11.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './incidents.css';

// The three kinds of incident the regulation enumerates (11a1–11a3).
const KINDS = [
  {
    key: 'procedure', Icon: Users, num: '11a1',
    zh: '程序执行有误', en: 'Incorrect procedure',
    zhDesc: '工作人员或选手没有按规定的流程执行 —— 比如裁判提前/延迟喊口令、计时器没正确启停。',
    enDesc: 'An official or competitor does not follow the prescribed procedure — e.g. a judge mis-times a call, or the timer is not started or stopped correctly.',
  },
  {
    key: 'interference', Icon: Power, num: '11a2',
    zh: '干扰或场地中断', en: 'Interference or interruption',
    zhDesc: '外部干扰或场地状况打断了还原 —— 比如停电、火警/警报响起、旁人撞到桌子。',
    enDesc: 'Outside interference or a facility problem interrupts the solve — e.g. a power failure, an emergency alarm, or someone knocking the table.',
  },
  {
    key: 'equipment', Icon: Wrench, num: '11a3',
    zh: '设备故障', en: 'Equipment malfunction',
    zhDesc: '比赛设备出问题 —— 比如计时器失灵、垫子或显示器故障。(注意:魔方本身的故障归第 5 章管。)',
    enDesc: 'Competition equipment fails — e.g. a malfunctioning timer, mat or display. (A defect of the puzzle itself is handled by Article 5.)',
  },
];

export default function IncidentsChapter() {
  const { i18n } = useTranslation(); // re-render on language toggle
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  return (
    <RegArticleLayout slug="incidents">
      {/* ── 1. What counts as an incident ───────────────────────────── */}
      <RegSection
        eyebrow={t('它指什么', 'What it means', "它指什麼")}
        title={t('什么算「意外事件」', 'What counts as an incident', "什麼算「意外事件」")}
        lede={t(
          '还原不总是顺顺当当。当有东西打断了一次正常的尝试,而问题不在选手对魔方的操作本身时,规则称之为「意外事件」,并交给 WCA 代表来裁决。它分三类:',
          'A solve does not always go smoothly. When something disrupts an otherwise normal attempt — and the problem is not the competitor’s own handling of the puzzle — the Regulations call it an incident, and hand it to the WCA Delegate to resolve. There are three kinds:', "還原不總是順順當當。當有東西打斷了一次正常的嘗試,而問題不在選手對魔方的操作本身時,規則稱之為「意外事件」,並交給 WCA 代表來裁決。它分三類:"
        )}
      >
        <div className="inc-kinds">
          {KINDS.map(({ key, Icon, num, zh, en, zhDesc, enDesc }) => (
            <div className="inc-kind" key={key}>
              <div className="inc-kind-head">
                <span className="inc-kind-icon"><Icon size={22} /></span>
                <span className="inc-kind-title">{t(zh, en)}</span>
                <span className="inc-kind-num">{num}</span>
              </div>
              <p className="inc-kind-text">{t(zhDesc, enDesc)}</p>
            </div>
          ))}
        </div>

        <Callout
          tone="info"
          label={t('谁来定夺:WCA 代表', 'Who decides: the WCA Delegate', "誰來定奪:WCA 代表")}
          style={{ marginTop: 30 }}
        >
          {i18n.language === 'zh-Hant'
            ? (<>出了意外,由 <strong>WCA 代表</strong>採取「公正且恰當」的處理方式(規則 11b)。規則沒寫到或不夠清楚的情況,代表本著<strong>公平競技精神</strong>裁決(11d)。代表的核心工具是:<strong>額外機會(extra attempt)</strong> —— 用一條新打亂重做一次,替換掉受影響的那次。</>)
            : (isZh ? (<>出了意外,由 <strong>WCA 代表</strong>采取「公正且恰当」的处理方式(规则 11b)。规则没写到或不够清楚的情况,代表本着<strong>公平竞技精神</strong>裁决(11d)。代表的核心工具是:<strong>额外机会(extra attempt)</strong> —— 用一条新打乱重做一次,替换掉受影响的那次。</>) : (<>When an incident happens, the <strong>WCA Delegate</strong> decides an “impartial and appropriate course of action” (11b). Where the Regulations are silent or unclear, the Delegate rules on <strong>fair sportsmanship</strong> (11d). The Delegate’s main tool is the <strong>extra attempt</strong> — a redo on a fresh scramble that replaces the affected one.</>))}
        </Callout>
      </RegSection>

      {/* ── 2. The decision flow ────────────────────────────────────── */}
      <RegSection
        eyebrow={t('出了状况怎么办', 'When something goes wrong', "出了狀況怎麼辦")}
        title={t('一步步:从意外到判定', 'Step by step: from incident to verdict', "一步步:從意外到判定")}
        lede={t(
          '遇到意外,选手该做的第一件事永远是「停下来、叫人」。下面这条流程把规则 11 串成了一张图。',
          'The first thing to do in an incident is always the same: stop and call for help. This flow strings Article 11 into one picture.', "遇到意外,選手該做的第一件事永遠是「停下來、叫人」。下面這條流程把規則 11 串成了一張圖。"
        )}
      >
        <div className="inc-flow" role="list">
          <div className="inc-step" role="listitem">
            <span className="inc-step-tag">{t('第 1 步', 'Step 1')}</span>
            <span className="inc-step-icon"><AlertTriangle size={20} /></span>
            <span className="inc-step-title">{t('意外发生', 'An incident happens', "意外發生")}</span>
            <span className="inc-step-desc">{t('干扰、故障或程序有误打断了你的尝试。', 'Interference, a malfunction, or a procedure error disrupts your attempt.', "干擾、故障或程式有誤打斷了你的嘗試。")}</span>
          </div>
          <div className="inc-arrow" aria-hidden>↓</div>

          <div className="inc-step" role="listitem">
            <span className="inc-step-tag">{t('第 2 步', 'Step 2')}</span>
            <span className="inc-step-icon"><Hand size={20} /></span>
            <span className="inc-step-title">{t('停下来,当场申诉', 'Stop and appeal on the spot', "停下來,當場申訴")}</span>
            <span className="inc-step-desc">{t('在结束这次尝试之前,口头或书面向裁判和代表提出。事后再申诉,机会很小。', 'Before finishing the attempt, tell the judge and Delegate, verbally or in writing. Appealing after you finish rarely works.', "在結束這次嘗試之前,口頭或書面向裁判和代表提出。事後再申訴,機會很小。")}</span>
          </div>
          <div className="inc-arrow" aria-hidden>↓</div>

          <div className="inc-step inc-step-q" role="listitem">
            <span className="inc-step-tag">{t('第 3 步', 'Step 3')}</span>
            <span className="inc-step-icon"><ShieldQuestion size={20} /></span>
            <span className="inc-step-title">{t('代表判断:问题在你的掌控之内吗?', 'Delegate judges: was it within your control?', "代表判斷:問題在你的掌控之內嗎?")}</span>
            <span className="inc-step-desc">{t('受影响的是这次尝试的公平性,还是纯属你自己的失误?', 'Was the fairness of the attempt affected, or was it merely your own mistake?', "受影響的是這次嘗試的公平性,還是純屬你自己的失誤?")}</span>
          </div>

          <div className="inc-branch">
            <div className="inc-outcome inc-outcome-extra">
              <div className="inc-outcome-head">
                <RotateCcw size={18} />
                {t('不在你掌控之内 → 可给额外机会', 'Outside your control → extra attempt', "不在你掌控之內 → 可給額外機會")}
              </div>
              <p className="inc-outcome-text">
                {t(
                  '尝试因意外受影响时,代表可以批准一次额外机会:换一条新打乱、紧接着重做,替换掉受影响的那次。申诉成功并不保证 —— 不确定时,可先给一次「临时额外机会」。',
                  'If the attempt was affected by the incident, the Delegate may grant an extra attempt: a fresh scramble, done right after, replacing the affected one. An appeal is never guaranteed — when in doubt, a provisional extra may be granted.', "嘗試因意外受影響時,代表可以批准一次額外機會:換一條新打亂、緊接著重做,替換掉受影響的那次。申訴成功並不保證 —— 不確定時,可先給一次「臨時額外機會」。"
                )}
              </p>
            </div>
            <div className="inc-outcome inc-outcome-stands">
              <div className="inc-outcome-head">
                <CircleCheckBig size={18} />
                {t('属于你的失误 → 成绩照算', 'Your own mistake → result stands', "屬於你的失誤 → 成績照算")}
              </div>
              <p className="inc-outcome-text">
                {t(
                  '如果问题出在你自己的操作或失误,而非外部意外,那这次成绩(含任何罚秒)照常成立 —— 没有额外机会。',
                  'If the problem was your own handling or error rather than an outside incident, the result stands as is (with any penalty) — no extra attempt.', "如果問題出在你自己的操作或失誤,而非外部意外,那這次成績(含任何罰秒)照常成立 —— 沒有額外機會。"
                )}
              </p>
            </div>
          </div>
        </div>

        <Callout
          tone="success"
          label={t('一句话原则', 'The principle, in one line', "一句話原則")}
          style={{ marginTop: 34 }}
        >
          {t(
            '你不会因为「不在你掌控之内」的事被罚 —— 停电、警报、旁人干扰、设备故障,这些都不该让你白白损失一次成绩。但反过来:意外不是「免死金牌」,自己的失误仍由自己承担,代表也会避免让额外机会变成走捷径的方式。',
            'You are not penalised for things outside your control — a power cut, an alarm, a bystander, a broken timer should not cost you a result. But the reverse holds too: an incident is not a free pass. Your own mistakes are still yours, and the Delegate guards against the extra attempt becoming a shortcut.', "你不會因為「不在你掌控之內」的事被罰 —— 停電、警報、旁人干擾、裝置故障,這些都不該讓你白白損失一次成績。但反過來:意外不是「免死金牌」,自己的失誤仍由自己承擔,代表也會避免讓額外機會變成走捷徑的方式。"
          )}
        </Callout>
      </RegSection>

      {/* ── 3. How an extra attempt works ───────────────────────────── */}
      <RegSection
        eyebrow={t('额外机会的规矩', 'How the extra attempt works', "額外機會的規矩")}
        title={t('补测怎么做、怎么记', 'Doing and recording an extra', "補測怎麼做、怎麼記")}
        lede={t(
          '一旦代表批了额外机会,执行上有几条硬性要求,确保它公平、可追溯。',
          'Once the Delegate grants an extra attempt, a few hard rules govern how it is run — keeping it fair and traceable.', "一旦代表批了額外機會,執行上有幾條硬性要求,確保它公平、可追溯。"
        )}
      >
        <RegList
          items={[
            (i18n.language === 'zh-Hant'
              ? (<><strong>必須用新打亂。</strong> 額外機會要用當前官方打亂程式生成的、<strong>另一條</strong>打亂序列,不能重複用原來那條。<span className="inc-tag">11e1</span></>)
              : (isZh ? (<><strong>必须用新打乱。</strong> 额外机会要用当前官方打乱程序生成的、<strong>另一条</strong>打乱序列,不能重复用原来那条。<span className="inc-tag">11e1</span></>) : (<><strong>A fresh scramble.</strong> The extra must use a <strong>different</strong> scramble sequence from a current official scramble program — never the original one. <span className="inc-tag">11e1</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>緊接著做,替換原位。</strong> 額外機會應在引發它的那次之後立即進行,並替換掉原來那個編號的嘗試。若順序亂了,成績按<strong>打亂序列的順序</strong>記錄,而非完成的先後。<span className="inc-tag">11e2 · 11e2a</span></>)
              : (isZh ? (<><strong>紧接着做,替换原位。</strong> 额外机会应在引发它的那次之后立即进行,并替换掉原来那个编号的尝试。若顺序乱了,成绩按<strong>打乱序列的顺序</strong>记录,而非完成的先后。<span className="inc-tag">11e2 · 11e2a</span></>) : (<><strong>Right after, in place.</strong> An extra should be done immediately after the attempt that caused it, replacing that numbered attempt. If done out of order, results are recorded by <strong>scramble-sequence order</strong>, not the order solved. <span className="inc-tag">11e2 · 11e2a</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>可以邊申訴邊計時。</strong> 因為申訴不保證成功,選手可以選擇讓計時繼續、合適時恢復還原 —— 這樣萬一申訴被駁回,這次成績仍然有效。<span className="inc-tag">11e+</span></>)
              : (isZh ? (<><strong>可以边申诉边计时。</strong> 因为申诉不保证成功,选手可以选择让计时继续、合适时恢复还原 —— 这样万一申诉被驳回,这次成绩仍然有效。<span className="inc-tag">11e+</span></>) : (<><strong>You may keep the timer running.</strong> Since an appeal may fail, you can choose to let the timer run and resume when appropriate — so the result still counts if the appeal is denied. <span className="inc-tag">11e+</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>不確定就先給臨時機會。</strong> 是否該給額外機會一時拿不準時,可先安排一次「臨時額外機會」,只有事後(例如經規則委員會判定)確認該給時才採用。<span className="inc-tag">11e3</span></>)
              : (isZh ? (<><strong>不确定就先给临时机会。</strong> 是否该给额外机会一时拿不准时,可先安排一次「临时额外机会」,只有事后(例如经规则委员会判定)确认该给时才采用。<span className="inc-tag">11e3</span></>) : (<><strong>Provisional when unsure.</strong> If it is unclear whether an extra is warranted, a provisional extra may be done, and only used if it is later confirmed (e.g. by the Regulations Committee) that one was appropriate. <span className="inc-tag">11e3</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>記下理由、按原日期算。</strong> 代表應把給額外機會的原因記在成績單上;額外機會的成績視為發生在<strong>原嘗試當天</strong>(用於排名歸屬)。<span className="inc-tag">11e++ · 11e++++++</span></>)
              : (isZh ? (<><strong>记下理由、按原日期算。</strong> 代表应把给额外机会的原因记在成绩单上;额外机会的成绩视为发生在<strong>原尝试当天</strong>(用于排名归属)。<span className="inc-tag">11e++ · 11e++++++</span></>) : (<><strong>Note the reason, dated to the original.</strong> The Delegate should record why an extra was granted on the scorecard; the extra is treated as done on the <strong>original solve’s date</strong> for ranking. <span className="inc-tag">11e++ · 11e++++++</span></>))),
          ]}
        />

        <Callout
          tone="info"
          label={t('视频证据:实时优先', 'Video evidence: real time first', "影片證據:實時優先")}
          icon={<Video size={17} />}
          style={{ marginTop: 30 }}
        >
          {t(
            '判定意外时可借助视频、照片或录音作为佐证(11f)。这类证据原则上按实时速度回看;只有在少数情形下才允许慢放或逐帧分析 —— 例如成绩是大区纪录或世界排名前 50、是国家/大洲/世界锦标赛决赛、或用于撤销原本的罚秒、调查作弊。',
            'Incident decisions may be supported by video, photo or audio evidence (11f). Such evidence is reviewed in real time by default; slow-motion or frame-by-frame is allowed only in narrow cases — e.g. a regional record or world top-50 result, a National/Continental/World Championship final, or to remove a penalty or investigate cheating.', "判定意外時可藉助影片、照片或錄音作為佐證(11f)。這類證據原則上按實時速度回看;只有在少數情形下才允許慢放或逐幀分析 —— 例如成績是大區紀錄或世界排名前 50、是國家/大洲/世界錦標賽決賽、或用於撤銷原本的罰秒、調查作弊。"
          )}
        </Callout>
      </RegSection>

      {/* ── 4. Special branches: wrong scramble / duplicate ─────────── */}
      <RegSection
        eyebrow={t('两种打乱出错', 'Two scramble errors', "兩種打亂出錯")}
        title={t('打乱错了、或重复了', 'A wrong, or duplicate, scramble', "打亂錯了、或重複了")}
        lede={t(
          '打乱本身出错是最常见的意外之一,规则给了细分处理:打乱拧错了,还是发到了重复的打乱。',
          'A faulty scramble is one of the most common incidents, and the rules treat it in detail: a puzzle scrambled incorrectly, or a duplicate scramble handed out.', "打亂本身出錯是最常見的意外之一,規則給了細分處理:打亂擰錯了,還是發到了重複的打亂。"
        )}
      >
        <div className="inc-cases">
          <div className="inc-case">
            <div className="inc-case-head">
              <Wrench size={18} />
              {t('打乱拧错了', 'Scrambled incorrectly', "打亂擰錯了")}
              <span className="inc-case-num">11i</span>
            </div>
            <RegList
              items={[
                t('成绩是大区纪录,或世界排名前 50 选手的个人最佳(单次,或它所在的平均),又或解法步数少于规则 4b3 的下界 —— 必须给额外机会;不给就记 DNS(11i1a / 11i1b / 11i1d)。', 'For a regional record, a world top-50 personal best (the single, or the average it belongs to), or a solve under the Regulation 4b3 move minimum — an extra must be granted; otherwise the result is DNS (11i1a / 11i1b / 11i1d).', "成績是大區紀錄,或世界排名前 50 選手的個人最佳(單次,或它所在的平均),又或解法步數少於規則 4b3 的下界 —— 必須給額外機會;不給就記 DNS(11i1a / 11i1b / 11i1d)。"),
                t('例外:五阶、六阶、七阶、五魔方、三阶多盲这些项目,以及经两名打乱员核对、并在成绩单上签名的国家/大洲/世界锦标赛决赛 —— 即便破了纪录,也改按下方 11i2 处理:成绩可以保留(11i1e / 11i1f)。(步数低于下界 11i1d 不在此例外内,仍须给额外机会。)', 'Exception: for 5×5×5, 6×6×6, 7×7×7, Megaminx and 3×3×3 Multi-Blind, and for a National / Continental / World Championship final where two scramblers verified the scramble and signed the scorecard — even a record falls under 11i2 below instead, so the result may stand (11i1e / 11i1f). (The move-minimum case 11i1d is not excepted and still requires an extra.)', "例外:五階、六階、七階、五魔方、三階多盲這些項目,以及經兩名打亂員核對、並在成績單上簽名的國家/大洲/世界錦標賽決賽 —— 即便破了紀錄,也改按下方 11i2 處理:成績可以保留(11i1e / 11i1f)。(步數低於下界 11i1d 不在此例外內,仍須給額外機會。)"),
                t('其他情况成绩一般照算;但若不公平影响显著(错乱极简单又破了 PR、影响了领奖台、或故意乱错),代表可酌情给额外机会。', 'Otherwise the result may stand; but if the unfairness is significant (an extremely easy wrong scramble breaking a PR, a podium impact, or a deliberate mis-scramble) the Delegate may grant an extra.', "其他情況成績一般照算;但若不公平影響顯著(錯亂極簡單又破了 PR、影響了領獎臺、或故意亂錯),代表可酌情給額外機會。"),
                t('赛后才发现、又无法补测时,该成绩记 DNS。', 'If found only after the competition and an extra cannot be given, the result becomes DNS.', "賽後才發現、又無法補測時,該成績記 DNS。"),
              ]}
            />
          </div>
          <div className="inc-case">
            <div className="inc-case-head">
              <Repeat size={18} />
              {t('收到重复打乱', 'Duplicate scramble', "收到重複打亂")}
              <span className="inc-case-num">11j</span>
            </div>
            <RegList
              items={[
                t('检查阶段就察觉重复:立刻停下、不要动魔方,叫来代表(真诚误报一般不罚)。', 'Noticed in inspection: stop at once, do not touch the puzzle, and call the Delegate (an honest false alarm is not penalised).', "檢查階段就察覺重複:立刻停下、不要動魔方,叫來代表(真誠誤報一般不罰)。"),
                t('本组进行中发现:代表应设法把正确打乱给到选手。', 'Noticed during the group: the Delegate should try to give the competitor the correct scramble.', "本組進行中發現:代表應設法把正確打亂給到選手。"),
                t('本组结束后、赛中发现:用额外机会替换缺失的那次。赛后才发现:记 DNS。', 'After the group but during the competition: replace the missing attempt with an extra. After the competition: DNS.', "本組結束後、賽中發現:用額外機會替換缺失的那次。賽後才發現:記 DNS。"),
              ]}
            />
          </div>
        </div>

        <RegQuote num="11i2">
          {t(
            '对于其余所有情况,成绩可以保留。例外:若代表认为这样能带来明显更公平的结果,可酌情给予一次额外机会。',
            'For all other cases, the result may stand. Exception: the WCA Delegate may grant an extra attempt at their discretion if they believe this provides a significantly fairer outcome.', "對於其餘所有情況,成績可以保留。例外:若代表認為這樣能帶來明顯更公平的結果,可酌情給予一次額外機會。"
          )}
        </RegQuote>

        <Callout tone="warn" label={t('魔方故障 ≠ 意外', 'A puzzle defect is not an incident')} style={{ marginTop: 22 }}>
          {i18n.language === 'zh-Hant'
            ? (<>要分清:<strong>魔方本身</strong>掉塊、解體、錯位的處理在 <Link href="/regulation/defects" className="inc-link">第 5 章(魔方故障)</Link>,而且<strong>不會</strong>因此給額外機會。第 11 章管的是魔方<em>之外</em>的意外 —— 干擾、裝置、程式、打亂錯誤。</>)
            : (isZh ? (<>要分清:<strong>魔方本身</strong>掉块、解体、错位的处理在 <Link href="/regulation/defects" className="inc-link">第 5 章(魔方故障)</Link>,而且<strong>不会</strong>因此给额外机会。第 11 章管的是魔方<em>之外</em>的意外 —— 干扰、设备、程序、打乱错误。</>) : (<>Keep them apart: a defect of the <strong>puzzle itself</strong> — pops, breakage, misalignment — is handled by <Link href="/regulation/defects" className="inc-link">Article 5 (Puzzle Defects)</Link>, and does <strong>not</strong> grant an extra attempt. Article 11 covers incidents <em>around</em> the puzzle — interference, equipment, procedure, scramble errors.</>))}
        </Callout>
      </RegSection>

      {/* ── 5. Head-to-Head note ────────────────────────────────────── */}
      <RegSection
        eyebrow={t('对决赛制的特例', 'The Head-to-Head case', "對決賽制的特例")}
        title={t('「一对一」里的意外', 'Incidents in Head to Head', "「一對一」裡的意外")}
        lede={t(
          '在两人对决的赛制下,意外的处理多了一层考量:任何处理都要顾及「谁赢这一分」的公平。',
          'In the two-competitor format, incidents carry an extra consideration: any resolution must be fair to who wins the point.', "在兩人對決的賽制下,意外的處理多了一層考量:任何處理都要顧及「誰贏這一分」的公平。"
        )}
      >
        <RegList
          items={[
            t('代表给一方额外机会时,两名选手都必须获得额外机会(11k1)。', 'If the Delegate grants an extra to one competitor for a point, both competitors must receive an extra (11k1).', "代表給一方額外機會時,兩名選手都必須獲得額外機會(11k1)。"),
            t('若意外并不影响「谁会赢这一分」,就不该给额外机会 —— 例如 A 已完成、随后噪音干扰到 B,这一分已属于 A(11k2)。', 'If an incident does not affect who would win the point, no extra is given — e.g. A has finished when noise then distracts B; the point is already A’s (11k2).', "若意外並不影響「誰會贏這一分」,就不該給額外機會 —— 例如 A 已完成、隨後噪音干擾到 B,這一分已屬於 A(11k2)。"),
            t('比赛(match)一旦结束,该场内任何意外的处理即视为最终,用于判定胜负;事后即便修改某次成绩,也不改变这一分的归属(作弊除外)(11l)。', 'Once a match is completed, the resolution of any incident is final for who won the point; later amending a result does not change the point (cheating excepted) (11l).', "比賽(match)一旦結束,該場內任何意外的處理即視為最終,用於判定勝負;事後即便修改某次成績,也不改變這一分的歸屬(作弊除外)(11l)。"),
          ]}
        />
        <p className="inc-foot-note">
          <Swords size={15} className="inc-li-icon" />
          {t('「一对一」赛制的完整规则见', 'The full rules of the Head-to-Head format are in ', "「一對一」賽制的完整規則見")}
          <Link href="/regulation/head-to-head" className="inc-link">{t('附则 I', 'Article I', "附則 I")}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
