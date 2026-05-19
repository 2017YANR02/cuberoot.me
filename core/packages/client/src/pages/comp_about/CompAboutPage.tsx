/**
 * /wca/comp-about — WCA 比赛直播说明页
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './comp_about.css';

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
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('WCA 比赛说明', 'WCA Competitions Guide');

  return (
    <div className="ca-page">
      <div className="ca-header">
        <Link to="/wca/comp" className="ca-back">
          <ArrowLeft size={16} />
          <span>{t('返回 WCA 比赛', 'Back to Competitions')}</span>
        </Link>
        <LangToggle />
      </div>

      <main className="ca-main">
        <h1 className="ca-title">{t('WCA 比赛直播是怎么工作的', 'How the WCA Competitions page works')}</h1>
        <p className="ca-intro">
          {t(
            '/wca/comp 是站内的比赛成绩查看入口。输入或搜索一场比赛,就能看到 cubing.com 上逐轮次、逐选手的实时成绩,包括 PR 标记、选手历史成绩弹窗、赛程心理表等。',
            '/wca/comp is the competition results viewer. Search or paste a competition id to browse round-by-round results sourced from cubing.com — with PR highlights, per-person result history, and a psychsheet view.',
          )}
        </p>

        <h2 className="ca-section-title">{t('数据来源', 'Data sources')}</h2>
        <p className="ca-section-intro">
          {t(
            '成绩数据来自两条路径:WCA 官方数据库(每周 dump)和 cubing.com 实时 API。两条路径在服务端合并,cubing.com 的数据优先(更新及时),WCA dump 作为历史补充。',
            'Results flow through two paths: the WCA developer dump (weekly) and the cubing.com live API. The server merges both, with cubing.com taking priority for recency and the WCA dump filling historical gaps.',
          )}
        </p>

        <h2 className="ca-section-title">{t('使用流程', 'How to use')}</h2>
        <div className="ca-flow">
          <Step
            step={1}
            title={t('搜索或粘贴链接', 'Search or paste a link')}
            body={t(
              '在搜索框里输入比赛名、城市,或直接粘贴 cubing.com / WCA 的比赛链接。自动识别 WCA-ID 和 cubing.com slug 两种格式。',
              'Type a competition name, city, or paste a cubing.com / WCA competition URL. Both WCA-ID format and cubing.com slug are auto-detected.',
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('选轮次和视图', 'Pick a round and view')}
            body={t(
              '进入比赛详情后,顶部有轮次选择器。成绩视图显示标准成绩表;心理表视图(Psychsheet)显示报名选手的 WR 排名。',
              'In the comp detail view, a round selector sits at the top. The results view shows a standard scoreboard; the Psychsheet view shows registered competitors sorted by their world ranking.',
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('点击选手看历史', 'Click a person for history')}
            body={t(
              '点任意选手名会弹出他/她在本场各项目的所有成绩(每次 attempt + PR 标记),以及生涯 PB 对比。',
              'Clicking a competitor\'s name opens a modal with all their round results (per-attempt + PR flags) across events in this competition, alongside their career PB.',
            )}
            highlight
          />
          <Arrow />
          <Step
            step={4}
            title={t('最近浏览', 'Recent comps')}
            body={t(
              '浏览过的比赛自动记录在首页(最近 12 条,存 localStorage)。再次访问无需重新搜索。',
              'Previously viewed competitions are remembered on the index page (up to 12, stored in localStorage). No need to search again on revisit.',
            )}
          />
        </div>

        <h2 className="ca-section-title">{t('PR 标记规则', 'PR badge rules')}</h2>
        <p className="ca-section-intro">
          {t(
            'PR(个人最佳)按 WCA 口径:该次成绩严格优于该选手在此之前所有比赛的相同类型最佳。表格里单次和平均各独立标记,浅蓝色表示同类项目当场首次超越。',
            'PR (personal record) follows WCA conventions: the result strictly improves on all prior results for that person in that event type. Single and average are tracked independently; light-blue cells indicate the first improvement within this competition.',
          )}
        </p>

        <h2 className="ca-section-title">{t('相关页面', 'See also')}</h2>
        <ul className="ca-refs">
          <li>
            <Link to="/wca/calendar">{t('比赛日历', 'Competition Calendar')}</Link>
            {t(' — 近期比赛时间轴 + 选手追踪。', ' — upcoming comps timeline + cuber tracking.')}
          </li>
          <li>
            <Link to="/wca/globe">{t('地球视图', 'Globe view')}</Link>
            {t(' — 比赛地理分布 3D 地球。', ' — competitions on an interactive 3D globe.')}
          </li>
          <li>
            <Link to="/wca/comp/sources">{t('数据源流程', 'Data source flow')}</Link>
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
