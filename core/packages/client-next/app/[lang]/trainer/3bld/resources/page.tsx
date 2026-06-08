'use client';

// 盲拧资源 / 3BLD Resources — bilingual curated link list, ported from the
// spooncuber bldtrainer resources.html + download.html.
//
// Pure link list (no engine, nothing persisted). Upstream grouped its links into
// tutorials / hand-technique demos / commutator videos / alg sheets / memory
// methods / tools / advanced / active creators. We keep those sections but:
//   • drop personal QQ numbers + the re-hosted /files/*.xlsx|*.pdf binaries
//     (20MB+). Downloadable sheets are linked to their ORIGINAL public source
//     (blddb.net, the public Google Sheets) when one exists; otherwise omitted.
//   • every external link opens in a new tab with rel="noopener noreferrer".

import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Hand,
  Repeat,
  Table2,
  Brain,
  Wrench,
  GraduationCap,
  Users,
  Library,
  ExternalLink,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../3bld.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface ResLink {
  href: string;
  zh: string;
  en: string;
  /** original author / 出处, shown inline after the title */
  by?: string;
  /** optional one-line description under the title */
  descZh?: string;
  descEn?: string;
    zhHant?: string;
    descZhHant?: string;
}

interface ResSection {
  id: string;
  icon: JSX.Element;
  zh: string;
  en: string;
  noteZh?: string;
  noteEn?: string;
  links: ResLink[];
    zhHant?: string;
    noteZhHant?: string;
}

