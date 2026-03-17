// NOTE: iOS 风格滚筒选择器 — 浮动在聚焦的成绩格子上方
// 虚拟滚动 + 3D 透视 + 惯性滚动 + scroll-snap

import { DNF_VALUE, MAX_TIME_VALUE, formatTime } from './calc_engine.js';
import { state } from './state.js';

// ── 常量 ──

var VISIBLE_ITEMS = 5;       // 可视项数（中心 ± 2）
var ITEM_HEIGHT = 32;        // 每项高度 (px)
var FRICTION = 0.92;         // 惯性摩擦系数
var MIN_VELOCITY = 0.5;      // 惯性截止速度 (px/frame)
var SNAP_DURATION = 200;     // snap 动画时长 (ms)
var PICKER_HEIGHT = VISIBLE_ITEMS * ITEM_HEIGHT; // 滚筒总高度

// ── 状态 ──

var pickerEl = null;         // 浮动容器 DOM
var wheelEl = null;          // 滚筒内部容器
var itemEls = [];            // 可视项 DOM 数组

var currentValue = 0;        // 当前选中值 (centiseconds)
var step = 1;                // 当前步进 (centiseconds)
var offset = 0;              // 当前滚动偏移 (px)
var onChange = null;          // 值变更回调
var onConfirm = null;        // 点击高亮区域确认选择的回调
var anchorCell = null;       // 当前锚定的 cell DOM 元素
var hideTimer = null;        // hide() 延迟关闭的 timer ID

// 触摸跟踪
var touchStartY = 0;
var touchStartOffset = 0;
var lastTouchY = 0;
var lastTouchTime = 0;
var velocity = 0;
var animFrame = null;

// ── 初始化 ──

export function init() {
    // NOTE: 创建浮动 picker — 直接挂在 body 上，用 fixed 定位
    pickerEl = document.createElement('div');
    pickerEl.className = 'drum-picker';
    pickerEl.style.display = 'none';

    // 滚筒窗口
    var viewport = document.createElement('div');
    viewport.className = 'drum-viewport';
    viewport.style.height = PICKER_HEIGHT + 'px';

    // 3D 滚筒容器
    wheelEl = document.createElement('div');
    wheelEl.className = 'drum-wheel';

    // 创建可视项 DOM
    for (var i = 0; i < VISIBLE_ITEMS; i++) {
        var item = document.createElement('div');
        item.className = 'drum-item';
        wheelEl.appendChild(item);
        itemEls.push(item);
    }

    viewport.appendChild(wheelEl);

    // 中央高亮条
    var highlightEl = document.createElement('div');
    highlightEl.className = 'drum-highlight';
    // NOTE: 点击中央高亮区域（当前值）时隐藏滚筒并使输入框失焦
    highlightEl.addEventListener('click', function(e) {
        e.stopPropagation();
        // NOTE: 保存回调引用 — hide() 会清除 onConfirm
        var confirmCb = onConfirm;
        hide();
        if (confirmCb) confirmCb();
        else if (anchorCell) anchorCell.blur();
    });
    // NOTE: 移动端 touchstart 的 preventDefault 阻止了 click 事件，
    // 需要用 touchend 检测轻触（移动 < 5px）来隐藏滚筒
    highlightEl.addEventListener('touchend', function(e) {
        var touch = e.changedTouches[0];
        var dy = Math.abs(touch.clientY - touchStartY);
        if (dy < 5) {
            e.stopPropagation();
            var confirmCb = onConfirm;
            hide();
            if (confirmCb) confirmCb();
            else if (anchorCell) anchorCell.blur();
        }
    });
    viewport.appendChild(highlightEl);

    // 上下渐变遮罩
    var maskTop = document.createElement('div');
    maskTop.className = 'drum-mask drum-mask-top';
    viewport.appendChild(maskTop);
    var maskBottom = document.createElement('div');
    maskBottom.className = 'drum-mask drum-mask-bottom';
    viewport.appendChild(maskBottom);

    pickerEl.appendChild(viewport);
    document.body.appendChild(pickerEl);

    // 触摸事件
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);
    // 桌面鼠标拖拽支持
    viewport.addEventListener('mousedown', onMouseDown);
    // NOTE: 桌面端鼠标滚轮控制滚筒
    viewport.addEventListener('wheel', onPickerWheel, { passive: false });

    // NOTE: 阻止 picker 上的 mousedown 夺走 input 焦点
    pickerEl.addEventListener('mousedown', function(e) { e.preventDefault(); });
    pickerEl.addEventListener('touchstart', function(e) {
        // 只阻止默认行为防止失焦，但不阻止冒泡（让 viewport 的 touchstart 正常工作）
    }, { passive: true });

    // NOTE: 全局 touchstart — 点击 picker 和 time-cell 以外的区域时隐藏滚筒
    // 移动端 blur 事件不可靠（numpad 的 preventDefault 会阻止 blur），所以用全局监听兜底
    document.addEventListener('touchstart', function(e) {
        if (!isVisible()) return;
        // 点在 picker 内部或 time-cell 上 → 不隐藏
        if (pickerEl.contains(e.target)) return;
        if (e.target.closest('.time-cell')) return;
        hide();
        if (anchorCell) anchorCell.blur();
    }, { passive: true });

    // NOTE: 页面滚动时隐藏滚筒
    window.addEventListener('scroll', function() {
        if (isVisible()) hide();
    }, { passive: true });
}

