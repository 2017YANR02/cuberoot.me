/**
 * Recon 独立提交页面逻辑
 * 功能：表单交互、比赛搜索下拉、预览动画、实时统计、提交/编辑处理
 * 依赖：ReconStats, ReconStore, ReconLocalStore, WcaAuth（通过 index.md script 标签引入）
 */
(function () {
    'use strict';

    // NOTE: 盲拧项目集合——IIFE 层定义，供 DOMContentLoaded 和 handleSubmit 共用
    var BLD_EVENTS = ['3BLD', '4BLD', '5BLD', 'MBLD'];

    function isBldEvent(ev) {
        return BLD_EVENTS.indexOf(ev) >= 0;
    }

    /**
     * 解析用户输入的成绩字符串为秒数
     * 支持三种格式：
     *   1:12.10  → 72.10（分:秒格式）
     *   305      → 3.05（三位整数，自动÷100）
     *   72.10    → 72.10（普通小数）
     */
    function parseTimeInput(str) {
        if (!str) return NaN;
        // NOTE: 分:秒格式（如 1:12.10）
        var colonIdx = str.indexOf(':');
        if (colonIdx > 0) {
            var mins = parseInt(str.substring(0, colonIdx), 10);
            var secs = parseFloat(str.substring(colonIdx + 1));
            if (!isNaN(mins) && !isNaN(secs)) return mins * 60 + secs;
            return NaN;
        }
        var v = parseFloat(str);
        // NOTE: 三位整数（如 305）自动转为 3.05
        if (!isNaN(v) && v > 0 && Number.isInteger(v) && str.indexOf('.') < 0 && str.length === 3) {
            return v / 100;
        }
        return v;
    }

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
    // NOTE: 缓存选手国籍 ISO2 和 WCA ID——选中后存入，提交时写入数据库
    var cachedSolverIso2 = '';
    var cachedSolverWcaId = '';

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
            // NOTE: 复用 ReconUtils.parseSolverName()——中文模式下只显示中文名（DRY）
            var parsed = RU.parseSolverName ? RU.parseSolverName(name) : { en: name, zh: null };
            var displayName = (isZh() && parsed.zh) ? parsed.zh : parsed.en;
            // NOTE: 有中文名时加 data-i18n 属性，使切换语言后 i18n 自动更新文本
            if (parsed.zh) {
                var esc = RU.escHtml || function(s) { return s; };
                return flag + idBadge + '<span data-i18n-en="' + esc(parsed.en) + '" data-i18n-zh="' + esc(parsed.zh) + '">' + displayName + '</span>';
            }
            return flag + idBadge + '<span>' + displayName + '</span>';
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
            document.getElementById('rf-single').value = s.rawTime || '';
            // NOTE: 设置 event——若值匹配预设选项则直选，否则切换到"其他"模式
            var eventSelect = document.getElementById('rf-event');
            var eventCustom = document.getElementById('rf-event-custom');
            var eventVal = s.event || '3x3';
            var hasOption = Array.from(eventSelect.options).some(function (o) { return o.value === eventVal && o.value !== '__other__'; });
            if (hasOption) {
                eventSelect.value = eventVal;
                eventCustom.style.display = 'none';
            } else {
                eventSelect.value = '__other__';
                eventCustom.value = eventVal;
                eventCustom.style.display = '';
            }
            // NOTE: 编辑模式下根据 event 显示/隐藏 BLD 行并回填
            var bldRowEl = document.getElementById('rf-bld-row');
            var execEl = document.getElementById('rf-exec-time');
            var BLD = ['3BLD', '4BLD', '5BLD', 'MBLD'];
            if (BLD.indexOf(eventVal) >= 0) {
                bldRowEl.style.display = '';
                execEl.value = s.execTime || '';
                // NOTE: memo = truncate(rawTime) - execTime
                // 千分位是计时器噪声，截断而非四舍五入
                var truncated = Math.floor(s.rawTime * 100) / 100;
                if (truncated > s.execTime) {
                    document.getElementById('rf-memo-time').value =
                        Math.round((truncated - s.execTime) * 100) / 100;
                }
            } else {
                bldRowEl.style.display = 'none';
            }
            document.getElementById('rf-method').value = s.method || '';
            document.getElementById('rf-comp').value = s.comp || '';
            document.getElementById('rf-note').value = s.note || '';
            autoResize(document.getElementById('rf-note'));
            document.getElementById('rf-video-url').value = s.videoUrl || '';
            autoResize(document.getElementById('rf-video-url'));
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
            autoResize(document.getElementById('rf-recon'));

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
                    // NOTE: 如果是 solver（非 reconer），缓存国籍用于提交
                    if (inputEl === solverInput) cachedSolverIso2 = match.iso2 || '';
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

            var single = parseTimeInput(rawSingle);

            // NOTE: 盲拧项目用 execTime 算 TPS（手速 = 步数 / 执行时间）
            var tpsTime = single;
            if (typeof getCurrentEvent === 'function' && isBldEvent(getCurrentEvent())) {
                var execVal = parseFloat(execTimeInput.value.trim());
                if (!isNaN(execVal) && execVal > 0) {
                    tpsTime = execVal;
                }
            }

            var stats = ReconStats.computeAllStats(recon, tpsTime);
            if (stats.stm) {
                var parts = stats.stm + 'STM';
                if (!isNaN(tpsTime) && tpsTime > 0) {
                    // NOTE: 用截断（非四舍五入）保持与 parseTps 的 Math.floor 逻辑一致
                    var floored = Math.floor(tpsTime * 100) / 100;
                    parts += ' /' + floored.toFixed(2) + '=' + (stats.tps || 0) + 'TPS';
                }
                display.textContent = parts;
                display.style.display = 'block';
            } else {
                display.textContent = '';
                display.style.display = 'none';
            }
        }
        // NOTE: textarea 自适应高度——先收缩到最小再撑开到 scrollHeight
        function autoResize(el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
        // NOTE: 自动替换非标准标点——弯引号/双引号→直单引号、中文括号/逗号/句号→英文
        var PUNCT_MAP = {
            '\u2018': "'", '\u2019': "'",  // 弯单引号 → 直单引号
            '\u201C': "'", '\u201D': "'",  // 弯双引号 → 直单引号
            '"': "'",                       // 直双引号 → 直单引号
            '\uFF08': '(', '\uFF09': ')',  // 中文括号
            '\uFF0C': ',',                  // 中文逗号
            '\u3002': '.'                   // 中文句号
        };
        var PUNCT_RE = /[\u2018\u2019\u201C\u201D"\uFF08\uFF09\uFF0C\u3002]/g;
        function normalizePunctuation(el) {
            var val = el.value;
            var newVal = val.replace(PUNCT_RE, function (ch) { return PUNCT_MAP[ch] || ch; });
            // NOTE: 输入法可能插入配对引号("")，替换后会变成 '' 两个单引号，折叠为1个
            newVal = newVal.replace(/''+/g, "'");
            if (newVal !== val) {
                // NOTE: 保持光标位置不变
                var start = el.selectionStart;
                var end = el.selectionEnd;
                el.value = newVal;
                el.selectionStart = start;
                el.selectionEnd = end;
            }
        }
        var reconEl = document.getElementById('rf-recon');
        reconEl.addEventListener('input', function () {
            normalizePunctuation(reconEl);
            updateStatsDisplay();
            autoResize(reconEl);
        });
        var noteEl = document.getElementById('rf-note');
        noteEl.addEventListener('input', function () {
            normalizePunctuation(noteEl);
            autoResize(noteEl);
        });
        var videoUrlEl = document.getElementById('rf-video-url');
        videoUrlEl.addEventListener('input', function () {
            autoResize(videoUrlEl);
        });
        document.getElementById('rf-single').addEventListener('input', function () {
            updateStatsDisplay();
            // NOTE: rawTime 变化时也联动更新 memo 计算
            if (typeof updateMemoTime === 'function') updateMemoTime();
        });

        // NOTE: 编辑模式的统计更新在 populateForm() 中自动调用

        // ==================== Event 下拉 + 自定义输入 + BLD ====================

        var eventSelect = document.getElementById('rf-event');
        var eventCustom = document.getElementById('rf-event-custom');
        var bldRow = document.getElementById('rf-bld-row');
        var execTimeInput = document.getElementById('rf-exec-time');
        var memoTimeInput = document.getElementById('rf-memo-time');


        /** 获取当前 event 值（考虑"其他"模式） */
        function getCurrentEvent() {
            return eventSelect.value === '__other__'
                ? eventCustom.value.trim()
                : eventSelect.value;
        }

        /** 根据当前 event 显示/隐藏 BLD 行和自定义输入框 */
        function updateBldRow() {
            var ev = getCurrentEvent();
            bldRow.style.display = isBldEvent(ev) ? '' : 'none';
            if (!isBldEvent(ev)) {
                execTimeInput.value = '';
                memoTimeInput.value = '';
            }
        }

        // NOTE: 选择"其他"时显示自定义输入框，否则隐藏；同时联动 BLD 行
        eventSelect.addEventListener('change', function () {
            if (this.value === '__other__') {
                eventCustom.style.display = '';
                eventCustom.focus();
            } else {
                eventCustom.style.display = 'none';
                eventCustom.value = '';
            }
            updateBldRow();
            updateStatsDisplay();
        });

        /** 计算并填充 memo time = truncate(rawTime) - execTime */
        function updateMemoTime() {
            var rawTimeVal = parseTimeInput(document.getElementById('rf-single').value.trim());
            var execVal = parseFloat(execTimeInput.value.trim());
            if (!isNaN(rawTimeVal) && !isNaN(execVal) && execVal > 0) {
                // NOTE: 截断千分位——计时器噪声，不参与计算
                var truncated = Math.floor(rawTimeVal * 100) / 100;
                if (truncated > execVal) {
                    var memo = Math.round((truncated - execVal) * 100) / 100;
                    memoTimeInput.value = memo;
                } else {
                    memoTimeInput.value = '';
                }
            } else {
                memoTimeInput.value = '';
            }
        }

        // NOTE: exec time 输入联动 memo 计算和 stats 更新
        execTimeInput.addEventListener('input', function () {
            updateMemoTime();
            updateStatsDisplay();
        });

        // NOTE: i18n 切换时更新 option 文本（中文/英文）
        function applyEventOptionI18n() {
            var lang = localStorage.getItem('i18n_locale') || 'en';
            Array.from(eventSelect.options).forEach(function (opt) {
                var zhText = opt.getAttribute('data-i18n-option-zh');
                var enText = opt.getAttribute('data-i18n-option-en');
                if (lang === 'zh' && zhText) {
                    opt.textContent = zhText;
                } else if (lang !== 'zh' && enText) {
                    opt.textContent = enText;
                } else if (lang !== 'zh' && zhText) {
                    // NOTE: 英文模式下还原为 value（短名），因为英文显示就是短名
                    opt.textContent = opt.value === '__other__' ? 'Other...' : opt.value;
                }
            });
        }
        applyEventOptionI18n();
        // NOTE: 监听 locale 变更事件（i18n.js setLocale 触发）
        window.addEventListener('i18n:locale-changed', applyEventOptionI18n);

        // ==================== 默认值灰色 ====================

        // NOTE: 带默认值的字段初始显示为灰色，focus 时变白
        ['rf-solver', 'rf-method'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.classList.add('default-val');
            el.addEventListener('focus', function () {
                this.classList.remove('default-val');
                this.select();
            });
            el.addEventListener('blur', function () {
                var defaults = { 'rf-solver': '耿暄一', 'rf-method': 'ZB' };
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
            var zhName = compNamesZh[name];
            var displayName = (isZh() && zhName) ? zhName : name;
            // NOTE: 有中文名时加 data-i18n 属性，使切换语言后 i18n 自动更新文本
            var nameSpan = zhName
                ? '<span data-i18n-en="' + name + '" data-i18n-zh="' + zhName + '">' + displayName + '</span>'
                : '<span>' + displayName + '</span>';
            return '<small>' + date + '</small>' + flag + nameSpan;
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
            dropdownEl.style.minWidth = rect.width + 'px';
            // NOTE: 约束下拉面板不超出屏幕右边界（留 8px 安全边距）
            dropdownEl.style.maxWidth = (window.innerWidth - rect.left - 8) + 'px';
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
                // NOTE: 自动填充日期并锁定——WCA 官方日期不应被手动修改
                var dateEl = document.getElementById('rf-edit-date');
                if (dateEl && item.dataset.date) {
                    dateEl.value = item.dataset.date;
                    dateEl.readOnly = true;
                    dateEl.style.opacity = '0.5';
                    dateEl.title = isZh() ? '日期由比赛自动填充' : 'Date auto-filled from competition';
                }
            }
        });

        // NOTE: 点击 display div 或 × 按钮 → 清除选中态，恢复 input 可编辑
        compDisplay.addEventListener('click', function (e) {
            if (e.target.closest('.comp-display-clear')) {
                // × 按钮：清除比赛值，并解锁日期
                compInput.value = '';
                compInput.dataset.autoDate = '';
                var dateEl2 = document.getElementById('rf-edit-date');
                if (dateEl2) {
                    dateEl2.readOnly = false;
                    dateEl2.style.opacity = '';
                    dateEl2.title = '';
                }
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

        // NOTE: 缓存已有选手列表（DOMContentLoaded 时预拉取，避免 focus 时才加载）
        var cachedPersons = null;

        // NOTE: 预拉取——异步不阻塞页面，用户开始输入时本地数据已就绪
        fetch(API_BASE + '?action=listPersons')
            .then(function (r) { return r.json(); })
            .then(function (persons) {
                cachedPersons = persons;
                // NOTE: cachedPersons 就绪后，填入默认复盘者（当前登录用户）
                if (reconerInput && !reconerInput.value && typeof WcaAuth !== 'undefined') {
                    var wcaUser = WcaAuth.getUser();
                    if (wcaUser && wcaUser.name) {
                        reconerInput.value = wcaUser.name;
                        var userIso2 = '';
                        var match = persons.find(function (p) {
                            return p.person_id === wcaUser.wcaId;
                        });
                        if (match) userIso2 = match.person_country || '';
                        showPersonDisplay(reconerDisplay, reconerInput, wcaUser.name, userIso2, wcaUser.wcaId || '');
                    }
                }
            })
            .catch(function (e) { console.warn('listPersons prefetch failed:', e); });

        /** 将 listPersons 原始格式转为下拉渲染格式（DRY——消除三处重复映射） */
        function mapPersonsToDropdownFormat(persons) {
            return persons.map(function (p) {
                return { name: p.person, iso2: p.person_country || '', wcaId: p.person_id };
            });
        }

        /** 从本地缓存中模糊过滤匹配项 */
        function filterLocalPersons(persons, query) {
            var q = query.toLowerCase();
            return persons.filter(function (p) {
                return p.person.toLowerCase().indexOf(q) >= 0 ||
                    (p.person_id && p.person_id.toLowerCase().indexOf(q) >= 0);
            });
        }

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

        /**
         * 为人员 input 绑定搜索事件（Slack 模式：本地优先，0 结果才调 WCA API）
         * @param {HTMLElement} inputEl   - 输入框
         * @param {HTMLElement} dropdownEl - 下拉容器
         * @param {HTMLElement} displayEl  - 富显示容器
         * @param {Object} [opts]          - 可选配置
         * @param {Function} [opts.localPersonsFn] - 返回本地人员数组（或 null）
         * @param {Function} [opts.onSelect]       - 选中回调 (name, iso2, wcaId)
         */
        function bindPersonSearch(inputEl, dropdownEl, displayEl, opts) {
            opts = opts || {};
            var debounceTimer = null;

            inputEl.addEventListener('input', function () {
                var q = this.value.trim();
                clearTimeout(debounceTimer);
                // NOTE: 中文单字语义足够精确（如"耿"），阈值 1；拉丁字母阈值 2
                var minLen = /[^\x00-\x7F]/.test(q) ? 1 : 2;
                if (q.length < minLen) {
                    dropdownEl.style.display = 'none';
                    return;
                }

                // NOTE: Slack 模式——先本地过滤（即时）
                var localData = opts.localPersonsFn ? opts.localPersonsFn() : null;
                if (localData) {
                    var localMatches = filterLocalPersons(localData, q);
                    if (localMatches.length > 0) {
                        // NOTE: 本地有结果 → 立即渲染，不调 WCA API
                        renderPersonDropdown(dropdownEl, mapPersonsToDropdownFormat(localMatches));
                        positionDropdownFor(inputEl, dropdownEl);
                        dropdownEl.style.display = 'block';
                        return;
                    }
                }

                // NOTE: 本地无结果 → 200ms debounce 后调 WCA API
                debounceTimer = setTimeout(function () {
                    dropdownEl.innerHTML = '<div class="solver-dropdown-loading"><span class="solver-spinner"></span>' +
                        (isZh() ? '搜索中...' : 'Searching...') + '</div>';
                    positionDropdownFor(inputEl, dropdownEl);
                    dropdownEl.style.display = 'block';

                    fetch(API_BASE + '?action=searchSolvers&q=' + encodeURIComponent(q))
                        .then(function (r) { return r.json(); })
                        .then(function (results) {
                            // NOTE: 用户已选中 → 不再更新下拉（防延迟回调覆盖）
                            if (displayEl.style.display !== 'none') return;
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

            // NOTE: 选中下拉项 → 设置 input 值 + 显示富内容 + 调用 onSelect 回调
            dropdownEl.addEventListener('mousedown', function (e) {
                var item = e.target.closest('.solver-dropdown-item');
                if (item) {
                    inputEl.value = item.dataset.name;
                    dropdownEl.style.display = 'none';
                    inputEl.classList.remove('default-val');
                    showPersonDisplay(displayEl, inputEl, item.dataset.name, item.dataset.iso2, item.dataset.wcaid);
                    if (opts.onSelect) {
                        opts.onSelect(item.dataset.name, item.dataset.iso2 || '', item.dataset.wcaid || '');
                    }
                }
            });

            inputEl.addEventListener('blur', function () {
                setTimeout(function () { dropdownEl.style.display = 'none'; }, 150);
            });

            // NOTE: 重新聚焦已有文本时，重新触发搜索恢复下拉
            inputEl.addEventListener('focus', function () {
                if (displayEl.style.display !== 'none') return;
                if (this.value.trim().length > 0) {
                    this.dispatchEvent(new Event('input'));
                }
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

        bindPersonSearch(solverInput, solverDropdown, solverDisplay, {
            localPersonsFn: function () { return cachedPersons; },
            // NOTE: 选中时缓存国籍和 WCA ID，提交时写入 personCountry/personId 字段
            onSelect: function (name, iso2, wcaId) { cachedSolverIso2 = iso2; cachedSolverWcaId = wcaId; }
        });

        // NOTE: focus 空输入框时展示全部已有选手（快速选择常用选手）
        solverInput.addEventListener('focus', function () {
            if (solverDisplay.style.display !== 'none') return;
            if (this.value.trim().length > 0) return;
            if (!cachedPersons) return;
            renderPersonDropdown(solverDropdown, mapPersonsToDropdownFormat(cachedPersons));
            positionDropdownFor(solverInput, solverDropdown);
            solverDropdown.style.display = 'block';
        });

        // ==================== 复盘者搜索下拉 ====================

        var reconerDropdown = document.createElement('div');
        reconerDropdown.id = 'rf-reconer-dropdown';
        reconerDropdown.className = 'solver-dropdown';
        document.body.appendChild(reconerDropdown);

        bindPersonSearch(reconerInput, reconerDropdown, reconerDisplay, {
            localPersonsFn: function () { return cachedPersons; }
        });

        // NOTE: 复盘日期默认当天（新增模式下输入框为空时自动填入）
        var reconDateEl = document.getElementById('rf-edit-reconDate');
        if (reconDateEl && !reconDateEl.value) {
            reconDateEl.value = new Date().toISOString().slice(0, 10);
        }


        // ==================== 预览动画（twisty-player 组件） ====================

        var previewActive = false;  // 是否已激活预览
        var twistyDebounceTimer = null;
        var currentPlayer = null;   // 当前 TwistyPlayer 实例引用

        /** 获取打乱公式 */
        function getScramble() {
            var optScr = document.getElementById('rf-edit-optimalScramble').value.trim();
            var wcaScr = document.getElementById('rf-scramble').value.trim();
            return optScr || wcaScr;
        }

        /** 从解法文本提取纯公式（去统计行、打乱行和注释） */
        function cleanReconText(text) {
            var scramble = getScramble();
            var lines = text.split('\n');
            var scrambleLineIdx = -1;
            if (scramble && lines.length >= 2 && /^\d+STM\s/i.test(lines[0])) {
                if (lines[1].trim() === scramble) scrambleLineIdx = 1;
            }
            var alg = lines
                .filter(function (line, idx) { return idx !== scrambleLineIdx; })
                .map(function (line) {
                    var idx = line.indexOf('//');
                    return (idx >= 0 ? line.substring(0, idx) : line).trim();
                })
                .filter(function (line) {
                    return line.length > 0 && !/^\d+STM\s/i.test(line);
                })
                .join('\n');
            return ReconAlgUtils.cleanForPlayer(alg);
        }

        /** 创建 twisty-player 并显示（首次或内容变化时） */
        /** 从项目下拉获取 twisty puzzle 类型 */
        function getCurrentPuzzle() {
            var eventEl = document.getElementById('rf-event');
            var event = eventEl ? eventEl.value : '3x3';
            return ReconUtils.eventToPuzzle(event);
        }

        function createTwistyPlayer() {
            var scramble = getScramble();
            var fullAlg = cleanReconText(document.getElementById('rf-recon').value);
            if (!scramble && !fullAlg) return;

            var container = document.getElementById('rf-twisty-container');
            var eventVal = document.getElementById('rf-event').value;

            // NOTE: SQ1 用 cubedb.net iframe（twisty-player 对 SQ1 渲染不友好）
            if (eventVal === 'SQ1') {
                var cubedbPuzzle = ReconUtils.eventToCubedbPuzzle(eventVal);
                var cubedbUrl = 'https://cubedb.net/?puzzle=' + cubedbPuzzle +
                    '&scramble=' + encodeURIComponent(scramble) +
                    '&alg=' + encodeURIComponent(fullAlg);
                container.innerHTML = '<iframe src="' + cubedbUrl + '" ' +
                    'style="width:100%;height:400px;border:1px solid #444;border-radius:8px" ' +
                    'allowfullscreen></iframe>';
                container.style.display = 'block';
                currentPlayer = null; // NOTE: iframe 不支持光标跟随
                return;
            }

            if (typeof window.ensureTwisty !== 'function') return;
            window.ensureTwisty().then(function () {
                var Ctor = window.__TwistyPlayerCtor;
                if (!Ctor) return;
                container.innerHTML = '';
                container.style.display = 'block';
                currentPlayer = new Ctor({
                    puzzle: getCurrentPuzzle(),
                    experimentalSetupAlg: scramble,
                    alg: fullAlg
                });
                container.appendChild(currentPlayer);
            }).catch(function () {});
        }

        /**
         * NOTE: 光标跟随——将光标前的移动设为 setupAlg，光标后的设为 alg。
         * 这样魔方直接显示光标处的状态，和 alg.cubing.net 行为一致。
         */
        function syncCursorToPlayer() {
            if (!currentPlayer || !previewActive) return;
            var container = document.getElementById('rf-twisty-container');
            if (container.style.display === 'none') return;

            var reconEl = document.getElementById('rf-recon');
            var cursorPos = reconEl.selectionStart;
            var fullText = reconEl.value;

            // NOTE: 计算光标前的步数
            var textBefore = fullText.substring(0, cursorPos);
            var algBefore = cleanReconText(textBefore);
            var moves = algBefore.trim().split(/\s+/).filter(function (s) { return s.length > 0; });
            var moveCount = moves.length;

            // NOTE: 通过 indexer 获取精确的毫秒时间戳
            try {
                var model = currentPlayer.experimentalModel;
                if (model && model.indexer) {
                    model.indexer.get().then(function (indexer) {
                        if (typeof indexer.indexToMoveStartTimestamp === 'function') {
                            var totalMoves = typeof indexer.numAnimatedLeaves === 'function'
                                ? indexer.numAnimatedLeaves()
                                : (typeof indexer.numMoves === 'function' ? indexer.numMoves() : 0);
                            // NOTE: 光标在末尾时用 algDuration 跳到绝对末尾
                            if (moveCount >= totalMoves && typeof indexer.algDuration === 'function') {
                                currentPlayer.timestamp = indexer.algDuration();
                            } else {
                                currentPlayer.timestamp = indexer.indexToMoveStartTimestamp(moveCount);
                            }
                        }
                    });
                }
            } catch (e) {
                // NOTE: 实验性 API 失败时 fallback 到重建
                createTwistyPlayer();
            }
        }

        // NOTE: 按钮首次点击加载 twisty 并激活，后续切换显示/隐藏
        var isZhBtn = localStorage.getItem('i18n_locale') === 'zh';
        var previewBtn = document.getElementById('rf-preview-btn');
        previewBtn.addEventListener('click', function () {
            if (!previewActive) {
                previewActive = true;
                createTwistyPlayer();
                previewBtn.textContent = isZhBtn ? '隐藏预览' : 'Hide Preview';
            } else {
                var container = document.getElementById('rf-twisty-container');
                var visible = container.style.display !== 'none';
                container.style.display = visible ? 'none' : 'block';
                previewBtn.textContent = visible
                    ? (isZhBtn ? '预览动画' : 'Preview Animation')
                    : (isZhBtn ? '隐藏预览' : 'Hide Preview');
            }
        });

        // NOTE: 激活后，解法/打乱变化时重建 player
        function debounceTwistyUpdate() {
            if (!previewActive) return;
            var container = document.getElementById('rf-twisty-container');
            if (container.style.display === 'none') return;
            clearTimeout(twistyDebounceTimer);
            twistyDebounceTimer = setTimeout(createTwistyPlayer, 500);
        }
        document.getElementById('rf-recon').addEventListener('input', debounceTwistyUpdate);
        document.getElementById('rf-scramble').addEventListener('input', debounceTwistyUpdate);
        document.getElementById('rf-edit-optimalScramble').addEventListener('input', debounceTwistyUpdate);
        // NOTE: 项目变化时重建 player（切换 puzzle 类型）
        document.getElementById('rf-event').addEventListener('change', debounceTwistyUpdate);

        // NOTE: 光标位置变化时同步 twisty 状态（click/键盘移动光标）
        var cursorSyncTimer = null;
        function debounceCursorSync() {
            if (!previewActive || !currentPlayer) return;
            clearTimeout(cursorSyncTimer);
            cursorSyncTimer = setTimeout(syncCursorToPlayer, 100);
        }
        var reconElForCursor = document.getElementById('rf-recon');
        // NOTE: click 时先吸附光标到 token 边界再同步 twisty
        reconElForCursor.addEventListener('click', function () {
            // NOTE: setTimeout(0) 确保浏览器先更新 selectionStart
            setTimeout(function () {
                var text = reconElForCursor.value;
                var pos = reconElForCursor.selectionStart;
                var result = ReconAlgUtils.findTokenPositions(text);
                var snapped = ReconAlgUtils.snapToTokenBoundary(pos, result.tokens);
                if (snapped !== pos) {
                    reconElForCursor.selectionStart = snapped;
                    reconElForCursor.selectionEnd = snapped;
                }
                syncCursorToPlayer();
            }, 0);
        });
        reconElForCursor.addEventListener('keyup', debounceCursorSync);

        // ==================== 箭头键 Token 跳转 ====================

        reconElForCursor.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;

            var text = reconElForCursor.value;
            var cursorPos = reconElForCursor.selectionStart;
            var result = ReconAlgUtils.findTokenPositions(text);

            // NOTE: 光标在注释区域内时，保持默认逐字符行为
            if (ReconAlgUtils.isCursorInComment(cursorPos, result.commentStarts)) return;

            var tokens = result.tokens;
            if (tokens.length === 0) return;

            var newPos = cursorPos;
            if (e.key === 'ArrowRight') {
                // NOTE: 找当前或下一个 token（start >= cursorPos），跳到其末尾
                for (var i = 0; i < tokens.length; i++) {
                    if (tokens[i].start >= cursorPos) {
                        newPos = tokens[i].end;
                        break;
                    }
                }
                // NOTE: 如果没找到（已在最后一个 token 之后），不拦截
                if (newPos === cursorPos) return;
            } else {
                // ArrowLeft: 找最后一个 end < cursorPos 的 token，跳到其末尾
                for (var j = tokens.length - 1; j >= 0; j--) {
                    if (tokens[j].end < cursorPos) {
                        newPos = tokens[j].end;
                        break;
                    }
                }
                if (newPos === cursorPos) return;
            }

            e.preventDefault();
            reconElForCursor.selectionStart = newPos;
            reconElForCursor.selectionEnd = newPos;
            // NOTE: 跳转后同步 twisty 预览
            debounceCursorSync();
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

    /**
     * 日期自动补零：将 2021-1-1 等非标准输入规范化为 2021-01-01
     * NOTE: 只处理形如 YYYY-M-D / YYYY-MM-D / YYYY-M-DD 的宽松格式
     * @returns {string} 规范化后的值（若无法识别则原样返回）
     */
    function normalizeDateValue(inputEl) {
        var v = inputEl.value.trim();
        if (!v) return v;
        var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) {
            var month = m[2].length === 1 ? '0' + m[2] : m[2];
            var day = m[3].length === 1 ? '0' + m[3] : m[3];
            var normalized = m[1] + '-' + month + '-' + day;
            if (normalized !== v) inputEl.value = normalized;
            return normalized;
        }
        return v;
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
            // NOTE: 自动同步"单次"——截断千分位（如 4.239 → 4.23），每次成绩变化都更新
            var valueEl = document.getElementById('rf-edit-value');
            if (valueEl) {
                var parsed = parseTimeInput(v);
                if (!isNaN(parsed) && parsed > 0) {
                    valueEl.value = Math.floor(parsed * 100) / 100;
                }
            }
            return '';
        });

        // NOTE: 自定义 event 输入框的长度校验（select 预设值无需校验）
        addBlurCheck('rf-edit-value', function (v) {
            if (!v) return isZh ? '请输入单次成绩' : 'Single is required';
            var n = parseFloat(v);
            if (isNaN(n) || n <= 0) return isZh ? '成绩必须是正数' : 'Must be a positive number';
            return '';
        });

        // NOTE: 自定义 event 输入框的长度校验（select 预设值无需校验）
        addBlurCheck('rf-event-custom', function (v) {
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
        addBlurCheck('rf-edit-date', function () {
            var normalized = normalizeDateValue(document.getElementById('rf-edit-date'));
            if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return isZh ? '格式: YYYY-MM-DD' : 'Format: YYYY-MM-DD';
            return '';
        });

        addBlurCheck('rf-edit-reconDate', function () {
            var normalized = normalizeDateValue(document.getElementById('rf-edit-reconDate'));
            if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return isZh ? '格式: YYYY-MM-DD' : 'Format: YYYY-MM-DD';
            return '';
        });

        addBlurCheck('rf-edit-avg', function (v) {
            if (v && isNaN(parseFloat(v))) return isZh ? '必须是数字或留空' : 'Must be a number or empty';
            return '';
        });

        // NOTE: execTime 不允许千分位——盲拧计时器精度只到百分位
        addBlurCheck('rf-exec-time', function (v) {
            if (!v) return '';
            if (isNaN(parseFloat(v))) return isZh ? '必须是数字' : 'Must be a number';
            var parts = v.split('.');
            if (parts.length > 1 && parts[1].length > 2) return isZh ? '最多两位小数' : 'Max 2 decimal places';
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
        var single = parseTimeInput(rawSingle);
        if (!rawSingle || isNaN(single) || single <= 0) {
            errors.push(isZh ? '成绩必须是正数' : 'Time must be a positive number');
        }

        var recon = document.getElementById('rf-recon').value;
        if (!recon || !recon.trim()) {
            errors.push(isZh ? '请输入复盘文本' : 'Reconstruction is required');
        }

        // --- 长度校验 ---
        var eventSel = document.getElementById('rf-event').value;
        var event = eventSel === '__other__' ? document.getElementById('rf-event-custom').value.trim() : eventSel;
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

        // --- 日期校验（提交前再次自动补零） ---
        var dateEl = document.getElementById('rf-edit-date');
        if (dateEl) {
            var dateVal = normalizeDateValue(dateEl);
            if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                errors.push(isZh ? '日期格式必须是 YYYY-MM-DD' : 'Date must be YYYY-MM-DD');
            }
        }

        var reconDateEl = document.getElementById('rf-edit-reconDate');
        if (reconDateEl) {
            var reconDateVal = normalizeDateValue(reconDateEl);
            if (reconDateVal && !/^\d{4}-\d{2}-\d{2}$/.test(reconDateVal)) {
                errors.push(isZh ? '复盘日期格式必须是 YYYY-MM-DD' : 'Recon date must be YYYY-MM-DD');
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
                rawTime: parseTimeInput(document.getElementById('rf-single').value.trim()) || 0,
                event: (document.getElementById('rf-event').value === '__other__' ? document.getElementById('rf-event-custom').value.trim() : document.getElementById('rf-event').value) || '3x3',
                method: document.getElementById('rf-method').value.trim(),
                comp: document.getElementById('rf-comp').value.trim(),
                // NOTE: 提交时自动查表获取 WCA 比赛 ID，未改比赛时保留原值
                compWcaId: compWcaIdMap[document.getElementById('rf-comp').value.trim()] || s.compWcaId || '',
                // NOTE: 提交时自动查表获取比赛国家，未改比赛时保留原值
                country: compCountryMap[document.getElementById('rf-comp').value.trim()] || s.country || '',
                // NOTE: 选手国籍和 WCA ID——未重新选择 solver 时保留原值，防止空覆盖
                personCountry: cachedSolverIso2 || s.personCountry || '',
                personId: cachedSolverWcaId || s.personId || '',
                note: document.getElementById('rf-note').value.trim(),
                videoUrl: document.getElementById('rf-video-url').value.trim(),
                round: document.getElementById('rf-round').value,
                solveNum: document.getElementById('rf-solve-num').value ? parseInt(document.getElementById('rf-solve-num').value) : null,
                wcaScramble: document.getElementById('rf-scramble').value.trim(),
                solution: document.getElementById('rf-recon').value
            };
            // NOTE: 盲拧项目时附加 execTime/memoTime
            if (isBldEvent(newData.event)) {
                var eVal = parseFloat(document.getElementById('rf-exec-time').value.trim());
                if (!isNaN(eVal) && eVal > 0) {
                    newData.execTime = eVal;
                    // NOTE: 截断千分位后计算 memo
                    var truncRaw = Math.floor(newData.rawTime * 100) / 100;
                    if (truncRaw > eVal) {
                        newData.memoTime = Math.round((truncRaw - eVal) * 100) / 100;
                    }
                }
            }
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
                var stats = ReconStats.computeAllStats(newData.solution, newData.rawTime);
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
        var eventSel = document.getElementById('rf-event').value;
        var event = (eventSel === '__other__' ? document.getElementById('rf-event-custom').value.trim() : eventSel) || '3x3';
        var method = document.getElementById('rf-method').value.trim() || 'ZB';
        var scramble = document.getElementById('rf-scramble').value.trim();
        var recon = document.getElementById('rf-recon').value;
        var comp = document.getElementById('rf-comp').value.trim();
        var note = document.getElementById('rf-note').value.trim();
        var round = document.getElementById('rf-round').value;
        var solveNum = document.getElementById('rf-solve-num').value;

        // NOTE: 成绩解析：支持 1:12.10、305（自动÷100）、普通小数
        var single = parseTimeInput(rawSingle);

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
            rawTime: single
        };
        if (comp) solve.comp = comp;
        // NOTE: 提交时自动查表获取 WCA 比赛 ID
        if (comp && compWcaIdMap[comp]) solve.compWcaId = compWcaIdMap[comp];
        // NOTE: 提交时自动查表获取比赛国家
        if (comp && compCountryMap[comp]) solve.country = compCountryMap[comp];
        // NOTE: 选手国籍和 WCA ID（从搜索选中时缓存）
        if (cachedSolverIso2) solve.personCountry = cachedSolverIso2;
        if (cachedSolverWcaId) solve.personId = cachedSolverWcaId;
        if (scramble) solve.wcaScramble = scramble;
        // NOTE: optimalScramble 也在新增模式下传递
        var optimalScramble = document.getElementById('rf-edit-optimalScramble').value.trim();
        if (optimalScramble) solve.optimalScramble = optimalScramble;
        // NOTE: solution 存纯解法（为未来移除 recon 做准备）
        solve.solution = recon;
        if (note) solve.note = note;
        var videoUrl = document.getElementById('rf-video-url').value.trim();
        if (videoUrl) solve.videoUrl = videoUrl;
        // NOTE: 盲拧项目时附加 execTime/memoTime
        if (isBldEvent(event)) {
            var eVal = parseFloat(document.getElementById('rf-exec-time').value.trim());
            if (!isNaN(eVal) && eVal > 0) {
                solve.execTime = eVal;
                // NOTE: 截断千分位后计算 memo
                var truncRaw = Math.floor(single * 100) / 100;
                if (truncRaw > eVal) {
                    solve.memoTime = Math.round((truncRaw - eVal) * 100) / 100;
                }
            }
        }
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
