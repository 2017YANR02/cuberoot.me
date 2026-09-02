// 拿方朝向下拉(24 档,csTimer 顺序)—— 全站唯一控件。
// 选项表在 lib/cube-orientation.ts;颜色块复用复盘页的 CubeColorChip。
//
// 消费方:/timer 设置面板、/sim 播放条、/predict 与 /alg 公式图。
import CubeColorChip from '@/components/CubeColorChip/CubeColorChip';
import { CompactSelect } from '@/components/CompactSelect';
import { tr } from '@/i18n/tr';
import { CUBE_COLOR_LETTER_FOR_FACE } from '@/lib/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';

const ORIENTATION_ITEMS = CUBE_ORIENTATIONS.map((option) => {
  const shown = orientedFaceColors(option.value);
  return {
    ...option,
    textValue: option.label,
    label: <><CubeColorChip colors={`${CUBE_COLOR_LETTER_FOR_FACE[shown.U]}${CUBE_COLOR_LETTER_FOR_FACE[shown.F]}`} /> {' '}{option.label}</>,
  };
});

export default function CubeOrientationSelect({
  value, onChange, className, title, ariaLabel,
}: {
  /** 整体转前缀,'' = 不转(UF)。 */
  value: string;
  onChange: (v: string) => void;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const current = ORIENTATION_ITEMS.find((option) => option.value === value);
  const items = current ? ORIENTATION_ITEMS : [...ORIENTATION_ITEMS, { value, label: value }];
  return (
    <CompactSelect
      items={items}
      value={value}
      onChange={onChange}
      label={current?.label ?? value}
      ariaLabel={ariaLabel ?? title ?? tr({ en: 'Cube orientation', zh: '魔方朝向' })}
      valueText={current?.textValue ?? value}
      title={title}
      triggerClassName={className}
      header={tr({
        en: 'Left color: top; right color: front',
        zh: '左色块：顶面，右色块：前面',
      })}
    />
  );
}
