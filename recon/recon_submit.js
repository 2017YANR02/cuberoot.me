/**
 * Recon 客户端提交模块
 * 功能：模态框表单 → 调用 ReconStats 计算 → 插入表格 → localStorage 持久化
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'recon_local_solves';

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', function () {
        var addBtn = document.getElementById('btn-add-recon');
        if (!addBtn) return;
        addBtn.addEventListener('click', openModal);

        // NOTE: 页面加载时恢复 localStorage 中的本地复盘
        restoreLocalSolves();
    });

    // ==================== 模态框 ====================

    function openModal() {
        // NOTE: 如已存在则先移除
        var existing = document.getElementById('recon-modal');
        if (existing) existing.remove();

        var isZh = localStorage.getItem('i18n_locale') === 'zh';

        var modal = document.createElement('div');
        modal.id = 'recon-modal';
        modal.className = 'recon-modal-overlay';
        modal.innerHTML =
            '<div class="recon-modal">' +
            '<div class="recon-modal-header">' +
            '<h3>' + (isZh ? '➕ 添加复盘' : '➕ Add Recon') + '</h3>' +
            '<button class="recon-modal-close" id="modal-close">&times;</button>' +
            '</div>' +
            '<form id="recon-form" class="recon-form">' +
            '<div class="recon-form-row">' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '选手' : 'Solver') + '</label>' +
            '<input type="text" id="rf-solver" value="耿暄一" placeholder="耿暄一" required>' +
            '</div>' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '成绩 (秒)' : 'Time (sec)') + '</label>' +
            '<input type="text" id="rf-single" placeholder="3.05 或 305" required>' +
            '</div>' +
            '</div>' +
            '<div class="recon-form-row">' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '项目' : 'Event') + '</label>' +
            '<input type="text" id="rf-event" value="3x3" placeholder="3x3">' +
            '</div>' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '方法' : 'Method') + '</label>' +
            '<input type="text" id="rf-method" value="ZB" list="method-options" placeholder="ZB">' +
            '<datalist id="method-options">' +
            '<option value="CFOP">' +
            '<option value="ZB">' +
            '<option value="ZZ">' +
            '<option value="Roux">' +
            '<option value="Petrus">' +
            '<option value="LEOR">' +
            '</datalist>' +
            '</div>' +
            '</div>' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '复盘文本' : 'Reconstruction') + '</label>' +
            '<textarea id="rf-recon" rows="10" placeholder="' +
            (isZh ? '粘贴复盘文本...\n例如:\n33STM /3.05=10.82TPS\n...' : 'Paste reconstruction...\ne.g.:\n33STM /3.05=10.82TPS\n...') +
            '" required></textarea>' +
            '</div>' +
            '<div class="recon-form-actions">' +
            '<button type="button" id="rf-cancel" class="recon-btn">' + (isZh ? '取消' : 'Cancel') + '</button>' +
            '<button type="submit" class="recon-btn recon-btn-primary">' + (isZh ? '提交' : 'Submit') + '</button>' +
            '</div>' +
            '</form>' +
            '</div>';

        document.body.appendChild(modal);

        // NOTE: 绑定事件
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('rf-cancel').addEventListener('click', closeModal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });
        document.getElementById('recon-form').addEventListener('submit', handleSubmit);
    }

    function closeModal() {
        var modal = document.getElementById('recon-modal');
        if (modal) modal.remove();
    }

    // ==================== 提交处理 ====================

    function handleSubmit(e) {
        e.preventDefault();

        var solver = document.getElementById('rf-solver').value.trim();
        var rawSingle = document.getElementById('rf-single').value.trim();
        var event = document.getElementById('rf-event').value.trim() || '3x3';
        var method = document.getElementById('rf-method').value.trim() || 'ZB';
        var recon = document.getElementById('rf-recon').value;

        // NOTE: 成绩解析：3位整数(如 373)自动转为 3.73，支持直接输入 3.73
        var single = parseFloat(rawSingle);
        if (!isNaN(single) && single > 0 && Number.isInteger(single) && rawSingle.indexOf('.') < 0 && rawSingle.length === 3) {
            single = single / 100;
        }

        if (!solver || isNaN(single) || single <= 0 || !recon) return;

        // NOTE: 调用 JS 计算引擎
        var stats = ReconStats.computeAllStats(recon, single);

        var solve = {
            id: 'local_' + Date.now(),
            official: false,
            event: event,
            method: method,
            date: new Date().toISOString().split('T')[0],
            solver: solver,
            single: single,
            recon: recon,
            // NOTE: 标记为本地提交（未持久化到 git）
            _local: true
        };

        // NOTE: 合并统计字段
        var statFields = {
            stm: stats.stm, tps: stats.tps,
            oll: stats.ollFull, pll: stats.pllFull,
            ollShort: stats.ollShort, pllShort: stats.pllShort,
            freePair: stats.freePair, yRot: stats.yRot,
            regrip: stats.regrip, lockup: stats.lockup,
            crossType: stats.crossType, crossStm: stats.crossStm,
            f2l: stats.f2l, ll: stats.ll,
            sMove: stats.sMove, crossColor: stats.crossColor
        };
        for (var key in statFields) {
            var val = statFields[key];
            if (val !== null && val !== undefined && val !== '') {
                solve[key] = val;
            } else if (['freePair', 'yRot', 'regrip', 'lockup', 'crossType', 'sMove'].indexOf(key) >= 0 && val === 0) {
                solve[key] = 0;
            }
        }

        // NOTE: 保存到 localStorage
        saveLocalSolve(solve);

        // NOTE: 插入到全局数据并刷新表格
        // 通过自定义事件通知 recon.js
        window.dispatchEvent(new CustomEvent('recon-local-add', { detail: solve }));

        closeModal();
    }

    // ==================== localStorage 持久化 ====================

    function saveLocalSolve(solve) {
        var solves = getLocalSolves();
        solves.unshift(solve);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
    }

    function getLocalSolves() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function restoreLocalSolves() {
        var solves = getLocalSolves();
        if (solves.length === 0) return;
        // NOTE: 延迟发送，等 recon.js 初始化完成
        setTimeout(function () {
            solves.forEach(function (solve) {
                window.dispatchEvent(new CustomEvent('recon-local-add', { detail: solve }));
            });
        }, 500);
    }

})();
