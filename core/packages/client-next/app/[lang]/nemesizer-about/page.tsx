'use client';

/**
 * /nemesizer-about — Nemesizer 宿敌说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './nemesizer_about.css';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`nema-step${highlight ? ' is-highlight' : ''}`}>
      <span className="nema-step-num">{step}</span>
      <div>
        <div className="nema-step-title">{title}</div>
        <div className="nema-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="nema-arrow" aria-hidden="true">↓</span>; }

export default function NemesizerAboutPage() {
  const { i18n } = useTranslation();
  const t = useT();
  useDocumentTitle('Nemesizer 说明', 'Nemesizer Guide', "Nemesizer 說明");

  return (
    <div className="nema-page">
      <div className="nema-header">
        <Link href="/nemesizer" className="nema-back">
          <ArrowLeft size={16} />
          <span>{t('返回 Nemesizer', 'Back to Nemesizer')}</span>
        </Link>
      </div>

      <main className="nema-main">
        <h1 className="nema-title">{t('Nemesizer 是怎么工作的', 'How Nemesizer works', "Nemesizer 是怎麼工作的")}</h1>
        <p className="nema-intro">
          {t(
            '/nemesizer 帮你找「宿敌」— 竞技魔方里成绩比你稍稍好一点点、偶尔超过你、但你也打得过的对手。算法基于 WCA developer dump,每周自动更新。',
            '/nemesizer helps you find your "nemesis" — the competitor in the WCA database who is just slightly better than you, sometimes beats you, but whom you also occasionally beat. Algorithm runs on the WCA developer dump, updated weekly.', "/nemesizer 幫你找「宿敵」— 競技魔方里成績比你稍稍好一點點、偶爾超過你、但你也打得過的對手。演算法基於 WCA developer dump,每週自動更新。"
          )}
        </p>

        <h2 className="nema-section-title">{t('宿敌算法', 'Nemesis algorithm', "宿敵演算法")}</h2>
        <p className="nema-section-intro">
          {t(
            '对每个 (选手, 项目) 对,算法计算"相对强度":同场比赛中两人对决的胜负比。宿敌满足三个条件:①他们的成绩比你稍好(WR 差距在一定范围内),②两人有共同参赛经历,③胜率约在 40%-60% 之间(真正的"势均力敌")。服务端用 Hono 在 Node.js 运行,6 个端点预加载到内存。',
            'For each (person, event) pair, the algorithm computes a relative-strength score based on head-to-head outcomes at shared competitions. A nemesis satisfies: ① they are slightly better (WR gap within a threshold), ② there is sufficient shared competition history, and ③ your mutual win rate is around 40-60% (genuinely competitive). The server runs on Hono/Node.js with 6 endpoints preloaded into memory.', "對每個 (選手, 項目) 對,演算法計算\"相對強度\":同場比賽中兩人對決的勝負比。宿敵滿足三個條件:①他們的成績比你稍好(WR 差距在一定範圍內),②兩人有共同參賽經歷,③勝率約在 40%-60% 之間(真正的\"勢均力敵\")。服務端用 Hono 在 Node.js 執行,6 個端點預載入到記憶體。"
          )}
        </p>

        <h2 className="nema-section-title">{t('四种模式', 'Four modes', "四種模式")}</h2>
        <ul className="nema-list">
          <li>
            <strong>{t('宿敌 (Nemeses)', 'Nemeses', "宿敵 (Nemeses)")}</strong>
            {t(' — 标准模式:输入 WCA-ID,列出各项目中最符合宿敌条件的对手列表。', ' — standard mode: enter a WCA-ID to see the closest nemeses per event.', " — 標準模式:輸入 WCA-ID,列出各項目中最符合宿敵條件的對手列表。")}
          </li>
          <li>
            <strong>{t('对决 (Head to head)', 'Head to head', "對決 (Head to head)")}</strong>
            {t(' — 两位选手直接对比:共同参赛场次、各项目胜负分布、最近对决时间线。', ' — two-person direct comparison: shared competitions, event-by-event win/loss breakdown, recent head-to-head timeline.', " — 兩位選手直接對比:共同參賽場次、各項目勝負分佈、最近對決時間線。")}
          </li>
          <li>
            <strong>{t('假设 (What if)', 'What if', "假設 (What if)")}</strong>
            {t(' — 假设某位选手有不同 PB,重新计算宿敌关系会如何变化。用于"如果我到了 X 秒,我的宿敌是谁"的探索。', ' — hypothetical scenario: what if a cuber had a different PB? Shows how the nemesis landscape shifts.', " — 假設某位選手有不同 PB,重新計算宿敵關係會如何變化。用於\"如果我到了 X 秒,我的宿敵是誰\"的探索。")}
          </li>
          <li>
            <strong>{t('统计 (Statistics)', 'Statistics', "統計 (Statistics)")}</strong>
            {t(' — 全局统计:最多宿敌关系的选手、各项目宿敌密度热图等。', ' — global statistics: cubers with the most nemesis relationships, per-event nemesis density, etc.', " — 全域性統計:最多宿敵關係的選手、各項目宿敵密度熱圖等。")}
          </li>
        </ul>

        <h2 className="nema-section-title">{t('使用流程(标准模式)', 'How to use (standard mode)', "使用流程(標準模式)")}</h2>
        <div className="nema-flow">
          <Step
            step={1}
            title={t('输入你的 WCA-ID', 'Enter your WCA-ID', "輸入你的 WCA-ID")}
            body={t(
              '在搜索框输入任意 WCA 选手 ID(例如 2019GENG01)。搜索框支持姓名模糊搜索,自动补全。',
              'Type any WCA-ID (e.g. 2019GENG01) in the search box. Name fuzzy search with autocomplete is also supported.', "在搜尋框輸入任意 WCA 選手 ID(例如 2019GENG01)。搜尋框支援姓名模糊搜尋,自動補全。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('查看宿敌列表', 'View nemesis list', "檢視宿敵列表")}
            body={t(
              '每个项目显示最符合宿敌定义的几位对手:姓名、国籍、相对成绩差距、共同参赛次数。点击任意宿敌可切到对决模式看详情。',
              'Each event shows the top nemesis candidates: name, nationality, relative result gap, and shared competition count. Click any nemesis to jump to Head-to-Head mode.', "每個項目顯示最符合宿敵定義的幾位對手:姓名、國籍、相對成績差距、共同參賽次數。點選任意宿敵可切到對決模式看詳情。"
            )}
            highlight
          />
          <Arrow />
          <Step
            step={3}
            title={t('切换项目', 'Switch events', "切換項目")}
            body={t(
              '页面顶部的项目 chip 可以快速切换查看不同项目的宿敌。也可以只看某个 WCA 大洲 / 国家范围内的宿敌。',
              'Event chips at the top of the results let you quickly switch events. You can also filter to nemeses from a specific continent or country.', "頁面頂部的項目 chip 可以快速切換檢視不同項目的宿敵。也可以只看某個 WCA 大洲 / 國家範圍內的宿敵。"
            )}
          />
        </div>

        <h2 className="nema-section-title">{t('相关页面', 'See also', "相關頁面")}</h2>
        <ul className="nema-refs">
          <li>
            <Link href="/wca/all-results">{t('全成绩排名', 'All Results', "全成績排名")}</Link>
            {t(' — 按项目搜索任意选手的历史成绩。', ' — search any cuber\'s results by event.', " — 按項目搜尋任意選手的歷史成績。")}
          </li>
          <li>
            <a href="https://github.com/huizhiLLL/WCA-Nemesizer-API" target="_blank" rel="noopener noreferrer">huizhiLLL/WCA-Nemesizer-API</a>
            {t(' — 宿敌算法的上游实现参考。', ' — the upstream algorithm reference.', " — 宿敵演算法的上游實現參考。")}
          </li>
          <li>
            <a href="https://nemesizer.com" target="_blank" rel="noopener noreferrer">nemesizer.com</a>
            {t(' — UI 设计的灵感来源。', ' — UI inspiration.', " — UI 設計的靈感來源。")}
          </li>
        </ul>
      </main>
    </div>
  );
}
