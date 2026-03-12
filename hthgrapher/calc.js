// NOTE: CubeRoot Calculator — 纯函数计算引擎
// 接收 5 个 centisecond 值，返回所有 WCA 衍生指标
// 时间格式：centiseconds（536 = 5.36 秒），DNF = 1e9

// NOTE: 与 carykh index.html 共享的常量
var DNF_VALUE = DNF_VALUE || 1000000000;

const CalcEngine = {

    // NOTE: 主入口 — 传入 5 个 centisecond 值（0 = 未填），返回指标对象
    // 返回值中 null 表示该指标无法计算（数据不足）
    compute(times5) {
        // 过滤出有效成绩（> 0 且非 UNFINISHED）
        const filled = times5.filter(t => t > 0);
        if (filled.length === 0) return null;

        const sorted = [...filled].sort((a, b) => a - b);
        // DNF 数量
        const dnfCount = filled.filter(t => t >= DNF_VALUE).length;
        // 非 DNF 成绩（用于 Best/Worst 等）
        const nonDnf = sorted.filter(t => t < DNF_VALUE);

        const result = {};

        // ── Best ──
        result.best = nonDnf.length > 0 ? nonDnf[0] : DNF_VALUE;

        // ── Worst ──
        result.worst = filled.length > 0 ? sorted[sorted.length - 1] : null;

        if (filled.length < 5) {
            // 不足 5 次，只返回基础指标
            result.complete = false;
            return result;
        }

        result.complete = true;

        // ── Ao5 (Avg) — WCA trimmed mean: 去掉最好最差，取中间 3 次均值 ──
        if (dnfCount >= 2) {
            result.avg = DNF_VALUE;
        } else {
            result.avg = Math.round((sorted[1] + sorted[2] + sorted[3]) / 3);
        }




        // ── BAo5 — 去掉最差，取剩余 4 次中最好 3 次均值 ──
        // sorted[0..3] 去掉 sorted[4]（最差），再去最好 sorted[0]，取 sorted[0..2] 均值
        // 实际上 BAo5 = 去掉最差的那次后，剩下4次取Ao4的BPA
        // BAo5 = mean(sorted[0], sorted[1], sorted[2])
        if (nonDnf.length < 3) {
            result.bao5 = DNF_VALUE;
        } else {
            result.bao5 = Math.round((nonDnf[0] + nonDnf[1] + nonDnf[2]) / 3);
        }

        // ── WAo5 — 去掉最好，取剩余 4 次中最差 3 次均值 ──
        // sorted[1..4] 去掉 sorted[0]（最好），再去最差 sorted[4]，取 sorted[2..4] 均值
        // 但如果有 DNF，WAo5 = DNF
        if (dnfCount >= 1) {
            result.wao5 = DNF_VALUE;
        } else {
            result.wao5 = Math.round((sorted[2] + sorted[3] + sorted[4]) / 3);
        }

        // ── Mo5 — 5 次算术均值（含 DNF 则 DNF）──
        if (dnfCount > 0) {
            result.mo5 = DNF_VALUE;
        } else {
            result.mo5 = Math.round(filled.reduce((s, v) => s + v, 0) / 5);
        }

        // ── BPA (sorted[0]) — 最佳可能成绩 ──
        result.bpa = nonDnf.length > 0 ? nonDnf[0] : DNF_VALUE;

        // ── WPA (sorted[3] 或 DNF) — 最差可能成绩（第4好的，因为只计3次）──
        if (dnfCount >= 2) {
            result.wpa = DNF_VALUE;
        } else {
            result.wpa = sorted[3];
        }

        // ── BestC — 最佳计入成绩（sorted[1]，Ao5 中间 3 次的最好）──
        if (dnfCount >= 2) {
            result.bestC = DNF_VALUE;
        } else {
            result.bestC = sorted[1];
        }

        // ── Median — 中位数（sorted[2]）──
        if (dnfCount >= 2) {
            result.median = DNF_VALUE;
        } else {
            result.median = sorted[2];
        }

        // ── WorstC — 最差计入成绩（sorted[3]，Ao5 中间 3 次的最差）──
        if (dnfCount >= 2) {
            result.worstC = DNF_VALUE;
        } else {
            result.worstC = sorted[3];
        }

        // ── Variance — 中间 3 次计入成绩的方差 ──
        if (result.avg !== DNF_VALUE) {
            const counting = [sorted[1], sorted[2], sorted[3]];
            const mean = counting.reduce((s, v) => s + v, 0) / 3;
            result.variance = counting.reduce((s, v) => s + (v - mean) ** 2, 0) / 3;
            // 转为秒单位显示（centiseconds² → seconds²，除以 10000）
            result.variance = Math.round(result.variance) / 10000;
        } else {
            result.variance = null;
        }

        // ── Best/Avg 比率 ──
        if (result.avg !== DNF_VALUE && result.best !== DNF_VALUE) {
            result.bestAvgRatio = Math.round(result.best / result.avg * 100) / 100;
        } else {
            result.bestAvgRatio = null;
        }

        // ── Mo2 ~ Mo4 — 连续 N 次的最佳算术均值 ──
        for (let n = 2; n <= 4; n++) {
            const key = 'mo' + n;
            if (dnfCount > 0) {
                result[key] = DNF_VALUE;
            } else {
                let bestMean = Infinity;
                // 滑动窗口：在原始时间序列上找最佳连续 N 次均值
                for (let i = 0; i <= 5 - n; i++) {
                    let sum = 0;
                    let hasDnf = false;
                    for (let j = i; j < i + n; j++) {
                        if (times5[j] >= DNF_VALUE) { hasDnf = true; break; }
                        sum += times5[j];
                    }
                    if (!hasDnf) {
                        bestMean = Math.min(bestMean, Math.round(sum / n));
                    }
                }
                result[key] = bestMean === Infinity ? DNF_VALUE : bestMean;
            }
        }




        return result;
    },

    // NOTE: 阈值计算 — 给定目标平均(tavg)，计算第 N 次成绩的阈值
    // tavg 单位：centiseconds
    computeThresholds(times5, tavg) {
        if (!tavg || tavg <= 0 || tavg >= DNF_VALUE) return null;

        const filled = times5.filter(t => t > 0 && t < DNF_VALUE);
        const result = {};

        // ── t#5: 已有 4 次非 DNF 成绩，第 5 把最多多少才能 Ao5 ≤ tavg ──
        if (filled.length >= 4) {
            var s = [...filled.slice(0, 4)].sort((a, b) => a - b);
            // Ao5 = mean(sorted middle 3)
            // 如果 x > s[3]（最差），x 被去掉，avg = (s[1]+s[2]+s[3])/3
            if ((s[1] + s[2] + s[3]) / 3 <= tavg) {
                // 即使 DNF 也能达标
                result.t5 = DNF_VALUE;
            } else {
                // x 在计入范围内：max x = 3*tavg - s[1] - s[2]
                var threshold = 3 * tavg - s[1] - s[2];
                if (threshold < 0 || (s[0] + s[1] + s[2]) / 3 > tavg) {
                    // 即使 x=0 也无法达标（前 3 个 counting 值已超标）
                    result.t5 = null; // NaN
                } else {
                    result.t5 = Math.floor(threshold);
                }
            }
        }

        // ── t#4 (BPA<=tavg): 已有 3 次，第 4 把最多多少才能让 BPA ≤ tavg ──
        // BPA 场景：第 5 把假设为 0（最佳情况）
        // 5 次排序 = {0, x, s[0], s[1], s[2]} 或其交错
        // 去掉最好(0)和最差，中间 3 次的均值 ≤ tavg
        if (filled.length >= 3) {
            var s3 = [...filled.slice(0, 3)].sort((a, b) => a - b);
            // 5 次 = {0, x, s3[0], s3[1], s3[2]}
            // 如果 x ≤ s3[0]: 排序 = 0, x, s3[0], s3[1], s3[2]
            //   去掉 0 和 s3[2]，中间 3 = x, s3[0], s3[1]
            //   (x + s3[0] + s3[1]) / 3 ≤ tavg → x ≤ 3*tavg - s3[0] - s3[1]
            var threshold = 3 * tavg - s3[0] - s3[1];
            if (threshold < 0) {
                result.t4bpa = null; // NaN
            } else if (threshold >= s3[2]) {
                // 如果阈值 ≥ s3[2]，x 可能落入不同排序位置
                // 检查 x > s3[2] 时：排序 = 0, s3[0], s3[1], s3[2], x
                // 中间 3 = s3[0], s3[1], s3[2]，avg = (s3[0]+s3[1]+s3[2])/3
                if ((s3[0] + s3[1] + s3[2]) / 3 <= tavg) {
                    result.t4bpa = DNF_VALUE; // 任何值都行
                } else {
                    // x 在 s3[1]~s3[2] 之间时：中间 3 取决于位置
                    // 最宽松 = 3*tavg - s3[0] - s3[1]（x 替代 s3[2]）
                    result.t4bpa = Math.floor(3 * tavg - s3[0] - s3[1]);
                }
            } else {
                result.t4bpa = Math.floor(threshold);
            }

            // ── t#4 (WPA<=tavg): 第 4 把阈值，WPA 场景（第 5 把 = DNF）──
            // 5 次 = {x, s3[0], s3[1], s3[2], DNF}
            // 去掉最好和 DNF，中间 3 取决于 x 位置
            // 如果 x ≤ s3[0]: 中间 3 = s3[0], s3[1], s3[2]
            //   avg = (s3[0]+s3[1]+s3[2])/3，不依赖 x
            var wpaFixed = (s3[0] + s3[1] + s3[2]) / 3;
            if (wpaFixed <= tavg) {
                // 即使第 5 把 DNF 也能达标
                result.t4wpa = DNF_VALUE;
            } else {
                // 不可能：无论 x 多小，WPA 都 > tavg
                result.t4wpa = null; // NaN
            }
        }

        return result;
    },

    // NOTE: 格式化 centiseconds 为时间字符串
    // 复用 carykh 的 timeToText 逻辑
    formatTime(cs) {
        if (cs === null || cs === undefined) return '-';
        if (cs >= DNF_VALUE) return 'DNF';
        // centiseconds → 分:秒.厘秒
        const n = Math.floor(cs);
        const centi = n % 100;
        const sec = Math.floor(n / 100) % 60;
        const min = Math.floor(n / 6000);
        const centiStr = centi.toString().padStart(2, '0');
        if (min > 0) {
            return min + ':' + sec.toString().padStart(2, '0') + '.' + centiStr;
        }
        return sec + '.' + centiStr;
    }
};
