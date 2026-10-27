import posts from '@/app/[lang]/regulation/_data/posts-index.json';

// Canonical article metadata shared by headings, indexes, SEO and homepage pins.
export const REG_NEWS = {
  "wic-investigation-2026": {
    "id": "wic-investigation-2026",
    "date": "2026-10",
    "title": {
      "zh": "WCA 廉政委员会关于近期调查的声明",
      "en": "Statement from the WCA Integrity Committee Regarding a Recent Investigation"
    }
  },
  "4-pad-2027": {
    "id": "4-pad-2027",
    "date": "2026-08-23",
    "title": {
      "zh": "WCA 将要求使用四触点计时",
      "en": "WCA to require 4-pad timing"
    }
  },
  "official-events-2026": {
    "id": "official-events-2026",
    "date": "2026-06",
    "title": {
      "zh": "WCA 官方项目列表变更",
      "en": "Changes to the WCA’s list of official events"
    }
  },
  "requirements-policy-5-5": {
    "id": "requirements-policy-5-5",
    "date": "2026-05",
    "title": {
      "zh": "竞赛要求政策更新 5.5",
      "en": "WCA Competition Requirements Policy update 5.5"
    }
  }
} as const;

export const LATEST_REG_NEWS = Object.values(REG_NEWS).reduce((latest, item) =>
  item.date > latest.date ? item : latest,
);

// Retain curated deep links; show one title for each official source in the index.
const curatedSources:Record<string,string>={
 '4-pad-2027':'adoption-of-4-pad-timing-august-2026',
 'official-events-2026':'changes-to-the-wca-s-list-of-official-events-june-2026',
 'requirements-policy-5-5':'wca-competition-requirements-policy-update-5-5-may-2026',
};
export const ALL_NEWS=[...posts,...Object.values(REG_NEWS)];
// Month-only dates sort before dated posts in that month; the displayed date stays unchanged.
const dateSortKey=(date:string)=>/^\d{4}-\d{2}$/.test(date)?date+'-99':date;
export const NEWS_INDEX=[...posts,...Object.values(REG_NEWS).filter(e=>!posts.some(p=>p.id===curatedSources[e.id]))].sort((a,b)=>dateSortKey(b.date).localeCompare(dateSortKey(a.date))||a.id.localeCompare(b.id));
export const LATEST_NEWS=NEWS_INDEX[0];

const postsById = new Map(ALL_NEWS.map(post => [post.id, post]));
export const findRegulationPost = (id: string) => postsById.get(id);

/** Only internal article destinations bind a notice to an article title. */
export function regulationPostForHref(href: string | undefined) {
  if (!href?.startsWith('/') || href.startsWith('//')) return undefined;
  try {
    const url = new URL(href, 'https://cuberoot.me');
    if (url.origin !== 'https://cuberoot.me') return undefined;
    const match = /^\/(?:(?:zh|en)\/)?regulation\/(?:post|news)(?:\/([^/]+)\/?)?$/.exec(url.pathname);
    if (!match) return undefined;
    return findRegulationPost(decodeURIComponent(match[1] || url.hash.slice(1)));
  } catch { return undefined; }
}
