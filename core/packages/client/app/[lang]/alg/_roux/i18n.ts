'use client';

// Render-layer i18n for the Roux trainer (ported from onionhoney/roux-trainers).
//
// WHY a dictionary instead of translating the data: selector option *names*
// (e.g. "Front FS", "On", "Show") double as engine logic keys — the views
// compare `selector.getActiveName() === "Front FS"` all over the place, and
// Config.ts stores them verbatim. So we MUST keep the English names in the data
// and translate ONLY at the moment of display. `t()` looks the English string up
// in ROUX_ZH and falls through to the original when there's no entry, so cube
// positions (UF/FU…), moves (RUR'…), color codes (WG…) and plain numbers stay
// as-is automatically.

import { useTranslation } from 'react-i18next';

export const ROUX_ZH: Record<string, string> = {
  // ---- shell / topbar ----
  'Roux Trainer': '桥式训练器',
  Roux: '桥式',
  About: '关于',
  'Got it!': '知道了',

  // ---- mode dropdown (RouxTrainer.tab_modes long labels) ----
  // Roux 术语:First Block=左桥, Second Block=右桥, Last Pair=末槽, Square=方块
  'First Block (Fixed)': '左桥 (固定)',
  'First Block Analyzer (x2y | CN)': '左桥分析器 (x2y | CN)',
  'First Block Square': '左桥方块 (FS)',
  'First Block Square + DR edge': '左桥方块 + DR 棱',
  'First Block Last Pair (+ DR edge)': '左桥末槽 (+ DR 棱)',
  'First Block Last Pair + Second Square': '左桥末槽 + 右桥方块',
  'Second Block Square': '右桥方块 (SS)',
  'LSE 4c': 'LSE 4c',
  'EOLR / EOLRb': 'EOLR / EOLRb',
  OLLCP: 'OLLCP',
  'Tracking Trainer (Beta)': '追踪训练器 (Beta)',

  // ---- common view text ----
  FB: '左桥',
  Scramble: '打乱',
  Solutions: '解法',
  Solution: '解法',
  Case: '情况',
  Show: '显示',
  Hide: '隐藏',
  Next: '下一个',
  Reveal: '显示答案',
  Add: '添加',
  Edit: '编辑',
  Select: '选择',
  Close: '关闭',
  Ok: '确定',
  Confirm: '确认',
  Cancel: '取消',
  Yes: '是',
  No: '否',
  'Are you sure?': '确定吗？',

  // ---- selector labels (Config.ts) ----
  'Virtual Cube': '虚拟魔方',
  'Solution Sorting Metrics': '解法排序方式',
  'Show Movecount Hint': '显示步数提示',
  'Color Scheme (U-F)': '配色 (U-F)',
  'Basis (piece considered solved) for FB. Default is L-center solved.':
    'FB 基准块（视作已还原）。默认 L 中心已还原。',
  'Position of square': '方块位置',
  'Square position': '方块位置',
  'Type of scramble': '打乱类型',
  'Pieces to solve': '要解的块',
  'Last Pair pattern': '末槽形态',
  'Position of FB edge': '左桥棱位置',
  'Position of DR': 'DR 位置',
  'Orientation of DR': 'DR 定向',
  'Number of solutions': '解法数量',
  Difficulty: '难度',
  'FBLP Position': '左桥末槽位置',
  'SS Position': '右桥方块位置',
  Center: '中心',
  'EO Pair': 'EO 对',
  Stage: '阶段',
  'Center strategy': '中心策略',
  'Obscure Non-L/R': '遮挡非 L/R',
  'Obscured Sticker Width': '遮挡贴纸宽度',
  'Full Corner Masking': '完全遮挡角块',

  // ---- selector option names (human-readable only; logic keys preserved) ----
  Default: '默认',
  'Hide LSE': '隐藏 LSE',
  None: '无',
  off: '关',
  on: '开',
  Off: '关',
  On: '开',
  'FS at back': 'FS 在后',
  'FS at front': 'FS 在前',
  Either: '均可',
  'Short (Concerning FBDR Pieces only)': '短（仅涉及 FBDR 块）',
  'Random State (Entire cube, useful for practicing F2B)': '随机态（整方块，适合练 F2B）',
  'FB Last Pair + DR': '左桥末槽 + DR',
  'FB Last Pair Only': '仅左桥末槽',
  Random: '随机',
  Solved: '已还原',
  'Front FS': '前 FS',
  'Back FS': '后 FS',
  Both: '两者',
  'Front SS': '前 SS',
  'Back SS': '后 SS',
  Oriented: '已定向',
  Misoriented: '未定向',
  'DR fixed': 'DR 固定',
  'DL Solved': 'DL 已还原',
  'BL Solved': 'BL 已还原',
  Hard: '困难',
  'Hard over x2y (Scramble only)': '对 x2y 都困难（仅打乱）',
  'Front FBLP': '前末槽',
  'Back FBLP': '后末槽',
  Aligned: '对齐',
  Misaligned: '错位',
  '4b for MC(1 move EOPair insert)': '4b（MC，1 步 EOPair 插入）',
  'M2 to 4c': 'M2 到 4c',
  solved: '已还原',
  Short: '短',
  'Random State': '随机态',
  Thin: '细',
  Medium: '中',
  Thick: '粗',
  // EOLRMode (Config.EOLRMode)
  'Only show cases where non-MC is optimal': '仅显示 non-MC 最优的情况',
  'Only show cases where MC is optimal': '仅显示 MC 最优的情况',
  Combined: '合并',
  'Only show MC solutions': '仅显示 MC 解法',
  'Only show non-MC solutions': '仅显示 non-MC 解法',

  // ---- slider ----
  Level: '难度',
  Any: '任意',

  // ---- MultiSelect manipulators ----
  'Toggle Select All': '全选 / 全不选',
  'Toggle All Oriented': '切换全部已定向',

  // ---- CaseSelectView ----
  'Select All': '全选',
  'Deselect All': '全不选',
  'Select CMLL Cases': '选择 CMLL 情况',
  'Select OLLCP Cases': '选择 OLLCP 情况',
  'Select by NMCLL': '按 NMCLL 选择',
  "Select cases by NMCLL recog (this is a separate selection from above, only activated when you're in L/R or F/B mode)":
    '按 NMCLL 识别选择情况（与上方的选择相互独立，仅在 L/R 或 F/B 模式下生效）',

  // ---- CMLL / OLLCP view labels ----
  'Visualize as': '显示方式',
  'Show L face': '显示 L 面',
  'L/R faces to reveal': '显示的 L/R 面',
  'Display recog stickers only': '仅显示识别贴纸',
  'NMCLL Recog Mode': 'NMCLL 识别模式',
  'CMLL Auf': 'CMLL AUF',
  'SB Last Pair Trigger (Uncheck all for pure CMLL)': '右桥末槽触发（全不选 = 纯 CMLL）',
  'Usage: Press space for next case. Enter to redo. / to reveal.':
    '用法：空格 下一个，回车 重做，/ 显示答案。',

  // ---- BlockTrainerView ----
  'Press next for new case': '点击“下一个”生成新情况',
  "Usage: Press space for next case. Enter to redo.\n\nVirtual Cube: I/K (E/D) for M'/M, J/F for U/U'":
    "用法：空格 下一个，回车 重做。\n\n虚拟魔方：I/K (E/D) 对应 M'/M，J/F 对应 U/U'",
  "We weren't able to generate your level within time limit. You can try again -- some levels are reachable within a few tries.":
    '未能在时限内生成该难度，可以再试一次——有些难度多试几次就能出。',

  // ---- Input.tsx (color panel) ----
  Color: '配色',
  'Set color': '应用配色',
  'Orientation and Color Scheme': '朝向与配色',
  'Set Orientation (U-F) and Color Scheme': '设置朝向 (U-F) 与配色',

  // ---- ScrambleInputView ----
  Input: '输入',
  'Input your own solution / scrambles (one per line)': '输入你自己的解法 / 打乱（每行一条）',
  'Use as solution': '作为解法',
  'Use as scramble': '作为打乱',

  // ---- AnalyzerView ----
  Gen: '生成',
  GO: '开始',
  'FB Orientation': '左桥朝向',
  'x2y on W/Y': 'x2y（白/黄）',
  'x2y on B/G': 'x2y（蓝/绿）',
  'x2y on R/O': 'x2y（红/橙）',
  'Color Neutral': '全色中立 (CN)',
  Organize: '组织方式',
  'By FB': '按左桥',
  '# Solutions': '解法数',
  'FB Stage': '左桥阶段',
  'Pseudo FS': '伪 FS',
  'Hints?': '提示？',
  'Input Your Solution': '输入你的解法',
  'Input your reconstructed solution': '输入你复原的解法',
  '(Click to reveal)': '（点击显示）',
  'E-Line + 1c': 'E 线 + 1 角',

  // ---- FavListView ----
  'Delete this alg from favorites?': '从收藏中删除该公式？',
  'Add New Cases': '添加新情况',
  'Add All': '全部添加',
  'Add cases': '添加情况',
  Replay: '重放',
  Delete: '删除',

  // ---- aria-labels (CaseSelectView) ----
  'Select group': '选择该组',
  'Deselect group': '取消该组',
};

/** Translate an English display string to the active language. Falls through to
 *  the original string when there's no entry (positions / moves / numbers). */
export function rt(en: string, isZh: boolean): string {
  if (!isZh) return en;
  return ROUX_ZH[en] ?? en;
}

/** Hook form: `const { t, isZh } = useRT();` then wrap display strings with t(). */
export function useRT() {
  const { i18n } = useTranslation();
  const isZh = !!i18n.language?.startsWith('zh');
  return { isZh, t: (en: string) => rt(en, isZh) };
}
