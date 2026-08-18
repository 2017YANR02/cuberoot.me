/**
 * 公式标签的展示名(站长 1LLL 表里的 `[oh]` / `[fmc]` 等)。
 * 列表(AlgCategoryView)和元数据弹窗(AlgCaseMetaModal)共用 —— 弹窗被列表 import,
 * 常量放列表里会绕成循环依赖,所以落在这。语义见 docs/1lll-migration.md。
 */
import type { AlgTag } from '@cuberoot/shared';
import { tr } from '@/i18n/tr';

export const OH_TAG_LABEL = {
  left: () => tr({ zh: '左单', en: 'Left OH' }),
  right: () => tr({ zh: '右单', en: 'Right OH' }),
} as const;

export const ALG_TAG_LABEL: Record<AlgTag, () => string> = {
  oh: OH_TAG_LABEL.left,
  ft: () => tr({ zh: '脚拧', en: 'Feet' }),
  fmc: () => tr({ zh: '最少步', en: 'FMC' }),
  big: () => tr({ zh: '高阶', en: 'Big cube' }),
  key: () => tr({ zh: '键盘', en: 'Keyboard' }),
};

export const ALG_TAGS = Object.keys(ALG_TAG_LABEL) as AlgTag[];
