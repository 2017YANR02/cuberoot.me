/**
 * Recon 列表页提交模块（精简版）
 * 功能：➕ 按钮跳转、本地复盘恢复、删除处理
 * 依赖：ReconLocalStore, ReconStore（通过 index.md 引入）
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        // NOTE: 页面加载时恢复 localStorage 中的本地复盘
        ReconLocalStore.restoreToRecon();

        // NOTE: 监听删除事件，从 localStorage 和后端中移除
        window.addEventListener('recon-local-delete', function (e) {
            var id = e.detail;
            ReconLocalStore.remove(id);
            // NOTE: 调用后端 API 删除
            if (typeof ReconStore !== 'undefined') {
                ReconStore.deleteRecon(id).catch(function (err) {
                    console.error('Failed to delete recon:', err);
                });
            }
        });
    });

})();
