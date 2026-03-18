// NOTE: 图表柱子拖动交互 — Tap-Select + Handle 拖动
// 移动端优先：tap 选中柱子 → 出现 Handle → 拖动 Handle 调整成绩值

import { state, updateTime, solveCount } from './state.js';
import { isMbf } from './state.js';
import { DNF_VALUE, MAX_TIME_VALUE, formatTime } from './calc_engine.js';
import {
    getSvgEl, getChartContainer, yToVal, valToY, valToYCap,
    BAR_START, BAR_W, STRIDE, SHADES, getGp, render as chartRender
} from './chart.js';

// ── 状态 ──

var selected = null;    // { player, slot, rectEl } — 当前选中的柱子
var dragging = false;   // 是否正在拖动
var dragStartY = 0;     // pointerdown 时的屏幕 Y
var dragStartX = 0;     // pointerdown 时的屏幕 X（用于判断 tap vs drag）
var originalVal = 0;    // 开始拖动时的原始值
var handleEl = null;    // HTML: pill 形 handle 元素
var tooltipEl = null;   // HTML: 浮动数值气泡
var ghostEl = null;     // SVG: 原始位置虚线轮廓

// NOTE: tap 判定阈值 — 位移 < 8px 且时间 < 300ms 视为 tap
var TAP_DIST = 8;
var TAP_TIME = 300;
var pointerDownTime = 0;

// ── 初始化 ──

export function initDrag() {
    var svg = getSvgEl();
    var container = getChartContainer();
    if (!svg || !container) return;

    // NOTE: 确保 container 是定位参考
    container.style.position = 'relative';

    // 创建 Handle DOM
    handleEl = document.createElement('div');
    handleEl.className = 'bar-drag-handle';
    handleEl.style.display = 'none';
    container.appendChild(handleEl);

    // 创建浮动数值气泡
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'bar-drag-tooltip';
    tooltipEl.style.display = 'none';
    container.appendChild(tooltipEl);

    // NOTE: 事件委托 — 在 SVG 上监听 pointerdown
    svg.addEventListener('pointerdown', onSvgPointerDown);

    // NOTE: Handle 上的拖动事件
    handleEl.addEventListener('pointerdown', onHandlePointerDown);

    // NOTE: 点击空白区域取消选中（document 级别，低优先级）
    document.addEventListener('pointerdown', onDocumentPointerDown);
}

// ── SVG pointerdown — 检测 tap 柱子 ──

function onSvgPointerDown(e) {
    // 已在拖动中则忽略
    if (dragging) return;

    // NOTE: 检测是否 tap 到了柱子或柱顶数字标签
    var bar = e.target.closest('.chart-bar');
    var label = e.target.closest('.chart-bar-label');
    var target = bar || label;
    if (!target) return;

    var p = parseInt(target.getAttribute('data-player'));
    var t = parseInt(target.getAttribute('data-slot'));
    if (isNaN(p) || isNaN(t)) return;

    // 记录 pointerdown 坐标和时间
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    pointerDownTime = Date.now();

    // 绑定临时监听器判断 tap vs drag
    var onUp = function(eu) {
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointermove', onMove);

        var dx = eu.clientX - dragStartX;
        var dy = eu.clientY - dragStartY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var elapsed = Date.now() - pointerDownTime;

        if (dist < TAP_DIST && elapsed < TAP_TIME) {
            // 判定为 tap — 选中/切换柱子
            // NOTE: 如果点击的是标签而非柱子本身，需要查找对应的 rect
            var rectEl = bar || getSvgEl().querySelector(
                '.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]'
            );
            selectBar(p, t, rectEl);
        }
    };
    var onMove = function(em) {
        var dx = em.clientX - dragStartX;
        var dy = em.clientY - dragStartY;
        if (Math.sqrt(dx * dx + dy * dy) > TAP_DIST) {
            // 位移超阈值 — 不是 tap，清除监听器
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointermove', onMove);
        }
    };
    document.addEventListener('pointerup', onUp, { once: false });
    document.addEventListener('pointermove', onMove);
}

// ── 选中/取消选中柱子 ──