// ── 显示/隐藏 ──

export function show(value, cellEl, callback, confirmCallback) {
    // NOTE: 清除旧的 hide 延迟 — 防止前一次 hide() 的 setTimeout 干掉新弹出的滚筒
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    currentValue = value;
    onChange = callback;
    onConfirm = confirmCallback || null;
    anchorCell = cellEl;

    // 固定步进
    step = (state.event === '333fm') ? 100 : 1;

    offset = 0;
    renderItems();
    positionAtCell(cellEl);
    pickerEl.style.display = '';
    pickerEl.classList.remove('drum-hidden');
    pickerEl.classList.add('drum-visible');
}

export function hide() {
    if (!pickerEl || pickerEl.style.display === 'none') return;
    cancelAnimation();
    pickerEl.classList.remove('drum-visible');
    pickerEl.classList.add('drum-hidden');
    hideTimer = setTimeout(function() {
        hideTimer = null;
        pickerEl.style.display = 'none';
        pickerEl.classList.remove('drum-hidden');
    }, 150);
    onChange = null;
    onConfirm = null;
    anchorCell = null;
}

export function isVisible() {
    return pickerEl && pickerEl.style.display !== 'none';
}

// NOTE: 外部更新当前值（不触发回调）
export function updateValue(value) {
    currentValue = value;
    offset = 0;
    renderItems();
}

// ── 定位 ──

// NOTE: 将 picker 中心行与 cell 垂直居中对齐，使选中值和 cell 数字重合
function positionAtCell(cellEl) {
    var rect = cellEl.getBoundingClientRect();
    var pickerWidth = Math.max(rect.width, 80); // 最小宽度 80px

    // NOTE: picker 中心 = cell 中心，即 top = cellCenterY - PICKER_HEIGHT/2
    var cellCenterY = rect.top + rect.height / 2;
    var top = cellCenterY - PICKER_HEIGHT / 2;

    // 防止超出屏幕上下边界
    top = Math.max(4, Math.min(top, window.innerHeight - PICKER_HEIGHT - 4));
    var left = rect.left + rect.width / 2 - pickerWidth / 2;
    // 防止溢出屏幕
    left = Math.max(4, Math.min(left, window.innerWidth - pickerWidth - 4));

    pickerEl.style.left = left + 'px';
    pickerEl.style.top = top + 'px';
    pickerEl.style.width = pickerWidth + 'px';
}

// ── 渲染 ──

function renderItems() {
    var stepsFromCenter = offset / ITEM_HEIGHT;
    var centerIndex = Math.round(stepsFromCenter);
    var fractional = stepsFromCenter - centerIndex;

    for (var i = 0; i < VISIBLE_ITEMS; i++) {
        var slotOffset = i - Math.floor(VISIBLE_ITEMS / 2); // -2 到 +2
        var itemStepOffset = slotOffset + centerIndex;
        var itemValue = currentValue - itemStepOffset * step;

        var el = itemEls[i];

        var minVal = (state.event === '333fm') ? 100 : 1;
        if (itemValue < minVal || itemValue > MAX_TIME_VALUE) {
            el.textContent = '';
            el.style.opacity = '0';
            el.style.transform = 'none';
            continue;
        }

        el.textContent = formatTime(itemValue);

        // 3D 变换
        var distFromCenter = (slotOffset - fractional);
        var angle = distFromCenter * 22; // 每项旋转角度
        var absAngle = Math.abs(angle);
        var opacity = Math.max(0, 1 - absAngle / 50);
        var translateY = distFromCenter * ITEM_HEIGHT;

        el.style.transform = 'translateY(' + translateY + 'px) rotateX(' + angle + 'deg)';
        el.style.opacity = opacity;
    }
}

// ── 鼠标滚轮 ──

