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

            // NOTE: 预填额外字段值（字段已在 HTML 中，不再动态创建）
            var officialEl = document.getElementById('rf-official');
            if (officialEl) officialEl.checked = !!s.official;
            EDIT_ONLY_FIELDS.forEach(function (f) {
                var el = document.getElementById('rf-edit-' + f.key);
                if (el) {
                    var val = s[f.key];
                    el.value = (val === undefined || val === null) ? '' : String(val);
                }
            });
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

            // NOTE: 清理不兼容符号 + 规范化步骤间距（共享工具函数）
            alg = ReconAlgUtils.cleanForPlayer(alg);

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

        // NOTE: 注册字段级 blur 即时校验
        setupBlurValidation();
    });

    // ==================== 字段级 Blur 校验 ====================

    /** 设置或清除单个字段的错误状态（红框 + 提示文字） */
    function setFieldError(inputEl, msg) {
        if (!inputEl) return;
        inputEl.classList.toggle('rf-field-error', !!msg);
        var existing = inputEl.parentElement.querySelector('.rf-error-msg');
        if (msg) {
            if (!existing) {
                existing = document.createElement('span');
                existing.className = 'rf-error-msg';
                inputEl.parentElement.appendChild(existing);
            }
            existing.textContent = msg;
        } else if (existing) {
            existing.remove();
        }
        // NOTE: 联动提交按钮——有任何字段错误时禁用
        updateSubmitButton();
    }

    /** 根据页面上是否存在字段错误来启用/禁用提交按钮 */
    function updateSubmitButton() {
        var btn = document.getElementById('rf-submit-btn');
        if (!btn) return;
        var hasErrors = document.querySelectorAll('.rf-field-error').length > 0;
        btn.disabled = hasErrors;
        btn.style.opacity = hasErrors ? '0.4' : '';
        btn.style.pointerEvents = hasErrors ? 'none' : '';
    }

    /** 给一个字段注册 blur 校验 */
    function addBlurCheck(id, checkFn) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('blur', function () {
            setFieldError(el, checkFn(el.value.trim()));
        });
    }

    /** 初始化所有字段的 blur 校验 */
    function setupBlurValidation() {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';

        addBlurCheck('rf-solver', function (v) {
            if (!v) return isZh ? '请输入选手名' : 'Solver is required';
            if (v.length > 100) return isZh ? '≤100字符' : '≤100 chars';
            return '';
        });

        addBlurCheck('rf-single', function (v) {
            if (!v) return isZh ? '请输入成绩' : 'Time is required';
            var n = parseFloat(v);
            if (isNaN(n) || n <= 0) return isZh ? '成绩必须是正数' : 'Must be a positive number';
            return '';
        });

        addBlurCheck('rf-event', function (v) {
            if (v.length > 20) return isZh ? '≤20字符' : '≤20 chars';
            return '';
        });

        addBlurCheck('rf-method', function (v) {
            if (v.length > 20) return isZh ? '≤20字符' : '≤20 chars';
            return '';
        });

        addBlurCheck('rf-comp', function (v) {
            if (v.length > 200) return isZh ? '≤200字符' : '≤200 chars';
            return '';
        });

        // NOTE: 编辑模式字段——动态创建后才存在，用 MutationObserver 等不值得
        // 直接尝试注册，不存在则跳过，编辑页刷新时这些字段已在 DOM 中
        addBlurCheck('rf-edit-date', function (v) {
            if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return isZh ? '格式: YYYY-MM-DD' : 'Format: YYYY-MM-DD';
            return '';
        });

        addBlurCheck('rf-edit-avg', function (v) {
            if (v && isNaN(parseFloat(v))) return isZh ? '必须是数字或留空' : 'Must be a number or empty';
            return '';
        });
    }

    // ==================== 校验工具 ====================

    /**
     * 校验表单字段，返回错误消息数组
     * NOTE: 与后端 validateRow() 规则对齐，前端校验只覆盖用户可输入的字段
     */
    function validateForm(isEditMode) {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        var errors = [];

        // --- 必填 + 类型校验 ---
        var solver = document.getElementById('rf-solver').value.trim();
        if (!solver) {
            errors.push(isZh ? '请输入选手名' : 'Solver is required');
        } else if (solver.length > 100) {
            errors.push(isZh ? '选手名不超过100字符' : 'Solver max 100 chars');
        }

        var rawSingle = document.getElementById('rf-single').value.trim();
        var single = parseFloat(rawSingle);
        // NOTE: 3位整数自动转换（如 305 → 3.05）
        if (!isNaN(single) && single > 0 && Number.isInteger(single) && rawSingle.indexOf('.') < 0 && rawSingle.length === 3) {
            single = single / 100;
        }
        if (!rawSingle || isNaN(single) || single <= 0) {
            errors.push(isZh ? '成绩必须是正数' : 'Time must be a positive number');
        }

        var recon = document.getElementById('rf-recon').value;
        if (!recon || !recon.trim()) {
            errors.push(isZh ? '请输入复盘文本' : 'Reconstruction is required');
        }

        // --- 长度校验 ---
        var event = document.getElementById('rf-event').value.trim();
        if (event.length > 20) {
            errors.push(isZh ? '项目名不超过20字符' : 'Event max 20 chars');
        }

        var method = document.getElementById('rf-method').value.trim();
        if (method.length > 20) {
            errors.push(isZh ? '方法名不超过20字符' : 'Method max 20 chars');
        }

        var comp = document.getElementById('rf-comp').value.trim();
        if (comp.length > 200) {
            errors.push(isZh ? '比赛名不超过200字符' : 'Competition max 200 chars');
        }

        // --- 日期校验 ---
        var dateEl = document.getElementById('rf-edit-date');
        if (dateEl) {
            var dateVal = dateEl.value.trim();
            if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                errors.push(isZh ? '日期格式必须是 YYYY-MM-DD' : 'Date must be YYYY-MM-DD');
            }
        }

        var avgEl = document.getElementById('rf-edit-avg');
        if (avgEl) {
            var avgVal = avgEl.value.trim();
            if (avgVal && isNaN(parseFloat(avgVal))) {
                errors.push(isZh ? '平均必须是数字或留空' : 'Average must be a number or empty');
            }
        }

        return errors;
    }

    /** 显示或隐藏错误提示框 */
    function showErrors(errors) {
        var el = document.getElementById('rf-errors');
        if (!el) return;
        if (errors.length === 0) {
            el.style.display = 'none';
            el.innerHTML = '';
            return;
        }
        var html = '<ul>';
        errors.forEach(function (msg) {
            html += '<li>' + msg + '</li>';
        });
        html += '</ul>';
        el.innerHTML = html;
        el.style.display = 'block';
        // NOTE: 滚动到错误提示位置
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ==================== 提交处理 ======================================

    function handleSubmit(e) {
        e.preventDefault();

        // NOTE: 统一校验，替换原有的静默 return
        var isEditMode = !!currentEditSolve;
        var errors = validateForm(isEditMode);
        if (errors.length > 0) {
            showErrors(errors);
            return;
        }
        showErrors([]); // NOTE: 清除之前的错误

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
                    // NOTE: 数字字段尝试转为 number
                    // HACK: rSingle/rAvg/rAoXR 等纪录字段是 VARCHAR 存储的标记（如 "WR"），
                    // 但值可能恰好是纯数字字符串（如 "3.73"），parseFloat 会把它转成 number，
                    // 导致前端 .toUpperCase() 调用 TypeError 崩溃，所以必须豁免
                    if (['avg', 'displaySingle', 'rSingle', 'rAvg', 'rAoXR'].indexOf(f.key) < 0 && !isNaN(val) && val !== '') {
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
            // NOTE: 所有数据都在 MariaDB，编辑统一走 edit overlay
            var savePromise = ReconStore.saveEdit(s.id, changedFields);
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

        if (!solver || isNaN(single) || single <= 0 || !recon) {
            // NOTE: 理论上不会到这里（validateForm 已拦截），保留作为兜底
            return;
        }

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

        // NOTE: 日期优先级：手动输入 > 比赛自动填充 > 今天
        var compInput = document.getElementById('rf-comp');
        var autoDate = compInput && compInput.dataset.autoDate;
        var manualDate = document.getElementById('rf-edit-date').value.trim();
        var date = manualDate || autoDate || new Date().toISOString().split('T')[0];

        // NOTE: 读取额外字段
        var officialEl = document.getElementById('rf-official');
        var official = officialEl ? officialEl.checked : false;
        var solverZh = document.getElementById('rf-edit-solverZh').value.trim();
        var displaySingle = document.getElementById('rf-edit-displaySingle').value.trim();
        var avg = document.getElementById('rf-edit-avg').value.trim();
        var aoType = document.getElementById('rf-edit-aoType').value.trim();
        var rAvg = document.getElementById('rf-edit-rAvg').value.trim();
        var rSingle = document.getElementById('rf-edit-rSingle').value.trim();
        var rAoXR = document.getElementById('rf-edit-rAoXR').value.trim();
        var cube = document.getElementById('rf-edit-cube').value.trim();
        var reconer = document.getElementById('rf-edit-reconer').value.trim();

        var solve = {
            id: 'local_' + Date.now(),
            official: official,
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
        if (solverZh) solve.solverZh = solverZh;
        if (displaySingle) solve.displaySingle = displaySingle;
        if (avg) solve.avg = parseFloat(avg);
        if (aoType) solve.aoType = aoType;
        if (rAvg) solve.rAvg = rAvg;
        if (rSingle) solve.rSingle = rSingle;
        if (rAoXR) solve.rAoXR = rAoXR;
        if (cube) solve.cube = cube;
        if (reconer) solve.reconer = reconer;

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
