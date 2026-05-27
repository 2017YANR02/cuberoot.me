'use client';

/**
 * /nemesizer-about — Nemesizer 宿敌说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import LangToggle from '@/components/LangToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './nemesizer_about.css';

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
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('Nemesizer 说明', 'Nemesizer Guide');

  return (
    <div className="nema-page">
      <div className="nema-header">
        <Link href="/nemesizer" className="nema-back">
          <ArrowLeft size={16} />
          <span>{t('返回 Nemesizer', 'Back to Nemesizer')}</span>
        </Link>
        <LangToggle />
      </div>

      <main className="nema-main">
        <h1 className="nema-title">{t('Nemesizer 是怎么工作的', 'How Nemesizer works')}</h1>
        <p className="nema-intro">
          {t(
            '/nemesizer 帮你找「宿敌」— 竞技魔方里成绩比你稍稍好一点点、偶尔超过你、但你也打得过的对手。算法基于 WCA developer dump,每周自动更新。',
            '/nemesizer helps you find your "nemesis" — the competitor in the WCA database who is just slightly better than you, sometimes beats you, but whom you also occasionally beat. Algorithm runs on the WCA developer dump, updated weekly.',
          )}
        </p>

        <h2 className="nema-section-title">{t('宿敌算法', 'Nemesis algorithm')}</h2>
        <p className="nema-section-intro">
          {t(
            '对每个 (选手, 项目) 对,算法计算"相对强度":同场比赛中两人对决的胜负比。宿敌满足三个条件:①他们的成绩比你稍好(WR 差距在一定范围内),②两人有共同参赛经历,③胜率约在 40%-60% 之间(真正的"势均力敌")。服务端用 Hono 在 Node.js 运行,6 个端点预加载到内存。',
            'For each (person, event) pair, the algorithm computes a relative-strength score based on head-to-head outcomes at shared competitions. A nemesis satisfies: ① they are slightly better (WR gap within a threshold), ② there is sufficient shared competition history, and ③ your mutual win rate is around 40-60% (genuinely competitive). The server runs on Hono/Node.js with 6 endpoints preloaded into memory.',
          )}
        </p>

        <h2 className="nema-section-title">{t('四种模式', 'Four modes')}</h2>
        <ul className="nema-list">
          <li>
            <strong>{t('宿敌 (Nemeses)', 'Nemeses')}</strong>
            {t(' — 标准模式:输入 WCA-ID,列出各项目中最符合宿敌条件的对手列表。', ' — standard mode: enter a WCA-ID to see the closest nemeses per event.')}
          </li>
          <li>
            <strong>{t('对决 (Head to head)', 'Head to head')}</strong>
            {t(' — 两位选手直接对比:共同参赛场次、各项目胜负分布、最近对决时间线。', ' — two-person direct comparison: shared competitions, event-by-event win/loss breakdown, recent head-to-head timeline.')}
          </li>
          <li>
            <strong>{t('假设 (What if)', 'What if')}</strong>
            {t(' — 假设某位选手有不同 PB,重新计算宿敌关系会如何变化。用于"如果我到了 X 秒,我的宿敌是谁"的探索。', ' — hypothetical scenario: what if a cuber had a different PB? Shows how the nemesis landscape shifts.')}
          </li>
          <li>
            <strong>{t('统计 (Statistics)', 'Statistics')}</strong>
            {t(' — 全局统计:最多宿敌关系的选手、各项目宿敌密度热图等。', ' — global statistics: cubers with the most nemesis relationships, per-event nemesis density, etc.')}
          </li>
        </ul>

        <h2 className="nema-section-title">{t('使用流程(标准模式)', 'How to use (standard mode)')}</h2>
        <div className="nema-flow">
          <Step
            step={1}
            title={t('输入你的 WCA-ID', 'Enter your WCA-ID')}
            body={t(
              '在搜索框输入任意 WCA 选手 ID(例如 2019GENG01)。搜索框支持姓名模糊搜索,自动补全。',
              'Type any WCA-ID (e.g. 2019GENG01) in the search box. Name fuzzy search with autocomplete is also supported.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('查看宿敌列表', 'View nemesis list')}
            body={t(
              '每个项目显示最符合宿敌定义的几位对手:姓名、国籍、相对成绩差距、共同参赛次数。点击任意宿敌可切到对决模式看详情。',
              'Each event shows the top nemesis candidates: name, nationality, relative result gap, and shared competition count. Click any nemesis to jump to Head-to-Head mode.',
            )}
            highlight
          />
          <Arrow />
          <Step
            step={3}
            title={t('切换项目', 'Switch events')}
            body={t(
              '页面顶部的项目 chip 可以快速切换查看不同项目的宿敌。也可以只看某个 WCA 大洲 / 国家范围内的宿敌。',
              'Event chips at the top of the results let you quickly switch events. You can also filter to nemeses from a specific continent or country.',
            )}
          />
        </div>

        <h2 className="nema-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="nema-refs">
          <li>
            <Link href="/wca/all-results">{t('全成绩排名', 'All Results')}</Link>
            {t(' — 按项目搜索任意选手的历史成绩。', ' — search any cuber\'s results by event.')}
          </li>
          <li>
            <a href="https://github.com/huizhiLLL/WCA-Nemesizer-API" target="_blank" rel="noopener noreferrer">huizhiLLL/WCA-Nemesizer-API</a>
            {t(' — 宿敌算法的上游实现参考。', ' — the upstream algorithm reference.')}
          </li>
          <li>
            <a href="https://nemesizer.com" target="_blank" rel="noopener noreferrer">nemesizer.com</a>
            {t(' — UI 设计的灵感来源。', ' — UI inspiration.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
