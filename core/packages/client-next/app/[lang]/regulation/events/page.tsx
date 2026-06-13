'use client';

// /regulation/events — Article 9 (Events).
// The definitive visual reference for every WCA event: the full event table
// grouped by family (each with its standard round format + ranking method),
// a from-scratch explainer of the round formats (Bo1/Bo2/Bo3 · Ao5 · Mo3) with
// a struck-through "which attempt counts" diagram, and the rules that shape a
// round — cutoffs (combined rounds), per-attempt + cumulative time limits, and
// how a field is reduced round to round. Shared shell + primitives do the chrome.

import { useTranslation } from 'react-i18next';
import { Trophy, ListChecks, Scissors, Timer, Hourglass, Users, Sigma, Crown } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import { EventIcon } from '@/components/EventIcon';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/9.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './events.css';

// ── How a round is ranked ────────────────────────────────────────────────
// 'best'    → Best of X: the single best attempt counts.
// 'average' → Average of 5: trim best+worst, mean of the middle 3.
// 'mean'    → Mean of 3: arithmetic mean of all 3 attempts.
// 'points'  → 3×3×3 Multi-Blind: solved minus unsolved (then time as tiebreak).
type Rank = 'best' | 'average' | 'mean' | 'points';

interface Evt {
  id: string;          // EventIcon id
  zh: string;
  en: string;
  format: string;      // shorthand printed in the table, e.g. "Ao5"
  formatZh: string;
  rank: Rank;
}

