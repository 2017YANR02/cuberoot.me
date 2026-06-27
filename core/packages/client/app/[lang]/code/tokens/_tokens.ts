// Token manifest for /code/tokens. The light/dark values here mirror app/globals.css
// (:root for light, html[data-theme=dark] for dark). They are NOT re-derived at
// build time — instead tests/code-tokens-drift.test.ts re-reads globals.css and
// asserts these stay in sync, so any change to a token value that isn't reflected
// here turns CI red. Keep `txt` as the human-facing short label.

export type Kind = 'surface' | 'text' | 'brand' | 'signal' | 'border';
export interface Swatch { css: string; txt: string; }
export interface Token { name: string; kind: Kind; light: Swatch; dark: Swatch; zh: string; en: string; }
export interface Group { id: string; zh: string; en: string; tokens: Token[]; }

export const GROUPS: Group[] = [
  {
    id: 'surfaces', zh: '背景与表面', en: 'Surfaces',
    tokens: [
      { name: '--background', kind: 'surface', light: { css: '#fafafa', txt: '#fafafa' }, dark: { css: '#171717', txt: '#171717' }, zh: '页面主背景', en: 'Page background' },
      { name: '--card', kind: 'surface', light: { css: '#FFFFFF', txt: '#FFFFFF' }, dark: { css: '#1f1f1f', txt: '#1f1f1f' }, zh: '卡片 / 面板背景', en: 'Card / panel surface' },
      { name: '--popover', kind: 'surface', light: { css: '#FFFFFF', txt: '#FFFFFF' }, dark: { css: '#262626', txt: '#262626' }, zh: '浮层 / 下拉 / 弹窗', en: 'Popover / dropdown / dialog' },
      { name: '--muted', kind: 'surface', light: { css: '#f5f5f5', txt: '#f5f5f5' }, dark: { css: '#262626', txt: '#262626' }, zh: '弱化区块背景', en: 'Muted block surface' },
    ],
  },
  {
    id: 'text', zh: '文字', en: 'Text',
    tokens: [
      { name: '--foreground', kind: 'text', light: { css: '#171717', txt: '#171717' }, dark: { css: '#ededed', txt: '#ededed' }, zh: '主文字', en: 'Primary text' },
      { name: '--muted-foreground', kind: 'text', light: { css: '#737373', txt: '#737373' }, dark: { css: '#a3a3a3', txt: '#a3a3a3' }, zh: '副信息 / 说明文字', en: 'Secondary / caption text' },
      { name: '--faint-foreground', kind: 'text', light: { css: '#a3a3a3', txt: '#a3a3a3' }, dark: { css: '#737373', txt: '#737373' }, zh: '占位 / 禁用 / 弱化文字', en: 'Placeholder / disabled text' },
    ],
  },
  {
    id: 'brand', zh: '品牌强调', en: 'Brand',
    tokens: [
      { name: '--accent', kind: 'brand', light: { css: '#C15F3C', txt: '#C15F3C' }, dark: { css: '#d97757', txt: '#d97757' }, zh: '品牌强调 (terracotta)', en: 'Brand accent (terracotta)' },
      { name: '--accent-soft', kind: 'brand', light: { css: 'color-mix(in srgb, #C15F3C 8%, transparent)', txt: 'accent 8%' }, dark: { css: 'color-mix(in srgb, #d97757 16%, transparent)', txt: 'accent 16%' }, zh: 'accent 弱化背景 (tag / 选中底)', en: 'Soft accent (tag / selected bg)' },
      { name: '--ring', kind: 'border', light: { css: '#C15F3C', txt: '= accent' }, dark: { css: '#d97757', txt: '= accent' }, zh: 'focus ring', en: 'Focus ring' },
    ],
  },
  {
    id: 'signals', zh: '状态色', en: 'Signals',
    tokens: [
      { name: '--signal-success', kind: 'signal', light: { css: '#5aac7e', txt: '#5aac7e' }, dark: { css: '#5aac7e', txt: '#5aac7e' }, zh: '成功 / 正向', en: 'Success' },
      { name: '--signal-warning', kind: 'signal', light: { css: '#d4a259', txt: '#d4a259' }, dark: { css: '#d4a259', txt: '#d4a259' }, zh: '警告', en: 'Warning' },
      { name: '--signal-info', kind: 'signal', light: { css: '#4a9eff', txt: '#4a9eff' }, dark: { css: '#4a9eff', txt: '#4a9eff' }, zh: '信息', en: 'Info' },
      { name: '--destructive', kind: 'signal', light: { css: '#e05c5c', txt: '#e05c5c' }, dark: { css: '#e05c5c', txt: '#e05c5c' }, zh: '危险 / 删除', en: 'Danger / destructive' },
      { name: '--toggle-on', kind: 'signal', light: { css: '#34c759', txt: '#34c759' }, dark: { css: '#30d158', txt: '#30d158' }, zh: '开关开启态 (iOS 绿 / PillToggle)', en: 'Toggle on (iOS green / PillToggle)' },
    ],
  },
  {
    id: 'borders', zh: '边框', en: 'Borders',
    tokens: [
      { name: '--border-default', kind: 'border', light: { css: '#e5e5e5', txt: '#e5e5e5' }, dark: { css: 'color-mix(in srgb, #ededed 10%, transparent)', txt: 'fg 10%' }, zh: '默认边框 / 分隔线', en: 'Default border / divider' },
      { name: '--border-strong', kind: 'border', light: { css: '#d4d4d4', txt: '#d4d4d4' }, dark: { css: 'color-mix(in srgb, #ededed 20%, transparent)', txt: 'fg 20%' }, zh: '强边框', en: 'Strong border' },
      { name: '--input', kind: 'border', light: { css: '#e5e5e5', txt: '#e5e5e5' }, dark: { css: 'color-mix(in srgb, #ededed 10%, transparent)', txt: 'fg 10%' }, zh: '输入框边框', en: 'Input border' },
    ],
  },
];
