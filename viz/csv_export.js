// NOTE: CSV 导出模块
// 通过 CsvColumns 注册表动态获取所有列定义，生成全量统计 CSV 并触发浏览器下载
// 依赖：csv_columns.js（CsvColumns 全局对象）

(function () {
  'use strict';

  // NOTE: 轮次类型 ID → 可读名称
  var ROUND_NAMES = {
    '1': 'Round 1', 'd': 'Combined R1',
    '2': 'Round 2', 'b': 'Combined R2',
    '3': 'Semi Final', 'c': 'Combined Final', 'f': 'Final'
  };

  /**
   * NOTE: 生成并下载 CSV
   * @param {Object} params
   * @param {string} params.wcaId - 选手 WCA ID
   * @param {string} params.eventId - 项目 ID
   * @param {Array}  params.solveEntries - 扁平 solve 列表（按时间正序）
   * @param {Object} params.stats - RollingStats.compute() 的返回值
   * @param {Object} params.roundMetrics - RoundMetrics.compute() 的返回值
   *   （其他模块注册的 dataKey 也应在 params 中提供对应数据）
   */
  function download(params) {
    var entries = params.solveEntries;
    var groups = CsvColumns.all();

    // NOTE: 表头——固定列 + 注册列
    var headers = ['Index', 'Date', 'Competition', 'Round', 'Attempt', 'Single(s)', 'SinglePB'];
    for (var g = 0; g < groups.length; g++) {
      var configs = groups[g].configs;
      for (var c = 0; c < configs.length; c++) {
        headers.push(configs[c].label);
        headers.push(configs[c].label + 'PB');
      }
    }

    var rows = [headers.join(',')];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var row = [];

      // 固定列
      row.push(i + 1);
      row.push(e.compDate || '');
      row.push(csvField(e.compName));
      row.push(csvField(ROUND_NAMES[e.roundType] || e.roundType));
      row.push(e.attemptIdx + 1);
      row.push(formatCs(e.cs));
      // NOTE: 单次 PB 从第一个注册组（RollingStats）的 pbFlags.singles 取
      row.push(params.stats && params.stats.pbFlags.singles[i] ? 'PB' : '');

      // 注册列
      for (var g2 = 0; g2 < groups.length; g2++) {
        var data = params[groups[g2].dataKey];
        var cfgs = groups[g2].configs;
        for (var c2 = 0; c2 < cfgs.length; c2++) {
          var key = cfgs[c2].key;
          var val = data ? data[key][i] : null;
          row.push(val === null ? '' : formatCs(val));
          row.push(data && data.pbFlags[key][i] ? 'PB' : '');
        }
      }

      rows.push(row.join(','));
    }

    var csv = rows.join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = params.wcaId + '_' + params.eventId + '_distribution.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── 工具 ───

  function formatCs(cs) {
    if (cs <= 0) return 'DNF';
    return (cs / 100).toFixed(2);
  }

  function csvField(str) {
    if (/[,"\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  window.CsvExport = { download: download };
})();
