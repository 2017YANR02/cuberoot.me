'use client';
// 多盲平均(Mo3)等非官方指标的统一小标记:跟在「平均」标签后,弱化超标。
// 单一文案源,避免各页重复写 tooltip。
import { tr } from '@/i18n/tr';

export function UnofficialMark() {
  return (
    <sup
      className="unofficial-mark"
      title={tr({ zh: '多盲平均(Mo3)为非官方统计,WCA 不追踪', en: 'Multi-Blind average (Mo3) is unofficial — not tracked by WCA',
          zhHant: "多盲平均(Mo3)為非官方統計,WCA 不追蹤"
    })}
    >
      {tr({ zh: '非官方', en: 'unofficial' })}
    </sup>
  );
}