// Section-level icon size kept consistent (18) with the lucide convention used
// across the 3bld pages.
const SECTIONS: ResSection[] = [
  {
    id: 'collections',
    icon: <Library size={18} />,
    zh: '资源汇总站',
    en: 'Resource hubs',
    links: [
      {
        href: 'https://docs.google.com/document/d/1a82Pt0JEkcgDbq2EqCzPja8NcgPL7MmyqTILTs8KUHA/edit',
        zh: 'Blindfolded Resources',
        en: 'Blindfolded Resources',
        descZh: '英文盲拧资源整合文档。',
        descEn: 'Community-maintained doc of blindfolded-solving resources (English).',
          descZhHant: "英文盲擰資源整合文件。"
    },
      {
        href: 'http://bbs.mf8-china.com/forum.php?mod=forumdisplay&fid=17&mobile=no',
        zh: 'mf8 论坛盲拧专区',
        en: 'mf8 forum — blindfolded board',
        descZh: '国内最早的魔方论坛，沉淀了大量早期盲拧资料。',
        descEn: "One of China's oldest cubing forums; deep archive of early BLD material.",
          zhHant: "mf8 論壇盲擰專區",
          descZhHant: "國內最早的魔方論壇，沉澱了大量早期盲擰資料。"
    },
    ],
      zhHant: "資源彙總站"
},
  {
    id: 'tutorials',
    icon: <BookOpen size={18} />,
    zh: '入门教程',
    en: 'Tutorials',
    links: [
      { href: 'https://b23.tv/NJhSNKA', zh: '《三盲彳亍法教程》', en: '3BLD M2/OP tutorial', by: '勺子 / Zhi Qiao' },
      { href: 'https://b23.tv/leSeijZ', zh: '盲拧公式四阶段学习法', en: '4-stage alg learning method', by: '勺子 / Zhi Qiao',
          zhHant: "盲擰公式四階段學習法"
    },
      { href: 'https://b23.tv/Yp3WNWv', zh: '彳亍法教程', en: '3-style tutorial', by: '王逸帆 / Yifan Wang' },
      { href: 'https://b23.tv/3e02mQj', zh: '彳亍法教程', en: '3-style tutorial', by: '一九四' },
      { href: 'https://b23.tv/FyGSI0d', zh: '高阶盲拧教程', en: 'Advanced BLD tutorial', by: '中国盲拧战队 / China BLD Team',
          zhHant: "高階盲擰教程"
    },
    ],
      zhHant: "入門教程"
},
  {
    id: 'hand-technique',
    icon: <Hand size={18} />,
    zh: '基础手法演示',
    en: 'Fingertrick demos',
    links: [
      { href: 'https://b23.tv/Lo0WHb4', zh: '《挑战全 B 站最清真 EMS 手法》', en: 'Clean EMS execution', by: '王逸帆 / Yifan Wang',
          zhHant: "《挑戰全 B 站最清真 EMS 手法》"
    },
      { href: 'https://b23.tv/igxqHfQ', zh: '《几个重要的三盲手法》', en: 'Key 3BLD fingertricks', by: '谢逸川（熊猫）/ Yichuan Xie',
          zhHant: "《幾個重要的三盲手法》"
    },
      { href: 'https://b23.tv/JfXQGRM', zh: '《三盲中的各种手法》', en: 'Various 3BLD techniques', by: '沈梦非（yuanzi）/ Mengfei Shen',
          zhHant: "《三盲中的各種手法》"
    },
      { href: 'https://b23.tv/2eI448U', zh: '《三盲 818 基础转换机手法》', en: '818 commutator fingertricks', by: '浅梦 / Qianmeng',
          zhHant: "《三盲 818 基礎轉換機手法》"
    },
    ],
      zhHant: "基礎手法演示"
},
  {
    id: 'commutators',
    icon: <Repeat size={18} />,
    zh: '交换子（转换机）教程',
    en: 'Commutator tutorials',
    links: [
      { href: 'https://b23.tv/SCay8Du', zh: '《交换子进阶教程——「转换机」的深入理解》', en: 'Deep dive into commutators (animated)', by: '天方魔 / Tianfangmo',
          zhHant: "《交換子進階教程——「轉換機」的深入理解》"
    },
      { href: 'https://b23.tv/1d36sgN', zh: '《转换机教程》收藏合集', en: 'Commutator tutorial collection', by: '王逸帆 / Yifan Wang',
          zhHant: "《轉換機教程》收藏合集"
    },
      { href: 'https://b23.tv/La7dxzp', zh: '《史上最详细的魔方转换机教程》', en: 'Most-detailed commutator tutorial', by: '一九四',
          zhHant: "《史上最詳細的魔方轉換機教程》"
    },
      { href: 'https://b23.tv/dr5Ofjr', zh: '《魔方转换机理解与应用》', en: 'Understanding & applying commutators', by: '勺子 / Zhi Qiao',
          zhHant: "《魔方轉換機理解與應用》"
    },
      { href: 'https://b23.tv/aZ3SkId', zh: '《6 分钟学习盲拧核心——转换机》', en: 'Commutators in 6 minutes', by: '沈梦非（yuanzi）/ Mengfei Shen',
          zhHant: "《6 分鐘學習盲擰核心——轉換機》"
    },
    ],
      zhHant: "交換子（轉換機）教程"
},
  {
    id: 'alg-sheets',
    icon: <Table2 size={18} />,
    zh: '公式集',
    en: 'Algorithm sheets',
    noteZh: '可下载的离线公式表已链接到其公开来源（公式库 / 公开 Google 表格）。',
    noteEn: 'Downloadable offline sheets are linked to their public source (alg database / public Google Sheets).',
    links: [
      {
        href: 'https://blddb.net/',
        zh: '三盲公式库 blddb.net',
        en: '3BLD algorithm database (blddb.net)',
        by: '王子兴 / Zixing Wang',
        descZh: '最重要的盲拧公式查询网站，可查各类换位子与缓冲。',
        descEn: 'The essential BLD alg lookup site — query commutators across buffers and piece types.',
          zhHant: "三盲公式庫 blddb.net",
          descZhHant: "最重要的盲擰公式查詢網站，可查各類換位子與緩衝。"
    },
      {
        href: 'https://blddb.net/nightmare.html',
        zh: '噩梦公式集网页版',
        en: 'Nightmare alg set (web)',
        by: '王逸帆 / Yifan Wang',
        descZh: '公式库内的噩梦公式集，最后更新 2022-06-01。',
        descEn: 'The Nightmare set inside blddb.net; last updated 2022-06-01.',
          zhHant: "噩夢公式集網頁版",
          descZhHant: "公式庫內的噩夢公式集，最後更新 2022-06-01。"
    },
      {
        href: 'https://docs.google.com/spreadsheets/d/1rchVPtie0Reuyd6rILG44IztwpK2gfwcytxAcW6BdNk/',
        zh: 'Tommy Cherry 公式集',
        en: 'Tommy Cherry alg sheet',
        descZh: '从 Tommy Cherry 复盘视频整理出的公开 Google 表格。',
        descEn: 'Public Google Sheet scraped from Tommy Cherry reconstruction videos.',
          descZhHant: "從 Tommy Cherry 覆盤影片整理出的公開 Google 表格。"
    },
      {
        href: 'https://docs.google.com/spreadsheets/d/1mDsO5xqD0n6U9J31rAZBiZNrkIs6hXeVVvalWpMda_I/',
        zh: 'Charlie Eggins 公式集',
        en: 'Charlie Eggins alg sheet',
        descZh: '从 Charlie Eggins 复盘视频整理出的公开 Google 表格。',
        descEn: 'Public Google Sheet scraped from Charlie Eggins reconstruction videos.',
          descZhHant: "從 Charlie Eggins 覆盤影片整理出的公開 Google 表格。"
    },
      {
        href: 'https://www.bilibili.com/medialist/detail/ml1342117686',
        zh: '《三盲 UR440 手法》视频教程',
        en: '3BLD UR440 video tutorial',
        by: '王逸帆 / Yifan Wang',
          zhHant: "《三盲 UR440 手法》影片教程"
    },
      {
        href: 'https://www.bilibili.com/opus/761363492636721160',
        zh: '《UFR 角块公式分类》图文教程',
        en: 'UFR corner alg classification (article)',
        by: '勺子 / Zhi Qiao',
          zhHant: "《UFR 角塊公式分類》圖文教程"
    },
      {
        href: 'https://www.bilibili.com/opus/1155711807463096323',
        zh: '简版 UF 棱块学习教程',
        en: 'Simplified UF edge learning guide',
        by: '勺子 / Zhi Qiao',
          zhHant: "簡版 UF 稜塊學習教程"
    },
    ],
      noteZhHant: "可下載的離線公式表已連結到其公開來源（公式庫 / 公開 Google 表格）。"
},
  {
    id: 'memory',
    icon: <Brain size={18} />,
    zh: '记忆方法',
    en: 'Memory methods',
    links: [
      { href: 'https://www.bilibili.com/video/BV1ka4y1J7Xc', zh: '《帆式全读》', en: 'Fan-style full reading', by: '王逸帆 / Yifan Wang',
          zhHant: "《帆式全讀》"
    },
      { href: 'https://www.bilibili.com/video/BV1eE411s7wL', zh: '拼音编码动画教程', en: 'Pinyin encoding (animated)', by: '天方魔 / Tianfangmo',
          zhHant: "拼音編碼動畫教程"
    },
      { href: 'https://www.bilibili.com/video/BV1zk4y1g769', zh: '三阶盲拧记忆方法盘点及选择', en: '3BLD memory methods overview', by: '浅梦 / Qianmeng',
          zhHant: "三階盲擰記憶方法盤點及選擇"
    },
      { href: 'https://www.bilibili.com/video/BV1yD421G7Vg', zh: '定桩法介绍（高盲教程四）', en: 'Memory palace / loci method', by: '中国盲拧战队 / China BLD Team',
          zhHant: "定樁法介紹（高盲教程四）"
    },
      { href: 'https://www.bilibili.com/video/BV1J4411G7tQ', zh: '三盲 sub30 心得之记忆方法（节奏）', en: 'Sub-30 memo rhythm tips', by: '一九四',
          zhHant: "三盲 sub30 心得之記憶方法（節奏）"
    },
      { href: 'http://bbs.mf8-china.com/forum.php?mod=viewthread&tid=110508&mobile=no', zh: '详解盲拧记忆读码节奏', en: 'BLD memo reading rhythm (article)', by: '单淳劼 / Chunjie Shan',
          zhHant: "詳解盲擰記憶讀碼節奏"
    },
      { href: 'https://www.bilibili.com/opus/793949233457659976', zh: '首字全读联想词（2023.05 版）', en: 'First-letter association words (2023-05)', by: '勺子 / Zhi Qiao',
          zhHant: "首字全讀聯想詞（2023.05 版）"
    },
    ],
      zhHant: "記憶方法"
},
  {
    id: 'tools',
    icon: <Wrench size={18} />,
    zh: '工具',
    en: 'Tools',
    links: [
      {
        href: 'https://blddb.net/',
        zh: '三盲公式库 blddb.net',
        en: '3BLD algorithm database (blddb.net)',
        by: '王子兴 / Zixing Wang',
        descZh: '查询各类换位子公式。',
        descEn: 'Look up commutator algorithms.',
          zhHant: "三盲公式庫 blddb.net",
          descZhHant: "查詢各類換位子公式。"
    },
      {
        href: 'https://cstimer.net/',
        zh: '网页魔方计时器 csTimer',
        en: 'csTimer (web timer)',
        descZh: '专业计时工具，右下角「盲拧助手」可读码与生成指定类型打乱。',
        descEn: 'Pro timer; its "BLD helper" panel reads codes and generates targeted scrambles.',
          zhHant: "網頁魔方計時器 csTimer",
          descZhHant: "專業計時工具，右下角「盲擰助手」可讀碼與生成指定型別打亂。"
    },
      {
        href: 'https://alg.cubing.net/',
        zh: '公式动态演示工具 alg.cubing.net',
        en: 'alg.cubing.net (alg animator)',
        descZh: '常用于记录复盘解法，也能直接看公式怎么转。',
        descEn: 'Animate any algorithm; widely used for solve reconstructions.',
          zhHant: "公式動態演示工具 alg.cubing.net",
          descZhHant: "常用於記錄覆盤解法，也能直接看公式怎麼轉。"
    },
      {
        href: 'http://zixingwang.com/commutator/cube.html',
        zh: '交换子拆解网站',
        en: 'Commutator decomposer',
        by: '王子兴 / Zixing Wang',
        descZh: '把完整公式拆解为交换子，或把交换子展开为完整公式。',
        descEn: 'Decompose full algs into commutators, or expand commutators back to algs.',
          zhHant: "交換子拆解網站",
          descZhHant: "把完整公式拆解為交換子，或把交換子展開為完整公式。"
    },
      {
        href: 'https://elliottkobelansky.github.io/buffer-trainer/',
        zh: '全缓冲公式训练工具',
        en: 'Full-buffer alg trainer',
        by: 'Elliott Kobelansky',
        descZh: '生成只涉及指定位置的打乱，用于全缓冲公式练习。',
        descEn: 'Generates scrambles limited to chosen positions for full-buffer drilling.',
          zhHant: "全緩衝公式訓練工具",
          descZhHant: "生成只涉及指定位置的打亂，用於全緩衝公式練習。"
    },
      {
        href: 'https://namisama269.github.io/corner-2color-trainer/',
        zh: '角块二面观察法训练工具',
        en: '2-color corner memo trainer',
        descZh: '在指定位置显示只看得到两个面的角块，练习判断第三面颜色。',
        descEn: 'Shows a corner with only two visible faces; practice inferring the third.',
          zhHant: "角塊二面觀察法訓練工具",
          descZhHant: "在指定位置顯示只看得到兩個面的角塊，練習判斷第三面顏色。"
    },
    ],
  },
  {
    id: 'advanced',
    icon: <GraduationCap size={18} />,
    zh: '进阶技术',
    en: 'Advanced topics',
    links: [
      {
        href: 'https://space.bilibili.com/432235186/favlist?fid=1342117686',
        zh: 'B 站收藏夹（转换机 / 帆式彳亍进阶 / 浮动缓冲）',
        en: 'Bilibili favorites (commutators / floating buffer)',
        by: '王逸帆 / Yifan Wang',
          zhHant: "B 站收藏夾（轉換機 / 帆式彳亍進階 / 浮動緩衝）"
    },
      { href: 'http://bbs.mf8-china.com/forum.php?mod=viewthread&tid=110455&mobile=no', zh: '跳编法（固定借位）教程', en: 'Fixed-parity / skip-letter method', by: '勺子 / Zhi Qiao',
          zhHant: "跳編法（固定借位）教程"
    },
      { href: 'https://www.bilibili.com/opus/900597579081842707', zh: '《全二角翻理解教程》图文', en: 'Understanding 2-twist corners (shift method)', by: '勺子 / Zhi Qiao',
          zhHant: "《全二角翻理解教程》圖文"
    },
      {
        href: 'https://www.bilibili.com/video/BV1qe4y197Bv/',
        zh: '未来三盲技术：伪互换 / 浮动 / LTCT',
        en: 'Future 3BLD: pseudo / floating / LTCT',
        by: 'Tommy Cherry (2022 北美锦标赛 / 2022 CubingUSA Nationals)',
        descZh: '全英文，讨论较细节的高级三盲技巧。',
        descEn: 'English talk on advanced 3BLD techniques.',
          zhHant: "未來三盲技術：偽互換 / 浮動 / LTCT",
          descZhHant: "全英文，討論較細節的高階三盲技巧。"
    },
    ],
      zhHant: "進階技術"
},
  {
    id: 'creators',
    icon: <Users size={18} />,
    zh: '活跃 UP 主',
    en: 'Active creators',
    links: [
      { href: 'https://space.bilibili.com/3493086233626637', zh: '中国盲拧战队', en: 'China BLD Team',
          zhHant: "中國盲擰戰隊"
    },
      { href: 'https://space.bilibili.com/432235186', zh: '王逸帆', en: 'Yifan Wang' },
      { href: 'https://space.bilibili.com/243671525', zh: '一九四', en: 'Yijiusi' },
      { href: 'https://space.bilibili.com/942628', zh: '勺子', en: 'Zhi Qiao (Spoon)' },
      { href: 'https://space.bilibili.com/470022293', zh: '浅梦', en: 'Qianmeng',
          zhHant: "淺夢"
    },
      { href: 'https://space.bilibili.com/266974547', zh: '天方魔', en: 'Tianfangmo' },
      { href: 'https://space.bilibili.com/22173573', zh: '沈梦非（yuanzi）', en: 'Mengfei Shen (yuanzi)',
          zhHant: "沈夢非（yuanzi）"
    },
      { href: 'https://space.bilibili.com/405929386', zh: '严宇业（冰冰）', en: 'Yuye Yan (Bingbing)',
          zhHant: "嚴宇業（冰冰）"
    },
    ],
      zhHant: "活躍 UP 主"
},
];

