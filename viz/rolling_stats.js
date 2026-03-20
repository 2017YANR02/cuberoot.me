// NOTE: 滚动统计计算引擎
// 输入 singles 数组（厘秒），输出 mo3/ao12/ao25/ao50/ao100 + PB 标记
// 供 viz 和 csv_export 共用

(function () {
  'use strict';

  // NOTE: WCA 标准 trimming 规则
  // mo3: 无 trim（纯均值），任一 DNF → 结果 DNF
  // aoN(N≥5): trim = max(1, floor(N * 0.05)) from each end
  // DNF 数 > trim → 结果 DNF
  var CONFIGS = [
    { key: 'mo3',   size: 3,   trim: 0,  label: 'Mo3'   },
    { key: 'ao12',  size: 12,  trim: 1,  label: 'Ao12'  },
    { key: 'ao25',  size: 25,  trim: 1,  label: 'Ao25'  },
    { key: 'ao50',  size: 50,  trim: 2,  label: 'Ao50'  },
    { key: 'ao100', size: 100, trim: 5,  label: 'Ao100' }
  ];

  /**
   * NOTE: 计算所有滚动统计
   * @param {Array<number>} singles - 按时间正序排列的厘秒数组
   *   >0 = 有效成绩, -1 = DNF, -2 = DNS, 0 = 空(跳过)
   * @returns {Object} 包含每种统计的结果数组和 PB 标记
   *   {
   *     singles: number[],     // 原始 singles（滤除空值后）
   *     mo3:   number[]|null,  // mo3[i] = 截至第 i 个 solve 的 Mo3（厘秒或 null=DNF/不足）
   *     ao12:  number[]|null,
   *     ...
   *     pbFlags: {             // pbFlags.singles[i] = true 表示该 solve 是单次 PB
   *       singles: boolean[],
   *       mo3: boolean[],
   *       ...
   *     }
   *   }
   */
  function compute(singles) {
    var result = { singles: singles };
    var pbFlags = { singles: [] };

    // NOTE: 单次 PB 标记
    var bestSingle = Infinity;
    for (var i = 0; i < singles.length; i++) {
      var v = singles[i];
      if (v > 0 && v < bestSingle) {
        bestSingle = v;
        pbFlags.singles.push(true);
      } else {
        pbFlags.singles.push(false);
      }
    }

    // NOTE: 逐个统计类型计算
    for (var c = 0; c < CONFIGS.length; c++) {
      var cfg = CONFIGS[c];
      var arr = new Array(singles.length);
      var pb = new Array(singles.length);
      var bestVal = Infinity;

      for (var j = 0; j < singles.length; j++) {
        if (j < cfg.size - 1) {
          // 不足窗口大小
          arr[j] = null;
          pb[j] = false;
          continue;
        }

        var val = computeWindow(singles, j - cfg.size + 1, j, cfg.trim, cfg.key === 'mo3');
        arr[j] = val;

        if (val !== null && val < bestVal) {
          bestVal = val;
          pb[j] = true;
        } else {
          pb[j] = false;
        }
      }

      result[cfg.key] = arr;
      pbFlags[cfg.key] = pb;
    }

    result.pbFlags = pbFlags;
    return result;
  }

  /**
   * NOTE: 计算单个窗口的 average/mean
   * @param {number[]} singles - 全部数据
   * @param {number} start - 窗口起始索引（含）
   * @param {number} end - 窗口结束索引（含）
   * @param {number} trim - 两端各 trim 掉的数量
   * @param {boolean} isMean - true=Mo3（无 trim，任一 DNF→DNF）
   * @returns {number|null} 厘秒或 null（DNF/无效）
   */
  function computeWindow(singles, start, end, trim, isMean) {
    var window = [];
    var dnfCount = 0;

    for (var i = start; i <= end; i++) {
      var v = singles[i];
      if (v <= 0) {
        // DNF(-1) 或 DNS(-2) 视为无效
        dnfCount++;
        window.push(Infinity); // 排序时排到最后
      } else {
        window.push(v);
      }
    }

    if (isMean) {
      // Mo3: 任一 DNF → 结果 DNF
      if (dnfCount > 0) return null;
      var sum = 0;
      for (var k = 0; k < window.length; k++) sum += window[k];
      return Math.round(sum / window.length);
    }

    // AoN: DNF 数超过 trim → 结果 DNF
    if (dnfCount > trim) return null;

    // 排序后去头尾 trim
    window.sort(function (a, b) { return a - b; });
    var trimmed = window.slice(trim, window.length - trim);
    var total = 0;
    for (var m = 0; m < trimmed.length; m++) total += trimmed[m];
    return Math.round(total / trimmed.length);
  }

  /**
   * NOTE: 获取配置信息（供 UI 使用）
   * @returns {Array<{key, size, trim, label}>}
   */
  function getConfigs() {
    return CONFIGS.slice();
  }

  window.RollingStats = {
    compute: compute,
    getConfigs: getConfigs
  };
})();
