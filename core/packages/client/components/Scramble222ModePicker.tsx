'use client';

/**
 * 2x2 打乱选择器。默认只显示完整状态口径(WCA 官方 11 步 ↔ 最优);计时器随机来源可打开
 * csTimer 已有的专项类型下拉。类型与口径分别持久化,专项类型不会覆盖完整状态口径。
 */
import { tr } from '@/i18n/tr';
import {
  use222Mode,
  use222Type,
} from '@/lib/scramble-222-mode';
import {
  SCRAMBLE_222_TYPE_CATALOG,
  SCRAMBLE_222_TYPES,
  SCRAMBLE_222_UI_LABELS,
  type Scramble222Type,
} from '@cuberoot/shared/timer';
import {
  TimerScramble222Config,
  type TimerScramble222Labels,
} from '@cuberoot/timer-ui';

interface Props {
  active222: boolean;
  /** 计时器等「项目已由上方图标表明」的场景传 false,省掉「2x2 口径」文字(见 ScrambleSourceBar)。 */
  showLabel?: boolean;
  /** 仅计时器随机来源启用:显示 csTimer 的二阶专项打乱类型。 */
  showSpecialTypes?: boolean;
  /** 来源支持的类型子集；WCA 真题会排除只描述生成过程的 3-gen。 */
  typeOptions?: readonly Scramble222Type[];
  /** WCA 专项过滤仍需让用户选择原始 11 步或最优等态。 */
  showModeWithSpecialType?: boolean;
}

export default function Scramble222ModePicker({
  active222,
  showLabel = true,
  showSpecialTypes = false,
  showModeWithSpecialType = false,
  typeOptions = SCRAMBLE_222_TYPES,
}: Props) {
  const [mode, setMode] = use222Mode();
  const [type, setType] = use222Type();
  const typeLabels = Object.fromEntries(
    SCRAMBLE_222_TYPE_CATALOG.map((item) => [item.id, tr(item.label)]),
  ) as Record<Scramble222Type, string>;
  const labels: TimerScramble222Labels = {
    modeAriaLabel: tr(SCRAMBLE_222_UI_LABELS.modeAriaLabel),
    modeLabel: tr(SCRAMBLE_222_UI_LABELS.modeLabel),
    optimal: tr(SCRAMBLE_222_UI_LABELS.optimal),
    type: tr(SCRAMBLE_222_UI_LABELS.type),
    typeAriaLabel: tr(SCRAMBLE_222_UI_LABELS.typeAriaLabel),
    typeOptions: typeLabels,
    wca11Move: tr(SCRAMBLE_222_UI_LABELS.wca11Move),
  };
  return (
    <TimerScramble222Config
      active222={active222}
      labels={labels}
      mode={mode}
      onModeChange={setMode}
      onTypeChange={setType}
      showLabel={showLabel}
      showSpecialTypes={showSpecialTypes}
      showModeWithSpecialType={showModeWithSpecialType}
      type={type}
      typeOptions={typeOptions}
    />
  );
}
