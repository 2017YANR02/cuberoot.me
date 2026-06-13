'use client';

// /regulation/environment — Article 7 (Environment).
// Illustrated guide to the competition environment: the layout of a solving
// station (timer + mat + surface, with the timer on the competitor's side), the
// separation of the scrambling area from competitors, lighting, the spectator
// distance, and competitor waiting areas. Shared shell + primitives do the
// chrome.

import { useTranslation } from 'react-i18next';
import { Timer, Sun, Ruler, EyeOff, Armchair, Wrench } from 'lucide-react';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/7.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './environment.css';

export default function EnvironmentChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="environment">
      {/* ── 1. The solving station ──────────────────────────────── */}
      <RegSection
        eyebrow={t('一个比赛位', 'A single solving station', "一個比賽位")}
        title={t('计时器、计时垫、桌面', 'Timer, mat, and surface', "計時器、計時墊、桌面")}
        lede={t(
          '每个选手在一个“比赛位”上还原。规则把它拆成几个部件:速拧计时器、它所固定的计时垫,以及放魔方的桌面 —— 并规定它们怎么摆。',
          'Each competitor solves at a single station. The Regulations break it into parts — the speedsolving timer, the mat it is attached to, and the surface the puzzle sits on — and say how they are arranged.', "每個選手在一個“比賽位”上還原。規則把它拆成幾個部件:速擰計時器、它所固定的計時墊,以及放魔方的桌面 —— 並規定它們怎麼擺。"
        )}
      >
        <figure className="env-station">
          <svg viewBox="0 0 320 200" className="env-station-svg" role="img"
            aria-label={t('比赛位示意图', 'Diagram of a solving station', "比賽位示意圖")}>
            {/* surface (table) */}
            <rect x="10" y="40" width="300" height="120" rx="10"
              className="env-surface" />
            {/* mat */}
            <rect x="92" y="70" width="136" height="78" rx="8" className="env-mat" />
            {/* stackmat timer body */}
            <rect x="118" y="118" width="84" height="22" rx="5" className="env-timer" />
            {/* timer pads */}
            <rect x="124" y="123" width="22" height="12" rx="3" className="env-pad" />
            <rect x="174" y="123" width="22" height="12" rx="3" className="env-pad" />
            {/* puzzle under cover (rounded square on the mat) */}
            <rect x="142" y="80" width="36" height="30" rx="6" className="env-puzzle" />
            <path d="M138 80 q22 -16 44 0" className="env-cover" />
            {/* labels */}
            <g className="env-lbl">
              <text x="160" y="32" textAnchor="middle">{t('桌面 7f1d', 'Surface · 7f1d')}</text>
              <text x="160" y="64" textAnchor="middle">{t('计时垫 7f1b', 'Mat · 7f1b', "計時墊 7f1b")}</text>
              <text x="160" y="156" textAnchor="middle">{t('计时器靠近选手一侧 7f2', 'Timer nearest the competitor · 7f2', "計時器靠近選手一側 7f2")}</text>
            </g>
            {/* competitor side marker */}
            <text x="160" y="190" textAnchor="middle" className="env-side">
              {t('↑ 选手坐这一侧', '↑ Competitor sits on this side', "↑ 選手坐這一側")}
            </text>
          </svg>
          <figcaption className="env-station-cap">
            {t(
              '计时器固定在计时垫上、放在桌面上,且位于计时垫靠近选手的一端。全尺寸计时垫至少 30 厘米 × 25 厘米。',
              'The timer is attached to the mat and placed on the surface, on the edge of the mat nearest the competitor. A full-size mat is at least 30 cm × 25 cm.', "計時器固定在計時墊上、放在桌面上,且位於計時墊靠近選手的一端。全尺寸計時墊至少 30 釐米 × 25 釐米。"
            )}
          </figcaption>
        </figure>

        <RegQuote num="7f2">
          {t(
            '速拧计时器必须固定在计时垫上并放置在桌面上,且计时器位于计时垫靠近选手的一端。',
            'The speedsolving timer must be attached to the mat and placed on the surface, with the timer on the side of the mat nearest to the competitor.', "速擰計時器必須固定在計時墊上並放置在桌面上,且計時器位於計時墊靠近選手的一端。"
          )}
        </RegQuote>

        <Callout tone="info" label={t('用什么计时', 'What does the timing', "用什麼計時")} icon={<Timer size={17} />}>
          {t(
            '大多数项目用一台“速拧计时器”—— 必须是 WCA 已批准列表里的型号(Speed Stacks 式 Stackmat 计时器)。最少步(纸笔记录)和多盲这类项目则用秒表计时;单次盲拧仍用计时器,只有成绩超过 10 分钟时才改用秒表兜底。主办团队应当对计时器做加固改造,比如在按键周围加 O 形环以防误触、把电池固定牢。',
            'Most events use a speedsolving timer — it must be a model from the WCA’s approved list (a Speed Stacks-style Stackmat timer). Fewest Moves (recorded on paper) and Multi-Blind are timed with a stopwatch; a single Blindfolded attempt still uses the timer, falling back to a stopwatch only if it runs past 10 minutes. Organizers should reinforce the timers — e.g. O-rings around the buttons to prevent accidental presses, and securing the battery.', "大多數項目用一臺“速擰計時器”—— 必須是 WCA 已批准列表裡的型號(Speed Stacks 式 Stackmat 計時器)。最少步(紙筆記錄)和多盲這類項目則用秒錶計時;單次盲擰仍用計時器,只有成績超過 10 分鐘時才改用秒錶兜底。主辦團隊應當對計時器做加固改造,比如在按鍵周圍加 O 形環以防誤觸、把電池固定牢。"
          )}
        </Callout>
      </RegSection>

      {/* ── 2. Venue zones: competitor vs scrambling area ───────── */}
      <RegSection
        eyebrow={t('场地布局', 'How the venue is laid out', "場地佈局")}
        title={t('打乱区与选手隔开', 'The scrambling area, kept apart', "打亂區與選手隔開")}
        lede={t(
          '打乱必须保密。场地要把打乱区与选手在视觉上隔开 —— 选手看不到打乱员手里的魔方,也看不到正在比赛位上还原的人(从等候区看)。',
          'Scrambling must stay secret. The venue keeps the scrambling area visually isolated from competitors — they should not be able to see a puzzle in a scrambler’s hands, nor (from the waiting area) the puzzles of those currently on stage.', "打亂必須保密。場地要把打亂區與選手在視覺上隔開 —— 選手看不到打亂員手裡的魔方,也看不到正在比賽位上還原的人(從等候區看)。"
        )}
      >
        <figure className="env-zones">
          <svg viewBox="0 0 320 170" className="env-zones-svg" role="img"
            aria-label={t('场地布局示意图', 'Diagram of venue zones', "場地佈局示意圖")}>
            {/* competitor / stage zone */}
            <rect x="8" y="14" width="180" height="142" rx="12" className="env-zone env-zone-stage" />
            {/* scrambling zone */}
            <rect x="206" y="14" width="106" height="142" rx="12" className="env-zone env-zone-scr" />
            {/* divider wall */}
            <rect x="194" y="10" width="6" height="150" rx="3" className="env-wall" />
            {/* stations on stage */}
            <rect x="28" y="58" width="44" height="26" rx="5" className="env-mini-station" />
            <rect x="92" y="58" width="44" height="26" rx="5" className="env-mini-station" />
            <rect x="60" y="104" width="44" height="26" rx="5" className="env-mini-station" />
            {/* scrambler table */}
            <rect x="228" y="64" width="62" height="34" rx="6" className="env-scr-table" />
            {/* labels */}
            <text x="98" y="36" textAnchor="middle" className="env-zone-lbl">{t('选手 / 比赛区', 'Competitor area', "選手 / 比賽區")}</text>
            <text x="259" y="36" textAnchor="middle" className="env-zone-lbl">{t('打乱区', 'Scramble area', "打亂區")}</text>
            <text x="197" y="168" textAnchor="middle" className="env-wall-lbl">{t('视线隔断', 'Visual divider', "視線隔斷")}</text>
          </svg>
          <figcaption className="env-zones-cap">
            {t(
              '打乱员可以待在墙后,或用足够高的隔板(例如桌侧的纸板挡板)围起来,让选手看不到打乱过程(规则 4b2++)。',
              'Scramblers may sit behind a wall, or a sufficiently high divider (such as a cardboard barrier around the table) can be used, so competitors cannot watch the scramble being applied (Regulation 4b2++).', "打亂員可以待在牆後,或用足夠高的隔板(例如桌側的紙板擋板)圍起來,讓選手看不到打亂過程(規則 4b2++)。"
            )}
          </figcaption>
        </figure>

        <Callout tone="warn" label={t('选手等候区', 'Competitor waiting area', "選手等候區")} icon={<EyeOff size={17} />}>
          {t(
            '如果选手不会整轮都待在同一个比赛位,场地就要设一个或多个等候区。在等候区等待的选手不应该能看到台上正在还原的魔方 —— 否则就能提前研究本组的打乱。',
            'If competitors do not stay at the same station for the whole round, the venue must provide one or more waiting areas. Competitors waiting there should not be able to see the puzzles of those on stage — otherwise they could study their group’s scramble in advance.', "如果選手不會整輪都待在同一個比賽位,場地就要設一個或多個等候區。在等候區等待的選手不應該能看到臺上正在還原的魔方 —— 否則就能提前研究本組的打亂。"
          )}
        </Callout>
      </RegSection>

      {/* ── 3. Conditions: light, space, no smoke ───────────────── */}
      <RegSection
        eyebrow={t('环境条件', 'The surrounding conditions', "環境條件")}
        title={t('灯光、距离与场地纪律', 'Lighting, distance, and venue rules', "燈光、距離與場地紀律")}
        lede={t(
          '光线和周围环境必须稳定,让选手能看清颜色、不受干扰地还原。规则对此有几条硬性要求。',
          'Lighting and the surroundings must be steady, so a competitor can read the colours and solve without disruption. A few requirements are spelled out.', "光線和周圍環境必須穩定,讓選手能看清顏色、不受干擾地還原。規則對此有幾條硬性要求。"
        )}
      >
        <RegList
          items={[
            <span key="light">
              <Sun size={16} className="env-li-icon" />
              <strong>{t('灯光要中性、充足。', 'Neutral, adequate lighting.', "燈光要中性、充足。")}</strong>{' '}
              {t(
                '比赛区光照应使用白光,让选手能轻松分辨魔方上的不同颜色(规则 7c)。',
                'The competition area should use white light so competitors can easily tell the puzzle’s colours apart (Regulation 7c).', "比賽區光照應使用白光,讓選手能輕鬆分辨魔方上的不同顏色(規則 7c)。"
              )}{' '}
              <span className="env-tag">7c</span>
            </span>,
            <span key="dist">
              <Ruler size={16} className="env-li-icon" />
              <strong>{t('观众保持 1.5 米。', 'Spectators stay 1.5 m back.', "觀眾保持 1.5 米。")}</strong>{' '}
              {t(
                '观众与正在使用的比赛位之间必须保持 1.5 米以上的距离(规则 7b)。',
                'Spectators must keep at least 1.5 metres from a station in use (Regulation 7b).', "觀眾與正在使用的比賽位之間必須保持 1.5 米以上的距離(規則 7b)。"
              )}{' '}
              <span className="env-tag">7b</span>
            </span>,
            <span key="smoke">
              <Wrench size={16} className="env-li-icon" />
              <strong>{t('器材加固、场地禁烟。', 'Reinforced gear, smoke-free venue.', "器材加固、場地禁菸。")}</strong>{' '}
              {t(
                '计时器应加固以耐用(规则 7f3);比赛区严禁吸烟(规则 7e)。',
                'Timers should be reinforced for robustness (Regulation 7f3); the competition area must be smoke-free (Regulation 7e).', "計時器應加固以耐用(規則 7f3);比賽區嚴禁吸菸(規則 7e)。"
              )}{' '}
              <span className="env-tag">7e · 7f3</span>
            </span>,
            <span key="seat">
              <Armchair size={16} className="env-li-icon" />
              <strong>{t('稳定一致的比赛位。', 'A stable, consistent station.', "穩定一致的比賽位。")}</strong>{' '}
              {t(
                '每个比赛位都有平整桌面和固定好的计时垫与计时器,让每个人在相同条件下还原。',
                'Every station has a flat surface with the mat and timer secured, so everyone solves under the same conditions.', "每個比賽位都有平整桌面和固定好的計時墊與計時器,讓每個人在相同條件下還原。"
              )}{' '}
              <span className="env-tag">7f</span>
            </span>,
          ]}
        />

        <Callout tone="success" label={t('为什么这些都要管', 'Why all of this matters', "為什麼這些都要管")}>
          {t(
            '环境规则的目标只有一个:让每个选手在尽可能相同、公平、不受干扰的条件下比赛 —— 一样的灯光、一样的器材、看不到别人的打乱、没有外界干扰。条件越统一,成绩就越可比。',
            'The environment rules all serve one goal: that every competitor performs under conditions as identical, fair and undisturbed as possible — the same lighting, the same equipment, no sight of others’ scrambles, and no outside interference. The more uniform the conditions, the more comparable the results.', "環境規則的目標只有一個:讓每個選手在儘可能相同、公平、不受干擾的條件下比賽 —— 一樣的燈光、一樣的器材、看不到別人的打亂、沒有外界干擾。條件越統一,成績就越可比。"
          )}
        </Callout>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}
