'use client';

// /regulation/news — WCA 规则与赛事动态。
// 忠实整理 WCA 官方近期公告(4-pad 计时 / 项目列表变更 / 竞赛要求政策 5.5 / 安静锦标赛说明)。
// 英文取官方原文措辞,中文为忠实翻译,按时间倒序排列。非注册表章节,
// 故不走 RegArticleLayout —— 自带面包屑 + 来源页脚,复用 .reg-page 外壳。

import { useTranslation } from 'react-i18next';
import { ArrowLeft, Newspaper, ExternalLink } from 'lucide-react';
import Link from '@/components/AppLink';
import { CubingIcon } from '@/components/EventIcon';
import { useT } from '../../../../hooks/useT';
import { Callout, RegList } from '../_components/primitives';
import '../regulation.css';
import './news.css';

const POST_4_PAD = 'https://www.worldcubeassociation.org/posts/adoption-of-4-pad-timing-august-2026';
const FOUR_PAD_EXPLAINER = 'https://drive.google.com/file/d/13fQghYapzMIPQnGeo53r80_cmKcp0NrW/view';
const REG_A7G = 'https://www.worldcubeassociation.org/regulations/#A7g';
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
        </header>

        <div className="news-list">

          {/* ───────────── 4-pad 计时(2026-08)───────────── */}
          <article className="news-item">
            <div className="news-meta">
              <span className="news-date">2026-08-23</span>
              <SourceLink href={POST_4_PAD} label={t('官方原文', 'Official post')} />
              <SourceLink href={FOUR_PAD_EXPLAINER} label={t('决策说明', 'Decision explainer')} />
              <SourceLink href={REG_A7G} label={t('现行 A7g 条款', 'Current Regulation A7g')} />
            </div>
            <h2 className="news-title">
              {t('WCA 将要求使用 4-pad 计时', 'WCA to require 4-pad timing')}
            </h2>
            <p className="news-lede">
              {t(
                '从 2027 年 1 月 2 日起,所有采用速拧计时器记录的 WCA 官方尝试,都必须使用 Speed Stacks G5 StackMat™ Pro Timer 的 4-pad 模式。WCA 表示,这一改变能更可靠地确认成绩符合规则,进一步保障官方成绩的公正性与可信度。',
                'From January 2, 2027, every official WCA attempt recorded with a speedsolving timer must use a Speed Stacks G5 StackMat™ Pro Timer in 4-pad mode. The WCA says the change will make it easier to verify that official times comply with the Regulations and strengthen the integrity of recognized results.',
              )}
            </p>

            <Callout tone="warn" label={t('现行规则尚未改变', 'Current rules remain in force')}>
              {t(
                '新要求到 2027-01-02 才生效。在此之前,比赛仍应遵守现行的 2-pad 规定;启动与停止计时器的规则修订草案将在 2026 年 9 月公布并征求社区意见。本站会在正式规则发布后同步完整条款。',
                'The new requirement does not take effect until 2027-01-02. Until then, competitions must continue to follow the current 2-pad rule. Draft changes covering how the timer is started and stopped will be published for community feedback in September 2026; this site will update its full text after the official Regulations are released.',
              )}
            </Callout>

            <h3 className="news-sub-title">{t('为什么要改', 'Why the change')}</h3>
            <p className="news-lede">
              {t(
                '两感应垫计时器本身能够精确计时,但成绩成立仍依赖选手完全按规则启动和停止计时器。部分违规动作很难由现场裁判直接发现;逐帧复核录像虽然可行,却耗时且依赖高质量视频。WCA 表示,没有找到只修改规则措辞或沿用现有设备要求就能令人满意地解决问题的方法,因此选择切换到 4-pad 模式。',
                'Two-sensor timers can measure time precisely, but a valid result still depends on the competitor starting and stopping the timer exactly as required. Some infringements are difficult for a judge to see live, while frame-by-frame video review is slow and depends on high-quality footage. The WCA found no satisfactory wording change or other solution that could retain the existing timer requirements, so it chose 4-pad mode.',
              )}
            </p>

            <h3 className="news-sub-title">{t('WCA 认为 4-pad 能解决什么', 'What the WCA expects 4-pad to solve')}</h3>
            <RegList items={[
              t(
                '几乎消除因意外或疏忽造成的计时器违规。',
                'Nearly eliminate timer infringements caused by accidents or carelessness.',
              ),
              t(
                '让通过计时器违规获取不当优势变得极其困难,实际操作上几乎不可行;4-pad 模式下的违规也会更加明显。',
                'Make it extremely difficult and impractical to gain an unfair advantage through a timer infringement, while making infringements in 4-pad mode more apparent.',
              ),
              t(
                '提供基于硬件的解决方案,无需在计时器之外增加设备。',
                'Provide a hardware-based solution without requiring equipment beyond the timer itself.',
              ),
            ]} />

            <h3 className="news-sub-title">{t('评估过但未采用的方案', 'Alternatives considered but not adopted')}</h3>
            <RegList items={[
              t(
                '3D 打印附件:不能完全可靠地阻止启动违规,需要额外设备,也无法阻止停止计时器时的违规。',
                '3D-printed attachments: they would not prevent starting infringements with complete reliability, would require extra equipment, and would not address infringements when stopping the timer.',
              ),
              t(
                '规定魔方必须放在垫子标线处:容易被忘记,难以在所有比赛中切实执行,需要改造设备,同样无法阻止停止计时器时的违规。',
                'A prescribed cube position marked on the mat: the procedure would be easy to forget, unrealistic to enforce at every competition, require modified equipment, and still not address stopping infringements.',
              ),
              t(
                '只加强对顶尖选手的监督:计时器违规并非只发生在顶尖水平,长期依赖志愿者逐帧审查也无法规模化。对于符合规则 11f1 的相关尝试,逐帧录像分析仍可继续使用。',
                'Stricter monitoring of top competitors alone: timer infringements are not confined to the top level, and continual frame-by-frame review is not a scalable use of volunteer resources. Frame-by-frame analysis remains available for relevant attempts under Regulation 11f1.',
              ),
            ]} />

            <Callout tone="info" label={t('WCA 承认单一供应商的取舍', 'The WCA acknowledges the single-supplier trade-off')}>
              {t(
                'WCA 说明,目前唯一可用的 4-pad 计时器由 Speed Stacks 生产,因此这一决定会把 WCA 限制在单一计时器供应商,并约束未来认可其他计时器的空间。WCA 明确认可这一商业取舍,并认为继续使用其历来认可的 Speed Stacks 计时器及最新 4-pad 技术,是目前对组织最有利的选择。',
                'The WCA notes that Speed Stacks currently makes the only available 4-pad timer. The decision therefore limits the WCA to one timer supplier and constrains the possibility of recognizing other timers in the future. The WCA explicitly accepts this commercial trade-off and considers continued use of the Speed Stacks timers it has historically recognized, now with 4-pad technology, the best outcome for the organization.',
              )}
            </Callout>

            <h3 className="news-sub-title">{t('会发生哪些变化', 'What will change')}</h3>
            <RegList items={[
              t(
                '认可计时器要求将由目前的 2-pad 模式以及允许 G3、G4 计时器,改为必须使用 G5 计时器的 4-pad 模式。',
                'The approved-timer requirements will move from today’s 2-pad mode, which also allows G3 and G4 timers, to mandatory G5 timers in 4-pad mode.',
              ),
              t(
                '启动和停止速拧计时器的相关规则会配合 4-pad 模式修订。',
                'The Regulations for starting and stopping the speedsolving timer will be revised for 4-pad mode.',
              ),
              t(
                '目前没有 4-pad 设备的地区会在生效日前收到 G5 计时器,费用与物流由 WCA 承担。',
                'Regions that do not currently have 4-pad-capable equipment will receive G5 timers before the effective date, with the WCA covering costs and logistics.',
              ),
            ]} />

            <h3 className="news-sub-title">{t('纪录与排名如何处理', 'Records and rankings')}</h3>
            <Callout tone="success" label={t('不重置纪录', 'No record reset')}>
              {t(
                'WCA 认为,对绝大多数选手与项目而言,2-pad 和 4-pad 成绩的差异可以忽略。因此现有纪录继续有效,直到被 4-pad 成绩打破;4-pad 成绩也会与 2-pad 成绩共同计入排名。',
                'The WCA considers the difference between 2-pad and 4-pad results negligible for the vast majority of competitors and events. Existing records therefore remain valid until broken by a 4-pad result, and results from both modes will be ranked together.',
              )}
            </Callout>
            <p className="news-lede" style={{ marginTop: 20 }}>
              {t(
                'WCA 排名页还会为二阶、魔表、金字塔和斜转增加筛选,可在“全部成绩”与“4-pad 成绩”之间切换。',
                'The WCA Rankings page will also add a filter for 2×2, Clock, Pyraminx and Skewb, allowing users to switch between all results and 4-pad results.',
              )}
            </p>

            <p className="news-lede">
              {t(
                'WCA 预计,4-pad 成绩会比 2-pad 成绩略慢。对绝大多数选手和项目而言影响可以忽略,但在部分项目的最顶尖水平可能较为明显。因此,切换后可能会有一段时间,计时较短项目的纪录比过去更难打破。根据这些项目顶尖专项选手的反馈,WCA 仍预计现有纪录最终都会被 4-pad 成绩打破。',
                'The WCA expects 4-pad times to be slightly slower than 2-pad times. The effect should be negligible for the vast majority of competitors and events, but may be significant at the very top of some events. Sprint-event records may therefore be harder to break for a period after the switch. Based on feedback from top specialists in those events, the WCA still expects every current record eventually to be broken in 4-pad mode.',
              )}
            </p>

            <h3 className="news-sub-title">{t('过渡期对选手的影响', 'Effect on competitors during the transition')}</h3>
            <p className="news-lede">
              {t(
                'WCA 预计,新选手学习 4-pad 计时器的过程会与目前学习 2-pad 计时器相近。经验较多的选手也可能需要时间适应新操作,但随着使用增加,4-pad 预计会逐渐成为自然习惯。',
                'The WCA expects new competitors to go through a learning process with 4-pad timers similar to the current process for 2-pad timers. More experienced competitors may also need time to adjust, but 4-pad operation is expected to become second nature with continued use.',
              )}
            </p>
            <Callout tone="warn" label={t('A7g 不代表自动获得额外尝试', 'A7g does not make an extra attempt automatic')}>
              {t(
                'WCA 预计,过渡初期可能会有选手因不熟悉新规则而依据 A7g 获得额外尝试,并认为这是可以接受的取舍。按照现行 A7g,是否给予额外尝试由 WCA 代表酌情决定,且相关意外或惩罚必须由选手经验不足所致。',
                'The WCA expects that some competitors may receive extra attempts under Regulation A7g early in the transition because they are unfamiliar with the new Regulations, and considers this an acceptable trade-off. Under the current A7g, an extra attempt is granted only at the WCA Delegate’s discretion, and the incident or penalty must have been caused by the competitor’s inexperience.',
              )}
            </Callout>

            <h3 className="news-sub-title">{t('这项决定是如何形成的', 'How the decision was reached')}</h3>
            <ul className="news-milestones">
              <li className="news-ms">
                <span className="news-ms-date">{t('2025–2026 年初', '2025–early 2026')}</span>
                <span className="news-ms-text">
                  {t(
                    '2025 年至 2026 年初,WCA 规则委员会开始内部调查和讨论,并正式征询顶尖选手;收到的反馈强烈支持切换到 4-pad。',
                    'From 2025 into early 2026, the WCA Regulations Committee investigated and discussed the change internally and formally sought feedback from top competitors; the responses strongly favored a switch to 4-pad.',
                  )}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">2026-04</span>
                <span className="news-ms-text">
                  {t(
                    'WCA 大型锦标赛组、规则委员会和 WCA 管理层(董事会与执行主任)正式讨论这一方案。讨论意见几乎全部支持切换,随后成立了负责过渡实施与物流的小型工作组。',
                    'The WCA Major Championships Team, the Regulations Committee, and WCA executives (the Board and Executive Director) formally discussed the proposal. The discussion was almost entirely in favor, and a smaller group was formed to implement the transition and its logistics.',
                  )}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">2026-05</span>
                <span className="news-ms-text">
                  {t(
                    'WCA 又向相关利益方征求意见:顶尖选手提供不同项目、规则措辞和 4-pad 模式潜在作弊方式方面的反馈,高级代表评估对组织者、代表、新选手和有经验选手的影响。WCA 表示,这一阶段的反馈几乎全部支持对所有选手采用 4-pad。各地区设备存量调查结合与 Speed Stacks 的商业沟通表明,WCA 有资金与物流能力为有需要的地区供应 G5 计时器。',
                    'The WCA then consulted relevant stakeholders: top competitors provided event-specific input on wording and possible cheating in 4-pad mode, while Senior Delegates assessed effects on organizers, Delegates, inexperienced competitors, and experienced competitors. The WCA says feedback at this stage was almost entirely in favor of switching all competitors to 4-pad. An equipment survey, together with commercial discussions with Speed Stacks, indicated that the WCA had the financial and logistical capacity to supply G5 timers where needed.',
                  )}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">{t('2026 年夏季', 'Summer 2026')}</span>
                <span className="news-ms-text">
                  {t(
                    '经 WCA 董事会批准,WCA 正式决定在 2027 年规则周期切换到 4-pad 模式。',
                    'With approval from the WCA Board, the WCA committed to the switch for the 2027 Regulations cycle.',
                  )}
                </span>
              </li>
            </ul>

            <h3 className="news-sub-title">{t('实施时间点', 'Implementation dates')}</h3>
            <ul className="news-milestones">
              <li className="news-ms">
                <span className="news-ms-date">2026-08-23</span>
                <span className="news-ms-text">
                  {t('WCA 正式公布采用 4-pad 计时的决定。', 'The WCA announces its decision to adopt 4-pad timing.')}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">2026-09</span>
                <span className="news-ms-text">
                  {t('计划公布规则修订草案,向社区征求意见。', 'Draft Regulations changes are scheduled for community feedback.')}
                </span>
              </li>
              <li className="news-ms">
                <span className="news-ms-date">2027-01-02</span>
                <span className="news-ms-text">
                  <strong>{t('G5 计时器 4-pad 模式要求正式生效。', 'The G5 timer 4-pad requirement takes effect.')}</strong>
                </span>
              </li>
            </ul>
          </article>

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
                    '自 2014 年斜转以来首个新增的 WCA 官方项目,采用与目前多数项目相同的"五次计平均"(Ao5)赛制。',
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
                    'WCA 董事会指出,魔表与其它项目所用的魔方存在根本性差异:它极易发生比赛事故,难以正确打乱,还需要与其它速拧项目不同的流程或设备;无论从远处判断是否还原、还是观察复原进展都很困难,大幅削弱了观赏性。移除魔表能强化 WCA 作为"专注于三维几何形态转动谜题"的组织定位。',
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

            <Callout tone="info" label={t('① 安静锦标赛(Quiet Championship)', '① Quiet Championship')}>
              {t(
                '各国与地区现在可以设立一个专门承办盲拧系列项目与三阶最少步的独立锦标赛。具体规则见下方《安静锦标赛说明》。',
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

            {/* 安静锦标赛说明(官方 explainer 文档)*/}
            <h3 className="news-sub-title">{t('安静锦标赛说明', 'Quiet Championship explainer')}</h3>
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
                <div className="news-term-name">{t('安静锦标赛(新)', 'Quiet Championship (new)')}<small>Quiet</small></div>
                <p className="news-term-def">
                  {t(
                    '可以承办俗称"安静项目"(PBQ,Please Be Quiet)的锦标赛,包括:三阶盲拧、四阶盲拧、五阶盲拧、三阶多盲、三阶最少步。',
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
                    <th>{t('安静锦标赛', 'Quiet')}</th>
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
            <a href={POST_4_PAD} target="_blank" rel="noopener noreferrer">{t('4-pad 计时公告', '4-pad timing post')}</a>
            {' · '}
            <a href={POST_EVENTS} target="_blank" rel="noopener noreferrer">{t('项目列表变更', 'Events list change')}</a>
            {' · '}
            <a href={POST_POLICY} target="_blank" rel="noopener noreferrer">{t('竞赛要求政策 5.5', 'Requirements Policy 5.5')}</a>
            {' · '}
            <a href={QUIET_DOC} target="_blank" rel="noopener noreferrer">{t('安静锦标赛说明', 'Quiet Championship explainer')}</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
