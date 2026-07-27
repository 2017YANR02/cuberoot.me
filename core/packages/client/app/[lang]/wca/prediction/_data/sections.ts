// Section list for the 3x3 prediction essay, shared by the client view and by
// the server metadata for /wca/prediction/333/<sectionId>. Kept as data-only
// (no hooks, no JSX) so a Server Component can import it — otherwise the tab
// title and the section heading would be two copies of the same list.

export interface PredictionSection {
  id: string;
  labelZh: string;
  labelEn: string;
}

export const SECTIONS: PredictionSection[] = [
  { id: 'tldr',          labelZh: '一句话结论',                  labelEn: 'Top Line'
},
  { id: 'history',       labelZh: '23 年 WR 编年史',              labelEn: '23-Year WR Chronicle'
},
  { id: 'reconstructions', labelZh: '著名复盘 (STM / TPS)',       labelEn: 'Famous Reconstructions'
},
  { id: 'state-space',   labelZh: '状态空间 4.3×10¹⁹',            labelEn: 'State Space 4.3×10¹⁹'
},
  { id: 'gods-number',   labelZh: "God's number 演化",            labelEn: "God's Number Evolution" },
  { id: 'optimal-dist',  labelZh: '最优 HTM 分布',                labelEn: 'Optimal HTM Distribution'
},
  { id: 'metrics',       labelZh: 'HTM / STM / QTM / ATM',        labelEn: 'HTM/STM/QTM/ATM' },
  { id: 'method-cfop',   labelZh: 'CFOP 解剖学',                  labelEn: 'CFOP Anatomy'
},
  { id: 'method-oll',    labelZh: 'OLL 57 case',                  labelEn: 'OLL 57 Cases' },
  { id: 'method-pll',    labelZh: 'PLL 21 case',                  labelEn: 'PLL 21 Cases' },
  { id: 'method-zb',     labelZh: 'ZB / ZBLS / ZBLL',             labelEn: 'ZB / ZBLS / ZBLL' },
  { id: 'method-roux',   labelZh: 'Roux / ZZ / Petrus / Mehta',   labelEn: 'Roux / ZZ / Petrus / Mehta' },
  { id: 'lookahead',     labelZh: 'F2L lookahead 理论',           labelEn: 'F2L Lookahead Theory'
},
  { id: 'inspection',    labelZh: 'Inspection 运筹',              labelEn: 'Inspection Strategy'
},
  { id: 'skips',         labelZh: '幸运打乱 + skip 概率',         labelEn: 'Lucky Scrambles + Skip Probability'
},
  { id: 'hardware',      labelZh: '硬件 1980-2026',                labelEn: 'Hardware 1980-2026'
},
  { id: 'smart-cube',    labelZh: '智能魔方革命',                 labelEn: 'Smart Cube Revolution'
},
  { id: 'biomech',       labelZh: '生物力学: TPS 边界',           labelEn: 'Biomech: TPS Ceiling'
},
  { id: 'cubers',        labelZh: '顶级选手画像',                 labelEn: 'Top Cuber Profiles'
},
  { id: 'training',      labelZh: '训练学方法',                   labelEn: 'Training Methodology'
},
  { id: 'stats',         labelZh: '统计建模',                     labelEn: 'Statistical Modeling'
},
  { id: 'gev',           labelZh: '极值理论 (Gumbel/GEV)',         labelEn: 'GEV Theory'
},
  { id: 'forecast',      labelZh: '综合预测 (single + Ao5)',      labelEn: 'Final Forecast'
},
  { id: 'scenarios',     labelZh: '情景分析',                     labelEn: 'Scenarios' },
  { id: 'caveats',       labelZh: '局限',                         labelEn: 'Caveats'
},
];
