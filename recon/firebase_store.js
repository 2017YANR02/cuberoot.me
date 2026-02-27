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

    // NOTE: 导出公共 API
    return {
        init: init,
        loadAll: loadAll,
        loadByUser: loadByUser,
        addRecon: addRecon,
        deleteRecon: deleteRecon
    };
})();
