/**
 * Recon 独立提交页面逻辑
 * 功能：表单交互、比赛搜索下拉、预览动画、实时统计、提交/编辑处理
 * 依赖：ReconStats, ReconStore, ReconLocalStore, WcaAuth（通过 index.md script 标签引入）
 */
(function () {
    'use strict';

    // NOTE: 编辑模式专用字段（新增模式不显示这些）
    var EDIT_ONLY_FIELDS = [
        { key: 'solverZh', labelEn: 'Solver(ZH)', labelZh: '选手(中文)' },
        { key: 'displaySingle', labelEn: 'Display', labelZh: '显示成绩' },
        { key: 'avg', labelEn: 'Average', labelZh: '平均' },
        { key: 'date', labelEn: 'Date', labelZh: '日期' },
        { key: 'aoType', labelEn: 'AoXR', labelZh: 'AoXR' },
        { key: 'rAvg', labelEn: 'Avg Record', labelZh: '平均纪录' },
        { key: 'rSingle', labelEn: 'Single Rec', labelZh: '单次纪录' },
        { key: 'rAoXR', labelEn: 'AoXR Rec', labelZh: 'AoXR纪录' },
        { key: 'cube', labelEn: 'Cube', labelZh: '魔方' },
        { key: 'reconer', labelEn: 'Reconer', labelZh: '复盘者' },
    ];

    // NOTE: 当前正在编辑的 solve 对象（null 表示新增模式）
    var currentEditSolve = null;

    document.addEventListener('DOMContentLoaded', function () {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';

        // ==================== 模式检测 ====================

        // NOTE: 从 sessionStorage 读取编辑数据，读取后立即移除防止刷新重复
        var editJson = sessionStorage.getItem('recon_edit_solve');
        if (editJson) {
            sessionStorage.removeItem('recon_edit_solve');
            try {
                currentEditSolve = JSON.parse(editJson);
            } catch (e) {
                console.error('Failed to parse edit solve data:', e);
            }
        }

        var isEditMode = !!currentEditSolve;

        // NOTE: 更新页面标题
        var titleEl = document.getElementById('submit-title');
        if (titleEl) {
            if (isEditMode) {
                titleEl.textContent = isZh ? '✏️ 编辑复盘' : '✏️ Edit Recon';
                titleEl.setAttribute('data-i18n-en', '✏️ Edit Recon');
                titleEl.setAttribute('data-i18n-zh', '✏️ 编辑复盘');
            }
            // NOTE: 新增模式使用 HTML 中的默认标题
        }

        // NOTE: 更新提交按钮文本
        var submitBtn = document.getElementById('rf-submit-btn');
        if (submitBtn && isEditMode) {
            submitBtn.textContent = isZh ? '保存修改' : 'Save Changes';
            submitBtn.setAttribute('data-i18n-en', 'Save Changes');
            submitBtn.setAttribute('data-i18n-zh', '保存修改');
        }

        // ==================== 编辑模式预填充 ====================

        if (isEditMode) {
            var s = currentEditSolve;
            document.getElementById('rf-solver').value = s.solver || '';
            document.getElementById('rf-single').value = s.single || '';
            document.getElementById('rf-event').value = s.event || '3x3';
            document.getElementById('rf-method').value = s.method || '';
            document.getElementById('rf-comp').value = s.comp || '';
            document.getElementById('rf-note').value = s.note || '';
            document.getElementById('rf-round').value = s.round || '';
            document.getElementById('rf-solve-num').value = s.solveNum ? String(s.solveNum) : '';

            // NOTE: 打乱预填充：优先用 wcaScramble，否则从 recon 文本第二行提取
            var scramblePrefill = s.wcaScramble || s.scramble || '';
            if (!scramblePrefill && s.recon) {
                var reconLines = s.recon.split('\n');
                if (reconLines.length >= 2 && /^\d+STM\s/i.test(reconLines[0])) {
                    scramblePrefill = reconLines[1].trim();
                }
            }
            document.getElementById('rf-scramble').value = scramblePrefill;
            // NOTE: recon 文本原样显示（含统计行），管理员可自行修改
            document.getElementById('rf-recon').value = s.recon || s.caption || '';

            // NOTE: 编辑专用字段——在 #rf-edit-fields 容器中动态插入
            var editFieldsContainer = document.getElementById('rf-edit-fields');
            if (editFieldsContainer) {
                // NOTE: official checkbox
                var officialHtml = '<div class="recon-form-row">' +
                    '<div class="recon-form-group">' +
                    '<label><input type="checkbox" id="rf-official"' + (s.official ? ' checked' : '') + '> ' +
                    (isZh ? '官方比赛' : 'Official') + '</label>' +
                    '</div></div>';

                var extraHtml = officialHtml;
                // NOTE: 两列排列编辑专用字段
                for (var i = 0; i < EDIT_ONLY_FIELDS.length; i += 2) {
                    extraHtml += '<div class="recon-form-row">';
                    for (var j = i; j < Math.min(i + 2, EDIT_ONLY_FIELDS.length); j++) {
                        var f = EDIT_ONLY_FIELDS[j];
                        var val = s[f.key];
                        if (val === undefined || val === null) val = '';
                        extraHtml += '<div class="recon-form-group">' +
                            '<label>' + (isZh ? f.labelZh : f.labelEn) + '</label>' +
                            '<input type="text" id="rf-edit-' + f.key + '" value="' + String(val).replace(/"/g, '&quot;') + '">' +
                            '</div>';
                    }
                    extraHtml += '</div>';
                }
                editFieldsContainer.innerHTML = extraHtml;
            }
        }

        // ==================== i18n placeholder 适配 ====================

        // NOTE: 根据语言切换 placeholder 文本
        if (isZh) {
            document.querySelectorAll('[data-i18n-placeholder-zh]').forEach(function (el) {
                el.placeholder = el.getAttribute('data-i18n-placeholder-zh');
            });
        } else {
            document.querySelectorAll('[data-i18n-placeholder-en]').forEach(function (el) {
                el.placeholder = el.getAttribute('data-i18n-placeholder-en');
            });
        }

        // ==================== 实时统计显示 ====================

        function updateStatsDisplay() {
            var recon = document.getElementById('rf-recon').value;
            var rawSingle = document.getElementById('rf-single').value.trim();
            var display = document.getElementById('rf-stats-display');
            if (!display || !recon) {
                if (display) { display.textContent = ''; display.style.display = 'none'; }
                return;
            }

            var single = parseFloat(rawSingle);
            // NOTE: 3位整数自动转换（如 305 → 3.05）
            if (!isNaN(single) && single > 0 && Number.isInteger(single) && rawSingle.indexOf('.') < 0 && rawSingle.length === 3) {
                single = single / 100;
            }

            var stats = ReconStats.computeAllStats(recon, single);
            if (stats.stm) {
                var parts = stats.stm + 'STM';
                if (!isNaN(single) && single > 0) {
                    parts += ' /' + single.toFixed(2) + '=' + (stats.tps || 0) + 'TPS';
                }
                display.textContent = parts;
                display.style.display = 'block';
            } else {
                display.textContent = '';
                display.style.display = 'none';
            }
        }
        document.getElementById('rf-recon').addEventListener('input', updateStatsDisplay);
        document.getElementById('rf-single').addEventListener('input', updateStatsDisplay);

        // NOTE: 编辑模式初始化时计算一次统计
        if (isEditMode) updateStatsDisplay();

        // ==================== 默认值灰色 ====================

        // NOTE: 带默认值的字段初始显示为灰色，focus 时变白
        ['rf-solver', 'rf-event', 'rf-method'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.classList.add('default-val');
            el.addEventListener('focus', function () {
                this.classList.remove('default-val');
                this.select();
            });
            el.addEventListener('blur', function () {
                var defaults = { 'rf-solver': '耿暄一', 'rf-event': '3x3', 'rf-method': 'ZB' };
                if (this.value === defaults[id]) this.classList.add('default-val');
            });
        });

        // ==================== 比赛搜索下拉 ====================

        var compInput = document.getElementById('rf-comp');
        var compDropdown = document.createElement('div');
        compDropdown.id = 'rf-comp-dropdown';
        compDropdown.className = 'comp-dropdown';
        document.body.appendChild(compDropdown);
        var recentComps = [];

        Promise.all([
            fetch('/stats/comp_dates.json').then(function (r) { return r.json(); }),
            fetch('/stats/comp_name_countries.json').then(function (r) { return r.json(); })
        ]).then(function (results) {
            var compDateMap = results[0];
            var compCountryMap = results[1];

            // NOTE: 30 天内的比赛
            var cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            var cutoffStr = cutoff.toISOString().split('T')[0];
            var today = new Date().toISOString().split('T')[0];

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
                    var dc = b.date.localeCompare(a.date);
                    return dc !== 0 ? dc : a.name.localeCompare(b.name);
                });

            renderCompDropdown(recentComps, '');
        }).catch(function (e) {
            console.warn('Failed to load competition data:', e);
        });

        function renderCompDropdown(comps, query) {
            var q = query.toLowerCase();
            var filtered = q
                ? comps.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; })
                : comps;
            var html = '';
            filtered.forEach(function (c) {
                var flag = c.iso2 ? '<span class="fi fi-' + c.iso2 + '"></span> ' : '';
                html += '<div class="comp-dropdown-item" data-name="' + c.name.replace(/"/g, '&quot;') + '" data-date="' + c.date + '">' +
                    '<small>' + c.date + '</small>' + flag + '<span>' + c.name + '</span></div>';
            });
            if (!html && q) {
                html = '<div class="comp-dropdown-empty">' + (isZh ? '无匹配' : 'No match') + '</div>';
            }
            compDropdown.innerHTML = html;
        }

        function positionDropdown() {
            var rect = compInput.getBoundingClientRect();
            var spaceBelow = window.innerHeight - rect.bottom;
            var spaceAbove = rect.top;
            compDropdown.style.left = rect.left + 'px';
            compDropdown.style.width = rect.width + 'px';
            if (spaceBelow >= spaceAbove) {
                compDropdown.style.top = rect.bottom + 'px';
                compDropdown.style.bottom = 'auto';
                compDropdown.style.maxHeight = (spaceBelow - 10) + 'px';
            } else {
                compDropdown.style.top = 'auto';
                compDropdown.style.bottom = (window.innerHeight - rect.top) + 'px';
                compDropdown.style.maxHeight = (spaceAbove - 10) + 'px';
            }
        }

        compInput.addEventListener('input', function () {
            renderCompDropdown(recentComps, this.value);
            positionDropdown();
            compDropdown.style.display = 'block';
        });

        compInput.addEventListener('focus', function () {
            renderCompDropdown(recentComps, this.value);
            positionDropdown();
            compDropdown.style.display = 'block';
        });

        compDropdown.addEventListener('mousedown', function (e) {
            var item = e.target.closest('.comp-dropdown-item');
            if (item) {
                compInput.value = item.dataset.name;
                compInput.dataset.autoDate = item.dataset.date;
                compDropdown.style.display = 'none';
            }
        });

        compInput.addEventListener('blur', function () {
            setTimeout(function () { compDropdown.style.display = 'none'; }, 150);
        });

        // ==================== 预览动画 ====================

        document.getElementById('rf-preview-btn').addEventListener('click', function () {
            var scramble = document.getElementById('rf-scramble').value.trim();
            var recon = document.getElementById('rf-recon').value.trim();
            if (!scramble && !recon) return;

            // NOTE: 从 recon 文本提取纯公式（去统计行、打乱行和注释）
            var reconLines = recon.split('\n');
            var scrambleLineIdx = -1;
            if (scramble && reconLines.length >= 2 && /^\d+STM\s/i.test(reconLines[0])) {
                if (reconLines[1].trim() === scramble) {
                    scrambleLineIdx = 1;
                }
            }
            var alg = reconLines
                .filter(function (line, idx) {
                    return idx !== scrambleLineIdx;
                })
                .map(function (line) {
                    var idx = line.indexOf('//');
                    return (idx >= 0 ? line.substring(0, idx) : line).trim();
                })
                .filter(function (line) {
                    return line.length > 0 && !/^\d+STM\s/i.test(line);
                })
                .join('\n');

            // NOTE: 清除 alg.cubing.net 不支持的复盘专用标记（卡顿·、换手↑↓、分数⅓⅔）
            alg = alg.replace(/[.·↑↓⅓⅔]/g, '');

            var url = 'https://alg.cubing.net/?setup=' + encodeURIComponent(scramble) +
                '&alg=' + encodeURIComponent(alg) +
                '&type=reconstruction&puzzle=3x3x3';

            var container = document.getElementById('rf-preview-container');
            var iframe = document.getElementById('rf-preview-iframe');
            iframe.src = url;
            container.style.display = 'block';
        });

        // ==================== 表单提交 ====================

        document.getElementById('recon-form').addEventListener('submit', handleSubmit);
    });

    // ==================== 提交处理 ====================

    function handleSubmit(e) {
        e.preventDefault();

        // ========== 编辑模式 ==========
        if (currentEditSolve) {
            var s = currentEditSolve;
            var newData = {
                solver: document.getElementById('rf-solver').value.trim(),
                single: parseFloat(document.getElementById('rf-single').value.trim()) || 0,
                event: document.getElementById('rf-event').value.trim() || '3x3',
                method: document.getElementById('rf-method').value.trim(),
                comp: document.getElementById('rf-comp').value.trim(),
                note: document.getElementById('rf-note').value.trim(),
                round: document.getElementById('rf-round').value,
                solveNum: document.getElementById('rf-solve-num').value ? parseInt(document.getElementById('rf-solve-num').value) : null,
                wcaScramble: document.getElementById('rf-scramble').value.trim(),
                recon: document.getElementById('rf-recon').value
            };
            // NOTE: official checkbox
            var officialEl = document.getElementById('rf-official');
            if (officialEl) newData.official = officialEl.checked;
            // NOTE: 读取编辑专用字段
            EDIT_ONLY_FIELDS.forEach(function (f) {
                var el = document.getElementById('rf-edit-' + f.key);
                if (el) {
                    var val = el.value.trim();
                    // NOTE: 数字字段尝试转为 number（avg/displaySingle 除外，它们可能含特殊格式）
                    if (['avg', 'displaySingle'].indexOf(f.key) < 0 && !isNaN(val) && val !== '') {
                        newData[f.key] = parseFloat(val);
                    } else {
                        newData[f.key] = val;
                    }
                }
            });
            // NOTE: 重新计算 STM/TPS
            if (newData.recon && typeof ReconStats !== 'undefined') {
                var stats = ReconStats.computeAllStats(newData.recon, newData.single);
                if (stats.stm) newData.stm = stats.stm;
                if (stats.tps) newData.tps = stats.tps;
            }
            // NOTE: 对比原始值和新值，只保存差异字段
            var changedFields = {};
            var beforeSnapshot = {};
            for (var key in newData) {
                var oldVal = s[key];
                var newVal = newData[key];
                if (String(newVal || '') !== String(oldVal || '')) {
                    changedFields[key] = newVal;
                    beforeSnapshot[key] = oldVal !== undefined ? oldVal : null;
                }
            }
            if (Object.keys(changedFields).length === 0) {
                // NOTE: 无变更，直接返回列表页
                location.href = '/recon/';
                return;
            }
            changedFields._editedBy = WcaAuth.getUser().wcaId;
            // NOTE: 保存编辑历史
            ReconStore.saveEditHistory(s.id, beforeSnapshot, changedFields);
            // NOTE: 根据数据来源选择保存方式
            var savePromise;
            if (s._community) {
                savePromise = ReconStore.updateRecon(s._firestoreId, changedFields);
            } else {
                savePromise = ReconStore.saveEdit(s.id, changedFields);
            }
            savePromise.then(function () {
                location.href = '/recon/';
            }).catch(function (err) {
                console.error('Failed to save edit:', err);
                alert('Save failed: ' + err.message);
            });
            return;
        }

        // ========== 新增模式 ==========

        var solver = document.getElementById('rf-solver').value.trim();
        var rawSingle = document.getElementById('rf-single').value.trim();
        var event = document.getElementById('rf-event').value.trim() || '3x3';
        var method = document.getElementById('rf-method').value.trim() || 'ZB';
        var scramble = document.getElementById('rf-scramble').value.trim();
        var recon = document.getElementById('rf-recon').value;
        var comp = document.getElementById('rf-comp').value.trim();
        var note = document.getElementById('rf-note').value.trim();
        var round = document.getElementById('rf-round').value;
        var solveNum = document.getElementById('rf-solve-num').value;

        // NOTE: 成绩解析：3位整数(如 373)自动转为 3.73
        var single = parseFloat(rawSingle);
        if (!isNaN(single) && single > 0 && Number.isInteger(single) && rawSingle.indexOf('.') < 0 && rawSingle.length === 3) {
            single = single / 100;
        }

        if (!solver || isNaN(single) || single <= 0 || !recon) return;

        var stats = ReconStats.computeAllStats(recon, single);

        // NOTE: 合并 recon 文本为标准三行格式：统计 + 打乱 + 解法
        var fullRecon = '';
        if (stats.stm) {
            fullRecon += stats.stm + 'STM /' + single.toFixed(2) + '=' + (stats.tps || 0) + 'TPS\n';
        }
        if (scramble) {
            fullRecon += scramble + '\n';
        }
        fullRecon += recon;

        // NOTE: 日期：如果选了比赛用比赛日期，否则用今天
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
            recon: fullRecon
        };
        if (comp) solve.comp = comp;
        if (scramble) solve.wcaScramble = scramble;
        if (note) solve.note = note;
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
            ReconStore.addRecon(solve).then(function () {
                location.href = '/recon/';
            }).catch(function (err) {
                console.error('Failed to save to Firestore:', err);
                alert((localStorage.getItem('i18n_locale') === 'zh' ? '提交失败: ' : 'Submit failed: ') + err.message);
            });
        } else {
            // NOTE: 未登录，走本地 localStorage
            solve._local = true;
            ReconLocalStore.save(solve);
            location.href = '/recon/';
        }
    }

})();
