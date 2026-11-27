// 拿方朝向下拉(24 档,csTimer 顺序)—— 全站唯一控件。
// 选项表在 lib/cube-orientation.ts;颜色块复用复盘页的 CubeColorChip。
//
// 消费方:/timer 设置面板、/sim 播放条、/predict 与 /alg 公式图。
import CubeColorChip from './CubeColorChip';
import { CompactSelect } from './CompactSelect';
import type { TimerSettingCopy } from '@cuberoot/shared/timer';
import { CUBE_COLOR_LETTER_FOR_FACE, CUBE_COLOR_NAMES, type CubeFace } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@cuberoot/shared/timer';

const FACE_ORDER = ['U', 'D', 'R', 'L', 'B', 'F'] as const;
const ORIENTATIONS = CUBE_ORIENTATIONS.map(option => ({ ...option, colors: orientedFaceColors(option.value) }));

function orientationItems(tr: (copy: TimerSettingCopy) => string, grid: boolean) {
  const items = ORIENTATIONS.map(option => {
    const shown = option.colors;
    const row = FACE_ORDER.indexOf(shown.U) + 1;
    const column = FACE_ORDER.indexOf(shown.F) + 1;
    const triggerLabel = <CubeColorChip localize={tr} className="cube-orientation-chip" colors={`${CUBE_COLOR_LETTER_FOR_FACE[shown.U]}${CUBE_COLOR_LETTER_FOR_FACE[shown.F]}`} />;
    return {
      ...option,
      textValue: option.label,
      triggerLabel,
      label: grid ? triggerLabel : <>{triggerLabel} {' '}{option.label}</>,
      title: grid ? option.label : undefined,
      gridPosition: grid ? { row, column } : undefined,
      cellIndex: (row - 1) * FACE_ORDER.length + column,
    };
  });
  return grid ? items.sort((a, b) => a.cellIndex - b.cellIndex) : items;
}

export default function CubeOrientationSelect({
  value, onChange, className, title, ariaLabel, layout = 'list', localize: tr,
}: {
  /** 整体转前缀,'' = 不转(UF)。 */
  value: string;
  localize(copy: TimerSettingCopy): string;
  onChange: (v: string) => void;
  className?: string;
  title?: string;
  ariaLabel?: string;
  layout?: 'list' | 'grid' | 'bottom' | 'bottom-front';
}) {
  if (layout === 'bottom' || layout === 'bottom-front') {
    const { D: bottom, F: front } = orientedFaceColors(value);
    const colorOption = (face: CubeFace) => ({
      label: <CubeColorChip localize={tr} colors={CUBE_COLOR_LETTER_FOR_FACE[face]} />,
      tooltip: tr(CUBE_COLOR_NAMES[face]),
    });
    const bottomOption = colorOption(bottom);
    const frontOption = colorOption(front);
    return <div className={`cube-orientation-fields${className ? ` ${className}` : ''}`} role="group"
      title={title} aria-label={ariaLabel ?? tr({ zh: '魔方配色', en: 'Cube colors' })}>
      <div>
        <span>{tr({ zh: '底色', en: 'Bottom' })}</span>
        <CompactSelect<CubeFace> ariaLabel={tr({ zh: '选择底色', en: 'Choose bottom color' })}
          value={bottom} label={bottomOption.label} valueText={bottomOption.tooltip}
          items={FACE_ORDER.map(face => ({ value: face, ...colorOption(face) }))}
          onChange={face => {
            const choices = ORIENTATIONS.filter(option => option.colors.D === face);
            const next = choices.find(option => option.colors.F === front) ?? choices[0];
            if (next) onChange(next.value);
          }} />
      </div>
      {layout === 'bottom-front' && <div>
        <span>{tr({ zh: '前色', en: 'Front' })}</span>
        <CompactSelect ariaLabel={tr({ zh: '选择前色', en: 'Choose front color' })}
          value={value} label={frontOption.label} valueText={frontOption.tooltip}
          items={ORIENTATIONS.filter(option => option.colors.D === bottom)
            .map(option => ({ value: option.value, ...colorOption(option.colors.F) }))}
          onChange={onChange} />
      </div>}
    </div>;
  }
  const grid = layout === 'grid';
  const ORIENTATION_ITEMS = orientationItems(tr, grid);
  const current = ORIENTATION_ITEMS.find((option) => option.value === value);
  const items = current || grid ? ORIENTATION_ITEMS : [...ORIENTATION_ITEMS, { value, label: value }];
  return (
    <CompactSelect
      className="cube-orientation-select"
      popupClassName={grid ? 'cube-orientation-grid' : undefined}
      items={items}
      value={value}
      onChange={onChange}
      label={current?.triggerLabel ?? value}
      ariaLabel={ariaLabel ?? title ?? tr({ en: 'Cube orientation', zh: '魔方朝向' })}
      valueText={current?.textValue ?? value}
      title={title}
      triggerClassName={className}
    />
  );
}
