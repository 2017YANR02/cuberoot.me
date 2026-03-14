// NOTE: 纯计算引擎 + 时间格式化工具
// 不含任何 UI/DOM 逻辑，所有模块共享的计算基础

// ── 常量 ──

export const DNF_VALUE = 1000000000;
export const UNFINISHED_VALUE = 2000000000;
export const MAX_TIME_VALUE = 8640000; // 24小时 (centiseconds)

// ── 时间格式化 ──

// NOTE: 统一的时间格式化函数（替代原 timeToText + CalcEngine.formatTime）
// cs: centiseconds 值
// axisLabel: true 时省略尾部 ".00"（用于 Y 轴刻度）
export function formatTime(cs, axisLabel = false) {
    if (cs === null || cs === undefined) return '-';
    var n = Math.floor(cs);
    if (n >= DNF_VALUE) return 'DNF';

    // NOTE: 通过 digit/separator 数组逐位拆解，自动处理 分:秒.厘秒 格式
    // digits[i] 是第 i 位的进制，separator[i] 是第 i 位前的分隔符
    var digits = [10, 10, 10, 6, 10, 6, 10, 10];
    var separator = ['', '', '.', '', ':', '', ':', '', '', '', '', ''];
    var result = '';
    var digitOn = 0;

    // 至少输出 3 位（厘秒2位 + 秒至少1位），更高位按需输出
    while (digitOn < 3 || n > 0) {
        result = (n % digits[digitOn]) + separator[digitOn] + result;
        n = Math.floor(n / digits[digitOn]);
        digitOn += 1;
    }

    // Y 轴标签省略整秒的 ".00" 后缀
    if (axisLabel && result.length >= 6 && result.substring(result.length - 3) === '.00') {
        result = result.substring(0, result.length - 3);
    }
    return result;
}

// NOTE: 文本输入转 centiseconds
// 支持格式: "536" → 5.36s, "5.36" → 5.36s, "1:23" → 1m23s, "dnf"/"d"/"n"/"f" → DNF
export function textToTime(s) {
    var dnf = 'dnf';
    for (var i = 0; i < dnf.length; i++) {
        if (s.toLowerCase().includes(dnf.charAt(i))) {
            return DNF_VALUE;
        }
    }
    var time = 0;
    var colonParts = s.split(':');
    var cpl = colonParts.length; // colonPartsLength
    var hours = (cpl >= 3) ? strToNumber(colonParts[cpl - 3], -1) : 0;
    var minutes = (cpl >= 2) ? strToNumber(colonParts[cpl - 2], -1) : 0;
    time += hours * 360000 + minutes * 6000;
    s = colonParts[cpl - 1];

    s = s.replace(',', '.'); // 兼容逗号作为小数点
    var periodIndex = s.indexOf('.');
    if (periodIndex >= 0) {
        var seconds = strToNumber(s.substring(0, periodIndex), -1);
        time += seconds * 100;
        s = s.substring(periodIndex + 1);
        if (s.length === 1) {
            time += strToNumber(s, -1) * 10; // 1位 → 十分之一秒
        } else {
            time += strToNumber(s, 2) * 1;   // 2位 → 厘秒
        }
    } else {
        // NOTE: 无小数点 — 无冒号时当 centiseconds，有冒号时当整秒
        var sec = strToNumber(s, -1);
        if (cpl === 1) {
            time += sec;       // 纯数字 → centiseconds（536 → 5.36 秒）
        } else {
            time += sec * 100; // 有冒号 → 整秒（1:23 中的 23 秒）
        }
    }
    if (time > MAX_TIME_VALUE) {
        time = MAX_TIME_VALUE;
    }
    return time;
}

// 从字符串中提取数字，digitsToInclude 限制截取位数（-1 表示不限）
function strToNumber(s, digitsToInclude) {
    var resultStr = s.replace(/\D/g, '');
    if (digitsToInclude >= 1) {
        resultStr = resultStr.substring(0, digitsToInclude);
    }
    var result = parseInt(resultStr);
    return Number.isNaN(result) ? 0 : result;
}

// NOTE: 序数词后缀（1st, 2nd, 3rd, 4th...）
export function rankify(s) {
    var es = (s + 1) % 100;
    var ending = 'th';
    if (es >= 10 && es < 20) {
        // 11th-19th 特殊
    } else if ((es % 10) === 1) {
        ending = 'st';
    } else if ((es % 10) === 2) {
        ending = 'nd';
    } else if ((es % 10) === 3) {
        ending = 'rd';
    }
    return (s + 1) + ending;
}

// ── 核心统计计算 ──

