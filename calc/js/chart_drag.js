// NOTE: 图表柱子拖动交互 — Tap-Select + Handle 拖动
// 移动端优先：tap 选中柱子 → 出现 Handle → 拖动 Handle 调整成绩值

import { state, updateTime, solveCount } from './state.js';
import { isMbf } from './state.js';
import { DNF_VALUE, formatTime, clampValue } from './calc_engine.js';
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



    // NOTE: 点击空白区域取消选中（document 级别，低优先级）
    document.addEventListener('pointerdown', onDocumentPointerDown);

    // NOTE: Phase 3 — 桌面端 hover 显示 Handle
    svg.addEventListener('mousemove', onSvgMouseMove);
    svg.addEventListener('mouseleave', onSvgMouseLeave);

    // NOTE: Phase 3 — 滚轮精调（在选中态下可用）
    svg.addEventListener('wheel', onSvgWheel, { passive: false });

    // NOTE: 键盘 ↑/↓ 精调（选中态下可用，步长与滚轮一致）
    document.addEventListener('keydown', onKeyDown);

    // NOTE: 检测触摸设备 — 首次触摸后禁用 hover 逻辑
    window.addEventListener('touchstart', function() { isTouch = true; }, { once: true });
}

// NOTE: Both 模式 Y 坐标消歧 — 当点击到外层柱但光标在内层柱顶以下时，重定向到内层
function resolveBarAtY(p, t, e) {
    var bothMode = state.playerEnabled[0] && state.playerEnabled[1];
    if (!bothMode) return { p: p };

    var otherP = 1 - p;
    var otherVal = state.times[state.seedOn + otherP][t];
    if (otherVal <= 0 || otherVal >= DNF_VALUE) return { p: p };

    var myVal = state.times[state.seedOn + p][t];
    if (myVal <= 0 || myVal >= DNF_VALUE) return { p: p };

    // NOTE: 判断谁是内层（较矮 = 值更小 = 柱顶更低 = Y 更高）
    // 内层柱子是值较小的（柱子较矮的那个）
    if (myVal <= otherVal) return { p: p }; // 当前已是内层，无需切换

    // 当前命中的是外层（值更大），检查光标是否在内层柱顶以下
    // NOTE: 用屏幕坐标 + 5px 容差，避免 ns-resize 光标热点偏移导致边界误判
    var svg = getSvgEl();
    var innerRect = svg.querySelector('.chart-bar[data-player="' + otherP + '"][data-slot="' + t + '"]');
    if (innerRect) {
        var innerBBox = innerRect.getBoundingClientRect();
        if (e.clientY >= innerBBox.top - 5) {
            return { p: otherP };
        }
    }
    return { p: p };
}

// ── SVG pointerdown — 检测 tap 柱子 ──

