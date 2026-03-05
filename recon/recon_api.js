/**
 * Recon API 数据层（替代 Firebase Firestore）
 * 功能：社区复盘的 CRUD，通过 fetch 调用阿里云 PHP 后端
 * NOTE: 变量名 ReconStore 保持不变，其他 JS 文件零改动
 */
var ReconStore = (function () {
    'use strict';

    // NOTE: API 基址——始终指向阿里云后端（国内可达）
    var API_BASE = 'https://toolkit.cuberoot.me/recon/api/';

    /** 通用 GET 请求 */
    function apiGet(params) {
        // NOTE: 加时间戳防止 Service Worker Cache API 命中旧缓存
        params._t = Date.now();
        var url = API_BASE + '?' + new URLSearchParams(params).toString();
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    /** 通用 POST 请求（自动携带 WCA access_token） */
    function apiPost(params, body) {
        var url = API_BASE + '?' + new URLSearchParams(params).toString();
        var headers = { 'Content-Type': 'application/json' };
        // NOTE: 携带 WCA access_token 供后端验证身份
        if (typeof WcaAuth !== 'undefined') {
            var token = WcaAuth.getAccessToken();
            if (token) headers['Authorization'] = 'Bearer ' + token;
        }
        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }).then(function (r) {
            if (r.status === 401) {
                if (typeof WcaAuth !== 'undefined') WcaAuth.logout();
                throw new Error('登录已过期，请重新登录');
            }
            // NOTE: 400 = 校验失败，解析后端返回的具体字段错误信息
            if (r.status === 400) {
                return r.json().then(function (data) {
                    throw new Error(data.fields ? data.fields.join('; ') : (data.error || 'Validation failed'));
                });
            }
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    // ==================== recons 集合 ====================

    /** 加载所有社区复盘（按创建时间降序） */
    function loadAll() {
        return apiGet({ action: 'list' });
    }

    /** 加载单条复盘（含编辑覆盖合并） */
    function loadOne(id) {
        return apiGet({ action: 'get', id: id });
    }

    /** 加载指定用户的社区复盘 */
    function loadByUser(wcaId) {
        return apiGet({ action: 'list', wcaId: wcaId });
    }

    /** 添加一条社区复盘 */
    function addRecon(solve) {
        return apiPost({ action: 'add' }, solve);
    }

    /** 删除一条社区复盘 */
    function deleteRecon(id) {
        return apiPost({ action: 'delete', id: id }, {});
    }

    /** 更新社区复盘的指定字段 */
    function updateRecon(id, fields) {
        return apiPost({ action: 'update', id: id }, fields);
    }

    // ==================== edits 集合 ====================

    /** 加载所有编辑覆盖 */
    function loadEdits() {
        return apiGet({ action: 'edits' });
    }

    /** 保存编辑覆盖（merge 模式） */
    function saveEdit(solveId, fields) {
        return apiPost({ action: 'saveEdit' }, { solveId: String(solveId), fields: fields });
    }

    /** 删除编辑覆盖 */
    function deleteEdit(solveId) {
        return apiPost({ action: 'deleteEdit', id: String(solveId) }, {});
    }

    // ==================== edit_history 集合 ====================

    /** 记录编辑历史 */
    function saveEditHistory(solveId, beforeSnapshot, afterFields) {
        return apiPost({ action: 'saveHistory' }, {
            solveId: String(solveId),
            before: beforeSnapshot,
            after: afterFields,
            editedBy: afterFields._editedBy || ''
        });
    }

    /** 获取编辑历史 */
    function getEditHistory(solveId) {
        return apiGet({ action: 'getHistory', id: String(solveId) });
    }

    // NOTE: 导出公共 API（签名与原 firebase_store.js 完全一致）
    return {
        init: function () { }, // NOTE: 无需初始化，保持接口兼容
        loadAll: loadAll,
        loadOne: loadOne,
        loadByUser: loadByUser,
        addRecon: addRecon,
        deleteRecon: deleteRecon,
        loadEdits: loadEdits,
        saveEdit: saveEdit,
        deleteEdit: deleteEdit,
        saveEditHistory: saveEditHistory,
        getEditHistory: getEditHistory,
        updateRecon: updateRecon
    };
})();
