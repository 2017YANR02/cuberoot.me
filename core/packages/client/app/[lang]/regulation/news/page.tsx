'use client';

// /regulation/news — WCA 规则与赛事动态。
// 忠实搬运 WCA 官方近期公告(项目列表变更 / 竞赛要求政策 5.5 / 静默锦标赛说明)。
// 英文取官方原文措辞,中文为忠实翻译,按时间倒序排列。非注册表章节,
// 故不走 RegArticleLayout —— 自带面包屑 + 来源页脚,复用 .reg-page 外壳。

import { useTranslation } from 'react-i18next';
import { ArrowLeft, Newspaper, ExternalLink } from 'lucide-react';
import Link from '@/components/AppLink';
import { CubingIcon } from '@/components/EventIcon';
import { useT } from '../../../../hooks/useT';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Callout, RegList } from '../_components/primitives';
import '../regulation.css';
import './news.css';

const POST_EVENTS = 'https://www.worldcubeassociation.org/posts/changes-to-the-wca-s-list-of-official-events-june-2026';
const POST_POLICY = 'https://www.worldcubeassociation.org/posts/wca-competition-requirements-policy-update-5-5-may-2026';
const QUIET_DOC = 'https://docs.google.com/document/d/1oYeA8YZQaVIwml0nA5KtZmJJp3WrAb2zcOnoyksIRBg/edit';

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="news-source" href={href} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={13} />
      {label}
    </a>
  );
}

