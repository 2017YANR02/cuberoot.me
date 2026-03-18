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
var ghostEl = null;     // SVG: 原始位置虚线轮廓

// NOTE: tap 判定阈值 — 位移 < 8px 且时间 < 300ms 视为 tap
var TAP_DIST = 8;
var TAP_TIME = 300;
var pointerDownTime = 0;

// NOTE: 桌面端 hover 状态
var hovered = null;     // { player, slot } — 当前 hover 的柱子（仅桌面端）
var isTouch = false;    // 是否触摸设备（hover 仅在非触摸时启用）

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
    handleEl.style.cursor = 'ns-resize';
    container.appendChild(handleEl);

    // NOTE: 事件委托 — 在 SVG 上监听 pointerdown
    svg.addEventListener('pointerdown', onSvgPointerDown);

    // NOTE: Handle 上的拖动事件
    handleEl.addEventListener('pointerdown', onHandlePointerDown);

    // NOTE: Handle 的 mouseenter/mouseleave 维持 hover 状态（防止闪烁）
    handleEl.addEventListener('mouseenter', function() {
        if (hoverDebounceTimer) {
            clearTimeout(hoverDebounceTimer);
            hoverDebounceTimer = null;
        }
    });
    handleEl.addEventListener('mouseleave', function() {
        if (!selected && hovered) {
            hoverDebounceTimer = setTimeout(function() {
                hoverDebounceTimer = null;
                if (!selected) clearHover();
            }, HOVER_DEBOUNCE);
        }
    });

    // NOTE: 点击空白区域取消选中（document 级别，低优先级）
    document.addEventListener('pointerdown', onDocumentPointerDown);

    // NOTE: Phase 3 — 桌面端 hover 显示 Handle
    svg.addEventListener('mousemove', onSvgMouseMove);
    svg.addEventListener('mouseleave', onSvgMouseLeave);

    // NOTE: Phase 3 — 滚轮精调（在选中态下可用）
    svg.addEventListener('wheel', onSvgWheel, { passive: false });

    // NOTE: 检测触摸设备 — 首次触摸后禁用 hover 逻辑
    window.addEventListener('touchstart', function() { isTouch = true; }, { once: true });
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
            // NOTE: 位移超阈值 — 直接从柱体开始拖动（不需要先 tap 选中 pill）
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointermove', onMove);

            var rectEl = bar || getSvgEl().querySelector(
                '.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]'
            );
            if (!rectEl) return;

            var val = state.times[state.seedOn + p][t];
            if (val <= 0 || val >= DNF_VALUE) return;

            // 自动选中 → 立即开始拖动
            doSelect(p, t, rectEl, val);
            onHandlePointerDown(em);
        }
    };
    document.addEventListener('pointerup', onUp, { once: false });
    document.addEventListener('pointermove', onMove);
}

// ── 选中/取消选中柱子 ──

function selectBar(p, t, rectEl) {
    // NOTE: Phase 2 Both 模式消歧 — 同一 slot 再次 tap 切换到另一个选手
    var bothMode = state.playerEnabled[0] && state.playerEnabled[1];
    if (selected && selected.slot === t) {
        if (selected.player === p) {
            // 点击已选中的柱子
            if (bothMode) {
                // Both 模式：切换到另一个选手的柱子
                var otherP = 1 - p;
                var otherVal = state.times[state.seedOn + otherP][t];
                if (otherVal > 0 && otherVal < DNF_VALUE) {
                    var otherRect = getSvgEl().querySelector(
                        '.chart-bar[data-player="' + otherP + '"][data-slot="' + t + '"]'
                    );
                    if (otherRect) {
                        deselect();
                        doSelect(otherP, t, otherRect, otherVal);
                        return;
                    }
                }
            }
            // 单人模式或另一选手无效 — 取消选中
            deselect();
            return;
        }
        // 同 slot 不同 player（直接切换）
    }

    // 先清除上一次选中
    deselect();

    var val = state.times[state.seedOn + p][t];
    // NOTE: 空柱子和 DNF 不可拖动
    if (val <= 0 || val >= DNF_VALUE) return;

    doSelect(p, t, rectEl, val);
}