export default function ResourcesPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('盲拧资源', '3BLD Resources', "盲擰資源");

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{tr({ zh: '盲拧资源', en: '3BLD Resources',
            zhHant: "盲擰資源"
        })}</h1>
      </div>

      <p className="bld-res-intro">
        {tr({ zh: '整合了国内外的三盲（3BLD）学习资源：视频与图文教程、交换子讲解、公式集、记忆方法以及常用工具。资源原汇总来自勺子的 bldtrainer，外链均跳转至原作者发布页。', en: 'A curated set of 3BLD learning resources: video & written tutorials, commutator explainers, algorithm sheets, memory methods, and tools. Originally compiled in Zhi Qiao’s bldtrainer; every link points to its original author.',
            zhHant: "整合了國內外的三盲（3BLD）學習資源：影片與圖文教程、交換子講解、公式集、記憶方法以及常用工具。資源原彙總來自勺子的 bldtrainer，外鏈均跳轉至原作者釋出頁。"
        })}
      </p>

      <div className="bld-res-sections">
        {SECTIONS.map((sec) => (
          <section className="bld-res-section" key={sec.id}>
            <div className="bld-res-section-head">
              {sec.icon}
              <h2>{(i18n.language === 'zh-Hant' ? (sec.zhHant ?? sec.zh) : (i18n.language.startsWith('zh') ? sec.zh : sec.en))}</h2>
            </div>
            {(isZh ? sec.noteZh : sec.noteEn) && (
              <p className="bld-res-section-note">{isZh ? sec.noteZh : sec.noteEn}</p>
            )}
            <div className="bld-res-list">
              {sec.links.map((l) => {
                const desc = isZh ? l.descZh : l.descEn;
                return (
                  <a
                    key={l.href + l.en}
                    className="bld-res-link"
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="bld-res-link-title">
                      {(i18n.language === 'zh-Hant' ? (l.zhHant ?? l.zh) : (i18n.language.startsWith('zh') ? l.zh : l.en))}
                      {l.by && <span className="bld-res-link-by">{l.by}</span>}
                      {desc && <span className="bld-res-link-desc">{desc}</span>}
                    </span>
                    <ExternalLink size={14} className="bld-res-link-ext" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
