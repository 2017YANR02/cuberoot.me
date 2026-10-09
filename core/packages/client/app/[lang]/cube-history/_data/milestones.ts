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
      "zh": "厄尔诺·鲁比克做出三阶原型：各层能相对转动，小块仍连接成一个整体。",
      "en": "Ernő Rubik built a 3×3 prototype whose layers could turn while its pieces remained connected."
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
      "zh": "1977 年底在匈牙利开始销售，1980 年以 Rubik’s Cube 品牌进入国际市场；不同地区与生产批次逐渐形成各自的版本。",
      "en": "Sales began in Hungary in late 1977. The international Rubik’s Cube launch followed in 1980, with regional and production variants."
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
      "zh": "1982 年布达佩斯举办首届世锦赛，2003 年多伦多重启世锦赛。玩家围绕转动阻力、弹簧、螺丝与润滑积累经验，硬件成为速拧的重要一环。",
      "en": "The first world championship took place in Budapest in 1982; championships resumed in Toronto in 2003. Cubers developed experience with turning resistance, springs, screws and lubrication."
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
      "zh": "2008–2009 年的玩家记录中，国甲、国丙、Type D 与圣恩等国产三阶已出现。换轴、调螺丝、磨合与混装部件成为常见的改装路线。",
      "en": "Player reports from 2008–2009 document Type A, Type C, Type D and ShengEn cubes. Core swaps, screw adjustments, break-in and hybrid builds became familiar modification routes."
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
      "zh": "大雁孤鸿、凌云、轮回和展翅改进块形、容错与防飞棱结构。海燕 Memory 则通过打磨既有结构改善手感，新设计与改装并行发展。",
      "en": "DaYan’s GuHong, LingYun, LunHui and ZhanChi developed piece geometry, corner cutting and retention. Haiyan Memory pursued improved feel through modifications to an existing design."
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
      "zh": "幻影、威龙、傲龙与方是霜刃推进容错和稳定性；GAN357、356S 发展块体拼装。尺寸、摩擦感和调节方式成为各品牌的重要差异。",
      "en": "HuanYing, WeiLong, AoLong and FangShi ShuangRen developed corner cutting and stability. GAN357 and 356S explored piece assembly; size, friction and adjustment helped distinguish the brands."
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
      "zh": "角块与棱块之间的磁铁提供对齐反馈，帮助控制转动。到 2017 年，GAN356 Air UM / SM、威龙 GTS2 M 等原厂磁力型号已进入市场。",
      "en": "Corner-edge magnets add alignment feedback and turning control. By 2017, factory magnetic models included the GAN356 Air UM/SM and WeiLong GTS2 M."
    },
    "sourceIds": [
      "gan-magnetic-cn",
      "gan-air-sm-official",
      "moyu-gts2m-tc"
    ],
    "cubeIds": [
      "gan356-air-um",
      "gan356-air-sm",
      "moyu-weilong-gts2-m"
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
      "zh": "计客、GAN i、GoCube 和 Rubik’s Connected 把转动数据传入应用，支持教学、复盘与线上对战。连接、姿态追踪和续航成为新的硬件指标。",
      "en": "GiiKER, GAN i, GoCube and Rubik’s Connected sent move data to apps for learning, reconstruction and online play. Connectivity, orientation tracking and battery life became additional hardware considerations."
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
      "zh": "永骏 MGC、RS3 M 2020 推动带磁力定位、可调松紧的三阶普及；GAN11 M Pro 在角棱磁力之外加入角轴磁力。入门款降低门槛，旗舰款扩展定位与调校。",
      "en": "YJ MGC and RS3 M 2020 expanded access to magnetic cubes with adjustable tension. GAN11 M Pro added corner-core coupling, extending the alignment and tuning options in flagship designs."
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
      "zh": "2021 年，RS3 M、威龙 WR M 和 GAN12 等推出磁悬浮配置，用相斥磁环提供回弹力。弹簧与磁悬浮成为并行的弹力方案。",
      "en": "In 2021, RS3 M, WeiLong WR M and GAN12 offered MagLev configurations using repelling rings for restoring force. Springs and MagLev became parallel tension-system choices."
    },
    "sourceIds": [
      "moyu-rs32021-tc",
      "moyu-wrm2021-maglev-tc",
      "gan-12"
    ],
    "cubeIds": [
      "moyu-rs3m-2021",
      "moyu-weilong-wr-m-maglev-3x3",
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
      "zh": "风三代、Super RS3 M、RS3 M V5 和孤鸿 Pro 提供更多配置组合：弹簧或磁悬浮、球轴、尺寸与涂层，同代产品覆盖不同需求和价位。",
      "en": "Tornado V3, Super RS3 M, RS3 M V5 and GuHong Pro offered more combinations of springs, MagLev, ball cores, sizes and finishes within one generation."
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
      "zh": "奇艺智能三阶、风 AI、威龙 AI 与 GAN ui 将联网记录融入速拧产品线。传统调校与磁力机构继续演进，同时增加应用训练、对战和充电配套。",
      "en": "QiYi’s smart cube, Tornado AI, WeiLong AI and GAN ui brought connected recording into speedcube lines, combining mechanical tuning with app training, online play and charging accessories."
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
      "zh": "GAN17、风五代与 PB WR 推进轴磁定位与多档调节。GAN17 于 8 月 10 日开售，中国首发价 439 元；截至 10 月 7 日，傲龙 V6 仍处于官方预告阶段。",
      "en": "GAN17, Tornado V5 and PB WR continued developing core magnets and adjustment options. GAN17 launched on August 10 at CNY 439 in China; AoLong V6 remained at the teaser stage on October 7."
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
