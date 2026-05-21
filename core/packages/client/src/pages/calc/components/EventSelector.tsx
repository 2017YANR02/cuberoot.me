// NOTE: 项目选择器 — 从 event_selector.js 迁移
// 21 个 WCA 项目按钮(使用 cubing-icons 字体图标)
// 项目顺序 + tooltip 翻译走 utils/wca_events.ts (与 wca-event skill 一致),不重写映射

import { useTranslation } from 'react-i18next';
import { useCalcStore, solveCountForEvent } from '../stores/calc_store';
import { setCurrentEvent } from '../engine/calc_engine';
import { eventDisplayName } from '../../../utils/wca_events';
import { CubingIcon } from '../../../components/EventIcon/EventIcon';

const EVENT_IDS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', 'minx', 'pyram', 'clock',
  'skewb', 'sq1', '444bf', '555bf', '333mbf',
  '333ft', 'magic', 'mmagic', '333mbo',
] as const;

export function EventSelector() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
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
      {EVENT_IDS.map(id => (
        <button
          key={id}
          className={`event-btn ${event === id ? 'active' : ''}`}
          data-tooltip={eventDisplayName(id, isZh)}
          onClick={() => handleSelect(id)}
        >
          <CubingIcon icon={`event-${id}`} />
        </button>
      ))}
    </div>
  );
}

export default EventSelector;
