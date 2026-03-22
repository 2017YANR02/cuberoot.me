// NOTE: 轮次衍生指标计算模块
// 对每轮的 attempts 计算 9 个指标（BAo5/WAo5/Mo5/BPA/WPA/Median/BestCounting/WorstCounting/Worst）
// 值放在轮次第一把，其余把为 null
// 依赖：csv_columns.js（CsvColumns 全局对象）

(function () {
  'use strict';

  var CONFIGS = [
    { key: 'bao5',   label: 'BAo5' },
    { key: 'wao5',   label: 'WAo5' },
    { key: 'mo5',    label: 'Mo5' },
    { key: 'bpa',    label: 'BPA' },
    { key: 'wpa',    label: 'WPA' },
    { key: 'median', label: 'Median' },
    { key: 'bestc',  label: 'BestC' },
    { key: 'worstc', label: 'WorstC' },
    { key: 'worst',  label: 'Worst' }
  ];

  /**
   * NOTE: 按轮次分组 solveEntries
   * 轮次边界 = compName 或 roundType 变化
   * 返回 [{ startIdx, endIdx, values: [cs, ...] }]
   */
  function groupByRound(entries) {
    var rounds = [];
    var start = 0;
    for (var i = 1; i <= entries.length; i++) {
      if (i === entries.length ||
          entries[i].compName !== entries[i - 1].compName ||
          entries[i].roundType !== entries[i - 1].roundType) {
        var values = [];
        for (var j = start; j < i; j++) values.push(entries[j].cs);
        rounds.push({ startIdx: start, endIdx: i - 1, values: values });
        start = i;
      }
    }
    return rounds;
  }

  /**
   * NOTE: 计算单轮的 9 个指标
   * values = 该轮所有 attempt 的厘秒值（>0 有效，≤0 = DNF/DNS）
   * 返回 { bao5, wao5, mo5, bpa, wpa, median, bestc, worstc, worst }（null = 无效）
   */
  function computeRound(values) {
    // NOTE: valid = 有效值升序排列
    var valid = [];
    for (var i = 0; i < values.length; i++) {
      if (values[i] > 0) valid.push(values[i]);
    }
    valid.sort(function (a, b) { return a - b; });
    var inv = values.length - valid.length;  // 无效成绩数
    var n = valid.length;

    var r = {};

    // BAo5: 最好 3 把均值，需 ≥3 有效
    r.bao5 = n >= 3 ? Math.round((valid[0] + valid[1] + valid[2]) / 3) : null;

    // WAo5: 最差 3 把均值，需全部有效
    r.wao5 = (inv === 0 && n >= 3)
      ? Math.round((valid[n - 1] + valid[n - 2] + valid[n - 3]) / 3) : null;

    // Mo5: 纯均值，需全部有效
    if (inv === 0 && n > 0) {
      var sum = 0;
      for (var k = 0; k < n; k++) sum += valid[k];
      r.mo5 = Math.round(sum / n);
    } else {
      r.mo5 = null;
    }

    // BPA: 前 4 把中最好 3 把均值
    var f4 = values.slice(0, 4);
    var f4v = [];
    for (var j = 0; j < f4.length; j++) {
      if (f4[j] > 0) f4v.push(f4[j]);
    }
    f4v.sort(function (a, b) { return a - b; });
    r.bpa = f4v.length >= 3 ? Math.round((f4v[0] + f4v[1] + f4v[2]) / 3) : null;

    // WPA: 前 4 把中最差 3 把均值，需前 4 把全部有效
    var f4inv = f4.length - f4v.length;
    r.wpa = (f4inv === 0 && f4v.length >= 3)
      ? Math.round((f4v[f4v.length - 1] + f4v[f4v.length - 2] + f4v[f4v.length - 3]) / 3) : null;

    // Median: 排序后第 3 个有效值，最多 2 个无效
    r.median = (inv <= 2 && n >= 3) ? valid[2] : null;

    // Best Counting: Ao5 中 counting 3 把的最小值 = sorted[1]
    // 1 DNF 时 DNF 是 dropped worst，sorted[1] 仍是 counting 最小
    r.bestc = (inv <= 1 && n >= 2) ? valid[1] : null;

    // Worst Counting: Ao5 中 counting 3 把的最大值
    if (inv === 0 && n >= 4) {
      // 5 有效：drop best(sorted[0]) + worst(sorted[4])，counting=[1,2,3]，worst=sorted[3]
      r.worstc = valid[n - 2];
    } else if (inv === 1 && n >= 3) {
      // 1 DNF：DNF=dropped worst，drop best(sorted[0])，counting=[1,2,...n-1]，worst=sorted[n-1]
      r.worstc = valid[n - 1];
    } else {
      r.worstc = null;
    }

    // Worst: 绝对最差把，需全部有效
    r.worst = (inv === 0 && n > 0) ? valid[n - 1] : null;

    return r;
  }

  /**
   * NOTE: 对全部 solveEntries 计算轮次指标
   * 返回与 RollingStats.compute() 同结构：
   *   { bao5: number[], ..., pbFlags: { bao5: boolean[], ... } }
   */
  function compute(entries) {
    var len = entries.length;
    var result = {};
    var pbFlags = {};

    // 初始化所有数组
    for (var c = 0; c < CONFIGS.length; c++) {
      var key = CONFIGS[c].key;
      result[key] = new Array(len);
      pbFlags[key] = new Array(len);
      for (var i = 0; i < len; i++) {
        result[key][i] = null;
        pbFlags[key][i] = false;
      }
    }

    var rounds = groupByRound(entries);

    // 每个指标的当前最佳（用于 PB 判定）
    var bests = {};
    for (var c2 = 0; c2 < CONFIGS.length; c2++) {
      bests[CONFIGS[c2].key] = Infinity;
    }

    for (var r = 0; r < rounds.length; r++) {
      var round = rounds[r];
      // NOTE: 少于 3 把的轮次跳过（部分指标需要至少 3 把）
      if (round.values.length < 3) continue;

      var metrics = computeRound(round.values);

      for (var c3 = 0; c3 < CONFIGS.length; c3++) {
        var k = CONFIGS[c3].key;
        var val = metrics[k];
        // 值放在轮次第一把
        result[k][round.startIdx] = val;
        if (val !== null && val < bests[k]) {
          bests[k] = val;
          pbFlags[k][round.startIdx] = true;
        }
      }
    }

    result.pbFlags = pbFlags;
    return result;
  }

  window.RoundMetrics = {
    compute: compute,
    getConfigs: function () { return CONFIGS.slice(); }
  };

  // NOTE: 注册到 CsvColumns
  CsvColumns.register({
    dataKey: 'roundMetrics',
    configs: CONFIGS
  });
})();
