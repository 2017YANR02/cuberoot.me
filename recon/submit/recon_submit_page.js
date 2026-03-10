/**
 * Recon 独立提交页面逻辑
 * 功能：表单交互、比赛搜索下拉、预览动画、实时统计、提交/编辑处理
 * 依赖：ReconStats, ReconStore, ReconLocalStore, WcaAuth（通过 index.md script 标签引入）
 */
(function () {
    'use strict';

    // NOTE: 编辑模式专用字段（新增模式不显示这些）
    var EDIT_ONLY_FIELDS = [
        { key: 'value', labelEn: 'Single', labelZh: '单次' },
        { key: 'average', labelEn: 'Average', labelZh: '平均' },
        { key: 'date', labelEn: 'Date', labelZh: '日期' },
        { key: 'aoType', labelEn: 'AoXR', labelZh: 'AoXR' },
        { key: 'regionalAverageRecord', labelEn: 'Avg Rec', labelZh: '平均纪录' },
        { key: 'regionalSingleRecord', labelEn: 'Single Rec', labelZh: '单次纪录' },
        { key: 'regionalAoxrRecord', labelEn: 'AoXR Rec', labelZh: 'AoXR纪录' },
        { key: 'optimalScramble', labelEn: 'Optimal Scramble', labelZh: '最少步打乱' },
        { key: 'cube', labelEn: 'Cube', labelZh: '魔方' },
        { key: 'reconer', labelEn: 'Reconer', labelZh: '复盘者' },
        { key: 'groupId', labelEn: 'Group', labelZh: '组' },
        { key: 'reconDate', labelEn: 'Recon Date', labelZh: '复盘日期' },
    ];

    // NOTE: 当前正在编辑的 solve 对象（null 表示新增模式）
    var currentEditSolve = null;
    // NOTE: 编辑模式下跳回详情页的 URL（Save / Cancel 使用，默认回列表页）
    var returnUrl = '/recon/';
    // NOTE: 比赛名 → WCA ID 映射表（initAutocomplete 加载后填充，handleSubmit 中查表）
    var compWcaIdMap = {};
    // NOTE: 比赛名 → 国家代码映射表（同上）
    var compCountryMap = {};

    document.addEventListener('DOMContentLoaded', function () {
        // NOTE: 实时读取 locale，避免闭包缓存导致的时序问题（i18n.js 可能在本脚本之后更新 localStorage）
        function isZh() { return localStorage.getItem('i18n_locale') === 'zh'; }

        // ==================== 通用人员富显示 ====================

        // NOTE: DOM 引用——选手和复盘者的 input + display div
        var solverInput = document.getElementById('rf-solver');
        var solverDisplay = document.getElementById('rf-solver-display');
        var reconerInput = document.getElementById('rf-edit-reconer');
        var reconerDisplay = document.getElementById('rf-reconer-display');

        /** 构建人员富显示 HTML（旗帜 + WCA ID 徽章 + 名字） */
        function buildPersonHtml(name, iso2, wcaId) {
            var flag = iso2 ? '<span class="fi fi-' + iso2 + '"></span> ' : '';
            var idBadge = wcaId ? '<span class="solver-wca-id">' + wcaId + '</span> ' : '';
            return flag + idBadge + '<span>' + name + '</span>';
        }

        /** 显示人员富内容 div，隐藏 input */
        function showPersonDisplay(displayEl, inputEl, name, iso2, wcaId) {
            displayEl.innerHTML = buildPersonHtml(name, iso2, wcaId)
                + '<span class="person-display-clear">&times;</span>';
            displayEl.style.display = 'flex';
            inputEl.style.display = 'none';
        }

        /** 隐藏富内容 div，恢复 input 可编辑 */
        function hidePersonDisplay(displayEl, inputEl) {
            displayEl.style.display = 'none';
            inputEl.style.display = '';
        }

        // ==================== 通用纪录富显示 ====================

        // NOTE: 所有可选纪录值（世界→洲际→国家→个人），供下拉列表使用
        var RECORD_OPTIONS = [
            'WR', 'WB', 'FWR', 'FWB', 'XWR', 'UWR', 'YTWR', 'YTWB',
            'WCR',
            'AsR', 'AsB', 'ER', 'EB', 'NAR', 'NAB', 'SAR', 'SAB', 'OcR', 'OcB', 'AfR', 'AfB', 'AnR', 'AnB',
            'FAsR', 'FAsB', 'FER', 'FEB', 'FNAR', 'FNAB', 'FSAR', 'FSAB', 'FOcR', 'FOcB', 'FAfR', 'FAfB', 'FAnR', 'FAnB',
            'YTAsR', 'YTAsB', 'YTER', 'YTEB', 'YTNAR', 'YTNAB', 'YTSAR', 'YTSAB', 'YTOcR', 'YTOcB', 'YTAfR', 'YTAfB', 'YTAnR', 'YTAnB',
            'XAsR', 'XAsB', 'XER', 'XEB', 'XNAR', 'XNAB', 'XSAR', 'XSAB', 'XOcR', 'XOcB', 'XAfR', 'XAfB', 'XAnR', 'XAnB',
            'NR', 'NB', 'FNR', 'FNB', 'XNR', 'XNB', 'YTNR', 'YTNB',
            'PR', 'PB', 'XPR', 'YTPR', 'YTPB'
        ];

        // NOTE: 工具引用——ReconUtils 在 recon_utils.js 中定义
        var RU = window.ReconUtils || {};

        /** 显示纪录 badge 富内容 div，隐藏 input */
        function showRecordDisplay(displayEl, inputEl, val) {
            var badgeHtml = RU.formatRecord ? RU.formatRecord(val) : val;
            displayEl.innerHTML = badgeHtml
                + '<span class="record-display-clear">&times;</span>';
            displayEl.style.display = 'flex';
            inputEl.style.display = 'none';
        }

        /** 隐藏纪录富内容 div，恢复 input */
        function hideRecordDisplay(displayEl, inputEl) {
            displayEl.style.display = 'none';
            inputEl.style.display = '';
        }

        /** 为一个 record input 绑定下拉搜索 + badge 富文本 */
        function bindRecordDropdown(inputEl, displayEl) {
            // NOTE: 创建下拉 DOM（三个字段各自独立，避免冲突）
            var dropdown = document.createElement('div');
            dropdown.className = 'record-dropdown';
            document.body.appendChild(dropdown);

            function renderOptions(query) {
                // NOTE: 检测 query 中是否含有取消关键词，若有则进入取消纪录模式
                var cancelMatch = query.match(/\bcancell?ed?\b|取消/i);
                var cancelKeyword = cancelMatch ? cancelMatch[0] : null;
                // NOTE: 过滤用的基准词——取消模式下剥离关键词后再过滤
                var baseQuery = cancelKeyword
                    ? query.replace(/\s*\bcancell?ed?\b\s*|\s*取消\s*/gi, '').trim()
                    : query;
                var q = baseQuery.toUpperCase();
                var filtered = q
                    ? RECORD_OPTIONS.filter(function (r) { return r.toUpperCase().indexOf(q) >= 0; })
                    : RECORD_OPTIONS;
                var html = '';
                filtered.forEach(function (r) {
                    // NOTE: 取消模式：下拉显示 "WR取消" / "WR cancel" 形式
                    var displayVal = cancelKeyword ? (r + cancelKeyword) : r;
                    var badge = RU.formatRecord ? RU.formatRecord(displayVal) : displayVal;
                    html += '<div class="record-dropdown-item" data-val="' + displayVal + '">'
                        + badge + '</div>';
                });
                dropdown.innerHTML = html || '<div style="padding:6px 12px;color:#666">'
                    + (isZh() ? '无匹配' : 'No match') + '</div>';
            }

            inputEl.addEventListener('focus', function () {
                if (displayEl.style.display !== 'none') return;
                renderOptions(this.value.trim());
                positionDropdownFor(inputEl, dropdown);
                dropdown.style.display = 'block';
            });

            inputEl.addEventListener('input', function () {
                renderOptions(this.value.trim());
                positionDropdownFor(inputEl, dropdown);
                dropdown.style.display = 'block';
            });

            dropdown.addEventListener('mousedown', function (e) {
                var item = e.target.closest('.record-dropdown-item');
                if (item) {
                    inputEl.value = item.dataset.val;
                    dropdown.style.display = 'none';
                    showRecordDisplay(displayEl, inputEl, item.dataset.val);
                }
            });

            inputEl.addEventListener('blur', function () {
                setTimeout(function () {
                    dropdown.style.display = 'none';
                    // NOTE: blur 时若有值且 display 未显示，自动显示 badge
                    var val = inputEl.value.trim();
                    if (val && displayEl.style.display === 'none') {
                        showRecordDisplay(displayEl, inputEl, val);
                    }
                }, 150);
            });

            // NOTE: 点击 display 或 × 按钮，恢复 input
            displayEl.addEventListener('click', function (e) {
                if (e.target.closest('.record-display-clear')) {
                    inputEl.value = '';
                }
                hideRecordDisplay(displayEl, inputEl);
                inputEl.focus();
            });
        }

        // NOTE: 绑定三个纪录字段
        var recFields = [
            { inputId: 'rf-edit-regionalSingleRecord', displayId: 'rf-singleRec-display' },
            { inputId: 'rf-edit-regionalAverageRecord', displayId: 'rf-avgRec-display' },
            { inputId: 'rf-edit-regionalAoxrRecord', displayId: 'rf-aoxrRec-display' }
        ];
        recFields.forEach(function (f) {
            var inp = document.getElementById(f.inputId);
            var disp = document.getElementById(f.displayId);
            if (inp && disp) bindRecordDropdown(inp, disp);
        });

        // ==================== 模式检测 ====================

        // NOTE: 从 URL ?id= 参数检测编辑模式（行业标准：纯 URL 驱动，不依赖 sessionStorage）
        var urlParams = new URLSearchParams(location.search);
        var editId = urlParams.get('id');

        // NOTE: 编辑模式下更新 returnUrl 为详情页 URL
        if (editId) {
            returnUrl = '/recon/detail/?id=' + editId;
            // NOTE: 更新返回箭头和 Cancel 链接的 href
            var backLink = document.querySelector('.detail-back-link');
            if (backLink) backLink.href = returnUrl;
            var cancelLink = document.querySelector('.recon-form-actions a');
            if (cancelLink) cancelLink.href = returnUrl;
        }

        // NOTE: 表单填充函数（编辑模式：API 返回后调用；新增模式：不调用）
        function populateForm(s) {
            currentEditSolve = s;

            document.getElementById('rf-solver').value = s.person || '';
            document.getElementById('rf-single').value = s.single || '';
            document.getElementById('rf-event').value = s.event || '3x3';
            document.getElementById('rf-method').value = s.method || '';
            document.getElementById('rf-comp').value = s.comp || '';
            document.getElementById('rf-note').value = s.note || '';
            document.getElementById('rf-round').value = s.round || '';
            document.getElementById('rf-solve-num').value = s.solveNum ? String(s.solveNum) : '';

            // NOTE: 打乱预填充：只用 wcaScramble（optimalScramble 有独立输入框）
            var scramblePrefill = s.wcaScramble || '';
            // NOTE: 解法优先用 solution 列（为未来移除 recon 做准备），fallback 解析 recon
            var solutionText = s.solution || s.caption || '';

            // NOTE: 如果用的是 recon（含统计行+打乱），需要剥离前两行
            if (!s.solution && solutionText) {
                var reconLines = solutionText.split('\n');
                if (reconLines.length >= 2 && /^\d+STM\s/i.test(reconLines[0])) {
                    // 第一行是统计行，第二行是打乱
                    if (!scramblePrefill) scramblePrefill = reconLines[1].trim();
                    solutionText = reconLines.slice(2).join('\n');
                }
            }

            document.getElementById('rf-scramble').value = scramblePrefill;
            document.getElementById('rf-recon').value = solutionText;

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

            // NOTE: 填充后更新统计显示
            updateStatsDisplay();

            // NOTE: 异步加载选手/复盘者富显示（搜索 WCA API 获取旗帜和 ID）
            tryShowPersonRichDisplay(s.person, solverDisplay, solverInput);
            var reconerVal = (s.reconer || '').trim();
            if (reconerVal) {
                tryShowPersonRichDisplay(reconerVal, reconerDisplay, reconerInput);
            }

            // NOTE: 比赛富显示——用 solve 自带的 country/date 直接渲染，
            // 不依赖 allComps 加载完成（解决 loadOne 比 allComps 先返回的竞态问题）
            if (s.comp) {
                var compIso2 = (s.country || '').toLowerCase();
                var compDate = s.date || '';
                showCompDisplay(s.comp, compDate, compIso2);
            }

            // NOTE: 纪录字段 badge 自动显示
            recFields.forEach(function (f) {
                var inp = document.getElementById(f.inputId);
                var disp = document.getElementById(f.displayId);
                if (inp && disp && inp.value.trim()) {
                    showRecordDisplay(disp, inp, inp.value.trim());
                }
            });
        }

        /** 尝试通过 searchSolvers API 查询人员信息并显示富内容 */
        function tryShowPersonRichDisplay(name, displayEl, inputEl) {
            if (!name) return;
            // NOTE: 搜索中先显示 loading 状态（spinner + 名字）
            displayEl.innerHTML = '<span class="solver-spinner"></span> <span>' + name + '</span>';
            displayEl.style.display = 'flex';
            inputEl.style.display = 'none';

            var API = 'https://toolkit.cuberoot.me/recon/api/';
            fetch(API + '?action=searchSolvers&q=' + encodeURIComponent(name))
                .then(function (r) { return r.json(); })
                .then(function (results) {
                    if (!results || results.length === 0) {
                        // NOTE: 搜索无结果，显示纯名字（无旗帜/ID）
                        showPersonDisplay(displayEl, inputEl, name, '', '');
                        return;
                    }
                    // NOTE: 精确匹配名字（大小写不敏感）
                    var match = null;
                    for (var i = 0; i < results.length; i++) {
                        if (results[i].name.toLowerCase() === name.toLowerCase()) {
                            match = results[i];
                            break;
                        }
                    }
                    if (!match) match = results[0];
                    showPersonDisplay(displayEl, inputEl, inputEl.value || name, match.iso2 || '', match.wcaId || '');
                })
                .catch(function () {
                    // NOTE: 搜索失败回退为纯名字显示
                    showPersonDisplay(displayEl, inputEl, name, '', '');
                });
        }

        // NOTE: 设置编辑模式 UI（标题、按钮文本）
        function applyEditModeUI() {
            var titleEl = document.getElementById('submit-title');
            if (titleEl) {
                titleEl.textContent = isZh() ? '✏️ 编辑复盘' : '✏️ Edit Recon';
                titleEl.setAttribute('data-i18n-en', '✏️ Edit Recon');
                titleEl.setAttribute('data-i18n-zh', '✏️ 编辑复盘');
            }
            var submitBtn = document.getElementById('rf-submit-btn');
            if (submitBtn) {
                submitBtn.textContent = isZh() ? '保存' : 'Save';
                submitBtn.setAttribute('data-i18n-en', 'Save');
                submitBtn.setAttribute('data-i18n-zh', '保存');
            }
        }

        // NOTE: 统一登录守卫——新增和编辑都需要登录（后端 API 也有 token 验证兜底）
        if (!WcaAuth.isLoggedIn()) {
            alert(isZh() ? '请先登录 WCA 账号' : 'Please log in with your WCA account first');
            WcaAuth.login();
            return;
        }

        // NOTE: 编辑模式：从 API 异步加载数据
        if (editId) {
            applyEditModeUI();
            // NOTE: 加载中禁用表单，防止用户误操作
            var form = document.getElementById('recon-form');
            var loadingEl = document.getElementById('rf-stats-display');
            if (loadingEl) {
                loadingEl.textContent = isZh() ? '加载中...' : 'Loading...';
                loadingEl.style.display = 'block';
            }
            if (form) form.style.opacity = '0.5';

            ReconStore.loadOne(editId).then(function (solve) {
                if (form) form.style.opacity = '';
                if (loadingEl) { loadingEl.textContent = ''; loadingEl.style.display = 'none'; }
                if (!solve || !solve.id) {
                    alert(isZh() ? '复盘 #' + editId + ' 不存在' : 'Recon #' + editId + ' not found');
                    location.href = '/recon/';
                    return;
                }
                // NOTE: 权限检查——仅管理员或添加者可编辑（登录已在上方统一守卫中确保）
                var user = WcaAuth.getUser();
                var canEdit = WcaAuth.isAdmin() || (user && solve.addedById && user.wcaId === solve.addedById);
                if (!canEdit) {
                    alert(isZh() ? '无编辑权限' : 'No edit permission');
                    location.href = '/recon/detail/?id=' + editId;
                    return;
                }
                populateForm(solve);
            }).catch(function (err) {
                if (form) form.style.opacity = '';
                if (loadingEl) { loadingEl.textContent = ''; loadingEl.style.display = 'none'; }
                console.error('Failed to load solve:', err);
                alert((isZh() ? '加载失败: ' : 'Load failed: ') + err.message);
            });
        }

        // ==================== i18n placeholder 适配 ====================

        // NOTE: 根据语言切换 placeholder 文本
        if (isZh()) {
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
                    // NOTE: 用截断（非四舍五入）保持与 parseTps 的 Math.floor 逻辑一致
                    var floored = Math.floor(single * 100) / 100;
                    parts += ' /' + floored.toFixed(2) + '=' + (stats.tps || 0) + 'TPS';
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

        // NOTE: 编辑模式的统计更新在 populateForm() 中自动调用

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
        var compDisplay = document.getElementById('rf-comp-display');
        var compDropdown = document.createElement('div');
        compDropdown.id = 'rf-comp-dropdown';
        compDropdown.className = 'comp-dropdown';
        document.body.appendChild(compDropdown);
        var recentComps = [];
        var allComps = [];
        // NOTE: 提升到闭包作用域，供 buildCompHtml 使用
        var compNamesZh = {};

        // NOTE: 共享 HTML 构建——下拉项和选中态 display 复用（DRY）
        function buildCompHtml(name, date, iso2) {
            var flag = iso2 ? '<span class="fi fi-' + iso2 + '"></span> ' : '';
            var displayName = (isZh() && compNamesZh[name]) ? compNamesZh[name] : name;
            return '<small>' + date + '</small>' + flag + '<span>' + displayName + '</span>';
        }

        // NOTE: 选中比赛后显示富内容 div，隐藏 input
        function showCompDisplay(name, date, iso2) {
            compDisplay.innerHTML = buildCompHtml(name, date, iso2)
                + '<span class="comp-display-clear">&times;</span>';
            compDisplay.style.display = 'flex';
            compInput.style.display = 'none';
        }

        // NOTE: 清除选中态，恢复 input 可编辑
        function hideCompDisplay() {
            compDisplay.style.display = 'none';
            compInput.style.display = '';
        }

        // NOTE: 从 allComps 查找比赛信息（编辑模式加载和 blur 恢复用）
        function findComp(name) {
            for (var i = 0; i < allComps.length; i++) {
                if (allComps[i].name === name) return allComps[i];
            }
            return null;
        }

        Promise.all([
            fetch('/stats/comp_dates.json').then(function (r) { return r.json(); }),
            fetch('/stats/comp_name_countries.json').then(function (r) { return r.json(); }),
            fetch('/recon/comp_names_zh.json').then(function (r) { return r.json(); }).catch(function () { return {}; }),
            fetch('/stats/comp_name_to_wca_id.json').then(function (r) { return r.json(); }).catch(function () { return {}; })
        ]).then(function (results) {
            var compDateMap = results[0];
            compCountryMap = results[1];
            compNamesZh = results[2];
            compWcaIdMap = results[3];

            // NOTE: 构建 cell_name → name 反向映射（用于搜索时匹配全称）
            // comp_name_to_wca_id 包含两种键：cell_name 和 name，映射到同一个 WCA ID
            var wcaIdToCellName = {};
            var wcaIdToFullName = {};
            Object.keys(compWcaIdMap).forEach(function (k) {
                var wcaId = compWcaIdMap[k];
                // cell_name 已存在于 compDateMap 中；name 不在 compDateMap 中
                if (compDateMap[k]) {
                    wcaIdToCellName[wcaId] = k;
                } else {
                    wcaIdToFullName[wcaId] = k;
                }
            });
            // cell_name → name 别名映射
            var compAliases = {};
            Object.keys(wcaIdToCellName).forEach(function (wcaId) {
                if (wcaIdToFullName[wcaId]) {
                    compAliases[wcaIdToCellName[wcaId]] = wcaIdToFullName[wcaId];
                }
            });

            // NOTE: 30 天内的比赛
            var cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            var cutoffStr = cutoff.toISOString().split('T')[0];
            var today = new Date().toISOString().split('T')[0];

            // NOTE: 全量比赛列表（关键字搜索用）
            allComps = Object.keys(compDateMap)
                .filter(function (name) { return name.indexOf('?') < 0; })
                .map(function (name) {
                    return {
                        name: name,
                        nameZh: compNamesZh[name] || '',
                        nameAlt: compAliases[name] || '',  // NOTE: 全称别名（搜索用）
                        date: compDateMap[name],
                        iso2: (compCountryMap[name] || '').toLowerCase()
                    };
                })
                .sort(function (a, b) {
                    var dc = b.date.localeCompare(a.date);
                    return dc !== 0 ? dc : a.name.localeCompare(b.name);
                });

            recentComps = allComps.filter(function (c) {
                return c.date >= cutoffStr && c.date <= today;
            });

            renderCompDropdown(recentComps, '');

            // NOTE: 时序安全——若 populateForm 已先于 fetch 完成，此时 input 有值但 display 未显示
            var prefilledComp = compInput.value.trim();
            if (prefilledComp) {
                var found = findComp(prefilledComp);
                if (found) showCompDisplay(found.name, found.date, found.iso2);
            }
        }).catch(function (e) {
            console.warn('Failed to load competition data:', e);
        });

        function renderCompDropdown(comps, query) {
            var q = query.toLowerCase();
            var filtered = q
                ? comps.filter(function (c) {
                    return c.name.toLowerCase().indexOf(q) >= 0 ||
                        c.date.indexOf(q) >= 0 ||
                        (c.nameZh && c.nameZh.indexOf(query) >= 0) ||
                        (c.nameAlt && c.nameAlt.toLowerCase().indexOf(q) >= 0);
                })
                : comps;
            var html = '';
            filtered.forEach(function (c) {
                // NOTE: 复用 buildCompHtml 构建下拉项内容（DRY）
                html += '<div class="comp-dropdown-item" data-name="' + c.name.replace(/"/g, '&quot;') + '" data-date="' + c.date
                    + '" data-iso2="' + (c.iso2 || '') + '">' + buildCompHtml(c.name, c.date, c.iso2) + '</div>';
            });
            if (!html && q) {
                html = '<div class="comp-dropdown-empty">' + (isZh() ? '无匹配' : 'No match') + '</div>';
            }
            compDropdown.innerHTML = html;
        }

        // NOTE: 通用下拉定位函数——根据输入框位置和屏幕空间自动选择向上/向下展开
        function positionDropdownFor(inputEl, dropdownEl) {
            var rect = inputEl.getBoundingClientRect();
            var spaceBelow = window.innerHeight - rect.bottom;
            var spaceAbove = rect.top;
            dropdownEl.style.left = rect.left + 'px';
            dropdownEl.style.width = rect.width + 'px';
            if (spaceBelow >= spaceAbove) {
                dropdownEl.style.top = rect.bottom + 'px';
                dropdownEl.style.bottom = 'auto';
                dropdownEl.style.maxHeight = (spaceBelow - 10) + 'px';
            } else {
                dropdownEl.style.top = 'auto';
                dropdownEl.style.bottom = (window.innerHeight - rect.top) + 'px';
                dropdownEl.style.maxHeight = (spaceAbove - 10) + 'px';
            }
        }

        compInput.addEventListener('input', function () {
            // NOTE: 有输入时搜索全量比赛，空输入时显示近期比赛
            var q = this.value.trim();
            renderCompDropdown(q ? allComps : recentComps, q);
            positionDropdownFor(compInput, compDropdown);
            compDropdown.style.display = 'block';
        });

        compInput.addEventListener('focus', function () {
            var q = this.value.trim();
            renderCompDropdown(q ? allComps : recentComps, q);
            positionDropdownFor(compInput, compDropdown);
            compDropdown.style.display = 'block';
        });

        compDropdown.addEventListener('mousedown', function (e) {
            var item = e.target.closest('.comp-dropdown-item');
            if (item) {
                compInput.value = item.dataset.name;
                compInput.dataset.autoDate = item.dataset.date;
                compDropdown.style.display = 'none';
                // NOTE: 选中后显示富内容 div
                showCompDisplay(item.dataset.name, item.dataset.date, item.dataset.iso2);
                // NOTE: WCA 比赛自动勾选 Official（用户可手动取消）
                var officialEl = document.getElementById('rf-official');
                if (officialEl && compWcaIdMap[item.dataset.name]) {
                    officialEl.checked = true;
                }
                // NOTE: 自动填充日期字段
                var dateEl = document.getElementById('rf-edit-date');
                if (dateEl && item.dataset.date) {
                    dateEl.value = item.dataset.date;
                }
            }
        });

        // NOTE: 点击 display div 或 × 按钮 → 清除选中态，恢复 input 可编辑
        compDisplay.addEventListener('click', function (e) {
            if (e.target.closest('.comp-display-clear')) {
                // × 按钮：清除比赛值
                compInput.value = '';
                compInput.dataset.autoDate = '';
            }
            hideCompDisplay();
            compInput.focus();
        });

        compInput.addEventListener('blur', function () {
            setTimeout(function () {
                compDropdown.style.display = 'none';
                // NOTE: blur 保护——若 input 有值且匹配已知比赛，自动恢复 display
                var val = compInput.value.trim();
                if (val && compDisplay.style.display === 'none') {
                    var found = findComp(val);
                    if (found) showCompDisplay(found.name, found.date, found.iso2);
                }
            }, 200);
        });

        // ==================== 通用人员搜索下拉 ====================

        // NOTE: API 基址——与 recon_api.js 保持一致
        var API_BASE = 'https://toolkit.cuberoot.me/recon/api/';

        /** 渲染人员下拉列表（选手/复盘者共用） */
        function renderPersonDropdown(dropdownEl, results) {
            if (!results || results.length === 0) {
                dropdownEl.innerHTML = '<div class="solver-dropdown-empty">' +
                    (isZh() ? '无匹配' : 'No match') + '</div>';
                return;
            }
            var html = '';
            results.forEach(function (p) {
                html += '<div class="solver-dropdown-item" data-name="' +
                    p.name.replace(/"/g, '&quot;') + '" data-iso2="' + (p.iso2 || '') +
                    '" data-wcaid="' + (p.wcaId || '') + '">' +
                    buildPersonHtml(p.name, p.iso2, p.wcaId) + '</div>';
            });
            dropdownEl.innerHTML = html;
        }

        /** 为人员 input 绑定搜索输入事件（debounce + API 调用） */
        function bindPersonSearch(inputEl, dropdownEl, displayEl) {
            var debounceTimer = null;

            inputEl.addEventListener('input', function () {
                var q = this.value.trim();
                clearTimeout(debounceTimer);
                if (q.length < 2) {
                    dropdownEl.style.display = 'none';
                    return;
                }
                // NOTE: 200ms debounce 防止快速输入频繁请求
                debounceTimer = setTimeout(function () {
                    dropdownEl.innerHTML = '<div class="solver-dropdown-loading"><span class="solver-spinner"></span>' +
                        (isZh() ? '搜索中...' : 'Searching...') + '</div>';
                    positionDropdownFor(inputEl, dropdownEl);
                    dropdownEl.style.display = 'block';

                    fetch(API_BASE + '?action=searchSolvers&q=' + encodeURIComponent(q))
                        .then(function (r) { return r.json(); })
                        .then(function (results) {
                            renderPersonDropdown(dropdownEl, results);
                            positionDropdownFor(inputEl, dropdownEl);
                            dropdownEl.style.display = 'block';
                        })
                        .catch(function (e) {
                            console.warn('Person search failed:', e);
                            dropdownEl.style.display = 'none';
                        });
                }, 200);
            });

            // NOTE: 选中下拉项 → 设置 input 值 + 显示富内容
            dropdownEl.addEventListener('mousedown', function (e) {
                var item = e.target.closest('.solver-dropdown-item');
                if (item) {
                    inputEl.value = item.dataset.name;
                    dropdownEl.style.display = 'none';
                    inputEl.classList.remove('default-val');
                    showPersonDisplay(displayEl, inputEl, item.dataset.name, item.dataset.iso2, item.dataset.wcaid);
                }
            });

            inputEl.addEventListener('blur', function () {
                setTimeout(function () { dropdownEl.style.display = 'none'; }, 150);
            });

            // NOTE: 点击 display div 的 × 按钮 → 清除选中态，恢复 input 可编辑
            displayEl.addEventListener('click', function (e) {
                if (e.target.closest('.person-display-clear')) {
                    inputEl.value = '';
                }
                hidePersonDisplay(displayEl, inputEl);
                inputEl.focus();
            });
        }

        // ==================== 选手搜索下拉 ====================

        var solverDropdown = document.createElement('div');
        solverDropdown.id = 'rf-solver-dropdown';
        solverDropdown.className = 'solver-dropdown';
        document.body.appendChild(solverDropdown);

        bindPersonSearch(solverInput, solverDropdown, solverDisplay);

        // NOTE: 缓存已有选手列表，避免重复请求
        var cachedPersons = null;

        solverInput.addEventListener('focus', function () {
            // NOTE: 已有富显示或有输入值时不弹下拉
            if (solverDisplay.style.display !== 'none') return;
            if (this.value.trim().length > 0) return;
            if (cachedPersons) {
                renderPersonDropdown(solverDropdown, cachedPersons.map(function (p) { return { name: p.person, iso2: '', wcaId: p.person_id }; }));
                positionDropdownFor(solverInput, solverDropdown);
                solverDropdown.style.display = 'block';
                return;
            }
            // NOTE: 首次加载显示 loading spinner
            solverDropdown.innerHTML = '<div class="solver-dropdown-loading"><span class="solver-spinner"></span>' +
                (isZh() ? '加载中...' : 'Loading...') + '</div>';
            positionDropdownFor(solverInput, solverDropdown);
            solverDropdown.style.display = 'block';

            fetch(API_BASE + '?action=listPersons')
                .then(function (r) { return r.json(); })
                .then(function (persons) {
                    cachedPersons = persons;
                    renderPersonDropdown(solverDropdown, persons.map(function (p) { return { name: p.person, iso2: '', wcaId: p.person_id }; }));
                    positionDropdownFor(solverInput, solverDropdown);
                    solverDropdown.style.display = 'block';
                })
                .catch(function (e) {
                    console.warn('listPersons failed:', e);
                    solverDropdown.style.display = 'none';
                });
        });

        // ==================== 复盘者搜索下拉 ====================

        var reconerDropdown = document.createElement('div');
        reconerDropdown.id = 'rf-reconer-dropdown';
        reconerDropdown.className = 'solver-dropdown';
        document.body.appendChild(reconerDropdown);

        bindPersonSearch(reconerInput, reconerDropdown, reconerDisplay);

        // ==================== 预览动画 ====================

        document.getElementById('rf-preview-btn').addEventListener('click', function () {
            // NOTE: 预览打乱优先用 optimalScramble，fallback 到 wcaScramble
            var optScr = document.getElementById('rf-edit-optimalScramble').value.trim();
            var wcaScr = document.getElementById('rf-scramble').value.trim();
            var scramble = optScr || wcaScr;
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
                person: document.getElementById('rf-solver').value.trim(),
                single: parseFloat(document.getElementById('rf-single').value.trim()) || 0,
                event: document.getElementById('rf-event').value.trim() || '3x3',
                method: document.getElementById('rf-method').value.trim(),
                comp: document.getElementById('rf-comp').value.trim(),
                // NOTE: 提交时自动查表获取 WCA 比赛 ID
                compWcaId: compWcaIdMap[document.getElementById('rf-comp').value.trim()] || '',
                // NOTE: 提交时自动查表获取比赛国家
                country: compCountryMap[document.getElementById('rf-comp').value.trim()] || '',
                note: document.getElementById('rf-note').value.trim(),
                round: document.getElementById('rf-round').value,
                solveNum: document.getElementById('rf-solve-num').value ? parseInt(document.getElementById('rf-solve-num').value) : null,
                wcaScramble: document.getElementById('rf-scramble').value.trim(),
                solution: document.getElementById('rf-recon').value
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
                    if (['average', 'value', 'regionalSingleRecord', 'regionalAverageRecord', 'regionalAoxrRecord'].indexOf(f.key) < 0 && !isNaN(val) && val !== '') {
                        newData[f.key] = parseFloat(val);
                    } else {
                        newData[f.key] = val;
                    }
                }
            });
            // NOTE: 重新计算 STM/TPS
            if (newData.solution && typeof ReconStats !== 'undefined') {
                var stats = ReconStats.computeAllStats(newData.solution, newData.single);
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
                location.href = returnUrl;
                return;
            }
            changedFields._editedBy = WcaAuth.getUser().wcaId;
            // NOTE: 保存编辑历史
            ReconStore.saveEditHistory(s.id, beforeSnapshot, changedFields);
            // NOTE: 直写 recons 主表，过滤掉 _ 前缀的内部字段
            var updateFields = {};
            for (var key in changedFields) {
                if (key.charAt(0) !== '_') updateFields[key] = changedFields[key];
            }
            var savePromise = ReconStore.updateRecon(s.id, updateFields);
            savePromise.then(function () {
                // NOTE: 数据已写入主表，清理旧的编辑覆盖层（如果有）
                if (s._edited) ReconStore.deleteEdit(s.id);
                location.href = returnUrl;
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

        // NOTE: 日期优先级：手动输入 > 比赛自动填充 > 今天
        var compInput = document.getElementById('rf-comp');
        var autoDate = compInput && compInput.dataset.autoDate;
        var manualDate = document.getElementById('rf-edit-date').value.trim();
        var date = manualDate || autoDate || new Date().toISOString().split('T')[0];

        // NOTE: 读取额外字段
        var officialEl = document.getElementById('rf-official');
        var official = officialEl ? officialEl.checked : false;

        var value = document.getElementById('rf-edit-value').value.trim();
        var avg = document.getElementById('rf-edit-average').value.trim();
        var aoType = document.getElementById('rf-edit-aoType').value.trim();
        var regionalAverageRecord = document.getElementById('rf-edit-regionalAverageRecord').value.trim();
        var regionalSingleRecord = document.getElementById('rf-edit-regionalSingleRecord').value.trim();
        var regionalAoxrRecord = document.getElementById('rf-edit-regionalAoxrRecord').value.trim();
        var cube = document.getElementById('rf-edit-cube').value.trim();
        var reconer = document.getElementById('rf-edit-reconer').value.trim();
        var groupId = document.getElementById('rf-edit-groupId').value.trim();
        var reconDate = document.getElementById('rf-edit-reconDate').value.trim();

        var solve = {
            id: 'local_' + Date.now(),
            official: official,
            event: event,
            method: method,
            date: date,
            person: solver,
            single: single
        };
        if (comp) solve.comp = comp;
        // NOTE: 提交时自动查表获取 WCA 比赛 ID
        if (comp && compWcaIdMap[comp]) solve.compWcaId = compWcaIdMap[comp];
        // NOTE: 提交时自动查表获取比赛国家
        if (comp && compCountryMap[comp]) solve.country = compCountryMap[comp];
        if (scramble) solve.wcaScramble = scramble;
        // NOTE: optimalScramble 也在新增模式下传递
        var optimalScramble = document.getElementById('rf-edit-optimalScramble').value.trim();
        if (optimalScramble) solve.optimalScramble = optimalScramble;
        // NOTE: solution 存纯解法（为未来移除 recon 做准备）
        solve.solution = recon;
        if (note) solve.note = note;
        if (round) solve.round = round;
        if (solveNum) solve.solveNum = parseInt(solveNum);

        if (value) solve.value = value;
        if (avg) solve.average = parseFloat(avg);
        if (aoType) solve.aoType = aoType;
        if (regionalAverageRecord) solve.regionalAverageRecord = regionalAverageRecord;
        if (regionalSingleRecord) solve.regionalSingleRecord = regionalSingleRecord;
        if (regionalAoxrRecord) solve.regionalAoxrRecord = regionalAoxrRecord;
        if (cube) solve.cube = cube;
        if (reconer) solve.reconer = reconer;
        if (groupId) solve.groupId = groupId;
        if (reconDate) solve.reconDate = reconDate;

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
        // NOTE: 新增模式下，reconer 默认填入当前登录用户名，reconerId 填入 WCA ID
        if (wcaUser && !solve.reconer) {
            solve.reconer = wcaUser.name || '';
            solve.reconerId = wcaUser.wcaId || '';
        }
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
