import type { Milestone } from './types';

/** Narrative milestones; references are shared with the model catalog. */
export const MILESTONES: Milestone[] = [
  {
    "id": "invention",
    "year": 1974,
    "period": {
      "zh": "结构的起点",
      "en": "The mechanism begins"
    },
    "title": {
      "zh": "六个面可以独立转动，整体仍保持相连",
      "en": "Independent face turns in a connected object"
    },
    "description": {
      "zh": "厄尔诺·鲁比克在 1974 年做出三阶原型。它首先解决的是结构问题：让不同层相对转动，同时把小块约束在一个整体中。这里把发明年份与之后的商业销售分开；1974 年不是每一款“原版魔方”的上市日期。",
      "en": "Ernő Rubik made the 3×3 prototype in 1974. The initial engineering problem was allowing layers to turn relative to one another while retaining the pieces as one object. The invention year is distinct from subsequent commercial sales; it is not the release date of every cube sold as an original."
    },
    "sourceIds": [
      "hist-rubiks"
    ],
    "cubeIds": [
      "magic-cube-1977"
    ]
  },
  {
    "id": "commercial",
    "year": 1977,
    "period": {
      "zh": "1977–1980",
      "en": "1977–1980"
    },
    "title": {
      "zh": "从匈牙利 Magic Cube 到国际 Rubik’s Cube",
      "en": "From Hungary’s Magic Cube to the international Rubik’s Cube"
    },
    "description": {
      "zh": "1977 年底，魔方在匈牙利进入商业销售；1980 年以 Rubik’s Cube 品牌走向国际市场。早期不同地区、厂家和批次并不完全一致。档案保留原版节点，但不会把几十年的生产批次合成一组看似精确的尺寸、重量和首发价。",
      "en": "Commercial sales began in Hungary in late 1977, followed by the international Rubik’s Cube launch in 1980. Regional manufacturers and production batches differed. The archive keeps the original milestones without assigning one supposedly exact size, weight or launch price to decades of production."
    },
    "sourceIds": [
      "hist-wca",
      "hist-rubiks"
    ],
    "cubeIds": [
      "magic-cube-1977",
      "rubiks-ideal-1980"
    ]
  },
  {
    "id": "competition",
    "year": 1982,
    "period": {
      "zh": "1982–2003",
      "en": "1982–2003"
    },
    "title": {
      "zh": "比赛让硬件性能成为可以讨论的问题",
      "en": "Competition gives hardware performance a practical context"
    },
    "description": {
      "zh": "1982 年布达佩斯举办首届世界魔方锦标赛，2003 年多伦多再次举办世锦赛。赛事和社群留下越来越多可比较的使用记录。与此同时，早期玩家已经讨论弹簧、螺丝和润滑：今天的调节思路有很长的历史，不能把“可调”一概视为近年的发明。",
      "en": "Budapest hosted the first world championship in 1982; the event returned in Toronto in 2003. Competition and communities produced an expanding record of hardware use. Early cubers already discussed springs, screws and lubrication, so adjustability should not be treated as an entirely recent invention."
    },
    "sourceIds": [
      "hist-wca",
      "hist-circular"
    ],
    "cubeIds": [
      "rubiks-ideal-1980"
    ]
  },
  {
    "id": "diy",
    "year": 2008,
    "period": {
      "zh": "早期国产 DIY",
      "en": "Early Chinese DIY"
    },
    "title": {
      "zh": "国甲、国丙、Type D 与圣恩进入玩家工具箱",
      "en": "Type A, Type C, Type D and ShengEn enter cubers’ collections"
    },
    "description": {
      "zh": "2008–2009 年的当年购买帖和使用帖能够确认多个国产系列已经流通。玩家会换轴、调螺丝、磨合，甚至混装不同型号部件。Type A / C / D / F 是历史市场称谓，不能仅凭字母就认定所有批次的厂家和模具完全相同；这一时期不少首发日期和中国价格仍待查。",
      "en": "Contemporary purchase and owner reports confirm several Chinese lines circulating in 2008–2009. Cubers swapped cores, adjusted screws, broke in cubes and combined components. Type A/C/D/F are historical market labels, not proof that every batch shared a manufacturer or mold. Many launch dates and Chinese prices remain unverified."
    },
    "sourceIds": [
      "hist-alpha-old",
      "hist-2009",
      "early-type-d-receipt"
    ],
    "cubeIds": [
      "alpha-i",
      "alpha-v",
      "type-c-ii",
      "historical-type-d",
      "shengen-f-ii"
    ]
  },
  {
    "id": "geometry",
    "year": 2010,
    "period": {
      "zh": "2010–2012",
      "en": "2010–2012"
    },
    "title": {
      "zh": "块形、圆角与防飞棱结构成为主线",
      "en": "Piece geometry, rounded surfaces and retention take center stage"
    },
    "description": {
      "zh": "大雁孤鸿、凌云、轮回、展翅等产品把内部块形和卡脚设计推到前台；轮回在大雁产品线中采用防飞棱卡脚，后续型号继续调整容错和稳定性。海燕 Memory 的打磨路线也说明，性能演进既有新结构，也有对既有结构的加工。容错角度必须结合调校与测法理解。",
      "en": "DaYan’s GuHong, LingYun, LunHui and ZhanChi brought internal geometry and retention features to the foreground. LunHui introduced torpedoes within DaYan’s line, while later designs continued to balance corner cutting and stability. Haiyan Memory illustrates a parallel path through modification of an existing design. Corner-cutting angles depend on setup and measurement."
    },
    "sourceIds": [
      "dayan-guhong-v1-retail",
      "dayan-zhanchi-retail",
      "dayan-lunhui-retail",
      "early-haiyan-memory-review"
    ],
    "cubeIds": [
      "dayan-guhong-v1",
      "dayan-lunhui",
      "dayan-zhanchi",
      "haiyan-memory"
    ]
  },
  {
    "id": "competition-brands",
    "year": 2013,
    "period": {
      "zh": "2013–2015",
      "en": "2013–2015"
    },
    "title": {
      "zh": "魔域、方是和 GAN 带来更多结构路线",
      "en": "MoYu, FangShi and GAN expand the design choices"
    },
    "description": {
      "zh": "幻影、威龙、傲龙与方是霜刃等系列围绕转动、容错、防转角和防飞棱继续改进。GAN 的 357、356S 则连接早期产品与之后的 56 mm 主线。品牌之间的区别不只是“快多少”：尺寸、块体拼装、摩擦感和调节方式开始成为选择型号的重要理由。",
      "en": "HuanYing, WeiLong, AoLong and FangShi ShuangRen developed turning, corner cutting, resistance to corner twists and piece retention. GAN’s 357 and 356S bridge its early designs and later 56 mm line. Size, piece assembly, friction and adjustment offered reasons to choose a model beyond raw turning speed."
    },
    "sourceIds": [
      "moyu-huanying-tc",
      "moyu-weilong-v2-tc",
      "hist-fangshi-founder",
      "gan-357-archive"
    ],
    "cubeIds": [
      "moyu-huanying",
      "moyu-weilong-v2",
      "fangshi-shuangren",
      "gan357"
    ]
  },
  {
    "id": "magnet",
    "year": 2016,
    "period": {
      "zh": "2016–2017",
      "en": "2016–2017"
    },
    "title": {
      "zh": "从无磁速拧到原厂磁力定位",
      "en": "Factory magnetic alignment joins the speed-cube mainstream"
    },
    "description": {
      "zh": "磁铁为接近整层对齐的位置提供反馈与定位感。到 2017 年，GAN356 Air UM / SM、威龙 GTS2 M 等已形成可核查的原厂磁力产品。磁力可以帮助控制，也可能让手感更强、更重；磁力版不天然适合所有人，更不能把某品牌的首款写成整个行业的首创。",
      "en": "Magnets add feedback and alignment near completed layer turns. By 2017, factory magnetic products included the GAN356 Air UM/SM and WeiLong GTS2 M. Magnetic feedback can help control, but stronger or heavier feel is not universally preferable. A brand’s first magnetic model is not automatically the industry’s first."
    },
    "sourceIds": [
      "gan-magnetic-cn",
      "gan-air-sm-official",
      "moyu-gts2m-tc"
    ],
    "cubeIds": [
      "gan356-air-um",
      "gan356-air-sm",
      "moyu-weilong-gts2"
    ]
  },
  {
    "id": "smart",
    "year": 2018,
    "period": {
      "zh": "2018–2020",
      "en": "2018–2020"
    },
    "title": {
      "zh": "智能三阶把转动记录带进软件",
      "en": "Smart cubes turn physical moves into software data"
    },
    "description": {
      "zh": "计客、GAN i、GoCube 和 Rubik’s Connected 等把转动状态传入应用，形成教学、复盘和线上对战能力。是否追踪空间方向、需要充电还是换电池、连接是否稳定，都成为新的性能维度。智能三阶仍有机械手感，不能只用功能数或续航小时数来比较。",
      "en": "GiiKER, GAN i, GoCube and Rubik’s Connected brought move data into apps for learning, reconstruction and online play. Orientation tracking, charging versus replaceable batteries, and connection reliability introduced additional performance dimensions. Mechanical feel still matters; feature counts and battery hours alone do not establish a better cube."
    },
    "sourceIds": [
      "hist-giiker-history",
      "hist-gocube-2019",
      "hist-connected"
    ],
    "cubeIds": [
      "giiker-i3",
      "gocube-edge",
      "rubiks-connected"
    ]
  },
  {
    "id": "accessible-tuning",
    "year": 2020,
    "period": {
      "zh": "普及与旗舰并行",
      "en": "Budget and flagship paths"
    },
    "title": {
      "zh": "低价磁力普及，轴心磁力开始扩展",
      "en": "Budget magnetism expands while core magnets develop"
    },
    "description": {
      "zh": "永骏 MGC 和 RS3 M 2020 等让有磁力、可调节的三阶覆盖更多价位；GAN11 M Pro 则在角棱定位之外加入角块与轴心之间的磁力。两条路线同时发展：一条降低使用门槛，一条增加结构与调节维度。贵和便宜不能代替对版本、调校及个人偏好的分析。",
      "en": "YJ MGC and RS3 M 2020 brought magnetic, adjustable cubes to more price points. GAN11 M Pro added corner-core coupling alongside corner-edge alignment. Accessibility and additional mechanical complexity developed together. Price alone cannot replace analysis of versions, setup and personal preferences."
    },
    "sourceIds": [
      "yj-official-history",
      "yj-mgc-tc",
      "moyu-rs32020-tc",
      "gan-11-official"
    ],
    "cubeIds": [
      "yj-mgc",
      "moyu-rs3m-2020",
      "gan11-m-pro"
    ]
  },
  {
    "id": "maglev",
    "year": 2021,
    "period": {
      "zh": "弹力系统的新选择",
      "en": "Another tension system"
    },
    "title": {
      "zh": "磁悬浮替代部分传统弹簧",
      "en": "Repelling magnets offer an alternative to springs"
    },
    "description": {
      "zh": "磁悬浮用相斥磁环提供回弹力，降低对传统弹簧接触的依赖。2021 年的 RS3 M、威龙 WR M 和 GAN12 能展示这一变化，同时也展示弹簧版与磁悬浮版并存。磁悬浮、角棱定位磁铁和轴心磁力是不同机制，不能把它们混称为一种“全磁”。",
      "en": "MagLev uses repelling magnetic rings for restoring force, reducing reliance on conventional spring contact. The 2021 RS3 M, WeiLong WR M and GAN12 illustrate this transition and the coexistence of spring and MagLev versions. MagLev, corner-edge magnets and core magnets are distinct mechanisms."
    },
    "sourceIds": [
      "moyu-rs32021-tc",
      "moyu-wrm2021-maglev-tc",
      "gan-12"
    ],
    "cubeIds": [
      "moyu-rs3m-2021",
      "moyu-weilong-wrm-2021",
      "gan12"
    ]
  },
  {
    "id": "variants",
    "year": 2022,
    "period": {
      "zh": "2022–2023",
      "en": "2022–2023"
    },
    "title": {
      "zh": "同一代产品开始拥有更多配置层级",
      "en": "One generation can contain several equipment levels"
    },
    "description": {
      "zh": "风三阶 V3、Super RS3 M、RS3 M V5 和孤鸿 Pro 等家族，往往同时包含弹簧、磁悬浮、球轴、不同尺寸或涂层。只写一个型号名、一个价格、一个重量，会把不同配置混在一起。这份档案把报价绑定版本，并在参数里保留配置限制。",
      "en": "Tornado V3, Super RS3 M, RS3 M V5 and GuHong Pro families include different combinations of springs, MagLev, ball cores, sizes and finishes. A single name, price and weight can conflate distinct products. This archive associates prices with versions and retains configuration limits in specifications."
    },
    "sourceIds": [
      "xman-tornado-v3-official",
      "moyu-superrs3-tc",
      "moyu-rs3v5-dual-tc",
      "dayan-guhong-pro-m-retail"
    ],
    "cubeIds": [
      "xman-tornado-v3",
      "moyu-super-rs3m-2022",
      "moyu-rs3m-v5",
      "dayan-guhong-pro-m"
    ]
  },
  {
    "id": "integration",
    "year": 2024,
    "period": {
      "zh": "2024–2025",
      "en": "2024–2025"
    },
    "title": {
      "zh": "智能功能与速拧机构继续结合",
      "en": "Connected features and speed mechanisms converge"
    },
    "description": {
      "zh": "奇艺智能三阶、风 AI、威龙 AI 以及 GAN ui 等让智能方拥有更多速拧结构选择，传统系列仍继续迭代。需要分清魔方本体续航与充电盒补电后的总续航，也要区分厂商标称和实际测试。软件能力与硬件支持会变化，旧版 App 体验不能直接套用到今日产品。",
      "en": "QiYi’s smart cube, Tornado AI, WeiLong AI and GAN ui expand the choice of speed-oriented connected hardware while conventional lines continue evolving. Cube battery life must be distinguished from totals that include a charging case, and advertised figures from tests. App capabilities and support can change after a review."
    },
    "sourceIds": [
      "qiyi-smart-official",
      "xman-tornado-ai-official",
      "moyu-v11ai-official",
      "gan-12-ui-manual"
    ],
    "cubeIds": [
      "qiyi-smart-sc-s",
      "xman-tornado-v4-ai",
      "moyu-weilong-v11-ai",
      "gan12-ui-maglev"
    ]
  },
  {
    "id": "latest",
    "year": 2026,
    "period": {
      "zh": "截至 10 月 7 日",
      "en": "Through October 7"
    },
    "title": {
      "zh": "GAN17、风 V5、PB WR，以及仍在预告中的新品",
      "en": "GAN17, Tornado V5, PB WR and products still at the teaser stage"
    },
    "description": {
      "zh": "GAN17 于 8 月 10 日开售，官方中国首发价为 439 元；国际官网标价单独记录。风 V5、PB WR 也已进入 2026 年产品线。更多磁铁、更细的调节和更高的标称自复位角度，是可记录的结构选择，不是统一性能分数。傲龙 V6 截止日仅确认官方预告，不能与已开售型号混为一谈。",
      "en": "GAN17 went on sale on August 10 with an announced Chinese launch price of CNY 439; its international quote is recorded separately. Tornado V5 and PB WR also joined the 2026 lineup. More magnets, adjustment choices and advertised alignment angles are design specifications, not a standardized score. AoLong V6 remained a confirmed teaser at the cutoff."
    },
    "sourceIds": [
      "gan-17-sina",
      "gan-17-comparison",
      "xman-tornado-v5-official",
      "moyu-pb-official",
      "moyu-aolong-v6-official"
    ],
    "cubeIds": [
      "gan17",
      "xman-tornado-v5",
      "moyu-pb-wr",
      "moyu-aolong-v6"
    ]
  }
];
