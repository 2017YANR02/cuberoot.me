// NOTE: 项目选择器 — 从 event_selector.js 迁移
// 21 个 WCA 项目按钮（使用 cubing-icons 字体图标）

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore, solveCountForEvent } from '../stores/calc_store';
import { setCurrentEvent } from '../engine/calc_engine';

export function EventSelector() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const event = useCalcStore(s => s.event);
  const setEvent = useCalcStore(s => s.setEvent);
  const resizeTimes = useCalcStore(s => s.resizeTimes);

  // NOTE: 全部 WCA 项目及其 tooltip (tooltip 随语言变化)
  const EVENTS = useMemo(() => [
    { id: '333', tooltip: '3x3x3' },
    { id: '222', tooltip: '2x2x2' },
    { id: '444', tooltip: '4x4x4' },
    { id: '555', tooltip: '5x5x5' },
    { id: '666', tooltip: '6x6x6' },
    { id: '777', tooltip: '7x7x7' },
    { id: '333bf', tooltip: isZh ? '三阶盲拧' : '3x3 Blindfolded' },
    { id: '333fm', tooltip: isZh ? '最少步' : 'Fewest Moves' },
    { id: '333oh', tooltip: isZh ? '三阶单手' : '3x3 OH' },
    { id: 'minx', tooltip: isZh ? '五魔方' : 'Megaminx' },
    { id: 'pyram', tooltip: isZh ? '金字塔' : 'Pyraminx' },
    { id: 'clock', tooltip: isZh ? '魔表' : 'Clock' },
    { id: 'skewb', tooltip: isZh ? '斜转' : 'Skewb' },
    { id: 'sq1', tooltip: 'Square-1' },
    { id: '444bf', tooltip: isZh ? '四阶盲拧' : '4x4 Blindfolded' },
    { id: '555bf', tooltip: isZh ? '五阶盲拧' : '5x5 Blindfolded' },
    { id: '333mbf', tooltip: isZh ? '多盲' : 'Multi-Blind' },
    { id: '333ft', tooltip: isZh ? '三阶脚拧' : '3x3 With Feet' },
    { id: 'magic', tooltip: isZh ? '魔板' : 'Magic' },
    { id: 'mmagic', tooltip: isZh ? '大师魔板' : 'Master Magic' },
    { id: '333mbo', tooltip: isZh ? '旧规则多盲' : 'Multi-Blind Old' },
  ], [isZh]);

  const handleSelect = (id: string) => {
    if (id === event) return;
    setEvent(id);
    setCurrentEvent(id);
    // NOTE: 项目切换 → 调整 times 数组长度（Mo3=3, Ao5=5）
    resizeTimes(solveCountForEvent(id));
  };

  return (
    <div className="event-selector">
      {EVENTS.map(e => (
        <button
          key={e.id}
          className={`event-btn ${event === e.id ? 'active' : ''}`}
          data-tooltip={e.tooltip}
          onClick={() => handleSelect(e.id)}
        >
          <span className={`cubing-icon event-${e.id}`} />
        </button>
      ))}
    </div>
  );
}

export default EventSelector;
