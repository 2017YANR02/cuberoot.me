// Add each announcement here when adding its body to post/_components/NewsArticle.tsx.
// Both pages share titles, dates and article IDs; the hub selects the newest date.
export const REG_NEWS = {
  "wic-investigation-2026": {
    "id": "wic-investigation-2026",
    "date": "2026-10",
    "title": {
      "zh": "WCA 诚信委员会关于近期调查的声明",
      "en": "Statement from the WCA Integrity Committee Regarding a Recent Investigation"
    }
  },
  "4-pad-2027": {
    "id": "4-pad-2027",
    "date": "2026-08-23",
    "title": {
      "zh": "WCA 将要求使用 4-pad 计时",
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