function onSvgPointerDown(e) {
    // 已在拖动中则忽略
    if (dragging) return;

    // NOTE: 检测是否 tap 到了柱子、柱顶数字标签、或 PA 柱
    var bar = e.target.closest('.chart-bar');
    var label = e.target.closest('.chart-bar-label');
    var paBar = (!bar && !label) ? e.target.closest('.chart-pa-bar') : null;
    var target = bar || label;

    // NOTE: PA 柱 tap → 直接启动 PA 拖动（不走普通柱子的 select 逻辑）
    if (paBar) {
        var paPl = parseInt(paBar.getAttribute('data-player'));
        if (isNaN(paPl)) return;
        // NOTE: 无空缺时假装最后一个 slot 是空的（PA 拖动始终只改倒数第 2 根）
        var emptyIdx = findEmptySlot(paPl);
        if (emptyIdx < 0) emptyIdx = solveCount() - 1;
        var paBBox = paBar.getBoundingClientRect();
        var midY = paBBox.top + paBBox.height / 2;
        var paEnd = (e.clientY <= midY) ? 'wpa' : 'bpa';
        e.preventDefault();
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        pointerDownTime = Date.now();

        // NOTE: tap/drag 区分 — tap 选中 PA 柱（显示 pill），drag 超阈值才开始拖动
        var onUpPa = function(eu) {
            document.removeEventListener('pointerup', onUpPa);
            document.removeEventListener('pointermove', onMovePa);
            var dx = eu.clientX - dragStartX;
            var dy = eu.clientY - dragStartY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var elapsed = Date.now() - pointerDownTime;
            if (dist < TAP_DIST && elapsed < TAP_TIME) {
                selectPa(paPl, emptyIdx, paEnd, paBar);
            }
        };
        var onMovePa = function(em) {
            var dx = em.clientX - dragStartX;
            var dy = em.clientY - dragStartY;
            if (Math.sqrt(dx * dx + dy * dy) > TAP_DIST) {
                document.removeEventListener('pointerup', onUpPa);
                document.removeEventListener('pointermove', onMovePa);
                startPaDrag(em, paPl, emptyIdx, paEnd, paBar);
            }
        };
        document.addEventListener('pointerup', onUpPa, { once: false });
        document.addEventListener('pointermove', onMovePa);
        return;
    }

    var p, t;
    if (target) {
        p = parseInt(target.getAttribute('data-player'));
        t = parseInt(target.getAttribute('data-slot'));
        if (isNaN(p) || isNaN(t)) return;
        // NOTE: Both 模式 Y 坐标消歧 — 重叠区域强制选内层柱子
        if (bar) {
            var resolved = resolveBarAtY(p, t, e);
            p = resolved.p;
        }
    } else if (hovered) {
        // NOTE: 空白区域有 hover 时，使用 hovered 的柱子信息
        p = hovered.player;
        t = hovered.slot;
        // NOTE: hovered 是 PA 柱时，用 PA 逻辑处理（tap/drag 区分）
        if (hovered.pa) {
            var emptyIdx = findEmptySlot(p);
            if (emptyIdx < 0) emptyIdx = solveCount() - 1;
            e.preventDefault();
            var paEnd = hovered.paEnd;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            pointerDownTime = Date.now();
            var paBarEl = getSvgEl().querySelector('.chart-pa-bar[data-player="' + p + '"]');
            var onUpPa2 = function(eu) {
                document.removeEventListener('pointerup', onUpPa2);
                document.removeEventListener('pointermove', onMovePa2);
                var dx = eu.clientX - dragStartX;
                var dy = eu.clientY - dragStartY;
                var dist = Math.sqrt(dx * dx + dy * dy);
                var elapsed = Date.now() - pointerDownTime;
                if (dist < TAP_DIST && elapsed < TAP_TIME) {
                    selectPa(p, emptyIdx, paEnd, paBarEl);
                }
            };
            var onMovePa2 = function(em) {
                var dx = em.clientX - dragStartX;
                var dy = em.clientY - dragStartY;
                if (Math.sqrt(dx * dx + dy * dy) > TAP_DIST) {
                    document.removeEventListener('pointerup', onUpPa2);
                    document.removeEventListener('pointermove', onMovePa2);
                    startPaDrag(em, p, emptyIdx, paEnd, paBarEl);
                }
            };
            document.addEventListener('pointerup', onUpPa2, { once: false });
            document.addEventListener('pointermove', onMovePa2);
            return;
        }
    } else {
        return;
    }

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

    // NOTE: 定位 Handle（选中态恢复 pointer-events，允许拖动）
    positionHandle(val);
    handleEl.style.display = '';
    handleEl.style.pointerEvents = 'auto';

    // NOTE: Handle 颜色跟随选手
    handleEl.classList.toggle('player-b', p === 1);
}

