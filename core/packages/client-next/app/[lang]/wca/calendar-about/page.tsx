'use client';

/**
 * /wca/calendar-about — 比赛日历说明页
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './calendar_about.css';

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`cala-step${highlight ? ' is-highlight' : ''}`}>
      <span className="cala-step-num">{step}</span>
      <div>
        <div className="cala-step-title">{title}</div>
        <div className="cala-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="cala-arrow" aria-hidden="true">↓</span>; }

export default function CalendarAboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('比赛日历说明', 'Calendar Guide');

  return (
    <div className="cala-page">
      <div className="cala-header">
        <Link href="/wca/calendar" className="cala-back">
          <ArrowLeft size={16} />
          <span>{t('返回比赛日历', 'Back to Calendar')}</span>
        </Link>
      </div>

      <main className="cala-main">
        <h1 className="cala-title">{t('比赛日历是怎么工作的', 'How the competition calendar works')}</h1>
        <p className="cala-intro">
          {t(
            '/wca/calendar 是 WCA 近期和历史比赛的日历视图。支持按顶尖选手、地区、月份过滤,以及查看每场比赛各轮次的纪录情况。数据来自每周更新的 all_upcoming_comps.json 和 all_past_comps.json。',
            '/wca/calendar is a calendar view of upcoming and past WCA competitions. You can filter by top cubers, region, and month, and check record highlights per round. Data updates weekly from all_upcoming_comps.json and all_past_comps.json.',
          )}
        </p>

        <h2 className="cala-section-title">{t('两种模式', 'Two modes')}</h2>
        <p className="cala-section-intro">
          {t(
            '页面默认以"顶尖选手出战"模式展示近期比赛 — 即有当前或前任 WR 保持者报名的比赛。切到"All"模式显示所有即将举行的 WCA 比赛。',
            'The page defaults to "Top cubers" mode, showing upcoming competitions where a current or former WR holder is registered. Switch to "All" to see every upcoming WCA competition.',
          )}
        </p>

        <h2 className="cala-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="cala-flow">
          <Step
            step={1}
            title={t('选择视图模式', 'Choose view mode')}
            body={t(
              '顶部工具栏可切换月历视图 / 列表视图 / 紧凑视图。月历视图按日期格排列;列表视图一行一场比赛,信息更密。',
              'The toolbar switches between month-grid view, list view, and compact view. Month-grid arranges comps by calendar day; list view packs more info per competition.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('过滤条件', 'Apply filters')}
            body={t(
              '可按地区(大洲 / 国家)、项目、WR 持有状态过滤。搜索框支持比赛名和城市名模糊匹配。右上"仅看 WR"开关收窄到纪录级别比赛。',
              'Filter by region (continent / country), event, and WR-holder status. The search box supports fuzzy matching on comp name and city. The "WR only" toggle limits to competitions where a WR was set.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('追踪特定选手', 'Track a specific cuber')}
            body={t(
              '用"选手追踪"输入框搜索一位 WCA 选手,日历将高亮该选手报名的比赛。同时可切到选手的"近期比赛"视图。',
              'Use the cuber-search input to track a specific person. The calendar highlights competitions they are registered for, and you can switch to that person\'s upcoming-comps view.',
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('点击比赛看纪录', 'Click a comp for records')}
            body={t(
              '点击日历格或列表中的比赛卡片,展开该场比赛各项目各轮次的 WR / CR / NR 纪录摘要,也可直接跳到 /wca/comp 看完整成绩。',
              'Clicking a comp card expands WR / CR / NR highlights per event per round, with a direct link to /wca/comp for full results.',
            )}
            highlight
          />
        </div>

        <h2 className="cala-section-title">{t('数据更新频率', 'Data freshness')}</h2>
        <p className="cala-section-intro">
          {t(
            '比赛列表来自 WCA developer dump,每周一次 CI 更新写入 stats/all_upcoming_comps.json 和 stats/all_past_comps.json。纪录快照(comp_records)同步更新。当前周可能有 1-7 天的延迟。',
            'Competition lists come from the WCA developer dump, updated weekly by CI into stats/all_upcoming_comps.json and stats/all_past_comps.json. Record snapshots (comp_records) update at the same cadence. Expect up to 7 days of lag for recent events.',
          )}
        </p>

        <h2 className="cala-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="cala-refs">
          <li>
            <Link href="/wca/comp">{t('比赛成绩查看', 'Competition Results')}</Link>
            {t(' — 逐轮次 cubing.com 实时成绩。', ' — round-by-round live results from cubing.com.')}
          </li>
          <li>
            <Link href="/wca/globe">{t('地球视图', 'Globe')}</Link>
            {t(' — 比赛地理分布地图。', ' — competition locations on a 3D globe.')}
          </li>
          <li>
            <Link href="/wca/calendar/stats">{t('比赛统计', 'Calendar Stats')}</Link>
            {t(' — 比赛数量随时间的分布可视化。', ' — visualisation of competition counts over time.')}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/competitions" target="_blank" rel="noopener noreferrer">{t('WCA 官方比赛列表', 'WCA official competition list')}</a>
            {t(' — 所有已公布 WCA 比赛的权威来源。', ' — the authoritative source for all published WCA competitions.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
