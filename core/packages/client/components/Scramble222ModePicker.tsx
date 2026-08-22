'use client';

/**
 * 2x2 打乱选择器。默认只显示完整状态口径(WCA 官方 11 步 ↔ 最优);计时器随机来源可打开
 * csTimer 已有的专项类型下拉。类型与口径分别持久化,专项类型不会覆盖完整状态口径。
 */
import { tr, useLang } from '@/i18n/tr';
import {
  SCRAMBLE_222_TYPES,
  type Scramble222Type,
  scramble222TypeLabel,
  use222Mode,
  use222Type,
} from '@/lib/scramble-222-mode';
import ScrambleModePickerRow from './ScrambleModePickerRow';
import { VariantSelect } from './VariantSelect';

interface Props {
  active222: boolean;
  /** 计时器等「项目已由上方图标表明」的场景传 false,省掉「2x2 口径」文字(见 ScrambleSourceBar)。 */
  showLabel?: boolean;
  /** 仅计时器随机来源启用:显示 csTimer 的二阶专项打乱类型。 */
  showSpecialTypes?: boolean;
  /** 来源支持的类型子集；WCA 真题会排除只描述生成过程的 3-gen。 */
  typeOptions?: readonly Scramble222Type[];
}

export default function Scramble222ModePicker({
  active222,
  showLabel = true,
  showSpecialTypes = false,
  typeOptions = SCRAMBLE_222_TYPES,
}: Props) {
  const [mode, setMode] = use222Mode();
  const [type, setType] = use222Type();
  const isZh = useLang() === 'zh';
  if (!active222) return null;
  const activeType = typeOptions.includes(type) ? type : 'full';
  return (
    <>
      {showSpecialTypes && (
        <span className="settings-row-tight-group">
          <span className="settings-row-label">{tr({ zh: '类型', en: 'Type' })}</span>
          <VariantSelect
            className="settings-row-control-select"
            value={activeType}
            options={typeOptions}
            onChange={(value) => setType(value as typeof type)}
            isZh={isZh}
            label={scramble222TypeLabel}
            ariaLabel={tr({ zh: '2x2 打乱类型', en: '2x2 scramble type' })}
          />
        </span>
      )}
      {(!showSpecialTypes || activeType === 'full') && (
        <ScrambleModePickerRow
          iconEvent={showLabel ? '222' : undefined}
          label={showLabel ? tr({ zh: '口径', en: 'style' }) : undefined}
          value={mode === 'optimal'}
          onChange={(v) => setMode(v ? 'optimal' : 'wca')}
          onLabel={tr({ zh: '最优', en: 'Optimal' })}
          offLabel={tr({ zh: 'WCA 11 步', en: 'WCA 11-move' })}
          ariaLabel={tr({ zh: '2x2 打乱口径', en: '2x2 scramble style' })}
        />
      )}
    </>
  );
}
