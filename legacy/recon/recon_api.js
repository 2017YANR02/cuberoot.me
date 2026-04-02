/**
 * Recon API 数据层（适配 Hono RESTful 后端）
 * 功能：社区复盘的 CRUD，通过 fetch 调用 Hono API
 * NOTE: 变量名 ReconStore 保持不变，其他 JS 文件零改动
 * NOTE: 原 PHP ?action=xxx 接口已下线，现对接 /api/recon/* RESTful 路由
 */
var ReconStore = (function () {
    'use strict';

    // NOTE: API 基址——生产用 /api/recon（Nginx 反代到 Hono），
    //       localhost 开发环境跨域到 cuberoot.me
    var API_BASE = window.location.hostname.endsWith('cuberoot.me')
        ? '/api/recon'
        : 'https://www.cuberoot.me/api/recon';

    /** 构建 Authorization headers */
    function authHeaders(json) {
        var headers = {};
        if (json) headers['Content-Type'] = 'application/json';
        if (typeof WcaAuth !== 'undefined') {
            var token = WcaAuth.getAccessToken();
            if (token) headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    }

    /** 通用 GET 请求 */
    function apiGet(path, params) {
        var url = new URL(API_BASE + path, window.location.origin);
        if (params) {
            for (var k in params) {
                if (params[k] != null) url.searchParams.set(k, params[k]);
            }
        }
        // NOTE: 加时间戳防缓存
        url.searchParams.set('_t', Date.now());
        return fetch(url.toString(), { headers: authHeaders(false) }).then(function (r) {
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    /** 通用 POST 请求 */
    function apiPost(path, body) {
        return fetch(API_BASE + path, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify(body)
        }).then(function (r) {
            if (r.status === 401) {
                if (typeof WcaAuth !== 'undefined') WcaAuth.logout();
                throw new Error('登录已过期，请重新登录');
            }
            if (r.status === 400) {
                return r.json().then(function (data) {
                    throw new Error(data.fields ? data.fields.join('; ') : (data.error || 'Validation failed'));
                });
            }
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    /** 通用 PUT 请求 */
    function apiPut(path, body) {
        return fetch(API_BASE + path, {
            method: 'PUT',
            headers: authHeaders(true),
            body: JSON.stringify(body)
        }).then(function (r) {
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    /** 通用 DELETE 请求 */
    function apiDelete(path) {
        return fetch(API_BASE + path, {
            method: 'DELETE',
            headers: authHeaders(false)
        }).then(function (r) {
            if (!r.ok) throw new Error('API error: ' + r.status);
            return r.json();
        });
    }

    // ==================== recons 集合 ====================

    /** 加载所有社区复盘（按创建时间降序） */
    function loadAll() {
        return apiGet('/list');
    }

    /** 加载单条复盘（含编辑覆盖合并） */
    function loadOne(id) {
        return apiGet('/' + id);
    }

    /** 加载指定用户的社区复盘 */
    function loadByUser(wcaId) {
        return apiGet('/list', { wcaId: wcaId });
    }

    /** 添加一条社区复盘 */
    function addRecon(solve) {
        return apiPost('', solve);
    }

    /** 删除一条社区复盘 */
    function deleteRecon(id) {
        return apiDelete('/' + id);
    }

    /** 更新社区复盘的指定字段 */
    function updateRecon(id, fields) {
        return apiPut('/' + id, fields);
    }

    // ==================== edits 集合 ====================

    /** 加载所有编辑覆盖 */
    function loadEdits() {
        return apiGet('/edits');
    }

    /** 保存编辑覆盖（merge 模式） */
    function saveEdit(solveId, fields) {
        return apiPost('/save-edit', { solveId: String(solveId), fields: fields });
    }

    /** 删除编辑覆盖 */
    function deleteEdit(solveId) {
        return apiDelete('/edit/' + solveId);
    }

    // ==================== edit_history 集合 ====================

    /** 记录编辑历史 */
    function saveEditHistory(solveId, beforeSnapshot, afterFields) {
        return apiPost('/save-history', {
            solveId: String(solveId),
            before: beforeSnapshot,
            after: afterFields,
            editedBy: afterFields._editedBy || ''
        });
    }

    /** 获取编辑历史 */
    function getEditHistory(solveId) {
        return apiGet('/history', { id: String(solveId) });
    }

    // ==================== 评论 (comments) ====================

    /** 加载指定复盘的评论列表 */
    function loadComments(reconId) {
        return apiGet('/comments', { reconId: reconId });
    }

    /** 添加评论（每人每复盘一条） */
    function addComment(reconId, content) {
        return apiPost('/comments', { reconId: Number(reconId), content: content });
    }

    /** 更新评论内容 */
    function updateComment(commentId, content) {
        return apiPut('/comments/' + commentId, { content: content });
    }

    /** 删除评论 */
    function deleteComment(commentId) {
        return apiDelete('/comments/' + commentId);
    }

    // NOTE: 导出公共 API
    return {
        _apiBase: API_BASE, // NOTE: 供外部直接 fetch 用（如 userStats）
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
        updateRecon: updateRecon,
        loadComments: loadComments,
        addComment: addComment,
        updateComment: updateComment,
        deleteComment: deleteComment
    };
})();
