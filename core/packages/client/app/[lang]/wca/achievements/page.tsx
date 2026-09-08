'use client';

import AppLink from '@/components/AppLink';
import { AchievementMedal, ACHIEVEMENT_TITLES } from '@/components/persons/sections/PersonAchievements';
import { useT } from '@/hooks/useT';
import './achievements.css';

export default function AchievementsPage() {
  const t = useT();
  const badges = [
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
      description: t('满足大满贯条件，且同一项目在世锦赛、洲际赛、国家赛都获得过冠军。以更亮的金色徽章替代该项目的普通大满贯徽章。“全金大满贯”是本站用于区分这一条件的名称。', 'Meet the Grand Slam conditions with first place in all three championship levels in the same event. A brighter gold medal replaces that event’s regular Grand Slam badge. “All-gold Grand Slam” is CubeRoot’s name for this distinction.'),
      href: '/wca/grand-slam?onlyFirst=1',
      link: t('查看全金大满贯选手', 'View all-gold Grand Slam achievers'),
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
  return (
    <main className="wca-achievements-page">
      <header>
        <h1>{t('荣誉徽章', 'Achievement badges')}</h1>
        <p>{t('CubeRoot 根据 WCA 成绩数据设计的自定义荣誉徽章，并非 WCA 官方颁发。满足条件后自动显示在选手主页，展示可能随数据更新而延迟。', 'Custom achievement badges designed by CubeRoot using WCA results, not issued by the WCA. They appear automatically on qualifying person profiles and may lag behind data updates.')}</p>
      </header>
      <div className="wca-achievements-catalog">
        {badges.map(badge => (
          <section className="wca-achievements-entry" key={badge.kind}>
            <AchievementMedal kind={badge.kind} />
            <div>
              <h2>{t(ACHIEVEMENT_TITLES[badge.kind].zh, ACHIEVEMENT_TITLES[badge.kind].en)}</h2>
              <p>{badge.description}</p>
              <AppLink href={badge.href} prefetch={false}>{badge.link}</AppLink>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