// NOTE: PA 柱 tap 选中态 — 显示 pill 并允许拖动
function selectPa(p, emptyIdx, paEnd, paBarEl) {
    // 如果已选中同一个 PA 端 → 取消选中
    if (selected && selected.pa && selected.player === p && selected.paEnd === paEnd) {
        deselect();
        return;
    }
    deselect();
    hovered = null;

    var paCx = parseFloat(paBarEl.getAttribute('data-pa-cx'));
    var paW = parseFloat(paBarEl.getAttribute('data-pa-w'));
    var endY = parseFloat(paBarEl.getAttribute(paEnd === 'wpa' ? 'data-wpa-y' : 'data-bpa-y'));

    // NOTE: 存储 PA 选中信息（onHandlePointerDown 需要读取）
    selected = { player: p, slot: emptyIdx, pa: true, paEnd: paEnd, rectEl: paBarEl };

    var svg = getSvgEl();
    svg.classList.add('bar-selected');
    paBarEl.classList.add('bar-active');

    // NOTE: pill 定位到 PA 柱端点
    positionHandleAt(paCx, endY + (paEnd === 'wpa' ? 12 : -12), paW);
    handleEl.style.display = '';
    handleEl.style.pointerEvents = 'auto';
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

// NOTE: 通用 pill 定位 — 给定 SVG 坐标和柱宽，设置 handleEl 的位置和尺寸
function positionHandleAt(svgCx, svgY, svgBarW) {
    var pos = svgPointToContainer(svgCx, svgY);
    var leftEdge = svgPointToContainer(svgCx - svgBarW / 2, svgY);
    var rightEdge = svgPointToContainer(svgCx + svgBarW / 2, svgY);
    var barScreenW = rightEdge.x - leftEdge.x;
    // NOTE: 最小尺寸保证窄屏下 pill 仍可见可交互
    barScreenW = Math.max(barScreenW, 24);
    var pillH = Math.max(barScreenW / 2.5, 12);
    handleEl.style.width = barScreenW + 'px';
    handleEl.style.height = pillH + 'px';
    handleEl.style.borderRadius = (pillH / 2) + 'px';
    handleEl.style.left = pos.x + 'px';
    handleEl.style.top = pos.y + 'px';
}

function positionHandle(val, overrideP, overrideT) {
    // NOTE: 支持传入 p/t（hover 用）或从 selected 读取
    var p = (overrideP !== undefined) ? overrideP : (selected ? selected.player : null);
    var t = (overrideT !== undefined) ? overrideT : (selected ? selected.slot : null);
    if (p === null || t === null) return;

    var barCenterX = BAR_START + t * STRIDE + BAR_W / 2;
    var barTopY = valToYCap(val);

    // NOTE: 优先从已渲染的 rect 读取宽度，完全匹配柱子实际宽度
    var svg = getSvgEl();
    var rectEl = svg.querySelector('.chart-bar[data-player="' + p + '"][data-slot="' + t + '"]');
    var svgBarW;
    if (rectEl) {
        // 从 rect 属性读取 SVG 坐标系中的宽度
        svgBarW = parseFloat(rectEl.getAttribute('width'));
    } else {
        svgBarW = BAR_W;
    }

    // NOTE: Handle 下移 12px 到柱体内部，避免遮住柱顶数字标签
    positionHandleAt(barCenterX, barTopY + 12, svgBarW);
}

// ── Handle 拖动 ──

function onHandlePointerDown(e) {
    // NOTE: PA 柱选中态 → 从 pill 启动 PA 拖动
    if (selected && selected.pa) {
        e.preventDefault();
        e.stopPropagation();
        var p = selected.player;
        var emptyIdx = selected.slot;
        var paEnd = selected.paEnd;
        var paBarEl = selected.rectEl;
        deselect(); // 清除选中态，startPaDrag 会重新设置
        startPaDrag(e, p, emptyIdx, paEnd, paBarEl);
        return;
    }

    // NOTE: hover 态直接拖动 — 自动选中再开始拖
    if (!selected && hovered) {
        // NOTE: hover 在 PA 柱上 → 直接启动 PA 拖动
        if (hovered.pa) {
            var p = hovered.player;
            var emptyIdx = findEmptySlot(p);
            if (emptyIdx < 0) emptyIdx = solveCount() - 1;
            e.preventDefault();
            e.stopPropagation();
            var paBarEl = getSvgEl().querySelector('.chart-pa-bar[data-player="' + p + '"]');
            startPaDrag(e, p, emptyIdx, hovered.paEnd, paBarEl);
            return;
        }
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
        newVal = clampValue(newVal);
        if (!selected) return;
        var p = selected.player;
        var t = selected.slot;

        // NOTE: 写入 state（不触发 notify，手动调 render 避免其他 UI 副作用）
        state.times[state.seedOn + p][t] = newVal;

        // NOTE: 全量重绘 — BPA/WPA/平均线等统计指标全部实时更新
        chartRender({ skipViewBox: true });
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
            var newVal = clampValue(val + dir * step);
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

// ── PA 柱拖动 — 反向推算第 5 把 ──

// NOTE: 找到该选手的空缺 slot（未填的那一把）。无空缺返回 -1。
function findEmptySlot(p) {
    var times = state.times[state.seedOn + p];
    for (var i = 0; i < solveCount(); i++) {
        if (times[i] === 0) return i;
    }
    return -1;
}

// NOTE: PA 柱拖动 — 拖动 WPA/BPA 端，只改第 4 根柱子的值
// 前 3 根柱子固定不变，PA 值通过改变第 4 根实现
function startPaDrag(e, p, emptyIdx, paEnd, paBarEl) {
    hovered = null;

    var times = state.times[state.seedOn + p];
    // NOTE: 目标柱子 = 第 4 根（空缺 slot 前一个）
    var targetSlot = emptyIdx - 1;
    if (targetSlot < 0) return;
    var targetOrigVal = times[targetSlot];
    if (targetOrigVal <= 0 || targetOrigVal >= DNF_VALUE) return;

    // NOTE: 收集前 3 根柱子的值，排序后用于反向推算
    var fixed = [];
    for (var i = 0; i < solveCount(); i++) {
        if (i !== targetSlot && i !== emptyIdx && times[i] > 0 && times[i] < DNF_VALUE) {
            fixed.push(times[i]);
        }
    }
    if (fixed.length < 3) return;
    fixed.sort(function(a, b) { return a - b; });
    // NOTE: 反向推算公式:
    // WPA (5th=DNF): counting = sorted[1..3] → fixedSum = f[1] + f[2]
    // BPA (5th=0):   counting = sorted[1..3] → fixedSum = f[0] + f[1]
    var fixedSum = (paEnd === 'wpa') ? fixed[1] + fixed[2] : fixed[0] + fixed[1];

    selected = { player: p, slot: targetSlot, pa: true, paEnd: paEnd, rectEl: paBarEl };
    dragging = true;

    var svg = getSvgEl();
    svg.classList.add('bar-selected');
    if (paBarEl) paBarEl.classList.add('bar-active');
    handleEl.style.display = '';
    handleEl.style.pointerEvents = 'auto';
    handleEl.classList.toggle('player-b', p === 1);

    document.body.style.userSelect = 'none';
    originalVal = targetOrigVal;

    // NOTE: 记录光标与 PA 端点的偏移
    var ctm = svg.getScreenCTM().inverse();
    var startSvgY = ctm.b * e.clientX + ctm.d * e.clientY + ctm.f;
    var paCx = parseFloat(paBarEl.getAttribute('data-pa-cx'));
    var paW = parseFloat(paBarEl.getAttribute('data-pa-w'));
    var endY = parseFloat(paBarEl.getAttribute(paEnd === 'wpa' ? 'data-wpa-y' : 'data-bpa-y'));
    var dragOffsetY = startSvgY - endY;

    // 创建原始位置虚线轮廓
    createGhost(p, targetSlot, targetOrigVal);

    var onMove = function(em) {
        em.preventDefault();
        if (!dragging || !selected || !selected.pa) return;

        var svg = getSvgEl();
        var ctm = svg.getScreenCTM().inverse();
        var svgY = ctm.b * em.clientX + ctm.d * em.clientY + ctm.f;
        var adjustedY = svgY - dragOffsetY;

        // NOTE: Y → 目标 PA 值 → 反向推算第 4 柱的值
        var targetPA = yToVal(adjustedY);
        targetPA = Math.round(targetPA);
        var x = 3 * targetPA - fixedSum;
        if (x <= 0) return;
        x = clampValue(Math.round(x));

        // 写入目标柱子并重绘
        state.times[state.seedOn + p][targetSlot] = x;
        chartRender({ skipViewBox: true });
        onAfterRender();

        // 重建 ghost（render 会清除）
        if (x !== targetOrigVal) {
            createGhost(p, targetSlot, targetOrigVal);
        }
    };

    var onUp = function(eu) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';

        if (!dragging || !selected) return;
        dragging = false;

        var currentVal = state.times[state.seedOn + p][targetSlot];
        deselect();

        // NOTE: 通知其他 UI 模块
        if (currentVal !== targetOrigVal) {
            updateTime(state.seedOn + p, targetSlot, currentVal);
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

    // NOTE: Both 模式下较矮柱（值较小 → SVG Y 更大）为内层，需缩窄
    var isInner = false;
    if (state.playerEnabled[0] && state.playerEnabled[1]) {
        var otherP = 1 - p;
        var otherVal = state.times[state.seedOn + otherP][t];
        // 当前柱子值更小（更矮）→ 它是内层
        if (otherVal > 0 && otherVal < DNF_VALUE && val < otherVal) {
            isInner = true;
        }
    }
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
    if (e.target.closest && (e.target.closest('.chart-bar') || e.target.closest('.chart-bar-label') || e.target.closest('.chart-pa-bar'))) return;
    // 点击在 numpad/input 等 UI 上 → 不取消（避免干扰输入）
    if (e.target.closest && (e.target.closest('#numpad') || e.target.closest('.time-cell'))) return;

    deselect();
}

// NOTE: 全量重绘后重新附加选中态（render 会清空 SVG 并重建所有元素）
export function onAfterRender() {
    if (!selected) return;

    var p = selected.player;
    var t = selected.slot;
    var svg = getSvgEl();

    // NOTE: PA 柱选中态 — 查找重建后的 PA bar
    if (selected.pa) {
        var newPaBar = svg.querySelector('.chart-pa-bar[data-player="' + p + '"]');
        if (!newPaBar) { deselect(); return; }
        selected.rectEl = newPaBar;
        svg.classList.add('bar-selected');
        newPaBar.classList.add('bar-active');
        // 重新定位 pill 到端点
        var paCx = parseFloat(newPaBar.getAttribute('data-pa-cx'));
        var paW = parseFloat(newPaBar.getAttribute('data-pa-w'));
        var paEnd = selected.paEnd;
        var endY = parseFloat(newPaBar.getAttribute(paEnd === 'wpa' ? 'data-wpa-y' : 'data-bpa-y'));
        positionHandleAt(paCx, endY + (paEnd === 'wpa' ? 12 : -12), paW);
        return;
    }

    // render 后旧 rectEl 已被清除，需要重新查找
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

function onSvgMouseMove(e) {
    if (isTouch) return;       // 触摸设备不需要 hover
    if (dragging) return;      // 拖动中不处理 hover
    if (selected) return;      // 已有选中态时不覆盖

    // NOTE: hover 检测柱子 rect、柱顶数字标签、PA 柱
    var bar = e.target.closest('.chart-bar');
    var label = !bar ? e.target.closest('.chart-bar-label') : null;
    var paBar = (!bar && !label) ? e.target.closest('.chart-pa-bar') : null;
    var target = bar || label || paBar;

    if (!target) {
        // NOTE: 空白区域保持上一个 hover 不变（只有离开 SVG 或移到另一根柱子才切换）
        return;
    }

    // NOTE: PA 柱 hover — 根据光标 Y 位置显示 WPA（上端）或 BPA（下端）pill
    if (paBar) {
        var paPl = parseInt(paBar.getAttribute('data-player'));
        var paCx = parseFloat(paBar.getAttribute('data-pa-cx'));
        var paW = parseFloat(paBar.getAttribute('data-pa-w'));
        var wpaY = parseFloat(paBar.getAttribute('data-wpa-y'));
        var bpaY = parseFloat(paBar.getAttribute('data-bpa-y'));
        if (isNaN(paPl) || isNaN(paCx)) return;

        // NOTE: 光标在 PA 柱上半段 → WPA pill，下半段 → BPA pill
        var paBBox = paBar.getBoundingClientRect();
        var midY = paBBox.top + paBBox.height / 2;
        var paEnd = (e.clientY <= midY) ? 'wpa' : 'bpa';

        // 同一个端 → 不重复处理
        if (hovered && hovered.pa && hovered.player === paPl && hovered.paEnd === paEnd) return;

        // NOTE: 切换 hover 时直接更新 class
        var svg = getSvgEl();
        var prevActive = svg.querySelector('.bar-active');
        if (prevActive) prevActive.classList.remove('bar-active');

        hovered = { player: paPl, slot: -1, pa: true, paEnd: paEnd };

        // NOTE: pill 定位到对应端（各下移/上移 12px 避免遮挡标签）
        var pillSvgY = (paEnd === 'wpa') ? wpaY + 12 : bpaY - 12;
        positionHandleAt(paCx, pillSvgY, paW);
        handleEl.style.display = '';
        handleEl.style.pointerEvents = 'none';
        handleEl.classList.toggle('player-b', paPl === 1);

        svg.classList.add('bar-selected');
        paBar.classList.add('bar-active');
        svg.style.cursor = 'ns-resize';
        return;
    }


    var p = parseInt(target.getAttribute('data-player'));
    var t = parseInt(target.getAttribute('data-slot'));
    if (isNaN(p) || isNaN(t)) { clearHover(); return; }

    // NOTE: Y 坐标消歧只对柱子 rect 有意义；标签明确属于某个 player，不需要消歧
    if (bar) {
        var resolved = resolveBarAtY(p, t, e);
        p = resolved.p;
    }

    // 已经 hover 在同一个柱子上 — 不重复处理
    if (hovered && hovered.player === p && hovered.slot === t) return;

    // NOTE: 切换 hover 时直接更新 class，不经过 clearHover 避免全亮闪一帧
    var svg = getSvgEl();
    var prevActive = svg.querySelector('.bar-active');
    if (prevActive) prevActive.classList.remove('bar-active');

    var val = state.times[state.seedOn + p][t];
    if (val <= 0 || val >= DNF_VALUE) { clearHover(); return; }

    hovered = { player: p, slot: t };

    // NOTE: hover 预览只显示 Handle（pointer-events:none 防止 pill 挡住光标引起循环）
    positionHandle(val, p, t);
    handleEl.style.display = '';
    handleEl.style.pointerEvents = 'none';
    handleEl.classList.toggle('player-b', p === 1);

    // NOTE: hover 时降暗其他柱子（svg class 可能已经有了，直接 add 无害）
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
    // NOTE: 彻底离开 SVG — 立即清除
    clearHover();
}

function clearHover() {
    if (!hovered) return;
    // NOTE: 移除 hover 的视觉效果
    var svg = getSvgEl();
    if (svg && !selected) {
        svg.classList.remove('bar-selected');
        var active = svg.querySelector('.bar-active');
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
    var newVal = clampValue(val + dir * step);
    if (newVal === val) return;

    // 写入 state 并触发全量重绘
    updateTime(state.seedOn + p, t, newVal);
}

// ── Phase 3：键盘 ↑/↓ 精调 ──

// NOTE: 选中态下 ↑/↓ ±0.01s（Shift ±0.10s, Ctrl ±1.00s）
function onKeyDown(e) {
    if (!selected || selected.pa) return; // PA 柱暂不支持键盘调整
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    // NOTE: 焦点在 input/textarea 等可编辑元素时不拦截
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    e.preventDefault(); // 防页面滚动

    var p = selected.player;
    var t = selected.slot;
    var val = state.times[state.seedOn + p][t];
    if (val <= 0 || val >= DNF_VALUE) return;

    // 步进粒度（与滚轮一致）
    var step = 1; // 0.01s
    if (state.event === '333fm' || isMbf()) {
        step = 100;
    } else if (e.ctrlKey) {
        step = 100;
    } else if (e.shiftKey) {
        step = 10;
    }

    var dir = e.key === 'ArrowUp' ? 1 : -1;
    var newVal = clampValue(val + dir * step);
    if (newVal === val) return;

    updateTime(state.seedOn + p, t, newVal);
}
