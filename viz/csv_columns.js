// NOTE: CSV 列注册中心
// 各统计模块注册自己的列定义，csv_export.js 统一遍历
// 这样新增指标模块只需在模块内 register()，csv_export.js 零修改

(function () {
  'use strict';

  var groups = [];

  window.CsvColumns = {
    /**
     * NOTE: 注册一组列
     * @param {Object} group
     * @param {string} group.dataKey - 数据在 download params 对象中的键名
     * @param {Array<{key: string, label: string}>} group.configs - 列配置
     */
    register: function (group) { groups.push(group); },
    all: function () { return groups; }
  };

  // NOTE: 代理注册 RollingStats 的列（rolling_stats.js 不可修改）
  // getConfigs() 返回 [{key, size, trim, label}]，只需 key 和 label
  CsvColumns.register({
    dataKey: 'stats',
    configs: RollingStats.getConfigs()
  });
})();
