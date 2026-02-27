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

        // NOTE: 监听删除事件，从 localStorage 或 Firestore 中移除
        window.addEventListener('recon-local-delete', function (e) {
            var id = e.detail;
            // NOTE: 本地复盘从 localStorage 删除
            var solves = getLocalSolves().filter(function (s) { return s.id !== id; });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
            // NOTE: 社区复盘从 Firestore 删除
            if (typeof ReconStore !== 'undefined' && id.indexOf('local_') !== 0) {
                ReconStore.deleteRecon(id).catch(function (err) {
                    console.error('Failed to delete from Firestore:', err);
                });
            }
        });
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
            '<input type="text" id="rf-event" value="3x3" list="event-options" placeholder="3x3">' +
            '<datalist id="event-options">' +
            '<option value="3x3">' +
            '<option value="2x2">' +
            '<option value="OH">' +
            '<option value="4x4">' +
            '<option value="5x5">' +
            '<option value="6x6">' +
            '<option value="7x7">' +
            '<option value="Mega">' +
            '<option value="Pyra">' +
            '<option value="Skewb">' +
            '<option value="SQ1">' +
            '</datalist>' +
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
            // NOTE: 比赛 + 轮次 + 第几把
            '<div class="recon-form-row">' +
            '<div class="recon-form-group" style="flex:2;position:relative">' +
            '<label>' + (isZh ? '比赛' : 'Competition') + '</label>' +
            '<input type="text" id="rf-comp" autocomplete="off" placeholder="' + (isZh ? '搜索比赛名称（可选）' : 'Search competition (optional)') + '">' +
            '<div id="rf-comp-dropdown" class="comp-dropdown"></div>' +
            '</div>' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '轮次' : 'Round') + '</label>' +
            '<select id="rf-round">' +
            '<option value="">—</option>' +
            '<option value="R1">R1</option>' +
            '<option value="R2">R2</option>' +
            '<option value="R3">R3</option>' +
            '<option value="Fi">Fi</option>' +
            '</select>' +
            '</div>' +
            '<div class="recon-form-group">' +
            '<label>' + (isZh ? '第几把' : 'Solve #') + '</label>' +
            '<select id="rf-solve-num">' +
            '<option value="">—</option>' +
            '<option value="1">#1</option>' +
            '<option value="2">#2</option>' +
            '<option value="3">#3</option>' +
            '<option value="4">#4</option>' +
            '<option value="5">#5</option>' +
            '</select>' +
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

        // NOTE: 带默认值的字段初始显示为灰色，focus 时变白
        ['rf-solver', 'rf-event', 'rf-method'].forEach(function (id) {
            var el = document.getElementById(id);
            el.classList.add('default-val');
            el.addEventListener('focus', function () {
                this.classList.remove('default-val');
                this.select();
            });
            el.addEventListener('blur', function () {
                // NOTE: 如果用户没改内容，恢复灰色
                var defaults = { 'rf-solver': '耿暄一', 'rf-event': '3x3', 'rf-method': 'ZB' };
                if (this.value === defaults[id]) this.classList.add('default-val');
            });
        });

        // NOTE: 从 comp_dates.json + comp_name_countries.json 加载比赛列表
        var compInput = document.getElementById('rf-comp');
        var compDropdown = document.getElementById('rf-comp-dropdown');
        var recentComps = []; // [{name, date, iso2}]

        Promise.all([
            fetch('/stats/comp_dates.json').then(function (r) { return r.json(); }),
            fetch('/stats/comp_name_countries.json').then(function (r) { return r.json(); })
        ]).then(function (results) {
            var compDateMap = results[0];
            var compCountryMap = results[1];

            // NOTE: 30 天前的日期字符串
            var cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            var cutoffStr = cutoff.toISOString().split('T')[0];
            var today = new Date().toISOString().split('T')[0];

            // NOTE: 筛选最近 30 天，过滤乱码（含 ? 的条目），按日期降序
            recentComps = Object.keys(compDateMap)
                .filter(function (name) {
                    var d = compDateMap[name];
                    return d >= cutoffStr && d <= today && name.indexOf('?') < 0;
                })
                .map(function (name) {
                    return {
                        name: name,
                        date: compDateMap[name],
                        iso2: (compCountryMap[name] || '').toLowerCase()
                    };
                })
                .sort(function (a, b) {
                    return b.date.localeCompare(a.date);
                });

            // NOTE: 初始显示全部近期比赛
            renderCompDropdown(recentComps, '');
        }).catch(function (e) {
            console.warn('Failed to load competition data:', e);
        });

        /** 渲染比赛下拉列表 */
        function renderCompDropdown(comps, query) {
            var q = query.toLowerCase();
            var filtered = q
                ? comps.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; })
                : comps;
            var html = '';
            filtered.slice(0, 30).forEach(function (c) {
                var flag = c.iso2 ? '<span class="fi fi-' + c.iso2 + '"></span> ' : '';
                html += '<div class="comp-dropdown-item" data-name="' + c.name.replace(/"/g, '&quot;') + '" data-date="' + c.date + '">' +
                    flag + '<span>' + c.name + '</span><small>' + c.date + '</small></div>';
            });
            if (!html && q) html = '<div class="comp-dropdown-empty">' + (localStorage.getItem('i18n_locale') === 'zh' ? '无匹配' : 'No match') + '</div>';
            compDropdown.innerHTML = html;
        }

        // NOTE: 输入时实时筛选
        compInput.addEventListener('input', function () {
            renderCompDropdown(recentComps, this.value);
            compDropdown.style.display = 'block';
        });

        // NOTE: focus 时显示下拉
        compInput.addEventListener('focus', function () {
            renderCompDropdown(recentComps, this.value);
            compDropdown.style.display = 'block';
        });

        // NOTE: 点击选中比赛
        compDropdown.addEventListener('mousedown', function (e) {
            var item = e.target.closest('.comp-dropdown-item');
            if (item) {
                compInput.value = item.dataset.name;
                compInput.dataset.autoDate = item.dataset.date;
                compDropdown.style.display = 'none';
            }
        });

        // NOTE: blur 时隐藏下拉
        compInput.addEventListener('blur', function () {
            setTimeout(function () { compDropdown.style.display = 'none'; }, 150);
        });
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
        var comp = document.getElementById('rf-comp').value.trim();
        var round = document.getElementById('rf-round').value;
        var solveNum = document.getElementById('rf-solve-num').value;

        // NOTE: 成绩解析：3位整数(如 373)自动转为 3.73，支持直接输入 3.73
        var single = parseFloat(rawSingle);
        if (!isNaN(single) && single > 0 && Number.isInteger(single) && rawSingle.indexOf('.') < 0 && rawSingle.length === 3) {
            single = single / 100;
        }

        if (!solver || isNaN(single) || single <= 0 || !recon) return;

        // NOTE: 调用 JS 计算引擎
        var stats = ReconStats.computeAllStats(recon, single);

        // NOTE: 日期自动匹配：如果选了已有比赛，用比赛日期；否则用今天
        var compInput = document.getElementById('rf-comp');
        var autoDate = compInput && compInput.dataset.autoDate;
        var date = autoDate || new Date().toISOString().split('T')[0];

        var solve = {
            id: 'local_' + Date.now(),
            official: false,
            event: event,
            method: method,
            date: date,
            solver: solver,
            single: single,
            recon: recon
        };
        if (comp) solve.comp = comp;
        if (round) solve.round = round;
        if (solveNum) solve.solveNum = parseInt(solveNum);

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

        // NOTE: 已登录 → 提交到 Firestore，未登录 → 保存到 localStorage
        var wcaUser = (typeof WcaAuth !== 'undefined') ? WcaAuth.getUser() : null;
        if (wcaUser && typeof ReconStore !== 'undefined') {
            solve.wcaId = wcaUser.wcaId;
            solve.displayName = wcaUser.name;
            solve._community = true;
            delete solve._local;
            delete solve.id;
            ReconStore.addRecon(solve).then(function (savedSolve) {
                window.dispatchEvent(new CustomEvent('recon-local-add', { detail: savedSolve }));
                closeModal();
            }).catch(function (err) {
                console.error('Failed to save to Firestore:', err);
                alert('提交失败: ' + err.message);
            });
        } else {
            // NOTE: 未登录，走本地 localStorage
            solve._local = true;
            saveLocalSolve(solve);
            window.dispatchEvent(new CustomEvent('recon-local-add', { detail: solve }));
            closeModal();
        }
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
