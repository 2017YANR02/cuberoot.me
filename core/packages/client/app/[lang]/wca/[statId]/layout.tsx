import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import { statsUrl } from '@/lib/stats-base';

// The 62 WCA statistics pages all inherited /wca's title, so every one of them
// looked identical in search results. There is no build-time list of valid
// statIds — the /wca index discovers them by fetching /stats/index.json at
// runtime — so the title comes from that same file. Safe to fetch here: the
// route prebuilds no params (generateStaticParams returns none), so this never
// runs during `next build`; a slow static origin can only make a title stale.

interface StatEntry { id: string; titleEn: string; titleZh: string }
interface StatGroup { nameEn: string; nameZh: string; stats: StatEntry[] }

const REVALIDATE = 86400;

async function findStat(id: string): Promise<{ stat: StatEntry; group: StatGroup } | null> {
  try {
    const res = await fetch(statsUrl('/stats/index.json'), {
      next: { revalidate: REVALIDATE, tags: ['wca-stats-index'] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, StatGroup[]>;
    for (const groups of Object.values(data)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        const stat = group.stats?.find((s) => s.id === id);
        if (stat) return { stat, group };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; statId: string }>;
}): Promise<Metadata> {
  const { lang, statId } = await params;
  const hit = await findStat(statId);
  // Unknown or retired id (the page 404s those) — inherit rather than name it.
  if (!hit) return {};
  const { stat, group } = hit;
  return metadataFromEntry(
    {
      title: {
        zh: `${stat.titleZh}:WCA 统计`,
        // Colon keeps the statistic name and section label visually distinct.
        en: `${stat.titleEn}: WCA statistics`,
      },
      description: {
        zh: `${stat.titleZh} —— 基于 WCA 官方成绩数据库的${group.nameZh}统计,可按项目、国家与时间筛选。`,
        en: `${stat.titleEn} — a ${group.nameEn.toLowerCase()} statistic computed from the official WCA results database, filterable by event, country and date.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
