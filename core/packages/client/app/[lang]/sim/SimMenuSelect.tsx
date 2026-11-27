import { CompactSelect, type CompactSelectItem } from '@/components/CompactSelect';

export default function SimMenuSelect<T extends string>({ ariaLabel, value, items, onChange, disabled }: {
  ariaLabel: string;
  value: T;
  items: readonly CompactSelectItem<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return <CompactSelect
    className="sim-menu-select"
    popupClassName="sim-select-menu"
    ariaLabel={ariaLabel}
    value={value}
    label={items.find(item => item.value === value)?.label ?? value}
    items={items}
    onChange={onChange}
    disabled={disabled}
    keyboardListNavigation
    showArrow
  />;
}