// 9b — full-round formats per event family. Source: WCA Regulations 9b1–9b6.
const STANDARD: Evt[] = [
  { id: '333',   zh: '三阶',     en: '3×3×3',     format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: '222',   zh: '二阶',     en: '2×2×2',     format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: '444',   zh: '四阶',     en: '4×4×4',     format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: '555',   zh: '五阶',     en: '5×5×5',     format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: 'clock', zh: '魔表',     en: 'Clock',     format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: 'minx',  zh: '五魔方',   en: 'Megaminx',  format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: 'pyram', zh: '金字塔',   en: 'Pyraminx',  format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: 'skewb', zh: '斜转',     en: 'Skewb',     format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: 'sq1',   zh: 'Square-1', en: 'Square-1',  format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
];

const BIG: Evt[] = [
  { id: '666', zh: '六阶', en: '6×6×6', format: 'Mo3', formatZh: '3 次取均值', rank: 'mean' },
  { id: '777', zh: '七阶', en: '7×7×7', format: 'Mo3', formatZh: '3 次取均值', rank: 'mean' },
];

const VARIANT: Evt[] = [
  { id: '333oh', zh: '三阶单手', en: '3×3×3 One-Handed', format: 'Ao5', formatZh: '5 次取平均', rank: 'average' },
  { id: '333fm', zh: '三阶最少步', en: '3×3×3 Fewest Moves', format: 'Mo3', formatZh: '3 次取均值', rank: 'mean' },
];

const BLIND: Evt[] = [
  { id: '333bf', zh: '三阶盲拧', en: '3×3×3 Blindfolded',  format: 'Bo3', formatZh: '3 次取最优', rank: 'best' },
  { id: '444bf', zh: '四阶盲拧', en: '4×4×4 Blindfolded',  format: 'Bo3', formatZh: '3 次取最优', rank: 'best' },
  { id: '555bf', zh: '五阶盲拧', en: '5×5×5 Blindfolded',  format: 'Bo3', formatZh: '3 次取最优', rank: 'best' },
  { id: '333mbf', zh: '三阶多盲', en: '3×3×3 Multi-Blind', format: 'Bo1', formatZh: '1 次定胜负', rank: 'points' },
];

// Total = 9 + 2 + 2 + 4 = 17 official WCA events.
const TOTAL = STANDARD.length + BIG.length + VARIANT.length + BLIND.length;

function rankLabel(t: ReturnType<typeof useT>, r: Rank): string {
  return r === 'best' ? t('取最优', 'by best', "取最優")
    : r === 'average' ? t('取平均', 'by average')
    : r === 'mean' ? t('取均值', 'by mean')
    : t('看完成数', 'by points', "看完成數");
}

function EventTable({ rows }: { rows: Evt[] }) {
  const t = useT();
  return (
    <div className="evt-table-wrap">
      <table className="reg-table evt-table">
        <thead>
          <tr>
            <th>{t('项目', 'Event', "項目")}</th>
            <th>{t('赛制', 'Format', "賽制")}</th>
            <th>{t('排名依据', 'Ranked', "排名依據")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>
                <span className="reg-evt">
                  <EventIcon event={e.id} />
                  {t(e.zh, e.en)}
                </span>
              </td>
              <td>
                <span className="reg-num">{e.format}</span>
                {t(e.formatZh, '') && <span className="reg-evt-text"> {t(e.formatZh, '')}</span>}
              </td>
              <td>
                <span className={`evt-rank evt-rank-${e.rank}`}>{rankLabel(t, e.rank)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A row of 5 attempt chips for the Ao5 diagram. `best`/`worst` index get struck.
function Ao5Strip() {
  const t = useT();
  // A real-looking set of 5 times (centiseconds shown as s.cc). idx 2 is best, idx 0 worst.
  const times = [
    { v: '9.41', state: 'worst' as const },
    { v: '7.86', state: 'keep' as const },
    { v: '6.92', state: 'best' as const },
    { v: '7.55', state: 'keep' as const },
    { v: '8.10', state: 'keep' as const },
  ];
  return (
    <div className="evt-strip">
      <div className="evt-strip-row">
        {times.map((a, i) => (
          <div key={i} className={`evt-chip evt-chip-${a.state}`}>
            <span className="evt-chip-n">{i + 1}</span>
            <span className="evt-chip-v">{a.v}</span>
            {a.state === 'best' && <span className="evt-chip-tag">{t('最优', 'best', "最優")}</span>}
            {a.state === 'worst' && <span className="evt-chip-tag">{t('最差', 'worst')}</span>}
          </div>
        ))}
      </div>
      <div className="evt-strip-calc">
        <span className="evt-strip-calc-label">{t('保留中间 3 把取平均', 'mean of the middle 3', "保留中間 3 把取平均")}</span>
        <span className="evt-strip-calc-eq">(7.86 + 7.55 + 8.10) / 3 = <strong className="reg-num">7.84</strong></span>
      </div>
    </div>
  );
}

export default function EventsChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="events">
      {/* ── 1. The full list of official events ─────────────────── */}
      <RegSection
        eyebrow={t('总共多少', `${TOTAL} in all`, "總共多少")}
        title={t('全部 WCA 项目', 'Every official WCA event', "全部 WCA 項目")}
        lede={t(
          'WCA 目前承认 17 个官方项目。每个项目都有一个标准赛制(一轮里你拧几把)和一个排名依据(用哪一把、还是几把的平均来给你排名)。按“魔方家族”分组看最清楚。',
          'The WCA currently recognizes 17 official events. Each has a standard round format (how many attempts you get in a round) and a ranking method (which attempt — or which average — decides your place). Grouping by puzzle family makes the pattern clear.', "WCA 目前承認 17 個官方項目。每個項目都有一個標準賽制(一輪裡你擰幾把)和一個排名依據(用哪一把、還是幾把的平均來給你排名)。按“魔方家族”分組看最清楚。"
        )}
      >
        <div className="evt-family">
          <h3 className="evt-family-title">
            <Trophy size={17} />
            {t('NxN 与其它常规项目 · 取 5 次平均', 'NxN and other standard events · Average of 5', "NxN 與其它常規項目 · 取 5 次平均")}
          </h3>
          <p className="evt-family-lede">
            {t(
              '速拧的“主力军”:拧 5 把,去掉最快和最慢,剩下 3 把取平均。这套规则把运气压到最低 —— 一把超神或一次失误都不会单独决定名次。',
              'The bulk of speedsolving: five attempts, drop the fastest and slowest, average the middle three. This squeezes out luck — neither one lightning solve nor one disaster alone decides your placement.', "速擰的“主力軍”:擰 5 把,去掉最快和最慢,剩下 3 把取平均。這套規則把運氣壓到最低 —— 一把超神或一次失誤都不會單獨決定名次。"
            )}
          </p>
          <EventTable rows={STANDARD} />
        </div>

        <div className="evt-family">
          <h3 className="evt-family-title">
            <Sigma size={17} />
            {t('大魔方 · 取 3 次均值', 'Big cubes · Mean of 3')}
          </h3>
          <p className="evt-family-lede">
            {t(
              '六阶、七阶单把就要几分钟,拧 5 把太耗时。改成只拧 3 把、全部计入取均值 —— 没有去掉最差这一说,稳定性更重要。',
              'A single 6×6×6 or 7×7×7 solve already runs minutes long, so five attempts would take too long. Instead you get three attempts and all of them count toward the mean — nothing is dropped, so consistency matters more.', "六階、七階單把就要幾分鐘,擰 5 把太耗時。改成只擰 3 把、全部計入取均值 —— 沒有去掉最差這一說,穩定性更重要。"
            )}
          </p>
          <EventTable rows={BIG} />
        </div>

        <div className="evt-family">
          <h3 className="evt-family-title">
            <ListChecks size={17} />
            {t('三阶变体 · 单手与最少步', '3×3×3 variants · One-Handed & Fewest Moves', "三階變體 · 單手與最少步")}
          </h3>
          <p className="evt-family-lede">
            {t(
              '同样是三阶,但玩法不同:单手沿用取 5 次平均;最少步是用纸笔写解法、比谁步数少,拧 3 次取均值(步数也能算平均)。',
              'Still the 3×3×3, but solved differently: One-Handed keeps Average of 5, while Fewest Moves is a pen-and-paper event scored on move count over three attempts, with the move counts themselves averaged into a mean.', "同樣是三階,但玩法不同:單手沿用取 5 次平均;最少步是用紙筆寫解法、比誰步數少,擰 3 次取均值(步數也能算平均)。"
            )}
          </p>
          <EventTable rows={VARIANT} />
        </div>

        <div className="evt-family">
          <h3 className="evt-family-title">
            <EventIcon event="333bf" className="evt-family-evticon" />
            {t('盲拧家族 · 取最优', 'Blindfolded family · Best of X', "盲擰家族 · 取最優")}
          </h3>
          <p className="evt-family-lede">
            {t(
              '盲拧太难,平均没意义 —— 一把 DNF 就会拖垮整组。所以盲拧只看你最好的那一把。多盲更特别:它比“净还原数”,即还原成功的魔方数减去失败的,差值越大越靠前。',
              'Blindfolded solving is so error-prone that an average is meaningless — a single DNF would wreck a whole set. So these events rank you on your single best attempt. Multi-Blind is special again: it ranks on net puzzles — cubes solved minus cubes missed — with a bigger difference ranking higher.', "盲擰太難,平均沒意義 —— 一把 DNF 就會拖垮整組。所以盲擰只看你最好的那一把。多盲更特別:它比“淨還原數”,即還原成功的魔方數減去失敗的,差值越大越靠前。"
            )}
          </p>
          <EventTable rows={BLIND} />
        </div>

        <Callout tone="info" label={t('想看每个项目的世界纪录与现场成绩', 'See world records and live results per event', "想看每個項目的世界紀錄與現場成績")}>
          {t('打开', 'Head to ', "開啟")}
          <Link href="/wca">{t('WCA 数据中心', 'the WCA data hub', "WCA 資料中心")}</Link>
          {t(
            ',可以按项目查纪录、排行和历史;每个项目真实打乱的步数分布在',
            ' to browse records, rankings and history by event; the real scramble-length distribution for each event lives at ', ",可以按項目查紀錄、排行和歷史;每個項目真實打亂的步數分佈在"
          )}
          <Link href="/scramble/stats">{t('打乱难度统计', 'the scramble stats', "打亂難度統計")}</Link>
          {t('。', '.')}
        </Callout>
      </RegSection>

      {/* ── 2. Round formats: which attempt counts ──────────────── */}
      <RegSection
        eyebrow={t('算哪一把', 'Which attempt counts')}
        title={t('赛制:Bo · Ao · Mo 到底怎么算', 'Formats: how Bo, Ao and Mo work', "賽制:Bo · Ao · Mo 到底怎麼算")}
        lede={t(
          '一轮里你拧固定次数(称作一次“尝试”),结果按下面三种方式之一汇总。看懂这三个缩写,成绩单就全看明白了。',
          'In a round you make a fixed number of attempts (a “solve”), and the results are combined in one of three ways. Learn these three abbreviations and any scorecard becomes readable.', "一輪裡你擰固定次數(稱作一次“嘗試”),結果按下面三種方式之一彙總。看懂這三個縮寫,成績單就全看明白了。"
        )}
      >
        <div className="evt-fmt-cards">
          <div className="evt-fmt-card">
            <div className="evt-fmt-head">
              <span className="evt-fmt-abbr">Bo1 / Bo2 / Bo3</span>
              <span className="evt-fmt-name">{t('取最优 · Best of X', 'Best of X', "取最優 · Best of X")}</span>
            </div>
            <p className="evt-fmt-text">
              {t(
                '拧 X 把(X = 1、2 或 3),只看其中最好的一把,其余忽略。盲拧、多盲都用这套:一把 DNF 不会拉低你的成绩,因为只取最优。',
                'You make X attempts (X = 1, 2 or 3); only your best one counts and the rest are ignored. Blindfolded and Multi-Blind use this — a DNF can’t drag you down, because only the best is taken.', "擰 X 把(X = 1、2 或 3),只看其中最好的一把,其餘忽略。盲擰、多盲都用這套:一把 DNF 不會拉低你的成績,因為只取最優。"
              )}
            </p>
            <p className="evt-fmt-rank">{t('排名 = 最好的一把', 'Ranking = your single best attempt')}</p>
          </div>

          <div className="evt-fmt-card">
            <div className="evt-fmt-head">
              <span className="evt-fmt-abbr">Mo3</span>
              <span className="evt-fmt-name">{t('取均值 · Mean of 3', 'Mean of 3')}</span>
            </div>
            <p className="evt-fmt-text">
              {t(
                '拧 3 把,三把全部计入,取算术平均。一把都不能去 —— 所以只要有一把 DNF/DNS,整个均值就记作 DNF。六阶、七阶、最少步用它。',
                'Three attempts, all three counted, arithmetic mean. Nothing is dropped — so a single DNF or DNS makes the whole mean a DNF. Used by 6×6×6, 7×7×7 and Fewest Moves.', "擰 3 把,三把全部計入,取算術平均。一把都不能去 —— 所以只要有一把 DNF/DNS,整個均值就記作 DNF。六階、七階、最少步用它。"
              )}
            </p>
            <p className="evt-fmt-rank">{t('排名 = 3 把的平均', 'Ranking = mean of all 3 attempts')}</p>
          </div>

          <div className="evt-fmt-card evt-fmt-card-wide">
            <div className="evt-fmt-head">
              <span className="evt-fmt-abbr">Ao5</span>
              <span className="evt-fmt-name">{t('取平均 · Average of 5', 'Average of 5')}</span>
            </div>
            <p className="evt-fmt-text">
              {t(
                '拧 5 把,去掉最快和最慢各一把,剩下中间 3 把取平均。绝大多数速拧项目都用它。',
                'Five attempts; drop the single fastest and the single slowest, then average the middle three. Almost every speed event uses it.', "擰 5 把,去掉最快和最慢各一把,剩下中間 3 把取平均。絕大多數速擰項目都用它。"
              )}
            </p>
            <Ao5Strip />
          </div>
        </div>

        <Callout tone="warn" label={t('Ao5 里能容忍一把 DNF', 'One DNF is tolerated in an Ao5', "Ao5 裡能容忍一把 DNF")}>
          {t(
            '取平均时,一把 DNF/DNS 会被当成“最差”那一把去掉,剩下 3 把照样算平均 —— 所以滑了一把还能拿到有效平均。但只要有第二把 DNF/DNS,被去掉的就只有一把,另一把留在中间 3 把里,平均直接记作 DNF。',
            'In an average, a single DNF or DNS becomes the “worst” attempt and is the one dropped, so the other three still produce a valid mean — you can blow one solve and still post an average. But a second DNF or DNS can only have one of them removed; the other stays among the counted three, and the whole average becomes a DNF.', "取平均時,一把 DNF/DNS 會被當成“最差”那一把去掉,剩下 3 把照樣算平均 —— 所以滑了一把還能拿到有效平均。但只要有第二把 DNF/DNS,被去掉的就只有一把,另一把留在中間 3 把裡,平均直接記作 DNF。"
          )}
        </Callout>

        <RegQuote num="9f8 · 9f10">
          {t(
            '取 5 次平均:拧 5 把,去掉最优与最差,以其余 3 把的算术平均决定排名。取 3 次均值:拧 3 把,以三把的算术平均决定排名。',
            'Average of 5: of five attempts the best and worst are removed, and the arithmetic mean of the remaining three determines ranking. Mean of 3: the arithmetic mean of the three attempts determines ranking.', "取 5 次平均:擰 5 把,去掉最優與最差,以其餘 3 把的算術平均決定排名。取 3 次均值:擰 3 把,以三把的算術平均決定排名。"
          )}
        </RegQuote>

        <h3 className="reg-sub-title">{t('成绩怎么记:精度与 DNF/DNS', 'How a result is recorded: precision and DNF/DNS', "成績怎麼記:精度與 DNF/DNS")}</h3>
        <RegList
          items={[
            <span key="prec">
              <strong>{t('计时精度:单次截断,平均四舍五入。', 'Precision: singles truncate, averages round.', "計時精度:單次截斷,平均四捨五入。")}</strong>{' '}
              {t(
                '单次成绩向下截断(不四舍五入):10 分钟以内截到百分之一秒,10 分钟及以上、以及全部多盲成绩截到整秒。而平均、去尾平均(Mo3 / Ao5)则是四舍五入:10 分钟以内取到百分之一秒,超过 10 分钟取到整秒。',
                'A single result is truncated (rounded down), not rounded: under 10 minutes to the hundredth of a second, and at 10 minutes or more — plus all Multi-Blind results — to whole seconds. Averages and means (Mo3 / Ao5), by contrast, are rounded to the nearest unit: to the hundredth under 10 minutes, and to the whole second above 10 minutes.', "單次成績向下截斷(不四捨五入):10 分鐘以內截到百分之一秒,10 分鐘及以上、以及全部多盲成績截到整秒。而平均、去尾平均(Mo3 / Ao5)則是四捨五入:10 分鐘以內取到百分之一秒,超過 10 分鐘取到整秒。"
              )}{' '}
              <span className="evt-tag">9f1 · 9f2</span>
            </span>,
            <span key="dnf">
              <strong>DNF（{t('未完成', 'Did Not Finish')}）。</strong>{' '}
              {t(
                '尝试被取消、超时被叫停、或没在限定内还原 —— 都记 DNF。在取最优里 DNF 是“最差”的结果。',
                'An attempt that is disqualified, stopped at the time limit, or left unsolved is a DNF. Under Best of X a DNF is the worst possible result.', "嘗試被取消、超時被叫停、或沒在限定內還原 —— 都記 DNF。在取最優裡 DNF 是“最差”的結果。"
              )}{' '}
              <span className="evt-tag">9f4 · 9f7</span>
            </span>,
            <span key="dns">
              <strong>DNS（{t('未开始', 'Did Not Start', "未開始")}）。</strong>{' '}
              {t(
                '你有资格拧这把、却没有开始(比如已退赛、或前面已无法晋级而放弃),记 DNS。和 DNF 一样视为最差结果。',
                'You were eligible for the attempt but never started it (you withdrew, or there was nothing left to play for) — recorded as DNS, treated like a DNF as the worst result.', "你有資格擰這把、卻沒有開始(比如已退賽、或前面已無法晉級而放棄),記 DNS。和 DNF 一樣視為最差結果。"
              )}{' '}
              <span className="evt-tag">9f5</span>
            </span>,
            <span key="mbf">
              <strong>{t('多盲怎么排。', 'How Multi-Blind ranks.', "多盲怎麼排。")}</strong>{' '}
              {t(
                '一把里你同时记忆并蒙眼还原多个三阶。排名看“净得分”=还原成功数 − 未还原数;净得分相同时,用时少者靠前。净得分小于 0、或只成功还原了 1 个魔方,都记 DNF。',
                'In one attempt you memorize and blind-solve several 3×3×3 cubes at once. You rank on net score = cubes solved minus cubes not solved; ties break on time. The attempt is a DNF if the net score is less than 0, or if only 1 cube is solved.', "一把裡你同時記憶並矇眼還原多個三階。排名看“淨得分”=還原成功數 − 未還原數;淨得分相同時,用時少者靠前。淨得分小於 0、或只成功還原了 1 個魔方,都記 DNF。"
              )}{' '}
              <span className="evt-tag">9f12c</span>
            </span>,
          ]}
        />
      </RegSection>

      {/* ── 3. Cutoffs and time limits ──────────────────────────── */}
      <RegSection
        eyebrow={t('一轮的边界', 'The edges of a round', "一輪的邊界")}
        title={t('晋级线与时间上限', 'Cutoffs and time limits', "晉級線與時間上限")}
        lede={t(
          '两条规则决定一轮怎么收口:晋级线(cutoff)决定你能不能拧完全部把数,时间上限决定单把(或累计)能拧多久。它们常常被写在成绩单顶部。',
          'Two rules shape how a round plays out: the cutoff decides whether you get all your attempts, and the time limit decides how long each solve (or all of them together) may run. Both are printed at the top of the scorecard.', "兩條規則決定一輪怎麼收口:晉級線(cutoff)決定你能不能擰完全部把數,時間上限決定單把(或累計)能擰多久。它們常常被寫在成績單頂部。"
        )}
      >
        <h3 className="evt-block-title">
          <Scissors size={18} />
          {t('晋级线 / 合并轮', 'The cutoff / combined round', "晉級線 / 合併輪")}
        </h3>
        <p className="evt-block-lede">
          {t(
            '为了让一轮跑得快,组委会可以给一轮加一个“前段”:先拧若干把(取最优作前段),只有在前段里至少有一把达到“晋级线”的人,才能继续拧完剩下的把数。',
            'To keep a round moving, the organizers can give it a cutoff phase: you first make a few attempts (a Best of X), and only if at least one of them beats the cutoff do you continue to the remaining attempts.', "為了讓一輪跑得快,組委會可以給一輪加一個“前段”:先擰若干把(取最優作前段),只有在前段裡至少有一把達到“晉級線”的人,才能繼續擰完剩下的把數。"
          )}
        </p>
        <div className="evt-cutoff">
          <div className="evt-cutoff-head">
            <span className="evt-cutoff-fmt">Bo2 / Ao5</span>
            <span className="evt-cutoff-cap">
              {t('前段取 2 次最优,达标后补满 5 把走平均', 'A Best-of-2 phase, then fill out 5 attempts for the average', "前段取 2 次最優,達標後補滿 5 把走平均")}
            </span>
          </div>
          <div className="evt-cutoff-flow">
            <div className="evt-cutoff-stage">
              <div className="evt-cutoff-stage-n">{t('前段', 'Cutoff phase')}</div>
              <div className="evt-cutoff-attempts">
                <span className="evt-att">1</span>
                <span className="evt-att">2</span>
              </div>
              <p className="evt-cutoff-stage-text">
                {t('先拧 2 把。任意一把好于晋级线即“达标”。', 'Make 2 attempts. Beat the cutoff on either one to qualify.', "先擰 2 把。任意一把好於晉級線即“達標”。")}
              </p>
            </div>
            <div className="evt-cutoff-gate" aria-hidden>→</div>
            <div className="evt-cutoff-branch">
              <div className="evt-cutoff-pass">
                <strong>{t('达标', 'Met cutoff', "達標")}</strong>{' '}
                {t('→ 补拧第 3、4、5 把,五把走完整的取平均。', '→ make attempts 3, 4 and 5; the full Average of 5 stands.', "→ 補擰第 3、4、5 把,五把走完整的取平均。")}
                <div className="evt-cutoff-attempts">
                  <span className="evt-att evt-att-done">1</span>
                  <span className="evt-att evt-att-done">2</span>
                  <span className="evt-att evt-att-add">3</span>
                  <span className="evt-att evt-att-add">4</span>
                  <span className="evt-att evt-att-add">5</span>
                </div>
              </div>
              <div className="evt-cutoff-fail">
                <strong>{t('未达标', 'Missed cutoff', "未達標")}</strong>{' '}
                {t('→ 到此为止,本轮成绩就是前 2 把的最优。', '→ you stop; your result for the round is the best of those 2 attempts.', "→ 到此為止,本輪成績就是前 2 把的最優。")}
              </div>
            </div>
          </div>
        </div>
        <RegQuote num="9g">
          {t(
            '合并轮带有一个“取 X 次最优”的前段与一条晋级线;只要选手在前段任意一把里达到晋级线,就有资格继续完成剩余把数。',
            'A combined round has a Best-of-X cutoff phase and a cutoff requirement; if a competitor meets the requirement on at least one cutoff-phase attempt, they are eligible for the remaining attempts.', "合併輪帶有一個“取 X 次最優”的前段與一條晉級線;只要選手在前段任意一把裡達到晉級線,就有資格繼續完成剩餘把數。"
          )}
        </RegQuote>

        <h3 className="evt-block-title">
          <Timer size={18} />
          {t('时间上限:单把与累计', 'Time limits: per-attempt and cumulative', "時間上限:單把與累計")}
        </h3>
        <p className="evt-block-lede">
          {t(
            '每一轮都必须有至少一种时间上限。最常见的是“单把上限”:这一把拧到上限还没还原,裁判立刻叫停并记 DNF。默认上限是 10 分钟。',
            'Every round must carry at least one kind of time limit. The usual one is a per-attempt limit: if a solve reaches it unsolved, the judge stops it at once and records a DNF. The default is 10 minutes.', "每一輪都必須有至少一種時間上限。最常見的是“單把上限”:這一把擰到上限還沒還原,裁判立刻叫停並記 DNF。預設上限是 10 分鐘。"
          )}
        </p>
        <div className="evt-limit-grid">
          <div className="evt-limit-card">
            <div className="evt-limit-head">
              <Hourglass size={16} />
              {t('单把上限', 'Per-attempt limit', "單把上限")}
            </div>
            <p>
              {t(
                '写成一个时间,例如 10:00。每一把都独立计时;到点未还原 = 这把 DNF。',
                'Written as a single time, e.g. 10:00. Each attempt is timed on its own; reaching it unsolved means a DNF for that attempt.', "寫成一個時間,例如 10:00。每一把都獨立計時;到點未還原 = 這把 DNF。"
              )}
            </p>
          </div>
          <div className="evt-limit-card">
            <div className="evt-limit-head">
              <Hourglass size={16} />
              {t('累计上限', 'Cumulative limit', "累計上限")}
            </div>
            <p>
              {t(
                '一个时间值管住一轮里若干把的总和,例如 “20:00 累计 / 4 把”。某一把可用的时间 = 累计上限 − 已用掉的时间;总时间用尽后,余下没拧完的把记 DNF。',
                'One value caps the sum across several attempts, e.g. “20:00 cumulative for 4 attempts”. The time available for any one attempt is the cumulative limit minus the time already spent; once the budget runs out, the unfinished attempts are DNFs.', "一個時間值管住一輪裡若干把的總和,例如 “20:00 累計 / 4 把”。某一把可用的時間 = 累計上限 − 已用掉的時間;總時間用盡後,餘下沒擰完的把記 DNF。"
              )}
            </p>
          </div>
        </div>
        <Callout tone="danger" label={t('到点 = DNF', 'Hit the limit = DNF', "到點 = DNF")}>
          {t(
            '时间上限不是“扣 2 秒”那种罚时,而是硬线 —— 一旦达到,裁判当场停表,这把直接记 DNF,没有补救。上限会在赛前公布,且一轮开始后通常不再改动。',
            'A time limit is not a +2-style penalty — it is a hard line. The moment it is reached the judge stops the solve and the attempt is a flat DNF, with no recovery. Limits are announced before the competition and normally are not changed once an affected round has begun.', "時間上限不是“扣 2 秒”那種罰時,而是硬線 —— 一旦達到,裁判當場停表,這把直接記 DNF,沒有補救。上限會在賽前公佈,且一輪開始後通常不再改動。"
          )}
        </Callout>
      </RegSection>

      {/* ── 4. Proceeding to the next round ─────────────────────── */}
      <RegSection
        eyebrow={t('谁能继续', 'Who moves on', "誰能繼續")}
        title={t('一轮淘汰一批:晋级与轮次上限', 'Each round cuts the field: advancing and round caps', "一輪淘汰一批:晉級與輪次上限")}
        lede={t(
          '热门项目会分多轮,每轮砍掉一批人,把最强的选手送进决赛。能开几轮、每轮留多少人,都有硬性规定。',
          'Popular events run several rounds, each trimming the field and funnelling the strongest into the final. How many rounds you may hold, and how many advance, are both fixed by rule.', "熱門項目會分多輪,每輪砍掉一批人,把最強的選手送進決賽。能開幾輪、每輪留多少人,都有硬性規定。"
        )}
      >
        <h3 className="evt-block-title">
          <Users size={18} />
          {t('每轮至少淘汰 25%', 'At least 25% are eliminated each round', "每輪至少淘汰 25%")}
        </h3>
        <RegList
          items={[
            <span key="how">
              <strong>{t('两种晋级方式。', 'Two ways to set who advances.', "兩種晉級方式。")}</strong>{' '}
              {t(
                '按名次取(本轮前 X 名晋级),或按成绩取(凡是好于某个阈值 X 的都晋级)。组委会赛前二选一并公布。',
                'By ranking (the best X competitors advance) or by result (everyone with a result better than a threshold X advances). Organizers pick one in advance and announce it.', "按名次取(本輪前 X 名晉級),或按成績取(凡是好於某個閾值 X 的都晉級)。組委會賽前二選一併公佈。"
              )}{' '}
              <span className="evt-tag">9p2</span>
            </span>,
            <span key="cut">
              <strong>{t('至少砍 1/4。', 'A quarter must go.')}</strong>{' '}
              {t(
                '相邻两轮之间,至少要淘汰 25% 的选手 —— 下一轮不能几乎原班人马,必须真正缩小赛场。',
                'Between consecutive rounds at least 25% of competitors must be eliminated — the next round cannot be nearly the same field; it must genuinely shrink.', "相鄰兩輪之間,至少要淘汰 25% 的選手 —— 下一輪不能幾乎原班人馬,必須真正縮小賽場。"
              )}{' '}
              <span className="evt-tag">9p1</span>
            </span>,
            <span key="dnf">
              <strong>{t('全 DNF/DNS 不能晋级。', 'All-DNF/DNS cannot advance.', "全 DNF/DNS 不能晉級。")}</strong>{' '}
              {t(
                '本轮一把有效成绩都没有(只有 DNF 和/或 DNS)的选手,不得进入下一轮。',
                'A competitor with no successful result in the round (only DNFs and/or DNSs) may not proceed to the next round.', "本輪一把有效成績都沒有(只有 DNF 和/或 DNS)的選手,不得進入下一輪。"
              )}{' '}
              <span className="evt-tag">9p4</span>
            </span>,
          ]}
        />

        <h3 className="evt-block-title">
          <Crown size={18} />
          {t('能开几轮,看人数', 'How many rounds the field allows', "能開幾輪,看人數")}
        </h3>
        <p className="evt-block-lede">
          {t(
            '一个项目最多 4 轮。能再加几轮取决于这一轮的参赛人数 —— 人越少,后续轮次越少,避免“人比奖牌还少”还硬分轮。',
            'An event may have at most four rounds. How many more you can add depends on the number of competitors in a round — the fewer the entrants, the fewer the subsequent rounds, so you don’t split a tiny field into needless rounds.', "一個項目最多 4 輪。能再加幾輪取決於這一輪的參賽人數 —— 人越少,後續輪次越少,避免“人比獎牌還少”還硬分輪。"
          )}
        </p>
        <div className="evt-table-wrap">
          <table className="reg-table evt-rounds-table">
            <thead>
              <tr>
                <th>{t('本轮人数', 'Competitors in the round', "本輪人數")}</th>
                <th>{t('之后最多还能开', 'At most this many more rounds', "之後最多還能開")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="reg-num">≤ 7</span></td>
                <td>{t('不得再开后续轮次', 'No subsequent rounds', "不得再開後續輪次")} <span className="evt-tag">9m3</span></td>
              </tr>
              <tr>
                <td><span className="reg-num">≤ 15</span></td>
                <td>{t('最多再开 1 轮', 'At most 1 more round', "最多再開 1 輪")} <span className="evt-tag">9m2</span></td>
              </tr>
              <tr>
                <td><span className="reg-num">≤ 99</span></td>
                <td>{t('最多再开 2 轮', 'At most 2 more rounds', "最多再開 2 輪")} <span className="evt-tag">9m1</span></td>
              </tr>
              <tr>
                <td><span className="reg-num">≥ 100</span></td>
                <td>{t('合计最多 4 轮(决赛在内)', 'Up to 4 rounds total (including the final)', "合計最多 4 輪(決賽在內)")} <span className="evt-tag">9m</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="reg-foot-note">
          {t(
            '每个项目的最后一轮(以及三阶最少步)全场只有一组,所有人用完全相同的打乱 —— 这就是“决赛”。配套的打乱与公平规则见',
            'The final round of every event (and all of Fewest Moves) is a single group where everyone solves the exact same scramble — that is the “final”. The matching scramble and fairness rules are in ', "每個項目的最後一輪(以及三階最少步)全場只有一組,所有人用完全相同的打亂 —— 這就是“決賽”。配套的打亂與公平規則見"
          )}
          <Link href="/regulation/scrambling">{t('打乱一章', 'the Scrambling chapter', "打亂一章")}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
