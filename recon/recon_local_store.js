/**
 * Recon localStorage 持久化共享模块
 * 功能：本地复盘的 CRUD 封装，供列表页和提交页共同使用
 */
var ReconLocalStore = (function () {
    'use strict';

    var STORAGE_KEY = 'recon_local_solves';

    /** 保存一条本地复盘（插入到头部） */
    function save(solve) {
        var solves = getAll();
        solves.unshift(solve);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
    }

    /** 获取所有本地复盘 */
    function getAll() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    /** 按 id 移除一条本地复盘 */
    function remove(id) {
        var solves = getAll().filter(function (s) { return s.id !== id; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
    }

    /**
     * 恢复本地复盘到表格
     * NOTE: 延迟发送 recon-local-add 事件，等 recon.js 初始化完成
     */
    function restoreToRecon() {
        var solves = getAll();
        if (solves.length === 0) return;
        setTimeout(function () {
            solves.forEach(function (solve) {
                window.dispatchEvent(new CustomEvent('recon-local-add', { detail: solve }));
            });
        }, 500);
    }

    return {
        save: save,
        getAll: getAll,
        remove: remove,
        restoreToRecon: restoreToRecon
    };
})();