// NOTE: 实际执行选中逻辑（抽取为独立函数供 selectBar 和 Both 消歧复用）
function doSelect(p, t, rectEl, val) {
    // NOTE: 从 hover 预览态转入正式选中态
    hovered = null;
    selected = { player: p, slot: t, rectEl: rectEl };

    // NOTE: 添加 SVG class 实现视觉效果
    var svg = getSvgEl();
    svg.classList.add('bar-selected');
    rectEl.classList.add('bar-active');

    // NOTE: 定位 Handle
    positionHandle(val);
    handleEl.style.display = '';

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

function positionHandle(val, overrideP, overrideT) {
    // NOTE: 支持传入 p/t（hover 用）或从 selected 读取
    var p = (overrideP !== undefined) ? overrideP : (selected ? selected.player : null);
    var t = (overrideT !== undefined) ? overrideT : (selected ? selected.slot : null);
    if (p === null || t === null) return;

    // 计算柱顶 SVG 坐标
    var barCenterX = BAR_START + t * STRIDE + BAR_W / 2;
    var barTopY = valToYCap(val);

    // NOTE: Handle 下移 12px 到柱体内部，避免遮住柱顶数字标签
    var pos = svgPointToContainer(barCenterX, barTopY + 12);

    handleEl.style.left = pos.x + 'px';
    handleEl.style.top = pos.y + 'px';
}

// ── Handle 拖动 ──

function onHandlePointerDown(e) {
    // NOTE: hover 态直接拖动 — 自动选中再开始拖
    if (!selected && hovered) {
        var p = hovered.player;
        var t = hovered.slot;
        var val = state.times[state.seedOn + p][t];
        if (val <= 0 || val >= DNF_VALUE) return;
        var rectEl = getSvgEl().querySelector(
            '.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]'
        );
        if (!rectEl) return;
        doSelect(p, t, rectEl, val);
    }
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();

    dragging = true;
    var p = selected.player;
    var t = selected.slot;
    originalVal = state.times[state.seedOn + p][t];

    // NOTE: 防止拖动中选中文字（蓝色高亮）
    document.body.style.userSelect = 'none';

    // NOTE: 记录光标与柱顶的 SVG Y 偏移，实现相对拖动（避免跳跃）
    var svg = getSvgEl();
    var ctm = svg.getScreenCTM().inverse();
    var startSvgY = ctm.b * e.clientX + ctm.d * e.clientY + ctm.f;
    var barTopSvgY = valToYCap(originalVal);
    var dragOffsetY = startSvgY - barTopSvgY;

    // NOTE: 捕获 pointer 确保移出元素后仍能跟踪
    handleEl.setPointerCapture(e.pointerId);

    // 创建原始位置虚线轮廓
    createGhost(p, t, originalVal);

    // NOTE: 边缘自动递增/递减 — 拖到 SVG 边缘时持续改变值
    var edgeTimer = null;
    var EDGE_ZONE = 40; // px — 距 SVG 边缘多少像素触发
    var EDGE_INTERVAL = 50; // ms — 每 tick 间隔
    var edgeTickCount = 0; // 累计 tick 数（用于加速）

    var applyVal = function(newVal) {
        // 限制范围
        newVal = Math.max(1, Math.min(newVal, MAX_TIME_VALUE));
        if (!selected) return;
        var p = selected.player;
        var t = selected.slot;

        // NOTE: 写入 state（不触发 notify，手动调 render 避免其他 UI 副作用）
        state.times[state.seedOn + p][t] = newVal;

        // NOTE: 全量重绘 — BPA/WPA/平均线等统计指标全部实时更新
        chartRender();
        onAfterRender();

        // NOTE: 重绘后 ghost 被清除，需要重新创建（使用 originalVal 保持原始位置）
        if (originalVal !== newVal) {
            createGhost(p, t, originalVal);
        }

        // NOTE: 触觉反馈 — 经过整数秒时微振
        if (navigator.vibrate) {
            var oldSec = Math.floor(originalVal / 100);
            var newSec = Math.floor(newVal / 100);
            if (newSec !== oldSec) {
                navigator.vibrate(newVal % 100 === 0 ? 12 : 5);
            }
        }
    };

    var startEdgeScroll = function(dir) {
        // dir: +1 = 值增大（往上拖超出上边缘），-1 = 值减小
        if (edgeTimer) return;
        edgeTickCount = 0;
        edgeTimer = setInterval(function() {
            if (!dragging || !selected) { stopEdgeScroll(); return; }
            edgeTickCount++;
            var p = selected.player;
            var t = selected.slot;
            var val = state.times[state.seedOn + p][t];
            // NOTE: 步进随停留时间加速 — 前 10 tick 慢（1cs），之后快（5cs），40 tick 后更快（20cs）
            var step = edgeTickCount < 10 ? 1 : edgeTickCount < 40 ? 5 : 20;
            if (state.event === '333fm' || isMbf()) step = 100;
            var newVal = Math.max(1, Math.min(val + dir * step, MAX_TIME_VALUE));
            if (newVal === val) return;
            applyVal(newVal);
        }, EDGE_INTERVAL);
    };

    var stopEdgeScroll = function() {
        if (edgeTimer) {
            clearInterval(edgeTimer);
            edgeTimer = null;
            edgeTickCount = 0;
        }
    };

    var onMove = function(em) {
        em.preventDefault();
        if (!dragging || !selected) return;

        // 用 getScreenCTM 逆矩阵将屏幕 Y 转为 SVG viewBox Y
        var svg = getSvgEl();
        var ctm = svg.getScreenCTM().inverse();
        var svgY = ctm.b * em.clientX + ctm.d * em.clientY + ctm.f;

        // NOTE: 减去偏移量 — 无论从柱子哪个位置开始拖，柱顶都不会跳跃
        var adjustedY = svgY - dragOffsetY;

        // SVG Y → centiseconds
        var newVal = yToVal(adjustedY);

        // 量化步长
        if (state.event === '333fm') {
            newVal = Math.round(newVal / 100) * 100;
        } else if (isMbf()) {
            newVal = Math.round(newVal / 100) * 100;
        } else {
            newVal = Math.round(newVal);
        }

        // NOTE: 边缘检测 — 鼠标距 SVG 上/下边缘 < EDGE_ZONE 时自动递增/递减
        var svgRect = svg.getBoundingClientRect();
        var distToTop = em.clientY - svgRect.top;
        var distToBottom = svgRect.bottom - em.clientY;

        if (distToTop < EDGE_ZONE) {
            startEdgeScroll(1);  // 往上 = 值增大
        } else if (distToBottom < EDGE_ZONE) {
            startEdgeScroll(-1); // 往下 = 值减小
        } else {
            stopEdgeScroll();
        }

        applyVal(newVal);
    };

    var onUp = function(eu) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        stopEdgeScroll();
        // NOTE: 恢复文字选中
        document.body.style.userSelect = '';

        if (!dragging || !selected) return;
        dragging = false;

        var p = selected.player;
        var t = selected.slot;
        var currentVal = state.times[state.seedOn + p][t];
        var wasP = p, wasT = t;
        deselect();

        // NOTE: 通知其他 UI 模块（input grid 等）刷新
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

    // NOTE: 拖动时直接更新原有 SVG 标签文字
    var svg = getSvgEl();
    var labelEl = svg.querySelector('.chart-bar-label[data-player="' + p + '"][data-slot="' + t + '"]');
    if (labelEl) {
        labelEl.textContent = formatTime(newVal);
        // NOTE: 标签 Y 跟随柱顶，但不超出 viewBox 上边界（至少留 24px 给文字高度）
        labelEl.setAttribute('y', Math.max(24, newTopY - 8));
    }
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
        positionHandle(val);
    } else {
        deselect();
    }
}

