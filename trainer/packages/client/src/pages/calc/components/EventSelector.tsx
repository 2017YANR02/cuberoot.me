// NOTE: 项目选择器 — 从 event_selector.js 迁移
// 21 个 WCA 项目按钮（使用 cubing-icons 字体图标）

import { useCalcStore, solveCountForEvent } from '../stores/calc_store';
import { setCurrentEvent } from '../engine/calc_engine';

// NOTE: 全部 WCA 项目及其 tooltip
const EVENTS = [
  { id: '333', tooltip: '3x3x3' },
  { id: '222', tooltip: '2x2x2' },
  { id: '444', tooltip: '4x4x4' },
  { id: '555', tooltip: '5x5x5' },
  { id: '666', tooltip: '6x6x6' },
  { id: '777', tooltip: '7x7x7' },
  { id: '333bf', tooltip: '3x3 Blindfolded' },
  { id: '333fm', tooltip: 'Fewest Moves' },
  { id: '333oh', tooltip: '3x3 OH' },
  { id: 'minx', tooltip: 'Megaminx' },
  { id: 'pyram', tooltip: 'Pyraminx' },
  { id: 'clock', tooltip: 'Clock' },
  { id: 'skewb', tooltip: 'Skewb' },
  { id: 'sq1', tooltip: 'Square-1' },
  { id: '444bf', tooltip: '4x4 Blindfolded' },
  { id: '555bf', tooltip: '5x5 Blindfolded' },
  { id: '333mbf', tooltip: 'Multi-Blind' },
  { id: '333ft', tooltip: '3x3 With Feet' },
  { id: 'magic', tooltip: 'Magic' },
  { id: 'mmagic', tooltip: 'Master Magic' },
  { id: '333mbo', tooltip: 'Multi-Blind Old' },
];

export function EventSelector() {
  const event = useCalcStore(s => s.event);
  const setEvent = useCalcStore(s => s.setEvent);
  const resizeTimes = useCalcStore(s => s.resizeTimes);

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
