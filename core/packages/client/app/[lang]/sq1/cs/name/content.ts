export type BilingualText = { zh: string; en: string };

export const SQ1_SHAPE_GUIDE = {
  caseCount: 29,
  title: { zh: 'Square-1 形状名称', en: 'Square-1 Shape Names' },
  seoDescription: {
    zh: '认识 Square-1 的 29 种单层形状，并通过单层图形练习形状命名。',
    en: 'Learn the 29 single-layer Square-1 shapes, then practise naming them from their silhouettes.',
  },
  kicker: { zh: '单层形状速查', en: 'Single-layer shape guide' },
  intro: {
    zh: 'CS 情况由“顶层 / 底层”两个形状组成。先单独记住这 29 种单层形状，再进入训练练习命名。',
    en: 'Each CS case combines a top and bottom shape. Learn these 29 single-layer shapes first, then practise naming them in the drill.',
  },
  libraryTitle: { zh: '29 种单层形状', en: '29 single-layer shapes' },
  libraryNote: {
    zh: '名称与 CS 公式库保持一致；同一形状只展示一次。',
    en: 'Names match the CS algorithm library, with each shape shown once.',
  },
} satisfies Record<string, number | BilingualText>;