// ── Phase 3：桌面端 hover ──

// NOTE: 鼠标悬停柱子时自动显示 Handle（仅桌面端，触摸设备跳过）
// HACK: hover 只检测 .chart-bar rect，不检测标签 — 标签文字太小且重叠时导致抖动
var hoverDebounceTimer = null;
var HOVER_DEBOUNCE = 80; // ms — 防止边界处快速横跳

function onSvgMouseMove(e) {
    if (isTouch) return;       // 触摸设备不需要 hover
    if (dragging) return;      // 拖动中不处理 hover
    if (selected) return;      // 已有选中态时不覆盖

    // NOTE: hover 只检测柱子 rect，不检测标签（标签 tap 仍可用）
    var bar = e.target.closest('.chart-bar');

    if (!bar) {
        // 鼠标移出柱子 — 延迟隐藏（防抖）
        if (hovered && !hoverDebounceTimer) {
            hoverDebounceTimer = setTimeout(function() {
                hoverDebounceTimer = null;
                if (!selected) clearHover();
            }, HOVER_DEBOUNCE);
        }
        return;
    }

    // 鼠标在柱子上 — 取消延迟隐藏
    if (hoverDebounceTimer) {
        clearTimeout(hoverDebounceTimer);
        hoverDebounceTimer = null;
    }

    var p = parseInt(bar.getAttribute('data-player'));
    var t = parseInt(bar.getAttribute('data-slot'));
    if (isNaN(p) || isNaN(t)) { clearHover(); return; }

    // 已经 hover 在同一个柱子上 — 不重复处理
    if (hovered && hovered.player === p && hovered.slot === t) return;

    clearHover();

    var val = state.times[state.seedOn + p][t];
    if (val <= 0 || val >= DNF_VALUE) return;

    hovered = { player: p, slot: t };

    // NOTE: hover 预览只显示 Handle
    positionHandle(val, p, t);
    handleEl.style.display = '';
    handleEl.classList.toggle('player-b', p === 1);

    // NOTE: hover 时也降暗其他柱子
    var svg = getSvgEl();
    svg.classList.add('bar-selected');
    var barRect = svg.querySelector('.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]');
    if (barRect) barRect.classList.add('bar-active');

    // NOTE: cursor 提示可交互
    svg.style.cursor = 'ns-resize';
}