// NOTE: 滚筒上鼠标滚轮直接步进调值（带滚动动画）
function onPickerWheel(e) {
    e.preventDefault();
    cancelAnimation();

    // 上滚(deltaY<0) = 值增大 = offset 正方向
    var direction = e.deltaY < 0 ? 1 : -1;
    var newValue = currentValue + direction * step;

    var minVal = (state.event === '333fm') ? 100 : 1;
    if (newValue < minVal || newValue > MAX_TIME_VALUE) return;

    // NOTE: 先设置 offset 产生视觉位移，再 snap 回中心
    // 这样数字会有向上/向下滑动的动画效果
    offset = direction * ITEM_HEIGHT;
    currentValue = newValue;
    renderItems();

    // 平滑 snap 回 offset=0
    var startOffset = offset;
    var startTime = Date.now();
    var duration = 120; // 比触摸 snap 更快

    var tick = function() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(1, elapsed / duration);
        var eased = 1 - Math.pow(1 - progress, 2);
        offset = startOffset * (1 - eased);
        renderItems();
        if (progress < 1) {
            animFrame = requestAnimationFrame(tick);
        } else {
            offset = 0;
            renderItems();
        }
    };
    animFrame = requestAnimationFrame(tick);

    if (onChange) onChange(currentValue);
}

// ── 触摸事件处理 ──

function onTouchStart(e) {
    e.preventDefault();
    cancelAnimation();
    var touch = e.touches[0];
    touchStartY = touch.clientY;
    touchStartOffset = offset;
    lastTouchY = touch.clientY;
    lastTouchTime = Date.now();
    velocity = 0;
}

function onTouchMove(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var deltaY = touch.clientY - touchStartY;
    offset = touchStartOffset - deltaY; // 反转方向

    var now = Date.now();
    var dt = now - lastTouchTime;
    if (dt > 0) {
        velocity = -(touch.clientY - lastTouchY) / dt * 16;
    }
    lastTouchY = touch.clientY;
    lastTouchTime = now;

    renderItems();
}

function onTouchEnd() {
    if (Math.abs(velocity) > MIN_VELOCITY) {
        startInertia();
    } else {
        snapToNearest();
    }
}

// ── 鼠标拖拽 ──

function onMouseDown(e) {
    e.preventDefault();
    cancelAnimation();
    touchStartY = e.clientY;
    touchStartOffset = offset;
    lastTouchY = e.clientY;
    lastTouchTime = Date.now();
    velocity = 0;

    var onMouseMove = function(e2) {
        var deltaY = e2.clientY - touchStartY;
        offset = touchStartOffset - deltaY;
        var now = Date.now();
        var dt = now - lastTouchTime;
        if (dt > 0) {
            velocity = -(e2.clientY - lastTouchY) / dt * 16;
        }
        lastTouchY = e2.clientY;
        lastTouchTime = now;
        renderItems();
    };
    var onMouseUp = function() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (Math.abs(velocity) > MIN_VELOCITY) {
            startInertia();
        } else {
            snapToNearest();
        }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

// ── 惯性动画 ──

function startInertia() {
    cancelAnimation();
    var tick = function() {
        velocity *= FRICTION;
        offset += velocity;
        renderItems();

        if (Math.abs(velocity) < MIN_VELOCITY) {
            snapToNearest();
            return;
        }
        animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);
}

// ── Snap 到最近值 ──

function snapToNearest() {
    cancelAnimation();
    var targetSteps = Math.round(offset / ITEM_HEIGHT);
    var targetOffset = targetSteps * ITEM_HEIGHT;

    var newValue = currentValue - targetSteps * step;
    var minVal = (state.event === '333fm') ? 100 : 1;
    if (newValue < minVal) {
        newValue = minVal;
        targetSteps = Math.round((currentValue - minVal) / step);
        targetOffset = targetSteps * ITEM_HEIGHT;
    }
    if (newValue > MAX_TIME_VALUE) {
        newValue = MAX_TIME_VALUE;
        targetSteps = Math.round((currentValue - MAX_TIME_VALUE) / step);
        targetOffset = targetSteps * ITEM_HEIGHT;
    }

    var startOffset = offset;
    var startTime = Date.now();

    var snapTick = function() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(1, elapsed / SNAP_DURATION);
        var eased = 1 - Math.pow(1 - progress, 3);
        offset = startOffset + (targetOffset - startOffset) * eased;
        renderItems();

        if (progress < 1) {
            animFrame = requestAnimationFrame(snapTick);
        } else {
            offset = 0;
            if (newValue !== currentValue) {
                currentValue = newValue;
                renderItems();
                if (onChange) onChange(currentValue);
            }
        }
    };
    animFrame = requestAnimationFrame(snapTick);
}

function cancelAnimation() {
    if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
    }
}
