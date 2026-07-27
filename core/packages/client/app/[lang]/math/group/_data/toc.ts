// Table of contents for /math/group — the section list, in reading order.
//
// Extracted from page.tsx so NON-CLIENT code can read it: app/sitemap.ts needs
// the 63 slugs to list the section URLs, and [slug]/layout.tsx needs each
// section's bilingual name for its <title>. page.tsx is 'use client', and
// importing it from the sitemap would drag the whole page (and cubing.js) into
// a build-time server module.
//
// Data only — no imports, no JSX — so it is safe from any context.

export const TOC_THEMES: { id: string; zh: string; en: string; descZh: string; descEn: string; range: string; secs: string[]
 }[] = [
  { id: 'foundations', zh: '基础', en: 'Foundations',
    descZh: '公理 · 生成元 · 状态向量 · |G| · 守恒律 · 结构定理',
    descEn: 'axioms · generators · state vector · order · invariants · structure theorem',
    range: '§1 – §6', secs: ['what-is-a-group','cube-group','state-vector','order','invariants','structure']
},
  { id: 'core', zh: '群论核心', en: 'Core group theory',
    descZh: '元素的阶 · 共轭 · 换位子 · 子群链 · 上帝之数',
    descEn: 'element order · conjugation · commutators · Thistlethwaite chain · God\'s number',
    range: '§7 – §11', secs: ['order-of-element','conjugation','commutators','thistlethwaite','gods-number']
},
  { id: 'visual', zh: '拓展 · 几何与图案', en: 'Extensions · geometry & patterns',
    descZh: '走得更远 · 图案画廊 · Cayley 图 · 其它拼图 · 未解问题',
    descEn: 'beyond · pattern gallery · Cayley graph · other puzzles · open problems',
    range: '§12 – §16', secs: ['beyond','patterns','cayley','other-puzzles','open-problems']
},
  { id: 'advanced', zh: '进阶代数', en: 'Advanced algebra',
    descZh: '同态 · 群作用 + Burnside · Lagrange + 陪集 · 商群 · 对称群与交错群',
    descEn: 'homomorphisms · actions + Burnside · Lagrange + cosets · quotients · S_n / A_n',
    range: '§17 – §21', secs: ['homomorphisms','actions-burnside','lagrange','quotient','permutation-groups']
},
  { id: 'computation', zh: '计算 · 算法 · 表示', en: 'Computation · algorithms · representation',
    descZh: '解法算法 · 距离分布 · 随机游走 · BSGS · 表示论一瞥',
    descEn: 'solving algorithms · distance distribution · random walks · BSGS · representation theory',
    range: '§22 – §26', secs: ['algorithms','distance','random-walks','computational','representations']
},
  { id: 'puzzles', zh: '拼图数学 · jaapsch.net', en: 'Puzzle mathematics · jaapsch.net',
    descZh: 'Lights Out · 孔明棋 · Hamilton · PGL₂(𝔽₅) · 图旋转拼图 · 有用数学',
    descEn: 'Lights Out · peg solitaire · Hamilton · PGL₂(𝔽₅) · rotational graph puzzles · useful math',
    range: '§27 – §32', secs: ['lights-out','peg-solitaire','hamiltonian','two-face-pgl','rotational-puzzles','useful-math']
},
  { id: 'structure', zh: '群的结构', en: 'Structure of groups',
    descZh: '圈积、半直积、Sylow、合成列、可解与幂零、阿贝尔分类、自同构群',
    descEn: 'wreath, semidirect, Sylow, series, solvable & nilpotent, abelian, Aut',
    range: '§33 – §39', secs: ['wreath-product','semidirect-product','sylow','composition-series','solvable-nilpotent','abelian-classification','automorphism-group']
},
  { id: 'symmetry', zh: '对称与几何', en: 'Symmetry & geometry',
    descZh: '循环群、二面体群、柏拉图立体、带饰群、墙纸群、点群、Coxeter、平面等距',
    descEn: 'cyclic, dihedral, Platonic solids, frieze, wallpaper, point groups, Coxeter, isometries',
    range: '§40 – §47', secs: ['cyclic-modular','dihedral','platonic-symmetry','frieze-groups','wallpaper-groups','point-groups-crystal','reflection-coxeter','plane-isometries']
},
  { id: 'counting', zh: '计数与表示', en: 'Counting & representation',
    descZh: 'Burnside–Pólya、轮换指标、类方程、特征标表、Young 图、不可约分解、傅里叶',
    descEn: 'Burnside–Pólya, cycle index, class equation, character tables, Young tableaux, irreps, Fourier',
    range: '§48 – §54', secs: ['polya-cube-colorings','cycle-index','class-equation','character-table','young-tableaux','representation-basics','fourier-on-groups']
},
  { id: 'frontiers', zh: '更多群与前沿', en: 'More groups & frontiers',
    descZh: '四元数群、自由群、Cayley 定理、轨道稳定子、矩阵与李群、伽罗瓦、增长、扩张图',
    descEn: 'quaternions, free groups, Cayley, orbit–stabiliser, Lie groups, Galois, growth, expanders',
    range: '§55 – §62', secs: ['quaternion-group','free-groups','cayley-theorem','orbit-stabilizer','matrix-lie-groups','galois-connection','growth-of-groups','expander-ramanujan']
},
];

