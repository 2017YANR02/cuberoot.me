'use client';

/**
 * /wca/comp-about — WCA 比赛直播说明页
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './comp_about.css';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

interface StepProps { step: number; title: string; body: string; highlight?: boolean; }
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`ca-step${highlight ? ' is-highlight' : ''}`}>
      <span className="ca-step-num">{step}</span>
      <div>
        <div className="ca-step-title">{title}</div>
        <div className="ca-step-body">{body}</div>
      </div>
    </div>
  );
}
function Arrow() { return <span className="ca-arrow" aria-hidden="true">↓</span>; }

export default function CompAboutPage() {
  const { i18n } = useTranslation();
  const t = useT();
  useDocumentTitle('加载任意比赛', 'Load any competition');

  return (
    <div className="ca-page">
      <div className="ca-header">
        <Link href="/wca/comp" className="ca-back">
          <ArrowLeft size={16} />
          <span>{t('返回 WCA 比赛', 'Back to Competitions')}</span>
        </Link>
      </div>

      <main className="ca-main">
        <h1 className="ca-title">{t('加载任意比赛', 'Load any competition')}</h1>
        <p className="ca-intro">
          {t(
            '/wca/comp 是站内的比赛成绩查看入口。输入或搜索一场比赛,就能看到逐轮次、逐选手的成绩,包括 PR 历史排名、选手成绩弹窗、Psych Sheet。已结束的比赛 50-400 毫秒出表,实时比赛走 WebSocket 推送。',
            '/wca/comp is the competition results viewer. Search or paste a competition id to browse round-by-round results — with historical PR rank, per-person result modal, and Psych Sheet. Past comps render in 50-400ms; ongoing comps stream via WebSocket.'
          )}
        </p>

        <h2 className="ca-section-title">{t('为什么瞬间加载', 'Why it loads instantly')}</h2>
        <p className="ca-section-intro">
          {t(
            '已结束的 17000+ 场比赛预先 dump 成静态 JSON 文件,放在 nginx 静态目录。打开页面时客户端先 fetch /stats/comp/<比赛 id>.json — 同源,无 CORS,命中即跳过 API。从比赛列表 / 日历 / 地球视图点进来时,hover 阶段已经悄悄 prefetch 进浏览器缓存,真点击瞬间出货。每周一 CI 增量补新结束的比赛。',
            'All 17000+ past comps are pre-dumped to static JSON in nginx static dir. Client fetches /stats/comp/<id>.json first — same-origin, no CORS, skips the API on hit. Hover-prefetch from list / calendar / globe pre-warms the browser cache so the click is instant. A weekly CI job incrementally adds newly finished comps.'
          )}
        </p>

        <h2 className="ca-section-title">{t('数据来源', 'Data sources')}</h2>
        <p className="ca-section-intro">
          {t(
            '四条路径,server 端自动挑最合适的:wca_db(本地 WCA dump 拼装,过去比赛走这条,带历史 PR 排名)/ cubing.com(中国比赛进行中走这条,WebSocket 实时推)/ WCA Live(国外比赛实时官方源)/ WCA REST(已公示但还没在 dump 里的比赛)。静态 snapshot 走的就是 wca_db 路径冻结后的产物。',
            'Four paths; server picks the best. wca_db (assembled from local WCA dump, used for past comps with historical PR rank) / cubing.com (Chinese ongoing comps via WebSocket) / WCA Live (international ongoing comps) / WCA REST (announced but not yet in dump). The static snapshot is just the wca_db output frozen to disk.'
          )}
        </p>

        <h2 className="ca-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="ca-flow">
          <Step
            step={1}
            title={t('搜索或粘贴链接', 'Search or paste a link')}
            body={t(
              '在搜索框里输入比赛名、城市,或直接粘贴 cubing.com / WCA 的比赛链接。自动识别 WCA-ID 和 cubing.com slug 两种格式。',
              'Type a competition name, city, or paste a cubing.com / WCA competition URL. Both WCA-ID format and cubing.com slug are auto-detected.'
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选轮次和视图', 'Pick a round and view')}
            body={t(
              '进入比赛详情后,顶部有轮次选择器。成绩视图显示标准成绩表;心理表视图(Psychsheet)显示报名选手的 WR 排名。',
              'In the comp detail view, a round selector sits at the top. The results view shows a standard scoreboard; the Psychsheet view shows registered competitors sorted by their world ranking.'
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('点击选手看历史', 'Click a person for history')}
            body={t(
              '点任意选手名会弹出他/她在本场各项目的所有成绩(每次 attempt + PR 标记),以及生涯 PB 对比。',
              'Clicking a competitor\'s name opens a modal with all their round results (per-attempt + PR flags) across events in this competition, alongside their career PB.'
            )}
            highlight
          />
          <Arrow />
          <Step
            step={4}
            title={t('最近浏览', 'Recent comps')}
            body={t(
              '浏览过的比赛自动记录在首页(最近 12 条,存 localStorage)。再次访问无需重新搜索。',
              'Previously viewed competitions are remembered on the index page (up to 12, stored in localStorage). No need to search again on revisit.'
            )}
          />
        </div>

        <h2 className="ca-section-title">{t('PR 标记规则', 'PR badge rules')}</h2>
        <p className="ca-section-intro">
          {t(
            '每条成绩标的不只是"是不是 PR",而是历史第几快:PR = 选手此项目历史最快,PR2 = 历史第 2 快,PR17 = 历史第 17 快,以此类推。计算口径:本比赛开始日期之前的全部历史成绩取 dense rank。这意味着旧比赛页面的 PR rank 在那一刻冻结 — 选手未来破纪录不会回头改老页面里的标志。单次和平均独立排名。',
            'Each result is tagged not just "is PR" but its historical position: PR = fastest ever, PR2 = 2nd best, PR17 = 17th best, etc. Dense rank computed across all results before this competition\'s start date. Past-comp PR rank is frozen in time — future breakthroughs do not retroactively rewrite old pages. Single and average ranked independently.'
          )}
        </p>

        <h2 className="ca-section-title">{t('比赛日历', 'Competition calendar')}</h2>
        <p className="ca-section-intro">
          {t(
            '本页主体是一张比赛日历:月历 / 紧凑国旗 / 列表三种视图,默认展示近期与历史的 WCA 比赛。可按顶尖选手、地区(大洲 / 国家)、项目轮次、月份过滤;点任意比赛弹出各轮次 WR / CR / NR 纪录摘要,再一步进入完整成绩。顶部「统计」链接到比赛数量随时间分布的热力图。比赛列表来自每周更新的 all_upcoming_comps.json / all_past_comps.json。',
            'The body of this page is a competition calendar: month-grid / compact-flags / list views, showing upcoming and past WCA competitions by default. Filter by top cubers, region (continent / country), event rounds, and month; click any competition for its per-round WR / CR / NR record highlights, then drill into full results. The "Stats" link opens a heatmap of competition counts over time. Lists update weekly from all_upcoming_comps.json / all_past_comps.json.'
          )}
        </p>

        <h2 className="ca-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="ca-refs">
          <li>
            <Link href="/wca/comp?view=globe">{t('地球视图', 'Globe view')}</Link>
            {t(' — 比赛地理分布 3D 地球。', ' — competitions on an interactive 3D globe.')}
          </li>
          <li>
            <Link href="/wca/comp/sources">{t('数据源流程', 'Data source flow')}</Link>
            {t(' — WCA dump 和 cubing.com 两条路径的详细合并逻辑。', ' — detailed merge logic for WCA dump and cubing.com paths.')}
          </li>
          <li>
            <a href="https://cubing.com" target="_blank" rel="noopener noreferrer">cubing.com</a>
            {t(' — 实时成绩的上游来源。', ' — the upstream source for live results.')}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/competitions" target="_blank" rel="noopener noreferrer">{t('WCA 官方比赛列表', 'WCA official competition list')}</a>
            {t(' — 所有已公布的 WCA 比赛。', ' — all officially published WCA competitions.')}
          </li>
        </ul>
      </main>
    </div>
  );
}
