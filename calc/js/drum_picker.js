// NOTE: iOS 风格滚筒选择器 — 移动端触摸微调成绩
// 虚拟滚动 + 3D 透视 + 惯性滚动 + scroll-snap

import { DNF_VALUE, MAX_TIME_VALUE, formatTime } from './calc_engine.js';
import { state } from './state.js';

// ── 常量 ──

var VISIBLE_ITEMS = 7;       // 可视项数（中心 ± 3）
var ITEM_HEIGHT = 40;        // 每项高度 (px)
var FRICTION = 0.92;         // 惯性摩擦系数（越大惯性越强）
var MIN_VELOCITY = 0.5;      // 惯性截止速度 (px/frame)
var SNAP_DURATION = 200;     // snap 动画时长 (ms)
var PERSPECTIVE = 200;       // 3D 透视距离 (px)
var CYLINDER_RADIUS = 80;    // 圆柱半径（控制弧度）

// ── 状态 ──

var container = null;        // 外层容器 DOM
var wheelEl = null;          // 滚筒内部容器
var highlightEl = null;      // 中央高亮条
var stepBtns = [];           // 步进按钮 DOM
var itemEls = [];            // 可视项 DOM 数组

var currentValue = 0;        // 当前选中值 (centiseconds)
var step = 1;                // 当前步进 (centiseconds)
var offset = 0;              // 当前滚动偏移 (px)，0 = 当前值居中
var onChange = null;          // 值变更回调

// 触摸跟踪
var touchStartY = 0;
var touchStartOffset = 0;
var lastTouchY = 0;
var lastTouchTime = 0;
var velocity = 0;
var animFrame = null;

// ── 初始化 ──

export function init(parentContainer) {
    container = parentContainer;
    container.className = 'drum-picker';
    container.style.display = 'none';

    // 滚筒窗口
    var viewport = document.createElement('div');
    viewport.className = 'drum-viewport';

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
    highlightEl = document.createElement('div');
    highlightEl.className = 'drum-highlight';
    viewport.appendChild(highlightEl);

    // 上下渐变遮罩
    var maskTop = document.createElement('div');
    maskTop.className = 'drum-mask drum-mask-top';
    viewport.appendChild(maskTop);
    var maskBottom = document.createElement('div');
    maskBottom.className = 'drum-mask drum-mask-bottom';
    viewport.appendChild(maskBottom);

    container.appendChild(viewport);

    // 步进按钮组
    var stepsDiv = document.createElement('div');
    stepsDiv.className = 'drum-steps';
    var stepValues = [1, 10, 100]; // 0.01s, 0.10s, 1.00s
    var stepLabels = ['0.01', '0.10', '1.00'];
    for (var s = 0; s < 3; s++) {
        var btn = document.createElement('button');
        btn.className = 'drum-step-btn';
        btn.textContent = stepLabels[s];
        btn.dataset.step = stepValues[s];
        btn.addEventListener('mousedown', function(e) { e.preventDefault(); });
        btn.addEventListener('touchstart', function(e) { e.preventDefault(); }, { passive: false });
        btn.addEventListener('click', onStepClick);
        stepsDiv.appendChild(btn);
        stepBtns.push(btn);
    }
    container.appendChild(stepsDiv);

    // 触摸事件
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);
    // 桌面鼠标拖拽支持（DevTools 模拟用）
    viewport.addEventListener('mousedown', onMouseDown);
}

// ── 显示/隐藏 ──

export function show(value, callback) {
    currentValue = value;
    onChange = callback;

    // 根据项目设置默认步进
    if (state.event === '333fm') {
        step = 100; // FMC: 1步
        // FMC 模式下只显示一个步进按钮
        stepBtns[0].textContent = '1';
        stepBtns[0].dataset.step = '100';
        stepBtns[1].style.display = 'none';
        stepBtns[2].style.display = 'none';
    } else {
        step = 1;
        stepBtns[0].textContent = '0.01';
        stepBtns[0].dataset.step = '1';
        stepBtns[1].textContent = '0.10';
        stepBtns[1].dataset.step = '10';
        stepBtns[1].style.display = '';
        stepBtns[2].textContent = '1.00';
        stepBtns[2].dataset.step = '100';
        stepBtns[2].style.display = '';
    }
    updateStepHighlight();

    offset = 0;
    renderItems();
    container.style.display = '';
    // 触发进入动画
    container.classList.remove('drum-hidden');
    container.classList.add('drum-visible');
}

