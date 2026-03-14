// NOTE: HTH Grapher 项目选择器 — 精简版，只做"标注当前项目"
// 从 i18n/event_selector.js 提取核心逻辑，适配 calc 浅色主题

// NOTE: 全部 21 个 WCA 项目 ID（标准顺序）
const ALL_EVENT_IDS = [
    '333', '222', '444', '555', '666', '777',
    '333bf', '333fm', '333oh', 'minx', 'pyram', 'clock',
    'skewb', 'sq1', '444bf', '555bf', '333mbf',
    '333ft', 'magic', 'mmagic', '333mbo'
];

// NOTE: 项目 ID → 英文名映射
const EVENT_EN = {
    '333': "Rubik's Cube", '222': '2x2x2 Cube', '444': '4x4x4 Cube',
    '555': '5x5x5 Cube', '666': '6x6x6 Cube', '777': '7x7x7 Cube',
    '333bf': '3x3x3 Blindfolded', '333fm': '3x3x3 Fewest Moves',
    '333oh': '3x3x3 One-Handed', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
    'clock': "Rubik's Clock", 'skewb': 'Skewb', 'sq1': 'Square-1',
    '444bf': '4x4x4 Blindfolded', '555bf': '5x5x5 Blindfolded',
    '333mbf': '3x3x3 Multi-Blind', '333ft': '3x3x3 With Feet',
    'magic': "Rubik's Magic", 'mmagic': 'Master Magic',
    '333mbo': 'Rubik\'s Cube: Multiple blind old style'
};

// NOTE: 项目 ID → 中文名映射
const EVENT_ZH = {
    '333': '三阶', '222': '二阶', '444': '四阶',
    '555': '五阶', '666': '六阶', '777': '七阶',
    '333bf': '三盲', '333fm': '最少步', '333oh': '单手',
    'minx': '五魔', 'pyram': '金字塔', 'clock': '魔表',
    'skewb': '斜转', 'sq1': 'SQ1', '444bf': '四盲',
    '555bf': '五盲', '333mbf': '多盲', '333ft': '脚拧',
    'magic': '八板', 'mmagic': '十二板', '333mbo': '旧多盲'
};

var activeId = '333';     // 当前选中项目
var onSelectCb = null;    // 选择回调
var barEl = null;         // 选择器 DOM 引用

/**
 * NOTE: 初始化事件选择器
 * @param {HTMLElement} container - 挂载容器
 * @param {Function} onSelect - 点击回调 (eventId) => void
 */
export function init(container, onSelect) {
    onSelectCb = onSelect;
    barEl = document.createElement('div');
    barEl.className = 'event-selector';

    ALL_EVENT_IDS.forEach(function (id) {
        var btn = document.createElement('button');
        btn.className = 'event-btn';
        btn.setAttribute('data-event', id);
        btn.setAttribute('data-tooltip', EVENT_EN[id] || id);

        var icon = document.createElement('span');
        icon.className = 'cubing-icon event-' + id;
        btn.appendChild(icon);

        if (id === activeId) btn.classList.add('active');

        btn.addEventListener('click', function () {
            if (id === activeId) return;
            barEl.querySelectorAll('.event-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            activeId = id;
            if (onSelectCb) onSelectCb(id);
        });

        barEl.appendChild(btn);
    });

    container.appendChild(barEl);
}

/**
 * NOTE: 外部设置选中项目（URL 恢复时使用）
 */
export function setEvent(eventId) {
    if (!barEl || !ALL_EVENT_IDS.includes(eventId)) return;
    activeId = eventId;
    barEl.querySelectorAll('.event-btn').forEach(function (b) {
        b.classList.remove('active');
    });
    var btn = barEl.querySelector('.event-btn[data-event="' + eventId + '"]');
    if (btn) btn.classList.add('active');
}

/**
 * NOTE: 获取当前选中项目 ID
 */
export function getEvent() {
    return activeId;
}