export const TOC: { id: string; num: string; zh: string; en: string
 }[] = [
  { id: 'what-is-a-group',   num: '1',  zh: '什么是群',                 en: 'What is a group?'
},
  { id: 'cube-group',         num: '2',  zh: '魔方群 G',                 en: 'The cube group G' },
  { id: 'state-vector',       num: '3',  zh: '状态向量 (cp, co, ep, eo)', en: 'State vector'
},
  { id: 'order',              num: '4',  zh: 'G 的阶',                  en: 'The order |G|'
},
  { id: 'invariants',         num: '5',  zh: '三个守恒律 + 证明',         en: 'Three invariants + proofs'
},
  { id: 'structure',          num: '6',  zh: '结构定理',                 en: 'Structure theorem'
},
  { id: 'order-of-element',   num: '7',  zh: '元素的阶',                 en: 'Order of an element'
},
  { id: 'conjugation',        num: '8',  zh: '共轭与共轭类',              en: 'Conjugation'
},
  { id: 'commutators',        num: '9',  zh: '换位子 + 中心',            en: 'Commutators + centre'
},
  { id: 'thistlethwaite',     num: '10', zh: 'Thistlethwaite 子群链',    en: 'Subgroup chain'
},
  { id: 'gods-number',        num: '11', zh: '上帝之数 = 20',           en: "God's number = 20"
},
  { id: 'beyond',             num: '12', zh: '走得更远',                en: 'Beyond the cube'
},
  { id: 'patterns',           num: '13', zh: '著名图案画廊',             en: 'Famous patterns'
},
  { id: 'cayley',             num: '14', zh: 'Cayley 图',              en: 'Cayley graph'
},
  { id: 'other-puzzles',      num: '15', zh: '其它扭转拼图',             en: 'Other twisting puzzles'
},
  { id: 'open-problems',      num: '16', zh: '未解问题',                 en: 'Open problems'
},
  { id: 'homomorphisms',      num: '17', zh: '同态与第一同构定理',        en: 'Homomorphisms'
},
  { id: 'actions-burnside',   num: '18', zh: '群作用 + Burnside',         en: 'Group actions + Burnside' },
  { id: 'lagrange',           num: '19', zh: '拉格朗日定理 + 陪集',        en: 'Lagrange + cosets' },
  { id: 'quotient',           num: '20', zh: '正规子群 + 商群',            en: 'Normal subgroups + quotients'
},
  { id: 'permutation-groups', num: '21', zh: '置换群 Sₙ 与交错群 Aₙ',       en: 'Symmetric & alternating groups'
},
  { id: 'algorithms',         num: '22', zh: '解魔方的算法',               en: 'Solving algorithms'
},
  { id: 'distance',           num: '23', zh: '距离分布与 20 步证明',       en: 'Distance distribution'
},
  { id: 'random-walks',       num: '24', zh: '群上的随机游走',             en: 'Random walks on G'
},
  { id: 'computational',      num: '25', zh: '计算群论:BSGS 与 Schreier–Sims', en: 'Computational group theory'
},
  { id: 'representations',    num: '26', zh: '表示论一瞥',                en: 'A glimpse of representation theory'
},
  { id: 'lights-out',         num: '27', zh: 'Lights Out 与 𝔽₂ 线性代数',  en: 'Lights Out · linear algebra over 𝔽₂'
},
  { id: 'peg-solitaire',      num: '28', zh: '孔明棋 · 三染色不变量',       en: 'Peg solitaire · 3-colouring invariant'
},
  { id: 'hamiltonian',        num: '29', zh: 'Hamilton 路径 + Gray 码',     en: 'Hamiltonian paths + Gray codes'
},
  { id: 'two-face-pgl',       num: '30', zh: '两面 6 角 ≅ PGL₂(𝔽₅) ≅ S₅',  en: 'Two-face corners ≅ PGL₂(𝔽₅) ≅ S₅'
},
  { id: 'rotational-puzzles', num: '31', zh: '图上的旋转拼图 · (x,y,z)',    en: 'Rotational puzzles on graphs · (x,y,z)'
},
  { id: 'useful-math',        num: '32', zh: '有用数学 · 排列可视化',         en: 'Useful mathematics · permutation visualiser'
},
  { id: 'wreath-product',      num: '33', zh: '圈积 Wreath',                en: 'Wreath products'
},
  { id: 'semidirect-product',  num: '34', zh: '半直积',                    en: 'Semidirect products'
},
  { id: 'sylow',               num: '35', zh: 'Sylow 定理',                en: 'Sylow theorems' },
  { id: 'composition-series',  num: '36', zh: '合成列与 Jordan–Hölder',    en: 'Composition series'
},
  { id: 'solvable-nilpotent',  num: '37', zh: '可解群与幂零群',            en: 'Solvable & nilpotent'
},
  { id: 'abelian-classification', num: '38', zh: '有限阿贝尔群基本定理',    en: 'Finite abelian groups'
},
  { id: 'automorphism-group',  num: '39', zh: '自同构群 Aut(G)',           en: 'Automorphism groups'
},
  { id: 'cyclic-modular',      num: '40', zh: '循环群与模算术',            en: 'Cyclic & modular'
},
  { id: 'dihedral',            num: '41', zh: '二面体群 Dₙ',               en: 'Dihedral groups'
},
  { id: 'platonic-symmetry',   num: '42', zh: '柏拉图立体的对称群',        en: 'Platonic symmetry'
},
  { id: 'frieze-groups',       num: '43', zh: '七种带饰群',                en: 'The 7 frieze groups'
},
  { id: 'wallpaper-groups',    num: '44', zh: '十七种墙纸群',              en: 'The 17 wallpaper groups'
},
  { id: 'point-groups-crystal', num: '45', zh: '点群与晶体学',             en: 'Point groups & crystals'
},
  { id: 'reflection-coxeter',  num: '46', zh: '反射群与 Coxeter 群',       en: 'Reflection & Coxeter'
},
  { id: 'plane-isometries',    num: '47', zh: '平面等距群',                en: 'Plane isometries' },
  { id: 'polya-cube-colorings', num: '48', zh: '数立方体染色 (Burnside–Pólya)', en: 'Counting cube colourings'
},
  { id: 'cycle-index',         num: '49', zh: '轮换指标多项式',            en: 'Cycle-index polynomial'
},
  { id: 'class-equation',      num: '50', zh: '类方程',                    en: 'The class equation'
},
  { id: 'character-table',     num: '51', zh: '特征标表',                  en: 'Character tables'
},
  { id: 'young-tableaux',      num: '52', zh: 'Young 图与 Sₙ 表示',        en: 'Young tableaux'
},
  { id: 'representation-basics', num: '53', zh: '表示与不可约分解',        en: 'Representations'
},
  { id: 'fourier-on-groups',   num: '54', zh: '群上的傅里叶分析',          en: 'Fourier on groups'
},
  { id: 'quaternion-group',    num: '55', zh: '四元数群 Q₈',              en: 'Quaternion group Q₈'
},
  { id: 'free-groups',         num: '56', zh: '自由群与约简字',            en: 'Free groups'
},
  { id: 'cayley-theorem',      num: '57', zh: 'Cayley 定理',              en: "Cayley's theorem" },
  { id: 'orbit-stabilizer',    num: '58', zh: '轨道–稳定子定理',          en: 'Orbit–stabiliser'
},
  { id: 'matrix-lie-groups',   num: '59', zh: '矩阵群与李群',              en: 'Matrix & Lie groups'
},
  { id: 'galois-connection',   num: '60', zh: '伽罗瓦理论与可解性',        en: 'Galois & solvability'
},
  { id: 'growth-of-groups',    num: '61', zh: '群的增长',                  en: 'Growth of groups'
},
  { id: 'expander-ramanujan',  num: '62', zh: '扩张图与 Ramanujan 图',     en: 'Expanders & Ramanujan'
},
  { id: 'refs',               num: 'REF', zh: '参考文献',                   en: 'References'
},
];


/** Every section slug, in reading order. */
export const TOC_SLUGS: string[] = TOC.map((t) => t.id);
