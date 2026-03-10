/**
 * Recon 复盘页面前端逻辑（列表页）
 * 功能：加载 JSON、表格渲染、筛选搜索、排序、分页
 * NOTE: 详情渲染已迁移到 detail/recon_detail.js，点击行跳转到独立详情页
 */
(function () {
    'use strict';

    // --- 常量 ---
    const PAGE_SIZE = 50; // NOTE: 每次加载的行数
    const COMP_COUNTRIES_URL = '/stats/comp_name_countries.json';
    const PERSON_COUNTRIES_URL = '/stats/person_name_countries.json';
    const COMP_NAMES_ZH_URL = '/recon/comp_names_zh.json';
    const COMP_WCA_IDS_URL = '/stats/comp_name_to_wca_id.json';
    // NOTE: recon 专用精简映射（4 合 1，~21KB），替代上面 4 个 URL（共 ~9.6MB）
    const RECON_AUX_URL = '/recon/recon_aux_data.json';
    const DEFAULT_SORT = { key: 'id', asc: false };

    // --- 状态 ---
    let allSolves = [];       // 全部数据
    let filteredSolves = [];  // 筛选后的数据
    let displayCount = 0;     // 当前已显示的行数
    let sortCol = 'id';       // 当前排序列
    let sortDir = 'desc';     // 排序方向
    let compCountries = {};   // 比赛名 → ISO2 映射
    let personCountries = {};  // 选手名 → ISO2 映射
    let compNamesZh = {};     // 英文比赛名 → 中文比赛名 映射
    let compWcaIds = {};      // 英文比赛名 → WCA 比赛 ID 映射
    let compNameAliases = {};  // cell_name → name 别名映射（搜索用）

    // --- DOM 引用 ---
    let tbody, searchInput, filterSolver, filterMethod, filterEvent;
    let filterWca, filterNonWca;
    let statsEl, showingEl, loadMoreBtn;

    // --- 工具函数简写（引用 ReconUtils 共享模块） ---
    var U = null; // NOTE: DOMContentLoaded 后初始化

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        U = ReconUtils;

        tbody = document.getElementById('recon-tbody');
        searchInput = document.getElementById('recon-search');
        filterSolver = document.getElementById('filter-solver');
        filterMethod = document.getElementById('filter-method');
        filterEvent = document.getElementById('filter-event');
        filterWca = document.getElementById('filter-wca');
        filterNonWca = document.getElementById('filter-nonwca');
        statsEl = document.getElementById('recon-stats');
        showingEl = document.getElementById('recon-showing');
        loadMoreBtn = document.getElementById('btn-load-more');

        // NOTE: 检测 URL ?user=wcaId 参数，进入用户模式
        var urlParams = new URLSearchParams(window.location.search);
        var userWcaId = urlParams.get('user');

        // NOTE: 加载辅助数据（国旗映射、中文比赛名、WCA ID 映射）
        // 优先使用 recon 专用精简文件（~21KB），fallback 到全量文件（~9.6MB）
        try {
            const auxResp = await fetch(RECON_AUX_URL);
            const aux = await auxResp.json();
            compCountries = aux.compCountries || {};
            personCountries = aux.personCountries || {};
            compNamesZh = aux.compNamesZh || {};
            compWcaIds = aux.compWcaIds || {};
            compNameAliases = aux.compNameAliases || {};
        } catch (e) {
            console.warn('Failed to load recon aux data, falling back to full files:', e);
            try {
                const [compResp, personResp, compZhResp, compWcaIdsResp] = await Promise.all([
                    fetch(COMP_COUNTRIES_URL),
                    fetch(PERSON_COUNTRIES_URL),
                    fetch(COMP_NAMES_ZH_URL),
                    fetch(COMP_WCA_IDS_URL)
                ]);
                compCountries = await compResp.json();
                personCountries = await personResp.json();
                compNamesZh = await compZhResp.json();
                compWcaIds = await compWcaIdsResp.json();
            } catch (e2) {
                console.warn('Failed to load auxiliary data:', e2);
            }
        }

        function preprocessSolves(solves) {
            solves.forEach(solve => {
                const preview = getReconPreview(solve);
                const stmMatch = preview.match(/(\d+)STM/i);
                const tpsMatch = preview.match(/([\d.]+)TPS/i);
                solve.stm = stmMatch ? parseInt(stmMatch[1]) : 0;
                solve.tps = tpsMatch ? parseFloat(tpsMatch[1]) : 0;
            });
        }

        // NOTE: 构建筛选器选项
        buildFilterOptions();

        // NOTE: 绑定事件
        searchInput.addEventListener('input', debounce(applyFilters, 200));
        filterSolver.addEventListener('change', applyFilters);
        filterMethod.addEventListener('change', applyFilters);
        filterEvent.addEventListener('change', applyFilters);
        // NOTE: WCA/non-WCA 复选框——不允许两个都不选
        function guardTypeFilter() {
            if (!filterWca.checked && !filterNonWca.checked) {
                this.checked = true;
                return;
            }
            applyFilters();
        }
        filterWca.addEventListener('change', guardTypeFilter);
        filterNonWca.addEventListener('change', guardTypeFilter);
        // NOTE: 无限滚动——用 IntersectionObserver 监听 sentinel 元素
        loadMoreBtn.style.display = 'none';
        var sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        document.getElementById('recon-pagination').appendChild(sentinel);
        var scrollObserver = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting && displayCount < filteredSolves.length) {
                loadMore();
            }
        }, { rootMargin: '200px' });
        scrollObserver.observe(sentinel);

        // NOTE: 表头排序
        document.querySelectorAll('#recon-table thead th').forEach(th => {
            th.addEventListener('click', () => handleSort(th));
        });

        // NOTE: 初始化 WCA 登录 UI
        updateWcaAuthUI();

        // NOTE: 从 API 统一加载所有复盘数据
        if (typeof ReconStore !== 'undefined') {
            try {
                if (userWcaId) {
                    // NOTE: 用户模式：只加载该用户的复盘
                    enterUserMode(userWcaId);
                } else {
                    var recons = await ReconStore.loadAll();
                    allSolves = recons;
                    preprocessSolves(allSolves);

                    // NOTE: 加载编辑覆盖层
                    if (ReconStore.loadEdits) {
                        try {
                            var editsMap = await ReconStore.loadEdits();
                            allSolves.forEach(function (solve) {
                                var edit = editsMap[String(solve.id)];
                                if (edit) {
                                    for (var key in edit) {
                                        if (key.charAt(0) === '_') continue;
                                        solve[key] = edit[key];
                                    }
                                    solve._edited = true;
                                }
                            });
                        } catch (e) {
                            console.warn('Failed to load edits overlay:', e);
                        }
                    }

                    buildFilterOptions();
                    applyFilters();
                    // NOTE: 旧 hash 链接向后兼容——重定向到独立详情页
                    tryRedirectFromHash();
                }
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;color:#f87171">Failed to load data</td></tr>';
                console.error('Failed to load recon data:', e);
                return;
            }
        }

        // NOTE: 监听客户端提交的新复盘
        window.addEventListener('recon-local-add', function (e) {
            var solve = e.detail;
            allSolves.unshift(solve);
            applyFilters();
        });

        // NOTE: 监听删除复盘——统一用字符串比较 ID
        window.addEventListener('recon-local-delete', function (e) {
            var id = String(e.detail);
            allSolves = allSolves.filter(function (s) { return String(s.id) !== id; });
            applyFilters();
        });
    }

    /**
     * 返回详情页 URL
     * NOTE: 统一用 /recon/detail/?id=ID（所有环境一致）
     */
    function getDetailUrl(id) {
        return '/recon/detail/?id=' + id;
    }

    /**
     * 旧 hash 链接向后兼容
     * NOTE: /recon/#2263 → 重定向到详情页
     */
    function tryRedirectFromHash() {
        var hash = location.hash.replace('#', '');
        if (!hash) return;
        // NOTE: 只处理纯数字 hash（旧的复盘 ID 链接）
        if (/^\d+$/.test(hash)) {
            location.replace(getDetailUrl(hash));
        }
    }

    /** 更新 WCA 登录按钮/用户头像 UI */
    function updateWcaAuthUI() {
        if (typeof WcaAuth === 'undefined') return;
        var user = WcaAuth.getUser();
        var loginBtn = document.getElementById('btn-wca-login');
        var userInfo = document.getElementById('wca-user-info');
        if (!loginBtn || !userInfo) return;

        if (user) {
            loginBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            document.getElementById('wca-avatar').src = user.avatar || '';
            var nameEl = document.getElementById('wca-name');
            nameEl.textContent = user.name || user.wcaId;
            // NOTE: 头像/名字可点击进入个人复盘页
            nameEl.style.cursor = 'pointer';
            nameEl.onclick = function () {
                window.location.href = '/recon/?user=' + encodeURIComponent(user.wcaId);
            };
            document.getElementById('wca-avatar').style.cursor = 'pointer';
            document.getElementById('wca-avatar').onclick = nameEl.onclick;
            // NOTE: 登录后才显示添加按钮
            var addBtn = document.getElementById('btn-add-recon');
            if (addBtn) addBtn.style.display = '';
        } else {
            loginBtn.style.display = '';
            userInfo.style.display = 'none';
            // NOTE: 未登录时隐藏添加按钮（防止滥用）
            var addBtn = document.getElementById('btn-add-recon');
            if (addBtn) addBtn.style.display = 'none';
        }
    }

    /** 进入用户模式：只显示指定 wcaId 的复盘 */
    function enterUserMode(wcaId) {
        // NOTE: 更新页面标题
        var titleEl = document.querySelector('h1') || document.querySelector('.recon-title');
        if (titleEl) {
            titleEl.innerHTML = '<a href="/recon/" style="color:#60a5fa;text-decoration:none;font-size:0.7em">← </a>' +
                wcaId + ' 的复盘';
        }

        // NOTE: 隐藏选手筛选（用户模式下无意义）
        if (filterSolver) filterSolver.style.display = 'none';

        // NOTE: 加载该用户的复盘
        ReconStore.loadByUser(wcaId).then(function (userRecons) {
            allSolves = userRecons;
            applyFilters();
            // NOTE: 用第一条复盘的 displayName 更新标题
            if (userRecons.length > 0 && userRecons[0].displayName && titleEl) {
                titleEl.innerHTML = '<a href="/recon/" style="color:#60a5fa;text-decoration:none;font-size:0.7em">← </a>' +
                    userRecons[0].displayName + ' 的复盘';
            }
        }).catch(function (e) {
            console.warn('Failed to load user recons:', e);
        });
    }

    // ==================== 筛选器 ====================

    function buildFilterOptions() {
        const persons = new Set();
        const methods = new Set();
        const events = new Set();

        allSolves.forEach(s => {
            if (s.person) persons.add(s.person);
            if (s.method) methods.add(s.method);
            if (s.event) events.add(s.event);
        });

        // NOTE: 按出现频率排序选手（最多的在前）
        const personCounts = {};
        allSolves.forEach(s => {
            if (s.person) {
                personCounts[s.person] = (personCounts[s.person] || 0) + 1;
            }
        });
        const sortedPersons = [...persons].sort((a, b) => (personCounts[b] || 0) - (personCounts[a] || 0));

        const isZh = localStorage.getItem('i18n_locale') === 'zh';

        sortedPersons.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            const cnt = personCounts[name] || 0;
            const parsed = U.parseSolverName(name);
            const enDisplay = parsed.en + ` (${cnt})`;
            const zhDisplay = (parsed.zh || parsed.en) + ` (${cnt})`;

            opt.setAttribute('data-i18n-en', enDisplay);
            opt.setAttribute('data-i18n-zh', zhDisplay);
            opt.textContent = isZh ? zhDisplay : enDisplay;

            filterSolver.appendChild(opt);
        });

        [...methods].sort().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filterMethod.appendChild(opt);
        });

        [...events].sort().forEach(e => {
            const opt = document.createElement('option');
            opt.value = e;
            opt.textContent = e;
            filterEvent.appendChild(opt);
        });
    }

    function applyFilters() {
        const query = (searchInput.value || '').toLowerCase().trim();
        const solver = filterSolver.value;
        const method = filterMethod.value;
        const event = filterEvent.value;

        // NOTE: WCA/non-WCA 复选框筛选
        const showWca = filterWca.checked;
        const showNonWca = filterNonWca.checked;

        filteredSolves = allSolves.filter(s => {
            if (solver && s.person !== solver) return false;
            if (method && s.method !== method) return false;
            if (event && s.event !== event) return false;
            // NOTE: 根据 official 字段过滤 WCA / non-WCA
            if (!showWca && s.official) return false;
            if (!showNonWca && !s.official) return false;
            if (query) {
                // NOTE: 搜索范围：选手名（含括号内中文名）、比赛名、成绩、打乱、OLL/PLL、纪录标记
                const haystack = [
                    s.person, s.comp, s.optimalScramble,
                    s.oll, s.pll, s.country, s.note,
                    s.single != null && typeof s.single === 'number' ? s.single.toFixed(3) : '',
                    // NOTE: 支持中文比赛名搜索
                    compNamesZh[s.comp] || '',
                    // NOTE: 支持用全称（name）搜索简称（cell_name）的比赛
                    compNameAliases[s.comp] || '',
                    // NOTE: 支持搜索 "cancelled"/"取消" 匹配被取消的纪录
                    s.regionalAverageRecord, s.regionalSingleRecord, s.regionalAoxrRecord
                ].filter(Boolean).join(' ').toLowerCase();
                // NOTE: "cancel"/"取消" 均映射为 "cancelled" 以匹配被取消的纪录
                const normalizedQuery = (query === '取消' || query === 'cancel') ? 'cancelled' : query;
                // NOTE: #编号 精确匹配（如 #2026 只匹配 id=2026，不会误中 2026 年比赛）
                if (normalizedQuery.startsWith('#')) {
                    return String(s.id) === normalizedQuery.slice(1);
                }
                // NOTE: 纪录字段用精确匹配（大小写不敏感），搜 WR 不应匹配 FWR
                const q = normalizedQuery.toUpperCase();
                const recordMatch = (s.regionalAverageRecord && String(s.regionalAverageRecord).toUpperCase() === q)
                    || (s.regionalSingleRecord && String(s.regionalSingleRecord).toUpperCase() === q)
                    || (s.regionalAoxrRecord && String(s.regionalAoxrRecord).toUpperCase() === q);
                if (!haystack.includes(normalizedQuery) && !recordMatch) return false;
            }
            return true;
        });

        // NOTE: 应用排序
        doSort();

        // NOTE: 重置分页并渲染
        displayCount = 0;
        tbody.innerHTML = '';
        loadMore();
        updateStats();
    }

    // ==================== 排序 ====================

    function handleSort(th) {
        const colMap = {
            'col-idx': 'id',
            'col-official': 'official',
            'col-event': 'event',
            'col-method': 'method',
            'col-date': 'date',
            'col-comp': 'comp',
            'col-round': 'round',
            'col-aoxr': 'aoType',
            'col-avg': 'average',
            'col-single': 'single',
            'col-dsingle': 'value',
            'col-solver': 'person',
            'col-stm': 'stm',
            'col-tps': 'tps'
        };

        const classes = [...th.classList];
        let col = null;
        for (const cls of classes) {
            if (colMap[cls]) { col = colMap[cls]; break; }
        }
        if (!col) return;

        // NOTE: 同列点击切换方向，不同列默认降序（数字）或升序（文本）
        if (sortCol === col) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortCol = col;
            sortDir = ['single', 'avg'].includes(col) ? 'asc' : 'desc';
        }

        // NOTE: 更新表头样式
        document.querySelectorAll('#recon-table thead th').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');

        doSort();
        displayCount = 0;
        tbody.innerHTML = '';
        loadMore();
    }

    function doSort() {
        const col = sortCol;
        const dir = sortDir === 'asc' ? 1 : -1;

        filteredSolves.sort((a, b) => {
            let va = a[col], vb = b[col];
            // NOTE: null 排到最后
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb)) * dir;
        });
    }

    // ==================== 渲染 ====================

    function loadMore() {
        const end = Math.min(displayCount + PAGE_SIZE, filteredSolves.length);
        const fragment = document.createDocumentFragment();

        for (let i = displayCount; i < end; i++) {
            fragment.appendChild(createSolveRow(filteredSolves[i]));
        }

        tbody.appendChild(fragment);
        displayCount = end;

        // NOTE: 更新分页状态
        const isZh = localStorage.getItem('i18n_locale') === 'zh';
        if (displayCount >= filteredSolves.length) {
            const enText = `${filteredSolves.length} total`;
            const zhText = `共 ${filteredSolves.length} 条`;
            showingEl.innerHTML = `<span data-i18n-en="${enText}" data-i18n-zh="${zhText}">${isZh ? zhText : enText}</span>`;
        } else {
            const enText = `Showing ${displayCount} of ${filteredSolves.length}`;
            const zhText = `已显示 ${displayCount} / ${filteredSolves.length}`;
            showingEl.innerHTML = `<span data-i18n-en="${enText}" data-i18n-zh="${zhText}">${isZh ? zhText : enText}</span>`;
        }

        // NOTE: 数据异步加载后新增的 DOM 需要重新应用 i18n 翻译
        if (typeof I18n !== 'undefined' && I18n._ready) I18n.apply();
    }

    function createSolveRow(solve) {
        const tr = document.createElement('tr');
        // NOTE: personId 字段表示社区提交（CSV 迁移数据无此字段）
        tr.className = 'solve-row' + (solve.personId ? ' community-row' : '');
        tr.dataset.id = solve.id;

        var url = getDetailUrl(solve.id);

        tr.innerHTML =
            '<td class="col-idx"><a href="' + url + '">' + (solve.id || '') + '</a></td>' +
            '<td class="col-dsingle mono">' + U.escHtml(solve.value || '') + (solve.regionalSingleRecord ? ' ' + U.formatRecord(solve.regionalSingleRecord) : '') + '</td>' +
            '<td class="col-solver">' + (function () {
                var solverHtml = U.countryFlag(U.solverCountry(solve.person, personCountries)) + ' ' + U.displaySolverName(solve.person);
                var pUrl = U.personWcaUrl(solve.personId);
                // NOTE: 有 WCA ID 时渲染为链接，否则纯文本
                // NOTE: data-person-flag 标记阻止 i18n._applyPersonFlags() 重复插入国旗
                return pUrl ? '<a href="' + U.escHtml(pUrl) + '" target="_blank" rel="noopener noreferrer" data-person-flag="done">' + solverHtml + '</a>' : solverHtml;
            })() + '</td>' +
            '<td class="col-date">' + U.escHtml(solve.date || '') + '</td>' +
            '<td class="col-comp">' + (function () {
                // NOTE: 国旗直接用数据库 country（已统一为 ISO2）
                var compHtml = U.countryFlag(solve.country) + ' ' + U.displayCompName(solve.comp, compNamesZh);
                var cUrl = U.compWcaUrl(solve.comp, compWcaIds);
                // NOTE: 有 WCA 比赛映射时渲染为链接，否则纯文本
                // NOTE: data-comp-flag 标记阻止 i18n._applyCompetitionFlags() 重复插入国旗
                return cUrl ? '<a href="' + U.escHtml(cUrl) + '" target="_blank" rel="noopener noreferrer" data-comp-flag="done">' + compHtml + '</a>' : compHtml;
            })() + '</td>' +
            '<td class="col-round">' + U.escHtml(solve.round || '') + (solve.round && solve.solveNum ? '#' : '') + (solve.solveNum || '') + '</td>' +
            '<td class="col-avg">' + U.formatAvg(solve.average) + (solve.regionalAverageRecord ? ' ' + U.formatRecord(solve.regionalAverageRecord) : '') + '</td>' +
            // NOTE: 多轮平均列——"4.24 Ao4R" → "4.24(4)"，节省列宽
            '<td class="col-aoxr">' + (function () {
                var ao = solve.aoType || '';
                if (!ao) return '';
                // 从 "4.24 Ao4R" 提取平均值和轮数，或从 "Ao3R" 仅提取轮数
                var m = ao.match(/^([\d.]+)\s+Ao(\d)R$/);
                if (m) return m[1] + '(' + m[2] + ')';
                var m2 = ao.match(/^Ao(\d)R$/);
                if (m2) return '(' + m2[1] + ')';
                return U.escHtml(ao);
            })() + (solve.regionalAoxrRecord ? ' ' + U.formatRecord(solve.regionalAoxrRecord) : '') + '</td>' +
            '<td class="col-single mono">' + U.formatResult(solve.single) + '</td>' +
            '<td class="col-stm mono">' + (solve.stm || '') + '</td>' +
            '<td class="col-tps mono">' + (solve.tps && typeof solve.tps === 'number' ? solve.tps.toFixed(2) : '') + '</td>' +
            '<td class="col-event">' + U.escHtml(solve.event || '') + '</td>' +
            '<td class="col-method">' + U.escHtml(solve.method || '') + '</td>';

        // NOTE: 点击行跳转——<a> 标签的原生中键/Ctrl/右键菜单自动生效，
        //       行级 click 增强修饰键检测，auxclick 处理中键点击非 <a> 区域
        tr.addEventListener('click', function (e) {
            if (e.target.closest('a')) return; // NOTE: <a> 标签让浏览器原生处理
            if (e.ctrlKey || e.metaKey) {
                window.open(url, '_blank');
            } else {
                location.href = url;
            }
        });
        // NOTE: 中键点击任意列 → 新标签打开
        tr.addEventListener('mousedown', function (e) {
            // NOTE: 阻止中键默认的自动滚动图标，但不拦截 <a> 标签
            if (e.button === 1 && !e.target.closest('a')) e.preventDefault();
        });
        tr.addEventListener('mouseup', function (e) {
            if (e.button === 1) {
                if (e.target.closest('a')) return; // NOTE: <a> 标签让浏览器原生处理中键
                e.preventDefault();
                window.open(url, '_blank');
            }
        });
        tr.style.cursor = 'pointer';
        return tr;
    }

    function getReconPreview(s) {
        // NOTE: 统计行在 recon 的第 1 行（如 "29STM /3.91=7.42TPS"）
        // solution 不含统计行，所以仍用 recon 提取 STM/TPS
        const text = s.recon || s.caption || '';
        if (!text) return '';
        return text.split('\n')[0].trim();
    }

    function updateStats() {
        const isZh = localStorage.getItem('i18n_locale') === 'zh';
        const total = allSolves.length;
        const shown = filteredSolves.length;
        if (shown === total) {
            const enText = `${total} recons`;
            const zhText = `共 ${total} 条`;
            statsEl.innerHTML = `<span data-i18n-en="${enText}" data-i18n-zh="${zhText}">${isZh ? zhText : enText}</span>`;
        } else {
            const enText = `${shown}/${total} matching`;
            const zhText = `${shown}/${total} 匹配`;
            statsEl.innerHTML = `<span data-i18n-en="${enText}" data-i18n-zh="${zhText}">${isZh ? zhText : enText}</span>`;
        }
    }

    // ==================== 工具函数 ====================

    function debounce(fn, delay) {
        let timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, delay);
        };
    }

})();