function selectBar(p, t, rectEl) {
    // 如果点击已选中的同一个柱子 — 取消选中
    if (selected && selected.player === p && selected.slot === t) {
        deselect();
        return;
    }

    // 先清除上一次选中
    deselect();

    var val = state.times[state.seedOn + p][t];
    // NOTE: 空柱子和 DNF 不可拖动
    if (val <= 0 || val >= DNF_VALUE) return;

    selected = { player: p, slot: t, rectEl: rectEl };

    // NOTE: 添加 SVG class 实现视觉效果
    var svg = getSvgEl();
    svg.classList.add('bar-selected');
    rectEl.classList.add('bar-active');

    // NOTE: 定位 Handle 和 Tooltip
    positionHandleAndTooltip(val);
    handleEl.style.display = '';
    tooltipEl.style.display = '';

    // NOTE: Handle 颜色跟随选手
    handleEl.classList.toggle('player-b', p === 1);
}

function deselect() {
    if (!selected) return;

    var svg = getSvgEl();
    svg.classList.remove('bar-selected');
    if (selected.rectEl) {
        selected.rectEl.classList.remove('bar-active');
    }

    handleEl.style.display = 'none';
    tooltipEl.style.display = 'none';
    removeGhost();

    selected = null;
    dragging = false;
}

// ── Handle 定位 ──

// NOTE: 将 SVG viewBox 坐标转为容器内 CSS 坐标
function svgPointToContainer(svgX, svgY) {
    var svg = getSvgEl();
    var container = getChartContainer();
    var ctm = svg.getScreenCTM();
    var containerRect = container.getBoundingClientRect();

    // SVG viewBox → 屏幕坐标
    var screenX = ctm.a * svgX + ctm.c * svgY + ctm.e;
    var screenY = ctm.b * svgX + ctm.d * svgY + ctm.f;

    // 屏幕 → 容器内坐标
    return {
        x: screenX - containerRect.left,
        y: screenY - containerRect.top
    };
}

function positionHandleAndTooltip(val) {
    if (!selected) return;
    var p = selected.player;
    var t = selected.slot;

    // 计算柱顶 SVG 坐标
    var barCenterX = BAR_START + t * STRIDE + BAR_W / 2;
    var barTopY = valToYCap(val);

    // 转为容器内 CSS 坐标
    var pos = svgPointToContainer(barCenterX, barTopY);

    handleEl.style.left = pos.x + 'px';
    handleEl.style.top = pos.y + 'px';

    // 气泡在 handle 上方
    tooltipEl.textContent = formatTime(val);
    tooltipEl.style.left = pos.x + 'px';
    tooltipEl.style.top = (pos.y - 36) + 'px';
}

// ── Handle 拖动 ──

function onHandlePointerDown(e) {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();

    dragging = true;
    var p = selected.player;
    var t = selected.slot;
    originalVal = state.times[state.seedOn + p][t];

    // NOTE: 捕获 pointer 确保移出元素后仍能跟踪
    handleEl.setPointerCapture(e.pointerId);

    // 创建原始位置虚线轮廓
    createGhost(p, t, originalVal);

    var onMove = function(em) {
        em.preventDefault();
        if (!dragging || !selected) return;

        // 用 getScreenCTM 逆矩阵将屏幕 Y 转为 SVG viewBox Y
        var svg = getSvgEl();
        var ctm = svg.getScreenCTM().inverse();
        var svgY = ctm.b * em.clientX + ctm.d * em.clientY + ctm.f;

        // SVG Y → centiseconds
        var newVal = yToVal(svgY);

        // 量化步长
        if (state.event === '333fm') {
            newVal = Math.round(newVal / 100) * 100; // FMC: 1 步 = 100cs
        } else if (isMbf()) {
            newVal = Math.round(newVal / 100) * 100; // 多盲: 1 分 = 100
        } else {
            newVal = Math.round(newVal); // 普通: 1 cs
        }

        // 限制范围
        newVal = Math.max(1, Math.min(newVal, MAX_TIME_VALUE));

        // NOTE: 拖动中直接操作 SVG rect，不触发全量重绘
        updateBarDuringDrag(newVal);

        // 更新 Handle 和 Tooltip 位置
        positionHandleAndTooltip(newVal);

        // NOTE: 触觉反馈 — 经过整数秒时微振
        if (navigator.vibrate) {
            var oldSec = Math.floor(originalVal / 100);
            var newSec = Math.floor(newVal / 100);
            if (newSec !== oldSec) {
                // 整秒边界用稍强振动
                navigator.vibrate(newVal % 100 === 0 ? 12 : 5);
            }
        }
    };

    var onUp = function(eu) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);

        if (!dragging || !selected) return;
        dragging = false;

        // 读取当前拖到的值
        var p = selected.player;
        var t = selected.slot;
        var currentVal = state.times[state.seedOn + p][t];

        // NOTE: 写入 state 并触发全量重绘
        // 先取消选中态，让 render() 完整重绘
        var wasP = p, wasT = t;
        deselect();

        // 仅当值变化时才写入（避免无效 notify）
        if (currentVal !== originalVal) {
            updateTime(state.seedOn + wasP, wasT, currentVal);
        }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

