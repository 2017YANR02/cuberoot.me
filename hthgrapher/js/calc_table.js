// NOTE: 指标对比表格 — 从原 index.html renderCalcTable() 提取
// 显示两个选手的各项统计指标对比

import {
    DNF_VALUE, formatTime, textToTime, CalcEngine
} from './calc_engine.js';
import { state, notify } from './state.js';

var tbodyEl = null;
var thA = null;
var thB = null;

// 每个 seed 的目标平均值
var targetAvgs = {};

export function init() {
    tbodyEl = document.getElementById('calc-tbody');
    thA = document.getElementById('calc-th-a');
    thB = document.getElementById('calc-th-b');
}

export function render() {
    if (!tbodyEl) return;

    var t0 = state.times[state.seedOn];
    var t1 = state.times[state.seedOn + 1];
    var r0 = CalcEngine.compute(t0);
    var r1 = CalcEngine.compute(t1);

    // 更新表头
    if (thA) thA.textContent = state.names[state.seedOn];
    if (thB) thB.textContent = state.names[state.seedOn + 1];

    if (!r0 && !r1) {
        tbodyEl.innerHTML = '<tr><td colspan="3" style="color:#888">Enter times above to see metrics</td></tr>';
        return;
    }

    // NOTE: [显示名, key, 越小越好]
    var metrics = [
        ['Best', 'best', true], ['Avg (Ao5)', 'avg', true],
        ['BAo5', 'bao5', true], ['WAo5', 'wao5', true],
        ['Mo5', 'mo5', true], ['BPA', 'bpa', true], ['WPA', 'wpa', true],
        ['BestC', 'bestC', true], ['Median', 'median', true],
        ['WorstC', 'worstC', true], ['Worst', 'worst', true],
        ['Mo2', 'mo2', true], ['Mo3', 'mo3', true], ['Mo4', 'mo4', true],
        ['Mean', 'mo5', true], ['Variance', 'variance', false],
        ['Best/Avg', 'bestAvgRatio', false],
    ];

    var html = '';
    for (var i = 0; i < metrics.length; i++) {
        var label = metrics[i][0], key = metrics[i][1], lowerBetter = metrics[i][2];
        var v0 = r0 ? r0[key] : null, v1 = r1 ? r1[key] : null;
        if ((v0 === undefined || v0 === null) && (v1 === undefined || v1 === null)) continue;

        var s0, s1;
        if (key === 'variance' || key === 'bestAvgRatio') {
            s0 = (v0 !== null && v0 !== undefined) ? v0.toFixed(2) : '-';
            s1 = (v1 !== null && v1 !== undefined) ? v1.toFixed(2) : '-';
        } else {
            s0 = formatTime(v0);
            s1 = formatTime(v1);
        }

        // 判断优势方
        var cls0 = '', cls1 = '';
        if (v0 != null && v1 != null && v0 !== DNF_VALUE && v1 !== DNF_VALUE) {
            if (key === 'bestAvgRatio') {
                if (v0 > v1) cls0 = 'calc-better'; else if (v1 > v0) cls1 = 'calc-better';
            } else if (lowerBetter || key === 'variance') {
                if (v0 < v1) cls0 = 'calc-better'; else if (v1 < v0) cls1 = 'calc-better';
            }
        }

        html += '<tr><td>' + label + '</td>';
        html += '<td class="' + cls0 + '">' + s0 + '</td>';
        html += '<td class="' + cls1 + '">' + s1 + '</td></tr>';
    }

    // NOTE: tavg 目标平均输入行
    var tavg0 = targetAvgs[state.seedOn] || 0;
    var tavg1 = targetAvgs[state.seedOn + 1] || 0;
    var tvStr0 = tavg0 > 0 ? formatTime(tavg0) : '';
    var tvStr1 = tavg1 > 0 ? formatTime(tavg1) : '';
    html += '<tr style="background:#d4e6d4"><td>Target Avg</td>';
    html += '<td><input class="tavg-input" id="tavg-input-0" value="' + tvStr0 + '" placeholder="e.g. 5.00"></td>';
    html += '<td><input class="tavg-input" id="tavg-input-1" value="' + tvStr1 + '" placeholder="e.g. 5.00"></td></tr>';

    // 阈值行
    var th0 = tavg0 > 0 ? CalcEngine.computeThresholds(t0, tavg0) : null;
    var th1 = tavg1 > 0 ? CalcEngine.computeThresholds(t1, tavg1) : null;
    var thresholds = [['t#4 (WPA≤tavg)', 't4wpa'], ['t#4 (BPA≤tavg)', 't4bpa'], ['t#5 (Avg≤tavg)', 't5']];
    for (var j = 0; j < thresholds.length; j++) {
        var tLabel = thresholds[j][0], tKey = thresholds[j][1];
        var tv0 = th0 ? th0[tKey] : undefined, tv1 = th1 ? th1[tKey] : undefined;
        var ts0 = tv0 === undefined ? '-' : (tv0 === null ? '<span class="calc-nan">NaN</span>' : formatTime(tv0));
        var ts1 = tv1 === undefined ? '-' : (tv1 === null ? '<span class="calc-nan">NaN</span>' : formatTime(tv1));
        html += '<tr><td>' + tLabel + '</td><td>' + ts0 + '</td><td>' + ts1 + '</td></tr>';
    }

    tbodyEl.innerHTML = html;

    // 绑定 tavg 输入事件
    var tavgInput0 = document.getElementById('tavg-input-0');
    var tavgInput1 = document.getElementById('tavg-input-1');
    if (tavgInput0) tavgInput0.addEventListener('change', function () {
        targetAvgs[state.seedOn] = textToTime(tavgInput0.value);
        render();
    });
    if (tavgInput1) tavgInput1.addEventListener('change', function () {
        targetAvgs[state.seedOn + 1] = textToTime(tavgInput1.value);
        render();
    });
}
