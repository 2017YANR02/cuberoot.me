'use client';

import AppLink from '@/components/AppLink';
import { ACHIEVEMENT_TITLES, RECORD_ACHIEVEMENT_TIERS } from '@/components/persons/sections/AchievementMedal';
import { AchievementBadge } from '@/components/persons/sections/AchievementBadge';
import { useT } from '@/hooks/useT';
import './achievements.css';
import { EXPLORER_ACHIEVEMENTS, type ExplorerKind } from '@/lib/person-achievements';

export default function AchievementsPage() {
  const t = useT();
  const badges = [
    {
      kind: 'personalMember' as const,
      description: t('CubeRoot 有效个人会员的专属徽章，采用 CubeRoot 原版标志。遵循会员公开展示设置，到期后移除。', 'An exclusive badge for active individual CubeRoot members, featuring the original CubeRoot mark. Respects public membership visibility and is removed after expiry.'),
      href: '/membership', link: t('了解个人会员', 'Explore individual membership'),
    },
    {
      kind: 'enterpriseMember' as const,
      description: t('CubeRoot 有效企业会员的专属徽章，采用 CubeRoot 原版标志。遵循会员公开展示设置，到期后移除。', 'An exclusive badge for active enterprise CubeRoot members, featuring the original CubeRoot mark. Respects public membership visibility and is removed after expiry.'),
      href: '/membership', link: t('了解企业会员', 'Explore enterprise membership'),
    },
    {
      kind: 'hundred' as const,
      description: t('参加过至少 100 场正式 WCA 比赛。同一比赛只计一次，DNF 计入参赛，只有 DNS 的比赛不计。', 'Participate in at least 100 official WCA competitions. Each competition counts once; DNF counts as participation, while DNS-only competitions do not.'),
      href: undefined, link: undefined,
    },
    {
      kind: 'allEvents' as const,
      description: t('所有现役 WCA 项目均有正式有效单次成绩，包含盲拧、最少步和多盲。', 'Record an official successful single in every active WCA event, including blindfolded, fewest moves and multi-blind.'),
      href: undefined, link: undefined,
    },
    {
      kind: 'champion' as const,
      description: t('在 WCA 世锦赛中获得过至少一个项目的冠军。不同年份、不同项目合并为一枚徽章，点击可查看项目明细。', 'Win at least one event at a WCA World Championship. Titles across years and events share one badge; click it to see the events.'),
      href: '/wca/world_championship_podiums_by_person',
      link: t('查看世锦赛选手奖牌榜', 'View World Championship medals by person'),
    },
    {
      kind: 'wr' as const,
      description: t('在现役 WCA 项目中，当前单次或平均世界排名为第一，包括并列第一。多个项目合并为一枚徽章，明细区分单次和平均；排名更新后不再保持纪录时，徽章随之移除。', 'Currently rank first, including ties, in single or average for an active WCA event. One badge groups all qualifying events and distinguishes singles from averages. It disappears when updated rankings no longer qualify.'),
      href: '/wca/records?show=current&region=world',
      link: t('查看当前世界纪录保持者', 'View current world record holders'),
    },
    {
      kind: 'slam' as const,
      description: t('同一个项目在世锦赛、洲际赛、国家赛均获得过前三名，并打破过世界纪录。', 'Reach the podium at world, continental and national championships in the same event, and have broken a world record in that event.'),
      href: '/wca/grand-slam',
      link: t('查看大满贯选手', 'View Grand Slam achievers'),
    },
    {
      kind: 'gold' as const,
      description: t('满足大满贯条件，且同一项目在世锦赛、洲际赛、国家赛都获得过冠军。以更亮的金色徽章替代该项目的普通大满贯徽章。“金牌大满贯”是本站用于区分这一条件的名称。', 'Meet the Grand Slam conditions with first place in all three championship levels in the same event. A brighter gold medal replaces that event’s regular Grand Slam badge. “Gold Medal Grand Slam” is CubeRoot’s name for this distinction.'),
      href: '/wca/grand-slam?onlyFirst=1',
      link: t('查看金牌大满贯选手', 'View Gold Medal Grand Slam achievers'),
    },
    {
      kind: 'historicalWR' as const,
      description: t('该项目的正式单次或平均成绩曾获 WR 标记。', 'An official single or average in this event has received a WR marker.'),
      href: '/wca/records?show=history&region=world',
      link: t('查看历史纪录', 'View record history'),
    },
    {
      kind: 'historicalCR' as const,
      description: t('该项目的正式单次或平均成绩曾获洲际纪录标记，如 AsR、ER、NAR。', 'An official single or average in this event has received a continental record marker, such as AsR, ER or NAR.'),
      href: '/wca/records?show=history&region=asia',
      link: t('查看洲际纪录，可切换大洲', 'View continental records; select a continent'),
    },
    {
      kind: 'historicalNR' as const,
      description: t('该项目的正式单次或平均成绩曾获 NR 标记。', 'An official single or average in this event has received an NR marker.'),
      href: '/wca/records?show=history&region=CN',
      link: t('查看国家纪录，可切换国家', 'View national records; select a country'),
    },
  ];
  const renderBadge = (badge: (typeof badges)[number]) => (
    <section className="wca-achievements-entry" key={badge.kind}>
      <AchievementBadge kind={badge.kind} description={badge.description}>
        {badge.href && <AppLink href={badge.href} prefetch={false}>{badge.link}</AppLink>}
      </AchievementBadge>
      <div>
        <h2>{t(ACHIEVEMENT_TITLES[badge.kind].zh, ACHIEVEMENT_TITLES[badge.kind].en)}</h2>
        <p>{badge.description}</p>
        {badge.href && <AppLink href={badge.href} prefetch={false}>{badge.link}</AppLink>}
      </div>
      {badge.kind.startsWith('historical') && <div className="wca-achievements-tiers">
        {RECORD_ACHIEVEMENT_TIERS.map(tier => <figure key={tier.count}>
          <AchievementBadge kind={badge.kind} recordCount={tier.count} description={badge.description}>
            {badge.href && <AppLink href={badge.href} prefetch={false}>{badge.link}</AppLink>}
          </AchievementBadge>
          <figcaption>{t(tier.zh, tier.en)}</figcaption>
        </figure>)}
      </div>}
    </section>
  );
  return (
    <main className="wca-achievements-page">
      <header>
        <h1>{t('荣誉徽章', 'Achievement badges')}</h1>
        <p>{t('CubeRoot 设计的会员与 WCA 成就徽章。满足条件后自动显示在选手主页，WCA 成就并非官方颁发。', 'Membership and WCA achievement badges designed by CubeRoot appear automatically on qualifying person profiles. WCA achievement badges are not officially issued by the WCA.')}</p>
        <p>{t('纪录徽章按项目和 WR／CR／NR 分别累计，只展示最高等级，角标为实际次数。单次和平均分别计数，包含追平；按成绩的官方纪录标记分类，WR 不重复计入 CR 或 NR。', 'Record badges count each event and WR/CR/NR category separately. Only the highest tier is shown, with the actual count in the corner. Singles and averages count separately, including ties. Official record markers determine the category; WR does not also count as CR or NR.')}</p>
      </header>
      <div className="wca-achievements-catalog">
        {badges.filter(badge => badge.kind.endsWith('Member')).map(renderBadge)}
        {(Object.keys(EXPLORER_ACHIEVEMENTS) as ExplorerKind[]).map(kind => {
          const entry = EXPLORER_ACHIEVEMENTS[kind];
          const description = t(entry.description.zh, entry.description.en);
          return <section className="wca-achievements-entry" key={kind}>
            <AchievementBadge kind={kind} description={description} />
            <div><h2>{t(entry.title.zh, entry.title.en)}</h2><p>{description}</p>
              {entry.stat && <AppLink href={`/wca/${entry.stat}`} prefetch={false}>{t('查看相关统计', 'View related statistics')}</AppLink>}
            </div>
            <div className="wca-achievements-tiers">{(kind === 'worldPodium' ? [1, 2, 3] : [...entry.tiers]).map(level => <figure key={level}>
              <AchievementBadge kind={kind} description={description} achievement={{ kind, count: level, tier: kind === 'worldPodium' ? 1 : level, place: kind === 'worldPodium' ? level : undefined, record: ['storm', 'constellation', 'monument'].includes(kind) ? 'WR' : undefined, evidence: [] }} />
              <figcaption>{kind === 'worldPodium' ? t(['金牌', '银牌', '铜牌'][level - 1], ['Gold', 'Silver', 'Bronze'][level - 1]) : level}</figcaption>
            </figure>)}</div>
          </section>;
        })}
        {badges.filter(badge => !badge.kind.endsWith('Member')).map(renderBadge)}
      </div>
    </main>
  );
}