// NOTE: 拖动中轻量更新 — 直接操作目标柱子的 SVG rect 属性
function updateBarDuringDrag(newVal) {
    if (!selected) return;
    var p = selected.player;
    var t = selected.slot;

    // 写入 state（但不触发 notify/重绘）
    state.times[state.seedOn + p][t] = newVal;

    // 直接操作 SVG rect
    var rect = selected.rectEl;
    if (!rect) return;

    var gp = getGp();
    var newTopY = valToYCap(newVal);
    var bottomY = valToYCap(0);
    // NOTE: 与 drawBars 相同的截断逻辑
    var uncappedBottomY = valToY(0);
    var bm = 7;
    var barHeight = (uncappedBottomY > bottomY)
        ? bottomY - bm * 2 - newTopY
        : bottomY - newTopY;

    rect.setAttribute('y', newTopY);
    rect.setAttribute('height', Math.max(0, barHeight));

    // NOTE: 同步更新柱顶标签文字（在 topTextGroup 中找到对应的 text）
    // 标签在全量重绘时创建，拖动中更新太复杂，靠 tooltip 显示即可
}

// ── 虚线轮廓（原始位置） ──

function createGhost(p, t, val) {
    removeGhost();

    var svg = getSvgEl();
    var gp = getGp();
    var barX = BAR_START + t * STRIDE;
    var bm = 7;
    var fullW = BAR_W - 2 * bm;

    // NOTE: Both 模式下内层柱缩窄
    var isInner = (state.playerEnabled[0] && state.playerEnabled[1] && p === 1);
    var bw = isInner ? fullW * 0.55 : fullW;
    var bx = barX + bm + (fullW - bw) / 2;

    var topY = valToYCap(val);
    var bottomY = valToYCap(0);
    var uncappedBottomY = valToY(0);
    var barHeight = (uncappedBottomY > bottomY)
        ? bottomY - bm * 2 - topY
        : bottomY - topY;

    ghostEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ghostEl.setAttribute('x', bx);
    ghostEl.setAttribute('y', topY);
    ghostEl.setAttribute('width', bw);
    ghostEl.setAttribute('height', Math.max(0, barHeight));
    ghostEl.setAttribute('fill', 'none');
    ghostEl.setAttribute('stroke', SHADES[p]);
    ghostEl.setAttribute('stroke-width', '2');
    ghostEl.setAttribute('stroke-dasharray', '6,4');
    ghostEl.setAttribute('opacity', '0.5');
    ghostEl.setAttribute('rx', '2');

    svg.appendChild(ghostEl);
}

function removeGhost() {
    if (ghostEl && ghostEl.parentNode) {
        ghostEl.parentNode.removeChild(ghostEl);
    }
    ghostEl = null;
}

// ── 点击空白区域取消选中 ──

function onDocumentPointerDown(e) {
    if (!selected) return;
    // 点击在 Handle 上 → 不取消
    if (handleEl && handleEl.contains(e.target)) return;
    // 点击在柱子或标签上 → onSvgPointerDown 处理
    if (e.target.closest && (e.target.closest('.chart-bar') || e.target.closest('.chart-bar-label'))) return;
    // 点击在 numpad/input 等 UI 上 → 不取消（避免干扰输入）
    if (e.target.closest && (e.target.closest('#numpad') || e.target.closest('.time-cell'))) return;

    deselect();
}

// NOTE: 全量重绘后重新附加选中态（render 会清空 SVG 并重建所有元素）
export function onAfterRender() {
    if (!selected) return;

    var p = selected.player;
    var t = selected.slot;

    // render 后旧 rectEl 已被清除，需要重新查找
    var svg = getSvgEl();
    var newRect = svg.querySelector('.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]');
    if (!newRect) {
        // 柱子消失（值被清零等） — 取消选中
        deselect();
        return;
    }

    selected.rectEl = newRect;

    // 重新附加 CSS class
    svg.classList.add('bar-selected');
    newRect.classList.add('bar-active');

    // 重新定位 Handle 和 Tooltip
    var val = state.times[state.seedOn + p][t];
    if (val > 0 && val < DNF_VALUE) {
        positionHandleAndTooltip(val);
    } else {
        deselect();
    }
}