export default function RegulationNews() {
  useTranslation();
  const t = useT();
  useDocumentTitle('最新动态 · WCA 规则', 'Updates · WCA Regulations');

  const yes = t('可', 'Yes');
  const no = t('不可', 'No');

  return (
    <div className="reg-page">
      <div className="reg-wrap">
        <div className="reg-crumb">
          <Link href="/regulation" className="reg-crumb-link">
            <ArrowLeft size={15} />
            {t('全部规则', 'All regulations')}
          </Link>
        </div>

        <header className="reg-hero reg-article-hero">
          <div className="reg-eyebrow">
            <Newspaper size={18} />
            {t('WCA 官方公告', 'WCA announcements')}
          </div>
          <h1 className="reg-title">{t('最新动态', "What’s New")}</h1>
          <p className="reg-subtitle">
            {t(
              'WCA 官方对规则、政策与项目列表的近期调整,按时间整理',
              'Recent WCA changes to its regulations, policy and the list of official events',
            )}
          </p>
          <p className="reg-lede">
            {t(
              '以下内容忠实搬运自 WCA 官方公告与说明文档:英文取官方原文,中文为翻译。点每条右上角链接可查看官方原文。',
              'The items below are faithfully relayed from the official WCA announcements and explainer: the English follows the original wording, the Chinese is a translation. Each item links to its official source.',
            )}
          </p>
        </header>

        <div className="news-list">

          {/* ───────────── 项目列表变更(2026-06)───────────── */}
          <article className="news-item">
            <div className="news-meta">
              <span className="news-date">2026-06</span>
              <SourceLink href={POST_EVENTS} label={t('官方原文', 'Official post')} />
            </div>
            <h2 className="news-title">
              {t('WCA 官方项目列表变更', "Changes to the WCA’s list of official events")}
            </h2>
            <p className="news-lede">
              {t(
                '这是自 2014 年增加斜转(Skewb)以来,WCA 首次调整官方项目列表:新增一个项目,并退役一个项目。',
                'For the first time since Skewb was added in 2014, the WCA is changing its list of official events: one event is added, and one is retired.',
              )}
            </p>

            <div className="news-change-grid">
              <div className="news-change add">
                <span className="news-tag add">{t('新增', 'Added')}</span>
                <div className="news-change-head">
                  <span className="news-evt"><CubingIcon icon="unofficial-fto" /></span>
                  <span className="news-change-name">
                    FTO
                    <small>{t('转面八面体 · Face-Turning Octahedron', 'Face-Turning Octahedron')}</small>
                  </span>
                </div>
                <p>
                  {t(
                    '自 2014 年斜转以来首个新增的 WCA 官方项目,采用与多数项目相同的 5 次取平均(Ao5)赛制。',
                    'The first new WCA event since Skewb was added in 2014. It uses the same Average of 5 format as most current events.',
                  )}
                </p>
                <p>
                  <strong>{t('加入原因:', 'Why: ')}</strong>
                  {t(
                    '社区调查显示多数支持;它热度持续,既与其它项目的性质足够契合,又保持足够独特,能丰富竞赛的多样性。',
                    'Community surveys showed majority support. It has demonstrated sustained interest and is sufficiently well-aligned with the nature of other events while remaining distinct enough to enhance competition diversity.',
                  )}
                </p>
              </div>

              <div className="news-change remove">
                <span className="news-tag remove">{t('退役', 'Removed')}</span>
                <div className="news-change-head">
                  <span className="news-evt"><CubingIcon icon="event-clock" /></span>
                  <span className="news-change-name">
                    {t('魔表', 'Clock')}
                    <small>Clock</small>
                  </span>
                </div>
                <p>
                  {t(
                    '魔表将不再是 WCA 官方认证项目。',
                    'Clock is being discontinued from official WCA recognition.',
                  )}
                </p>
                <p>
                  <strong>{t('移除原因:', 'Why: ')}</strong>
                  {t(
                    'WCA 理事会指出魔表存在根本性的设计问题——极易发生意外,且难以正确打乱;是否还原在远处也难以辨认,大幅削弱了观赏性。魔表与 WCA 旗下其它魔方有本质区别,移除它能强化 WCA 作为"三维几何扭转魔方组织"的定位。',
                    'The WCA Board cited fundamental design issues — Clock is highly prone to incidents and difficult to scramble correctly, and whether a Clock is solved is not easily visible at a distance, substantially diminishing spectator appeal. Clock differs fundamentally from other puzzles in the WCA’s portfolio, and its removal strengthens the WCA’s identity as an organization for three-dimensional geometrical twisty puzzles.',
                  )}
                </p>
              </div>
            </div>

            <h3 className="news-sub-title">{t('关键时间点', 'Key dates')}</h3>
            <ul className="news-milestones">
              <li className="news-ms">
                <span className="news-ms-date">2027-01-02</span>
                <span className="news-ms-text">
                  <strong>{t('FTO 可纳入比赛。', 'FTO becomes available at competitions.')}</strong>
                  {t(' FTO 规则将在 2027 年 1 月的规则修订周期发布并征求反馈。', ' Its regulations will be released for feedback during the January 2027 Regulations cycle.')}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">2027-07-18</span>
                <span className="news-ms-text">
                  {t('魔表在比赛中一般保留至此日。', 'Clock remains generally available at competitions until this date.')}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">{t('2027 世锦赛', 'Worlds 2027')}</span>
                <span className="news-ms-text">
                  {t('最后一次官方魔表比赛,作为这个项目的告别赛。', 'The final official Clock competition, serving as the event’s farewell.')}
                </span>
              </li>
            </ul>
          </article>

          {/* ───────────── 竞赛要求政策 5.5(2026-05)───────────── */}
          <article className="news-item">
            <div className="news-meta">
              <span className="news-date">2026-05</span>
              <SourceLink href={POST_POLICY} label={t('官方原文', 'Official post')} />
            </div>
            <h2 className="news-title">
              {t('竞赛要求政策更新 5.5', 'WCA Competition Requirements Policy update 5.5')}
            </h2>
            <p className="news-lede">
              {t(
                '《竞赛要求政策》更新至 5.5 版(公告人 Lars Johan Folde),带来两项主要变化。',
                'The WCA Competition Requirements Policy is updated to version 5.5 (announced by Lars Johan Folde), with two main changes.',
              )}
            </p>

            <Callout tone="info" label={t('① 静默锦标赛(Quiet Championship)', '① Quiet Championship')}>
              {t(
                '各国与地区现在可以设立一个专门承办盲拧系列项目与三阶最少步的独立锦标赛。具体规则见下方《静默锦标赛说明》。',
                'Countries and regions can now establish a separate championship dedicated to the Blindfolded events and 3×3×3 Fewest Moves. See the Quiet Championship explainer below for the details.',
              )}
            </Callout>

            <div style={{ height: 16 }} />

            <Callout tone="info" label={t('② 资格成绩起始日期', '② Qualification start dates')}>
              {t(
                '组织者现在可以为资格成绩设定一个"起始日期",避免选手凭早已不能反映当前水平的旧成绩获得参赛资格。例如:三阶盲拧的资格,可设为"在 2020 年 1 月 1 日至 2026 年 11 月 1 日之间取得的、好于 3 分钟的单次成绩"。',
                'Organizers can now set a start date for qualification results, preventing competitors from qualifying on outdated performances that no longer reflect their current ability. For example, a qualification for 3×3×3 Blindfolded can be a single time better than 3 minutes that is set between January 1st 2020 and November 1st 2026.',
              )}
            </Callout>

            {/* 静默锦标赛说明(官方 explainer 文档)*/}
            <h3 className="news-sub-title">{t('静默锦标赛说明', 'Quiet Championship explainer')}</h3>
            <div className="news-meta" style={{ marginTop: -8 }}>
              <SourceLink href={QUIET_DOC} label={t('官方说明文档', 'Official explainer document')} />
            </div>
            <p className="news-lede">
              {t(
                '一个日历年内的锦标赛现在可以拆分为三种不同的比赛。此前锦标赛已能拆成"主锦标赛"和"最少步锦标赛"——组织者可以把最少步单独办一场,或与其它项目放在一起。现在,盲拧系列项目也适用同样的规则。',
                'Championships can now be divided into three different competitions within a calendar year. Previously championships could already be divided into a Main Championship and a Fewest Moves Championship — organizers had the option to either hold Fewest Moves at its own competition, or hold it alongside the rest of the events. The same rules now apply to the Blindfolded events as well.',
              )}
            </p>

            <div className="news-terms">
              <div className="news-term">
                <div className="news-term-name">{t('主锦标赛', 'Main Championship')}<small>Main</small></div>
                <p className="news-term-def">
                  {t(
                    '我们熟悉的常规锦标赛,可以承办任意项目。',
                    'The normal championship we are used to. Can hold any event.',
                  )}
                </p>
              </div>
              <div className="news-term">
                <div className="news-term-name">{t('静默锦标赛(新)', 'Quiet Championship (new)')}<small>Quiet</small></div>
                <p className="news-term-def">
                  {t(
                    '可以承办俗称 PBQ 项目(Please Be Quiet,"请保持安静")的锦标赛,包括:三阶盲拧、四阶盲拧、五阶盲拧、三阶多盲、三阶最少步。',
                    'A championship that can hold the events commonly referred to as PBQ-events (Please Be Quiet). This championship can hold 3×3×3 Blindfolded, 4×4×4 Blindfolded, 5×5×5 Blindfolded, 3×3×3 Multi-Blind and 3×3×3 Fewest Moves.',
                  )}
                </p>
              </div>
              <div className="news-term">
                <div className="news-term-name">{t('最少步锦标赛', 'Fewest Moves Championship')}<small>FM</small></div>
                <p className="news-term-def">
                  {t(
                    '只能承办三阶最少步的锦标赛,可以作为多地点(multi-location)比赛举办。',
                    'A championship that can only hold 3×3×3 Fewest Moves. This can be held as a multi-location competition.',
                  )}
                </p>
              </div>
            </div>

            <h3 className="news-sub-title">{t('项目如何分配', 'Event distribution')}</h3>
            <p className="news-lede" style={{ marginBottom: 16 }}>
              {t(
                '你可以按对所在地区合理的方式任意分配项目,只要遵守以下两条规则:',
                'You are free to permute the events in any way that makes sense for your region, as long as these two rules are followed:',
              )}
            </p>
            <RegList items={[
              t('同一项目在一个日历年内,不得举办超过一次。', 'No event is held more than once within a calendar year.'),
              t('项目不得在其不适用的锦标赛上举办。', 'No event is held at a championship it is not eligible for.'),
            ]} />

            <div className="news-dist-wrap" style={{ marginTop: 26 }}>
              <table className="news-dist">
                <thead>
                  <tr>
                    <th>{t('项目', 'Event')}</th>
                    <th>{t('主锦标赛', 'Main')}</th>
                    <th>{t('静默锦标赛', 'Quiet')}</th>
                    <th>{t('最少步锦标赛', 'FM')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>{t('三阶最少步', '3×3×3 Fewest Moves')}</td><td className="y">{yes}</td><td className="y">{yes}</td><td className="y">{yes}</td></tr>
                  <tr><td>{t('三阶多盲', '3×3×3 Multi-Blind')}</td><td className="y">{yes}</td><td className="y">{yes}</td><td className="n">{no}</td></tr>
                  <tr><td>{t('五阶盲拧', '5×5×5 Blindfolded')}</td><td className="y">{yes}</td><td className="y">{yes}</td><td className="n">{no}</td></tr>
                  <tr><td>{t('四阶盲拧', '4×4×4 Blindfolded')}</td><td className="y">{yes}</td><td className="y">{yes}</td><td className="n">{no}</td></tr>
                  <tr><td>{t('三阶盲拧', '3×3×3 Blindfolded')}</td><td className="y">{yes}</td><td className="y">{yes}</td><td className="n">{no}</td></tr>
                  <tr><td>{t('其它所有项目', 'All other events')}</td><td className="y">{yes}</td><td className="n">{no}</td><td className="n">{no}</td></tr>
                </tbody>
              </table>
            </div>
          </article>

        </div>

        {/* 来源页脚 */}
        <footer className="reg-footer">
          <p>
            {t(
              '本页忠实整理自 WCA 官方公告与说明文档,仅供学习参考;一切规则与判定以官方现行版本为准。',
              'This page faithfully relays the official WCA announcements and explainer for educational reference only. All rules and judging follow the current official version.',
            )}
          </p>
          <p style={{ marginTop: 12 }}>
            <Link href="/regulation">{t('← 返回规则总览', '← Back to overview')}</Link>
            {' · '}
            <a href={POST_EVENTS} target="_blank" rel="noopener noreferrer">{t('项目列表变更', 'Events list change')}</a>
            {' · '}
            <a href={POST_POLICY} target="_blank" rel="noopener noreferrer">{t('竞赛要求政策 5.5', 'Requirements Policy 5.5')}</a>
            {' · '}
            <a href={QUIET_DOC} target="_blank" rel="noopener noreferrer">{t('静默锦标赛说明', 'Quiet Championship explainer')}</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