// NOTE: 平均值计算（自动适配 Mo3 和 Ao5）
// Mo3 (arr.length=3): 算术均值，任何 DNF = 整个 DNF
// Ao5 (arr.length=5): 去掉最好最差，取中间 3 次均值
// includeZeros: false 时遇到 0（未填）返回 UNFINISHED
export function getAverage(arr, includeZeros) {
    var n = arr.length;
    if (!includeZeros) {
        for (var i = 0; i < n; i++) {
            if (arr[i] === 0) return UNFINISHED_VALUE;
        }
    }
    var sorted = [...structuredClone(arr)].sort((a, b) => a - b);
    if (n <= 3) {
        // NOTE: Mo3 — 任何一个 DNF 则整个 Mean = DNF
        if (sorted[n - 1] >= DNF_VALUE) return DNF_VALUE;
        var sum = 0;
        for (var i = 0; i < n; i++) sum += sorted[i];
        return Math.round(sum / n);
    }
    // Ao5
    if (sorted[3] >= DNF_VALUE) return DNF_VALUE;
    return Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
}

// NOTE: 按平均值和最佳单次排序，返回索引数组
export function getSortedIndices(test, test2) {
    var len = test.length;
    var indices = new Array(len);
    for (var i = 0; i < len; ++i) indices[i] = i;
    indices.sort(function (a, b) {
        if (test[a] < test[b] || (test[a] === test[b] && test2[a] < test2[b])) return -1;
        if (test[a] > test[b] || (test[a] === test[b] && test2[a] > test2[b])) return 1;
        return 0;
    });
    return indices;
}

// NOTE: 最佳单次成绩（忽略 0 和 DNF）
export function getBestSingle(arr) {
    var record = DNF_VALUE;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] > 0 && arr[i] < record) {
            record = arr[i];
        }
    }
    return record;
}

// ── CalcEngine 命名空间 ──

