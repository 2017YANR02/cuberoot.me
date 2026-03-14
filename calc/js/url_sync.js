// NOTE: URL 状态同步 — 保持 URL 参数格式向后兼容
// save() 内置 debounce 防止秒表运行时高频调用

import { state, updateSort } from './state.js';
import { textToTime, formatTime } from './calc_engine.js';

var debounceTimer = null;
var DEBOUNCE_MS = 500;

// NOTE: 将当前 state 编码到 URL 参数
export function save() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSave, DEBOUNCE_MS);
}

function doSave() {
    var params = new URLSearchParams();
    params.set('comp', state.compName);

    for (var i = 0; i < state.names.length; i++) {
        params.set('n' + i, state.names[i]);
    }
    for (var i = 0; i < state.times.length; i++) {
        var t = state.times[i];
        var hasData = t.some(function (v) { return v > 0; });
        if (hasData) {
            params.set('t' + i, t.join(','));
        }
    }
    if (state.seedOn > 0) params.set('seed', state.seedOn);
    if (state.event && state.event !== '333') params.set('event', state.event);

    history.replaceState(null, '', '?' + params.toString());
}

// NOTE: 从 URL 参数恢复 state
export function load() {
    var params = new URLSearchParams(window.location.search);
    if (!params.has('comp') && !params.has('t0')) return;

    if (params.has('comp')) state.compName = params.get('comp');

    // 恢复名字
    var i = 0;
    while (params.has('n' + i)) {
        if (i >= state.names.length) state.names.push('Name ' + String.fromCharCode(65 + i));
        state.names[i] = params.get('n' + i);
        i++;
    }

    // 恢复成绩
    var j = 0;
    while (params.has('t' + j)) {
        var parts = params.get('t' + j).split(',').map(Number);
        if (j >= state.times.length) state.times.push([0, 0, 0, 0, 0]);
        for (var k = 0; k < 5 && k < parts.length; k++) {
            state.times[j][k] = parts[k] || 0;
        }
        j++;
    }

    if (params.has('seed')) state.seedOn = parseInt(params.get('seed')) || 0;
    if (params.has('event')) state.event = params.get('event');

    updateSort();
}
