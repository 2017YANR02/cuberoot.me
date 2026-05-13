/**
 * Persons / Results 切换器 — 对标 WCA 官方 ranking 顶部.
 * - Results = 每条 valid 成绩一行
 * - Persons = 每个选手只一行(已去重)
 */

export type ShowMode = 'persons' | 'results';

interface Props {
  value: ShowMode;
  onChange: (v: ShowMode) => void;
  isZh: boolean;
}

export default function ShowToggle({ value, onChange, isZh }: Props) {
  return (
    <div className="wse-show-toggle">
      <button
        type="button"
        className={value === 'persons' ? 'active' : ''}
        onClick={() => onChange('persons')}
      >
        {isZh ? '选手' : 'Persons'}
      </button>
      <button
        type="button"
        className={value === 'results' ? 'active' : ''}
        onClick={() => onChange('results')}
      >
        {isZh ? '成绩' : 'Results'}
      </button>
    </div>
  );
}