// NOTE: 高级指标计算引擎，接收 5 个 centisecond 值，返回所有 WCA 衍生指标
export const CalcEngine = {

    // 主入口 — 返回值中 null 表示该指标无法计算（数据不足）
    // mo3Mode: true 时使用 Mo3 计算（算术均值，无 BPA/WPA 等）
    compute(times, mo3Mode) {
        var n = times.length;
        var filled = times.filter(t => t > 0);
        if (filled.length === 0) return null;

        var sorted = [...filled].sort((a, b) => a - b);
        var dnfCount = filled.filter(t => t >= DNF_VALUE).length;
        var nonDnf = sorted.filter(t => t < DNF_VALUE);

        var result = {};

        // ── Best / Worst ──
        result.best = nonDnf.length > 0 ? nonDnf[0] : DNF_VALUE;
        result.worst = filled.length > 0 ? sorted[sorted.length - 1] : null;

        if (filled.length < n) {
            result.complete = false;
            return result;
        }
        result.complete = true;

        if (mo3Mode) {
            // NOTE: Mo3 模式 — 算术均值，无 BPA/WPA/BestC/WorstC/BAo5/WAo5
            result.avg = (dnfCount > 0) ? DNF_VALUE
                : Math.round(filled.reduce((s, v) => s + v, 0) / n);

            // Mo2 / Mo3 — 连续 N 次的最佳算术均值
            for (var nn = 2; nn <= 3; nn++) {
                var key = 'mo' + nn;
                if (dnfCount > 0) {
                    result[key] = DNF_VALUE;
                } else {
                    var bestMean = Infinity;
                    for (var i = 0; i <= n - nn; i++) {
                        var sum = 0;
                        var hasDnf = false;
                        for (var j = i; j < i + nn; j++) {
                            if (times[j] >= DNF_VALUE) { hasDnf = true; break; }
                            sum += times[j];
                        }
                        if (!hasDnf) bestMean = Math.min(bestMean, Math.round(sum / nn));
                    }
                    result[key] = bestMean === Infinity ? DNF_VALUE : bestMean;
                }
            }
        } else {
            // NOTE: Ao5 模式
            // ── Ao5 ──
            result.avg = (dnfCount >= 2) ? DNF_VALUE
                : Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);

            // ── BAo5 — 去掉最差，取最好 3 次均值 ──
            result.bao5 = (nonDnf.length < 3) ? DNF_VALUE
                : Math.round((nonDnf[0] + nonDnf[1] + nonDnf[2]) / 3);

            // ── WAo5 — 去掉最好，取最差 3 次均值 ──
            result.wao5 = (dnfCount >= 1) ? DNF_VALUE
                : Math.round((sorted[2] + sorted[3] + sorted[4]) / 3);

            // ── Mo5 — 5 次算术均值 ──
            result.mo5 = (dnfCount > 0) ? DNF_VALUE
                : Math.round(filled.reduce((s, v) => s + v, 0) / 5);

            // ── BPA / WPA ──
            if (times.length === 5) {
                var baseForPa = filled.slice(0, 4);
                if (baseForPa.length === 4) {
                    var bpaArr = [...baseForPa, 0].sort((a, b) => a - b);
                    var bpaDnf = bpaArr.filter(t => t >= DNF_VALUE).length;
                    result.bpa = (bpaDnf >= 2) ? DNF_VALUE
                        : Math.round((bpaArr[1] + bpaArr[2] + bpaArr[3]) / 3);
                    var wpaArr = [...baseForPa, DNF_VALUE].sort((a, b) => a - b);
                    var wpaDnf = wpaArr.filter(t => t >= DNF_VALUE).length;
                    result.wpa = (wpaDnf >= 2) ? DNF_VALUE
                        : Math.round((wpaArr[1] + wpaArr[2] + wpaArr[3]) / 3);
                } else {
                    result.bpa = null;
                    result.wpa = null;
                }
            }

            // ── BestC / Median / WorstC — 计入成绩的最好/中位/最差 ──
            if (dnfCount >= 2) {
                result.bestC = result.median = result.worstC = DNF_VALUE;
            } else {
                result.bestC = sorted[1];
                result.median = sorted[2];
                result.worstC = sorted[3];
            }

            // ── Mo2 ~ Mo4 — 连续 N 次的最佳算术均值 ──
            for (var nn = 2; nn <= 4; nn++) {
                var key = 'mo' + nn;
                if (dnfCount > 0) {
                    result[key] = DNF_VALUE;
                } else {
                    var bestMean = Infinity;
                    for (var i = 0; i <= 5 - nn; i++) {
                        var sum = 0;
                        var hasDnf = false;
                        for (var j = i; j < i + nn; j++) {
                            if (times[j] >= DNF_VALUE) { hasDnf = true; break; }
                            sum += times[j];
                        }
                        if (!hasDnf) bestMean = Math.min(bestMean, Math.round(sum / nn));
                    }
                    result[key] = bestMean === Infinity ? DNF_VALUE : bestMean;
                }
            }
        }

        // NOTE: 以下指标 Mo3/Ao5 通用
        // ── Variance — 方差（秒²单位） ──
        if (result.avg !== DNF_VALUE && result.avg !== undefined) {
            var countingVals;
            if (mo3Mode) {
                countingVals = nonDnf;
            } else {
                countingVals = [sorted[1], sorted[2], sorted[3]];
            }
            var mean = countingVals.reduce((s, v) => s + v, 0) / countingVals.length;
            result.variance = countingVals.reduce((s, v) => s + (v - mean) ** 2, 0) / countingVals.length;
            result.variance = Math.round(result.variance) / 10000;
        } else {
            result.variance = null;
        }

        // ── Best/Avg 比率 ──
        result.bestAvgRatio = (result.avg !== DNF_VALUE && result.best !== DNF_VALUE)
            ? Math.round(result.best / result.avg * 100) / 100
            : null;

        return result;
    },

    // NOTE: 阈值计算 — 给定目标平均(tavg)，计算第 N 次成绩的阈值
    computeThresholds(times5, tavg) {
        if (!tavg || tavg <= 0 || tavg >= DNF_VALUE) return null;

        var filled = times5.filter(t => t > 0 && t < DNF_VALUE);
        var result = {};

        // ── t#5: 已有 4 次，第 5 把最多多少才能 Ao5 ≤ tavg ──
        // Math.round(v) <= tavg 当且仅当 v < tavg + 0.5
        // 整数: sum_of_counted <= 3*tavg + 1
        if (filled.length >= 4) {
            var s = [...filled.slice(0, 4)].sort((a, b) => a - b);
            if (s[1] + s[2] + s[3] <= 3 * tavg + 1) {
                result.t5 = DNF_VALUE; // 即使 DNF 也能达标
            } else {
                var threshold = 3 * tavg + 1 - s[1] - s[2];
                if (threshold < 0 || s[0] + s[1] + s[2] > 3 * tavg + 1) {
                    result.t5 = null; // NaN — 不可能达标
                } else {
                    result.t5 = threshold;
                }
            }
        }

        // ── t#4: 已有 3 次的阈值 ──
        if (filled.length >= 3) {
            var s3 = [...filled.slice(0, 3)].sort((a, b) => a - b);
            var threshold = 3 * tavg + 1 - s3[0] - s3[1];

            // BPA 场景（第 5 把 = 0）
            if (threshold < 0) {
                result.t4bpa = null;
            } else if (threshold >= s3[2]) {
                result.t4bpa = (s3[0] + s3[1] + s3[2] <= 3 * tavg + 1)
                    ? DNF_VALUE : 3 * tavg + 1 - s3[0] - s3[1];
            } else {
                result.t4bpa = threshold;
            }

            // WPA 场景（第 5 把 = DNF）
            result.t4wpa = (s3[0] + s3[1] + s3[2] <= 3 * tavg + 1)
                ? DNF_VALUE : null;
        }

        return result;
    },

    // NOTE: 委托给统一的 formatTime
    formatTime: (cs) => formatTime(cs),
};
