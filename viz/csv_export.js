// NOTE: CSV 导出模块
// 生成全量统计 CSV 并触发浏览器下载
// 依赖：rolling_stats.js（RollingStats 全局对象）

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
   *   每项: { cs: number, compName: string, roundType: string, attemptIdx: number }
   * @param {Object} params.stats - RollingStats.compute() 的返回值
   */
  function download(params) {
    var entries = params.solveEntries;
    var stats = params.stats;
    var configs = RollingStats.getConfigs();

    // NOTE: 表头
    var headers = ['序号', '比赛', '日期', '轮次', '把数', '单次(秒)', '是否单次PB'];
    for (var c = 0; c < configs.length; c++) {
      headers.push(configs[c].label);
      headers.push('是否' + configs[c].label + 'PB');
    }

    var rows = [headers.join(',')];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var row = [];

      // 序号
      row.push(i + 1);
      // 比赛（含逗号时加引号）
      row.push(csvField(e.compName));
      // 日期
      row.push(e.compDate || '');
      // 轮次
      row.push(csvField(ROUND_NAMES[e.roundType] || e.roundType));
      // 把数
      row.push(e.attemptIdx + 1);
      // 单次（秒）
      row.push(formatCs(e.cs));
      // 是否单次 PB
      row.push(stats.pbFlags.singles[i] ? 'PB' : '');

      // 各 average
      for (var j = 0; j < configs.length; j++) {
        var key = configs[j].key;
        var val = stats[key][i];
        row.push(val === null ? '' : formatCs(val));
        row.push(stats.pbFlags[key][i] ? 'PB' : '');
      }

      rows.push(row.join(','));
    }

    var csv = rows.join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = params.wcaId + '_' + params.eventId + '_stats.csv';
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
