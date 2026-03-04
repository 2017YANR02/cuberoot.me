/**
 * Firestore 数据层
 * 功能：复盘数据的 CRUD 封装（读取、添加、删除社区复盘）
 * 依赖：Firebase SDK（通过 CDN compat 版本在 index.md 中引入）
 */
var ReconStore = (function () {
    'use strict';

    var db = null;
    var COLLECTION = 'recons';

    // ==================== 初始化 ====================

    /** 初始化 Firebase App 和 Firestore */
    function init() {
        if (db) return;
        // NOTE: Firebase compat SDK 配置
        var firebaseConfig = {
            apiKey: "AIzaSyAQ_eWVcdZGPc-Rww3poVxlGfY9LDSAB_Q",
            authDomain: "recon-stats.firebaseapp.com",
            projectId: "recon-stats",
            storageBucket: "recon-stats.firebasestorage.app",
            messagingSenderId: "676475351692",
            appId: "1:676475351692:web:503196f7f78122b26581a9"
        };

        // NOTE: 避免重复初始化
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
    }

    // ==================== 读取 ====================

    /** 加载所有社区复盘（按创建时间降序） */
    function loadAll() {
        init();
        return db.collection(COLLECTION)
            .orderBy('createdAt', 'desc')
            .get()
            .then(function (snapshot) {
                var solves = [];
                snapshot.forEach(function (doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    data._community = true;
                    solves.push(data);
                });
                return solves;
            });
    }

    // ==================== 写入 ====================

    /** 添加一条社区复盘 */
    function addRecon(solve) {
        init();
        // NOTE: 添加服务端时间戳
        solve.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        return db.collection(COLLECTION).add(solve).then(function (docRef) {
            solve.id = docRef.id;
            return solve;
        });
    }

    // ==================== 删除 ====================

    /** 删除一条社区复盘 */
    function deleteRecon(id) {
        init();
        return db.collection(COLLECTION).doc(id).delete();
    }

    // ==================== 按用户查询 ====================

    /** 加载指定用户的社区复盘 */
    function loadByUser(wcaId) {
        init();
        // NOTE: 不用 orderBy 避免需要复合索引，在 JS 端排序
        return db.collection(COLLECTION)
            .where('wcaId', '==', wcaId)
            .get()
            .then(function (snapshot) {
                var solves = [];
                snapshot.forEach(function (doc) {
                    var data = doc.data();
                    data.id = doc.id;
                    data._community = true;
                    solves.push(data);
                });
                // NOTE: 按创建时间降序排列
                solves.sort(function (a, b) {
                    var ta = a.createdAt ? a.createdAt.toMillis() : 0;
                    var tb = b.createdAt ? b.createdAt.toMillis() : 0;
                    return tb - ta;
                });
                return solves;
            });
    }

    // ==================== 管理员编辑覆盖层 ====================

    var EDITS_COLLECTION = 'recon_edits';
    var HISTORY_COLLECTION = 'recon_edit_history';

    /** 加载所有编辑覆盖（文档数通常很少） */
    function loadEdits() {
        init();
        return db.collection(EDITS_COLLECTION).get()
            .then(function (snapshot) {
                var edits = {};
                snapshot.forEach(function (doc) {
                    edits[doc.id] = doc.data();
                });
                return edits;
            });
    }

    /** 保存一条编辑覆盖（merge=true，只更新指定字段） */
    function saveEdit(solveId, fields) {
        init();
        fields._editedAt = firebase.firestore.FieldValue.serverTimestamp();
        return db.collection(EDITS_COLLECTION).doc(String(solveId)).set(fields, { merge: true });
    }

    /** 删除一条编辑覆盖（恢复原始数据） */
    function deleteEdit(solveId) {
        init();
        return db.collection(EDITS_COLLECTION).doc(String(solveId)).delete();
    }

    /** 记录编辑前后的快照（用于历史查看） */
    function saveEditHistory(solveId, beforeSnapshot, afterFields) {
        init();
        return db.collection(HISTORY_COLLECTION).add({
            solveId: String(solveId),
            before: beforeSnapshot,
            after: afterFields,
            editedBy: afterFields._editedBy || '',
            editedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    /** 获取某条 solve 的编辑历史（按时间降序，最多 20 条） */
    function getEditHistory(solveId) {
        init();
        return db.collection(HISTORY_COLLECTION)
            .where('solveId', '==', String(solveId))
            .orderBy('editedAt', 'desc')
            .limit(20)
            .get()
            .then(function (snapshot) {
                var history = [];
                snapshot.forEach(function (doc) {
                    var d = doc.data();
                    d.id = doc.id;
                    history.push(d);
                });
                return history;
            });
    }

    /** 更新已有社区复盘的指定字段 */
    function updateRecon(id, fields) {
        init();
        return db.collection(COLLECTION).doc(id).update(fields);
    }

    // NOTE: 导出公共 API
    return {
        init: init,
        loadAll: loadAll,
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