function onSvgMouseLeave(e) {
    if (isTouch) return;
    if (selected) return;  // 选中态不受 mouseleave 影响
    // NOTE: 鼠标移到 Handle 上时不清除 hover（否则会导致闪烁循环）
    if (handleEl && (handleEl.contains(e.relatedTarget) || handleEl === e.relatedTarget)) return;
    // NOTE: 彻底离开 SVG — 立即清除，不需要延迟
    if (hoverDebounceTimer) {
        clearTimeout(hoverDebounceTimer);
        hoverDebounceTimer = null;
    }
    clearHover();
}

function clearHover() {
    if (!hovered) return;
    // NOTE: 移除 hover 的视觉效果
    var svg = getSvgEl();
    if (svg && !selected) {
        svg.classList.remove('bar-selected');
        var active = svg.querySelector('.chart-bar.bar-active');
        if (active) active.classList.remove('bar-active');
    }
    hovered = null;
    if (!selected) {
        handleEl.style.display = 'none';
    }
    if (svg) svg.style.cursor = '';
}

// ── Phase 3：滚轮精调 ──

// NOTE: 选中态下滚轮 ±0.01s（Shift ±0.10s, Ctrl ±1.00s）
function onSvgWheel(e) {
    if (!selected) return;

    e.preventDefault();

    var p = selected.player;
    var t = selected.slot;
    var val = state.times[state.seedOn + p][t];
    if (val <= 0 || val >= DNF_VALUE) return;

    // 步进粒度
    var step = 1; // 0.01s
    if (state.event === '333fm' || isMbf()) {
        step = 100; // FMC: 1步; 多盲: 1分
    } else if (e.ctrlKey) {
        step = 100; // 1.00s
    } else if (e.shiftKey) {
        step = 10;  // 0.10s
    }

    var dir = e.deltaY < 0 ? 1 : -1; // 向上滚 = 值增大
    var newVal = Math.max(1, Math.min(val + dir * step, MAX_TIME_VALUE));
    if (newVal === val) return;

    // 写入 state 并触发全量重绘
    updateTime(state.seedOn + p, t, newVal);
}
