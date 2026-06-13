'use client';

// /regulation/head-to-head — Appendix I: Head to Head Solving (「一对一」复原).
//
// The knockout/bracket format: two competitors solve the same scrambles side by
// side, the better single wins the point, points make a set, sets make a match,
// and the match winner advances. Visuals:
//   1) a "two solvers, one scramble" facing-columns diagram with a VS badge,
//   2) a single-elimination bracket SVG (8-place example) showing winners
//      advancing toward the final.
// Shell (breadcrumb/hero/prev-next/footer) comes from RegArticleLayout; visual
// classes live in ./head-to-head.css.

import { useTranslation } from 'react-i18next';
import {
  Swords, Trophy, Layers, Clock, Megaphone, Scale, ListOrdered, Medal,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/I.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './head-to-head.css';

// Single-elimination ladder: point → set → match → stage → advance.
const LADDER = [
  { key: 'point', Icon: Clock, zh: '一分(point)', en: 'A point',
    zhDesc: '双方用同一条打乱各还原一次,用时更短者赢得这一分。DNF / DNS 是最差结果。',
    enDesc: 'Both solve the same scramble once; the shorter time wins the point. A DNF or DNS is the worst possible result.' },
  { key: 'set', Icon: Layers, zh: '一局(set)', en: 'A set',
    zhDesc: '先赢 3 分者拿下一局。打满 7 分仍未分出,则按分数、再按局内最佳单次决定。',
    enDesc: 'First to 3 points wins the set. If no one wins after 7 points, the most points — then best single in the set — decides.' },
  { key: 'match', Icon: Swords, zh: '一场(match)', en: 'A match',
    zhDesc: '先赢 X 局者赢得这场对决(X 为 1、2 或 3,同一阶段内一致)。',
    enDesc: 'First to win X sets wins the match (X is 1, 2, or 3, the same across a stage).' },
  { key: 'advance', Icon: Trophy, zh: '晋级(advance)', en: 'Advance',
    zhDesc: '胜者进入下一阶段,负者淘汰;半决赛的负者进入季军赛。',
    enDesc: 'The winner advances to the next stage, the loser is eliminated; semifinal losers go to the Third Place Match.' },
];

// 8-place bracket: each entry is a label slot. Drawn purely with SVG so it stays
// crisp and uses theme tokens (currentColor / CSS vars via class).
function Bracket8({ seedLabel, finalLabel }: { seedLabel: string; finalLabel: string }) {
  // Column x positions and a tidy set of y positions for an 8 → 4 → 2 → 1 tree.
  const r1 = [20, 70, 130, 180, 240, 290, 350, 400]; // 8 seeds (4 matches)
  const r2 = [45, 155, 265, 375]; // 4 winners (semifinal feeders)
  const r3 = [100, 320]; // 2 (semifinal winners → final)
  const r4 = [210]; // champion
  const xs = [10, 120, 240, 360, 470]; // node columns
  const w = 96, h = 26;
  const node = (x: number, y: number, cls = '') => (
    <rect x={x} y={y} width={w} height={h} rx={7} className={`h2h-bx ${cls}`} />
  );
  // connector from (x1,y1 center-right) to (x2,y2 center-left)
  const link = (x1: number, y1: number, x2: number, y2: number, key: string) => {
    const sx = x1 + w, sy = y1 + h / 2, ex = x2, ey = y2 + h / 2, mx = (sx + ex) / 2;
    return <path key={key} d={`M ${sx} ${sy} H ${mx} V ${ey} H ${ex}`} className="h2h-bline" />;
  };
  return (
    <svg viewBox="0 0 580 440" className="h2h-bracket-svg" role="img"
      aria-label={seedLabel}>
      {/* links r1 → r2 */}
      {r2.map((y, i) => (
        <g key={`l1-${i}`}>
          {link(xs[0], r1[i * 2], xs[1], y, `a${i}`)}
          {link(xs[0], r1[i * 2 + 1], xs[1], y, `b${i}`)}
        </g>
      ))}
      {/* links r2 → r3 */}
      {r3.map((y, i) => (
        <g key={`l2-${i}`}>
          {link(xs[1], r2[i * 2], xs[2], y, `c${i}`)}
          {link(xs[1], r2[i * 2 + 1], xs[2], y, `d${i}`)}
        </g>
      ))}
      {/* links r3 → r4 */}
      {link(xs[2], r3[0], xs[3], r4[0], 'e0')}
      {link(xs[2], r3[1], xs[3], r4[0], 'e1')}
      {/* nodes */}
      {r1.map((y, i) => <g key={`n1-${i}`}>{node(xs[0], y)}</g>)}
      {r2.map((y, i) => <g key={`n2-${i}`}>{node(xs[1], y)}</g>)}
      {r3.map((y, i) => <g key={`n3-${i}`}>{node(xs[2], y)}</g>)}
      {node(xs[3], r4[0], 'h2h-bx-champ')}
      {/* champion label inside + caption under the champion box */}
      <text x={xs[3] + w / 2} y={r4[0] + h / 2 + 4} className="h2h-bx-cap" textAnchor="middle">{finalLabel}</text>
    </svg>
  );
}

export default function HeadToHeadChapter() {
  const { i18n } = useTranslation(); // re-render on language toggle
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  return (
    <RegArticleLayout slug="head-to-head">
      {/* ── 1. The idea: two solvers, one scramble ──────────────────── */}
      <RegSection
        eyebrow={t('它是什么', 'What it is', "它是什麼")}
        title={t('两人,一条打乱', 'Two solvers, one scramble', "兩人,一條打亂")}
        lede={t(
          '「一对一」是一种淘汰赛(对阵表)赛制:两名选手并排坐,用同一条打乱同时开拧,快的人赢下这一分。它只用于一个项目的决赛,目前可用于三阶、四阶、三盲、单手。',
          'Head to Head is a knockout (bracket) format: two competitors sit side by side and solve the same scramble at the same time — the faster one wins the point. It is used only for the final round of an event, currently available for 3×3×3, 4×4×4, 3×3×3 Blindfolded, and One-Handed.', "「一對一」是一種淘汰賽(對陣表)賽制:兩名選手並排坐,用同一條打亂同時開擰,快的人贏下這一分。它只用於一個項目的決賽,目前可用於三階、四階、三盲、單手。"
        )}
      >
        <figure className="h2h-versus">
          <div className="h2h-side h2h-side-a">
            <div className="h2h-side-tag">{t('选手 A', 'Competitor A', "選手 A")}</div>
            <div className="h2h-cube" aria-hidden />
            <div className="h2h-side-foot">{t('同一条打乱', 'Same scramble', "同一條打亂")}</div>
          </div>
          <div className="h2h-vs" aria-hidden><Swords size={22} /><span>VS</span></div>
          <div className="h2h-side h2h-side-b">
            <div className="h2h-side-tag">{t('选手 B', 'Competitor B', "選手 B")}</div>
            <div className="h2h-cube" aria-hidden />
            <div className="h2h-side-foot">{t('同时开拧', 'Solve together', "同時開擰")}</div>
          </div>
          <figcaption className="h2h-versus-cap">
            {t(
              '播报员喊 START,两人同时开始;用时更短者赢得这一分。',
              'The announcer calls START and both begin together; the shorter time wins the point.', "播報員喊 START,兩人同時開始;用時更短者贏得這一分。"
            )}
          </figcaption>
        </figure>

        <Callout tone="info" label={t('只看单次,不看平均', 'Singles only, no averages', "只看單次,不看平均")} style={{ marginTop: 30 }}>
          {t(
            '一对一赛制只比单次成绩。该轮取得的单次可计入排名与各级纪录,但这种赛制下不产生任何平均成绩的排名或纪录(规则 9i4)。',
            'Head to Head compares single results only. Singles achieved in the round are eligible for ranking and regional records, but no average ranking or record can be set in this format (Regulation 9i4).', "一對一賽制只比單次成績。該輪取得的單次可計入排名與各級紀錄,但這種賽制下不產生任何平均成績的排名或紀錄(規則 9i4)。"
          )}
        </Callout>
      </RegSection>

      {/* ── 2. Point → set → match → advance ────────────────────────── */}
      <RegSection
        eyebrow={t('怎么算赢', 'How winning works', "怎麼算贏")}
        title={t('分、局、场、晋级', 'Point, set, match, advance', "分、局、場、晉級")}
        lede={t(
          '一对一不是「一拧定胜负」,而是层层嵌套:分凑成局,局凑成场,赢下一场才能晋级。',
          'Head to Head is not a single shootout; it nests: points make a set, sets make a match, and winning the match is what advances you.', "一對一不是「一擰定勝負」,而是層層巢狀:分湊成局,局湊成場,贏下一場才能晉級。"
        )}
      >
        <ol className="h2h-ladder">
          {LADDER.map(({ key, Icon, zh, en, zhDesc, enDesc }, i) => (
            <li className="h2h-ladder-item" key={key}>
              <span className="h2h-ladder-step">{i + 1}</span>
              <span className="h2h-ladder-icon"><Icon size={20} /></span>
              <div className="h2h-ladder-body">
                <div className="h2h-ladder-title">{t(zh, en)}</div>
                <p className="h2h-ladder-desc">{t(zhDesc, enDesc)}</p>
              </div>
            </li>
          ))}
        </ol>

        <RegQuote num="I3c">
          {t(
            '赢得一分的是成绩更好的一方,「更好」即用时更短;DNF 或 DNS 是最差的结果。',
            'The winner of a point is the competitor with the better result, where “better” means the shorter time. A DNF or DNS is the worst possible result.', "贏得一分的是成績更好的一方,「更好」即用時更短;DNF 或 DNS 是最差的結果。"
          )}
        </RegQuote>

        <Callout tone="warn" label={t('平局怎么办', 'Handling ties', "平局怎麼辦")} icon={<Scale size={17} />} style={{ marginTop: 6 }}>
          {t(
            '若双方都没有更好的成绩(例如两人都 DNF),这一分无人取得(I3d)。一局打满 7 分仍未有人先到 3 分时,分多者胜;再平则比局内最佳单次,仍平则依次看全场、全轮的最佳单次;最后以种子顺位为准,种子高者胜(I3e)。',
            'If neither has a better result (e.g. both DNF), no one wins the point (I3d). If no one reaches 3 first by 7 points, the most points wins the set; ties then go to best single in the set, then in the match, then in the round; finally the higher seed wins (I3e).', "若雙方都沒有更好的成績(例如兩人都 DNF),這一分無人取得(I3d)。一局打滿 7 分仍未有人先到 3 分時,分多者勝;再平則比局內最佳單次,仍平則依次看全場、全輪的最佳單次;最後以種子順位為準,種子高者勝(I3e)。"
          )}
        </Callout>
      </RegSection>

      {/* ── 3. The bracket ──────────────────────────────────────────── */}
      <RegSection
        eyebrow={t('对阵表', 'The bracket', "對陣表")}
        title={t('单败淘汰,胜者晋级', 'Single elimination, winners advance', "單敗淘汰,勝者晉級")}
        lede={t(
          '一对一是单败淘汰赛。名额必须是 4、8、12 或 16;下面是 8 人对阵表:四分之一决赛 → 半决赛 → 决赛,每场胜者向右晋级,直到决出冠军。',
          'Head to Head is a single-elimination tournament. The number of places must be 4, 8, 12, or 16. Here is an 8-place bracket: Quarterfinal → Semifinal → Final, each match’s winner advancing rightward until a champion remains.', "一對一是單敗淘汰賽。名額必須是 4、8、12 或 16;下面是 8 人對陣表:四分之一決賽 → 半決賽 → 決賽,每場勝者向右晉級,直到決出冠軍。"
        )}
      >
        <figure className="h2h-bracket">
          <div className="h2h-bracket-cols" aria-hidden>
            <span>{t('1/4 决赛', 'Quarterfinal', "1/4 決賽")}</span>
            <span>{t('半决赛', 'Semifinal', "半決賽")}</span>
            <span>{t('决赛', 'Final', "決賽")}</span>
            <span>{t('冠军', 'Champion', "冠軍")}</span>
          </div>
          <Bracket8
            seedLabel={t('8 人单败淘汰对阵表', '8-place single-elimination bracket', "8 人單敗淘汰對陣表")}
            finalLabel={t('冠军', 'Champion', "冠軍")}
          />
        </figure>

        <RegList
          items={[
            (i18n.language === 'zh-Hant'
              ? (<><strong>種子與對陣。</strong> 有前一輪時,按前一輪排名定種子;沒有則按報名資格。首階段最高種子對最低種子,次高對次低,依此類推。<span className="h2h-tag">I1 · I2c</span></>)
              : (isZh ? (<><strong>种子与对阵。</strong> 有前一轮时,按前一轮排名定种子;没有则按报名资格。首阶段最高种子对最低种子,次高对次低,依此类推。<span className="h2h-tag">I1 · I2c</span></>) : (<><strong>Seeding and matchups.</strong> With a prior round, seeds follow that round’s ranking; otherwise the competition’s qualification. In the first stage the top seed faces the bottom seed, second vs second-last, and so on. <span className="h2h-tag">I1 · I2c</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>階段隨名額變化。</strong> 4 人:半決賽 + 決賽;8 人:加四分之一決賽;12、16 人再往前加一個階段(12 人時前 4 號種子輪空,直接進四分之一決賽)。<span className="h2h-tag">I2a · I2c1</span></>)
              : (isZh ? (<><strong>阶段随名额变化。</strong> 4 人:半决赛 + 决赛;8 人:加四分之一决赛;12、16 人再往前加一个阶段(12 人时前 4 号种子轮空,直接进四分之一决赛)。<span className="h2h-tag">I2a · I2c1</span></>) : (<><strong>Stages scale with places.</strong> 4: Semifinal + Final; 8 adds a Quarterfinal; 12 and 16 add another stage (for 12, the top 4 seeds get a bye straight into the Quarterfinal). <span className="h2h-tag">I2a · I2c1</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>季軍賽。</strong> 決賽階段有兩場:決賽和季軍賽 —— 兩場半決賽的負者爭奪銅牌。<span className="h2h-tag">I2b1 · I2e</span></>)
              : (isZh ? (<><strong>季军赛。</strong> 决赛阶段有两场:决赛和季军赛 —— 两场半决赛的负者争夺铜牌。<span className="h2h-tag">I2b1 · I2e</span></>) : (<><strong>Third Place Match.</strong> The Final Stage has two matches: the Final and the Third Place Match, where the two semifinal losers play for bronze. <span className="h2h-tag">I2b1 · I2e</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><strong>棄賽與平種子。</strong> 對決開始前一方退賽,另一方視為獲勝晉級,但不記錄該場成績;種子完全相同則隨機定序。<span className="h2h-tag">I2h · I1d</span></>)
              : (isZh ? (<><strong>弃赛与平种子。</strong> 对决开始前一方退赛,另一方视为获胜晋级,但不记录该场成绩;种子完全相同则随机定序。<span className="h2h-tag">I2h · I1d</span></>) : (<><strong>Withdrawals and tied seeds.</strong> If one withdraws before a match begins, the opponent is treated as winning for progression, but no results are recorded; identical seeds are randomized. <span className="h2h-tag">I2h · I1d</span></>))),
          ]}
        />
      </RegSection>

      {/* ── 4. Modified procedure ───────────────────────────────────── */}
      <RegSection
        eyebrow={t('流程上的不同', 'How the procedure differs')}
        title={t('和普通速拧的差别', 'What changes vs a normal speed-solve', "和普通速擰的差別")}
        lede={t(
          '一对一沿用速拧(附则 A)与盲拧(附则 B)的标准流程,但因为是两人同步、由播报员主持,有几处专门的改动。',
          'Head to Head follows the standard speed-solving (Article A) and blindfolded (Article B) procedures, with a few changes because two competitors are synchronized by an announcer.', "一對一沿用速擰(附則 A)與盲擰(附則 B)的標準流程,但因為是兩人同步、由播報員主持,有幾處專門的改動。"
        )}
      >
        <RegList
          items={[
            (i18n.language === 'zh-Hant'
              ? (<><Megaphone size={16} className="h2h-li-icon" /><strong>播報員主持檢查。</strong> 雙方就位、裁判就緒後,播報員問「READY?」;兩人確認或至少 15 秒後喊「START」開始計檢查時,這一分開始。<span className="h2h-tag">I4c1 · I4c2</span></>)
              : (isZh ? (<><Megaphone size={16} className="h2h-li-icon" /><strong>播报员主持检查。</strong> 双方就位、裁判就绪后,播报员问「READY?」;两人确认或至少 15 秒后喊「START」开始计检查时,这一分开始。<span className="h2h-tag">I4c1 · I4c2</span></>) : (<><Megaphone size={16} className="h2h-li-icon" /><strong>The announcer runs inspection.</strong> Once both are at the station and judges ready, the announcer asks “READY?”; on confirmation or after 15 s, calls “START” to begin inspection and the point. <span className="h2h-tag">I4c1 · I4c2</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><Clock size={16} className="h2h-li-icon" /><strong>統一倒計時。</strong> 檢查到 8 秒喊「8 SECONDS」,11/12/13 秒喊「3、2、1」,14 秒喊「GO」—— 選手須在此時開始還原。<span className="h2h-tag">I4c3–I4c5</span></>)
              : (isZh ? (<><Clock size={16} className="h2h-li-icon" /><strong>统一倒计时。</strong> 检查到 8 秒喊「8 SECONDS」,11/12/13 秒喊「3、2、1」,14 秒喊「GO」—— 选手须在此时开始还原。<span className="h2h-tag">I4c3–I4c5</span></>) : (<><Clock size={16} className="h2h-li-icon" /><strong>A shared countdown.</strong> At 8 s the announcer calls “8 SECONDS”, at 11/12/13 s “3, 2, 1”, and at 14 s “GO” — when the competitor must start the solve. <span className="h2h-tag">I4c3–I4c5</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><Scale size={16} className="h2h-li-icon" /><strong>沒有「超 15 秒」罰則。</strong> 因為檢查流程改了,普通的「15 秒內未開始」罰則在一對一賽制中不適用;但故意拖延開始或在「GO」之前搶跑,裁判可酌情判 DNF。<span className="h2h-tag">I4c6 · I4c7</span></>)
              : (isZh ? (<><Scale size={16} className="h2h-li-icon" /><strong>没有「超 15 秒」罚则。</strong> 因为检查流程改了,普通的「15 秒内未开始」罚则在一对一赛制中不适用;但故意拖延开始或在「GO」之前抢跑,裁判可酌情判 DNF。<span className="h2h-tag">I4c6 · I4c7</span></>) : (<><Scale size={16} className="h2h-li-icon" /><strong>No “over 15 s” penalty.</strong> Because inspection is modified, the usual not-started-in-15-s penalties do not apply; but intentionally delaying, or starting before “GO”, may be a DNF at the judge’s discretion. <span className="h2h-tag">I4c6 · I4c7</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><ListOrdered size={16} className="h2h-li-icon" /><strong>記下勝負。</strong> 裁判記錄成績時,還要在記分表上標明這一分由誰贏、誰輸,或本分無人取得。<span className="h2h-tag">I4d1</span></>)
              : (isZh ? (<><ListOrdered size={16} className="h2h-li-icon" /><strong>记下胜负。</strong> 裁判记录成绩时,还要在记分表上标明这一分由谁赢、谁输,或本分无人取得。<span className="h2h-tag">I4d1</span></>) : (<><ListOrdered size={16} className="h2h-li-icon" /><strong>Note who won the point.</strong> When recording the result, the judge also marks on the score sheet whether each competitor won or lost the point, or there was no winner. <span className="h2h-tag">I4d1</span></>))),
            (i18n.language === 'zh-Hant'
              ? (<><Medal size={16} className="h2h-li-icon" /><strong>盲擰版起手不同。</strong> 三盲一對一同樣由播報員主持:就緒或 15 秒後喊「3、2、1、GO」,選手須在此開始;搶跑或故意拖延同樣可判 DNF。<span className="h2h-tag">I5b</span></>)
              : (isZh ? (<><Medal size={16} className="h2h-li-icon" /><strong>盲拧版起手不同。</strong> 三盲一对一同样由播报员主持:就绪或 15 秒后喊「3、2、1、GO」,选手须在此开始;抢跑或故意拖延同样可判 DNF。<span className="h2h-tag">I5b</span></>) : (<><Medal size={16} className="h2h-li-icon" /><strong>Blindfolded starts differ.</strong> 3×3 BLD Head to Head is also announcer-run: on readiness or after 15 s, “3, 2, 1, GO”, when the competitor must start; a false start or stalling may be a DNF. <span className="h2h-tag">I5b</span></>))),
          ]}
        />

        <Callout tone="success" label={t('意外了怎么算', 'And if something goes wrong', "意外了怎麼算")} icon={<Swords size={17} />} style={{ marginTop: 30 }}>
          {i18n.language === 'zh-Hant'
            ? (<>對決中出現意外時,代表給一方額外機會,則兩人都要給;若意外不影響「誰贏這一分」,則不給。比賽一旦結束,意外的處理即為最終結果(作弊除外)。完整說明見 <Link href="/regulation/incidents" className="h2h-link">第 11 章(意外事件)</Link>。</>)
            : (isZh ? (<>对决中出现意外时,代表给一方额外机会,则两人都要给;若意外不影响「谁赢这一分」,则不给。比赛一旦结束,意外的处理即为最终结果(作弊除外)。完整说明见 <Link href="/regulation/incidents" className="h2h-link">第 11 章(意外事件)</Link>。</>) : (<>If an incident occurs in a match and the Delegate grants one competitor an extra, both must receive one; if it does not affect who wins the point, none is given. Once the match is completed the resolution is final (cheating excepted). See <Link href="/regulation/incidents" className="h2h-link">Article 11 (Incidents)</Link>.</>))}
        </Callout>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