export function hide() {
    if (!container || container.style.display === 'none') return;
    cancelAnimation();
    container.classList.remove('drum-visible');
    container.classList.add('drum-hidden');
    // 动画结束后隐藏
    setTimeout(function() {
        container.style.display = 'none';
        container.classList.remove('drum-hidden');
    }, 200);
    onChange = null;
}

export function isVisible() {
    return container && container.style.display !== 'none';
}

// NOTE: 外部更新当前值（不触发回调）
export function updateValue(value) {
    currentValue = value;
    offset = 0;
    renderItems();
}

// ── 渲染 ──

function renderItems() {
    // 计算当前偏移对应的步数
    var stepsFromCenter = offset / ITEM_HEIGHT;
    var centerIndex = Math.round(stepsFromCenter);
    var fractional = stepsFromCenter - centerIndex;

    for (var i = 0; i < VISIBLE_ITEMS; i++) {
        var slotOffset = i - Math.floor(VISIBLE_ITEMS / 2); // -3 到 +3
        var itemStepOffset = slotOffset + centerIndex;
        // NOTE: 上滚 = offset 增加 = 值增加，所以 item 值 = currentValue - itemStepOffset * step
        var itemValue = currentValue - itemStepOffset * step;

        var el = itemEls[i];

        // 边界外显示为空
        var minVal = (state.event === '333fm') ? 100 : 1;
        if (itemValue < minVal || itemValue > MAX_TIME_VALUE) {
            el.textContent = '';
            el.style.opacity = '0';
            el.style.transform = 'none';
            continue;
        }

        el.textContent = formatTime(itemValue);

        // 3D 变换：距离中心越远，旋转角度越大、透明度越低
        var distFromCenter = (slotOffset - fractional);
        var angle = distFromCenter * 18; // 每项旋转 18°
        var absAngle = Math.abs(angle);
        var opacity = Math.max(0, 1 - absAngle / 60);
        var translateY = distFromCenter * ITEM_HEIGHT;
        var translateZ = CYLINDER_RADIUS * (1 - Math.cos(angle * Math.PI / 180)) * -1;

        el.style.transform = 'translateY(' + translateY + 'px) perspective(' + PERSPECTIVE + 'px) rotateX(' + angle + 'deg) translateZ(' + translateZ + 'px)';
        el.style.opacity = opacity;
    }
}

// ── 步进按钮 ──

function onStepClick(e) {
    var newStep = parseInt(e.target.dataset.step);
    if (newStep && newStep !== step) {
        step = newStep;
        // NOTE: 对齐当前值到新步进的整数倍（避免 0.10 步进出现 4.53 这种中间值）
        var minVal = (state.event === '333fm') ? 100 : 1;
        currentValue = Math.max(minVal, Math.round(currentValue / step) * step);
        offset = 0;
        renderItems();
        updateStepHighlight();
        if (onChange) onChange(currentValue);
    }
}

function updateStepHighlight() {
    for (var i = 0; i < stepBtns.length; i++) {
        var isActive = parseInt(stepBtns[i].dataset.step) === step;
        stepBtns[i].classList.toggle('drum-step-active', isActive);
    }
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
    offset = touchStartOffset + deltaY;

    // 计算速度（用于惯性）
    var now = Date.now();
    var dt = now - lastTouchTime;
    if (dt > 0) {
        velocity = (touch.clientY - lastTouchY) / dt * 16; // px/frame (60fps)
    }
    lastTouchY = touch.clientY;
    lastTouchTime = now;

    renderItems();
}

function onTouchEnd() {
    // 如果速度够大，启动惯性动画
    if (Math.abs(velocity) > MIN_VELOCITY) {
        startInertia();
    } else {
        snapToNearest();
    }
}

// ── 鼠标拖拽（桌面 DevTools 调试用） ──

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
        offset = touchStartOffset + deltaY;
        var now = Date.now();
        var dt = now - lastTouchTime;
        if (dt > 0) {
            velocity = (e2.clientY - lastTouchY) / dt * 16;
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
    // 计算最近的步进对齐位置
    var targetSteps = Math.round(offset / ITEM_HEIGHT);
    var targetOffset = targetSteps * ITEM_HEIGHT;

    // 计算新值并应用边界
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

    // 平滑动画到目标
    var startOffset = offset;
    var startTime = Date.now();

    var snapTick = function() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(1, elapsed / SNAP_DURATION);
        // ease-out 缓动
        var eased = 1 - Math.pow(1 - progress, 3);
        offset = startOffset + (targetOffset - startOffset) * eased;
        renderItems();

        if (progress < 1) {
            animFrame = requestAnimationFrame(snapTick);
        } else {
            // snap 完成，更新 currentValue
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
