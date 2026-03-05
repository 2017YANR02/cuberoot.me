/**
 * Recon 复盘页面前端逻辑
 * 功能：加载 JSON、表格渲染、筛选搜索、行展开、排序、分页
 */
(function () {
    'use strict';

    // --- 常量 ---
    const PAGE_SIZE = 50; // NOTE: 每次加载的行数
    const COMP_COUNTRIES_URL = '/stats/comp_name_countries.json';
    const PERSON_COUNTRIES_URL = '/stats/person_name_countries.json';
    const COMP_NAMES_ZH_URL = '/recon/comp_names_zh.json';
    const DEFAULT_SORT = { key: 'id', asc: false };

    // --- 状态 ---
    let allSolves = [];       // 全部数据
    let filteredSolves = [];  // 筛选后的数据
    let displayCount = 0;     // 当前已显示的行数
    let sortCol = 'id';       // 当前排序列
    let sortDir = 'desc';     // 排序方向
    let expandedId = null;    // 当前展开的行 ID
    let compCountries = {};   // 比赛名 → ISO2 映射
    let personCountries = {};  // 选手名 → ISO2 映射
    let compNamesZh = {};     // 英文比赛名 → 中文比赛名 映射

    // --- DOM 引用 ---
    let tbody, searchInput, filterSolver, filterMethod, filterEvent;
    let filterWca, filterNonWca;
    let statsEl, showingEl, loadMoreBtn;

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
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

        // NOTE: 加载辅助数据（国旗映射、中文比赛名）
        try {
            const [compResp, personResp, compZhResp] = await Promise.all([
                fetch(COMP_COUNTRIES_URL),
                fetch(PERSON_COUNTRIES_URL),
                fetch(COMP_NAMES_ZH_URL)
            ]);
            compCountries = await compResp.json();
            personCountries = await personResp.json();
            compNamesZh = await compZhResp.json();
        } catch (e) {
            console.warn('Failed to load auxiliary data:', e);
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
                // NOTE: 阻止操作，恢复刚被取消的那个
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

        // NOTE: 事件委托——管理员按钮 + caption 复制
        tbody.addEventListener('click', function (e) {
            // --- 管理员编辑按钮 → sessionStorage + 跳转到独立编辑页 ---
            var editBtn = e.target.closest('.recon-btn-edit');
            if (editBtn) {
                e.stopPropagation();
                var solveId = editBtn.dataset.solveId;
                var solve = allSolves.find(function (s) { return String(s.id) === solveId; });
                if (solve) {
                    sessionStorage.setItem('recon_edit_solve', JSON.stringify(solve));
                    location.href = '/recon/submit/';
                }
                return;
            }
            // --- 管理员恢复按钮 ---
            var restoreBtn = e.target.closest('.recon-btn-restore');
            if (restoreBtn) {
                e.stopPropagation();
                handleRestore(restoreBtn.dataset.solveId);
                return;
            }
            // --- 管理员历史按钮 ---
            var historyBtn = e.target.closest('.recon-btn-history');
            if (historyBtn) {
                e.stopPropagation();
                showEditHistory(historyBtn.dataset.solveId);
                return;
            }
            // --- caption 复制按钮 ---
            var btn = e.target.closest('.caption-copy-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            var text = btn.getAttribute('data-caption');
            navigator.clipboard.writeText(text).then(function () {
                var isZh = localStorage.getItem('i18n_locale') === 'zh';
                var orig = btn.textContent;
                btn.textContent = isZh ? '已复制' : 'copied';
                btn.classList.add('copied');
                setTimeout(function () {
                    btn.textContent = orig;
                    btn.classList.remove('copied');
                }, 1500);
            });
        });

        // NOTE: 编辑现在通过独立页面完成，跳回时整页重载自动拉取最新数据

        // NOTE: 复制分享链接按钮事件委托
        tbody.addEventListener('click', function (e) {
            var linkBtn = e.target.closest('.share-link-btn');
            if (!linkBtn) return;
            e.preventDefault();
            e.stopPropagation();
            var url = linkBtn.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(function () {
                var isZh = localStorage.getItem('i18n_locale') === 'zh';
                var orig = linkBtn.textContent;
                linkBtn.textContent = isZh ? '已复制' : 'copied';
                linkBtn.classList.add('copied');
                setTimeout(function () {
                    linkBtn.textContent = orig;
                    linkBtn.classList.remove('copied');
                }, 1500);
            });
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
                    tryExpandFromHash();
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
            // NOTE: 删除后清除 hash，避免停留在已删除条目的锚点
            history.replaceState(null, '', location.pathname + location.search);
        });
    }

    /**
     * 从 URL hash 自动展开对应行
     * NOTE: 如果目标行不在当前已渲染的行中（被分页截断），先加载全部数据再定位
     */
    function tryExpandFromHash() {
        if (expandedId !== null) return; // NOTE: 已有展开行，不重复处理
        var hash = location.hash.replace('#', '');
        if (!hash) return;
        var targetId = isNaN(hash) ? hash : parseInt(hash);

        // NOTE: 确保目标行已渲染（可能被分页截断），逐批加载直到找到
        while (displayCount < filteredSolves.length) {
            var found = false;
            for (var i = 0; i < displayCount; i++) {
                if (String(filteredSolves[i].id) === String(targetId)) { found = true; break; }
            }
            if (found) break;
            loadMore();
        }

        // NOTE: 查找并点击目标行
        var targetRow = tbody.querySelector('.solve-row[data-id="' + targetId + '"]');
        if (targetRow) {
            var solve = allSolves.find(function (s) { return String(s.id) === String(targetId); });
            if (solve) {
                toggleDetail(solve, targetRow);
            }
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

    // NOTE: assignCommunityIds() 已删除——后端统一分配永久数字 ID

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
            const parsed = parseSolverName(name);
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
        expandedId = null;
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
        expandedId = null;
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
            showingEl.textContent = isZh
                ? `共 ${filteredSolves.length} 条`
                : `${filteredSolves.length} total`;
        } else {
            showingEl.textContent = isZh
                ? `已显示 ${displayCount} / ${filteredSolves.length}`
                : `Showing ${displayCount} of ${filteredSolves.length}`;
        }
    }

    // NOTE: 中文模式下优先显示中文比赛名（有映射时）
    function displayCompName(comp) {
        if (!comp) return '';
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        if (isZh && compNamesZh[comp]) return escHtml(compNamesZh[comp]);
        return escHtml(comp);
    }

    function createSolveRow(solve) {
        const tr = document.createElement('tr');
        // NOTE: personId 字段表示社区提交（CSV 迁移数据无此字段）
        tr.className = 'solve-row' + (solve.personId ? ' community-row' : '');
        tr.dataset.id = solve.id;

        const officialHtml = solve.official ? '✅' : '';

        tr.innerHTML =
            '<td class="col-idx">' + (solve.id || '') + '</td>' +
            '<td class="col-avg">' + formatAvg(solve.average) + (solve.regionalAverageRecord ? ' ' + formatRecord(solve.regionalAverageRecord) : '') + '</td>' +
            '<td class="col-dsingle mono">' + escHtml(solve.value || '') + (solve.regionalSingleRecord ? ' ' + formatRecord(solve.regionalSingleRecord) : '') + '</td>' +
            '<td class="col-solver">' + countryFlag(solverCountry(solve)) + ' ' + displaySolverName(solve) + '</td>' +
            '<td class="col-date">' + escHtml(solve.date || '') + '</td>' +
            '<td class="col-comp">' + countryFlag(compCountries[solve.comp]) + ' ' + displayCompName(solve.comp) + '</td>' +
            '<td class="col-round">' + escHtml(solve.round || '') + (solve.round && solve.solveNum ? '#' : '') + (solve.solveNum || '') + '</td>' +
            '<td class="col-aoxr">' + escHtml(solve.aoType || '') + (solve.regionalAoxrRecord ? ' ' + formatRecord(solve.regionalAoxrRecord) : '') + '</td>' +
            '<td class="col-single mono">' + formatResult(solve.single) + '</td>' +
            '<td class="col-stm mono">' + (solve.stm || '') + '</td>' +
            '<td class="col-tps mono">' + (solve.tps && typeof solve.tps === 'number' ? solve.tps.toFixed(2) : '') + '</td>' +
            '<td class="col-event">' + escHtml(solve.event || '') + '</td>' +
            '<td class="col-method">' + escHtml(solve.method || '') + '</td>';

        tr.addEventListener('click', () => toggleDetail(solve, tr));
        return tr;
    }

    function toggleDetail(solve, solveRow) {
        const existingDetail = solveRow.nextElementSibling;

        // NOTE: 若已展开则收起
        if (existingDetail && existingDetail.classList.contains('detail-row')) {
            existingDetail.remove();
            solveRow.classList.remove('expanded');
            expandedId = null;
            // NOTE: 收起时清除 hash（不触发滚动）
            history.replaceState(null, '', location.pathname + location.search);
            return;
        }

        // NOTE: 关闭其他展开的行
        if (expandedId !== null) {
            const prevExpanded = tbody.querySelector('.solve-row.expanded');
            if (prevExpanded) {
                const prevDetail = prevExpanded.nextElementSibling;
                if (prevDetail && prevDetail.classList.contains('detail-row')) {
                    prevDetail.remove();
                }
                prevExpanded.classList.remove('expanded');
            }
        }

        // NOTE: 创建详情行
        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        const td = document.createElement('td');
        td.colSpan = 14;
        td.innerHTML = buildDetailHtml(solve);
        detailRow.appendChild(td);

        solveRow.after(detailRow);
        solveRow.classList.add('expanded');
        expandedId = solve.id;
        // NOTE: 更新 URL hash，方便分享链接
        history.replaceState(null, '', '#' + solve.id);

        // NOTE: 点击展开时滚动到屏幕顶部
        solveRow.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // NOTE: 懒加载 twisty-player（有 wcaScramble 时）
        var twistyContainer = td.querySelector('.recon-twisty-container');
        if (twistyContainer && typeof window.ensureTwisty === 'function') {
            loadTwistyPlayer(twistyContainer, solve);
        }
    }

    // ==================== 魔方动画 ====================

    /**
     * 从复盘文本中提取纯解法（去除统计行、打乱行、// 注释）
     * 三行格式: 第1行=统计, 第2行=打乱, 第3行起=解法
     */
    function extractAlgFromRecon(text) {
        if (!text) return '';
        var lines = text.split('\n');
        var startIdx = 0;
        // NOTE: 跳过第1行统计（如 "41STM /3.64=11.26TPS"）
        if (lines.length > 0 && /^\d+STM\s/i.test(lines[0])) {
            startIdx = 1;
            // NOTE: 跳过第2行打乱（统计行之后紧跟的一行纯公式，无 // 注释）
            if (lines.length > 1 && lines[1].indexOf('//') < 0) {
                startIdx = 2;
            }
        }
        var alg = lines.slice(startIdx)
            .map(function (line) {
                var idx = line.indexOf('//');
                return (idx >= 0 ? line.substring(0, idx) : line).trim();
            })
            .filter(function (line) { return line.length > 0; })
            .join('\n');
        return ReconAlgUtils.cleanForPlayer(alg);
    }

    /** 提取纯解法但保留 // 注释（用于 alg.cubing.net 链接） */
    function extractAlgWithComments(text) {
        if (!text) return '';
        var lines = text.split('\n');
        var startIdx = 0;
        if (lines.length > 0 && /^\d+STM\s/i.test(lines[0])) {
            startIdx = 1;
            if (lines.length > 1 && lines[1].indexOf('//') < 0) {
                startIdx = 2;
            }
        }
        var alg = lines.slice(startIdx)
            .filter(function (line) { return line.trim().length > 0; })
            .join('\n');
        return ReconAlgUtils.cleanForAlgCubingNet(alg);
    }

    /** 从复盘文本第2行提取打乱公式（当 wcaScramble/scramble 字段为空时的 fallback） */
    function extractScrambleFromRecon(text) {
        if (!text) return '';
        var lines = text.split('\n');
        // NOTE: 第1行是统计行时, 第2行就是打乱
        if (lines.length > 1 && /^\d+STM\s/i.test(lines[0])) {
            return lines[1].trim();
        }
        return '';
    }

    /**
     * 从 recon 文本动态生成 caption（等效 Google Sheets CAPTION 函数）。
     * 逻辑：去掉统计行和打乱行，去掉 insp 行，
     * 去掉每行 // 后的注释，末尾附加统计行。
     */
    function generateCaption(text) {
        if (!text) return '';
        var lines = text.split('\n');
        var statsLine = '';
        var startIdx = 0;
        // NOTE: 第1行是 STM/TPS 统计行，提取后跳过
        if (lines.length > 0 && /^\d+STM\s/i.test(lines[0])) {
            statsLine = lines[0].trim();
            startIdx = 1;
            // NOTE: 第2行无 // 则为打乱行，跳过
            if (lines.length > 1 && lines[1].indexOf('//') < 0) {
                startIdx = 2;
            }
        }
        var result = lines.slice(startIdx)
            .filter(function (line) {
                // NOTE: 去掉 insp 行和空行
                return line.trim().length > 0 && !/\binsp\b/i.test(line);
            })
            .map(function (line) {
                // NOTE: 去掉 // 及之后的注释，保留纯公式
                var pos = line.indexOf('//');
                return pos >= 0 ? line.substring(0, pos).trimEnd() : line;
            })
            .filter(function (line) { return line.trim().length > 0; });
        // NOTE: 末尾附加统计行
        if (statsLine) result.push(statsLine);
        return result.join('\n');
    }

    /** 懒加载 twisty-player 并插入到容器 */
    function loadTwistyPlayer(container, solve) {
        container.innerHTML = '<div style="color:#888;font-size:0.8em">加载中...</div>';
        window.ensureTwisty().then(function () {
            var Ctor = window.__TwistyPlayerCtor;
            if (!Ctor) { container.innerHTML = ''; return; }

            var reconText = solve.recon || solve.caption || '';
            // NOTE: 优先用独立字段, fallback 从 recon 文本第2行提取
            var setup = solve.wcaScramble || solve.optimalScramble || extractScrambleFromRecon(reconText);
            var alg = extractAlgFromRecon(reconText);
            // NOTE: 根据项目切换 puzzle
            var puzzle = '3x3x3';
            if (solve.event && solve.event.indexOf('2') >= 0) puzzle = '2x2x2';

            // NOTE: 使用默认配置（棋盘格背景 + 完整控制面板）
            var player = new Ctor({
                puzzle: puzzle,
                experimentalSetupAlg: setup,
                alg: alg
            });

            container.innerHTML = '';
            container.appendChild(player);
        }).catch(function () {
            container.innerHTML = '';
        });
    }

    function buildDetailHtml(s) {
        const isZh = localStorage.getItem('i18n_locale') === 'zh';

        let html = '<div class="detail-content">';

        // NOTE: 复盘 + 打乱两列布局（复盘在左，手机端也先显示复盘）
        html += '<div class="detail-grid">';

        // 左列：复盘步骤
        html += '<div>';
        if (s.recon) {
            html += '<div class="detail-recon">';
            html += '<div class="detail-recon-label"><span data-i18n-en="Reconstruction" data-i18n-zh="复盘">' + (isZh ? '复盘' : 'Reconstruction') + '</span></div>';
            html += '<div class="detail-recon-text">' + formatReconText(s.recon) + '</div>';
            html += '</div>';
        } else if (s.caption) {
            html += '<div class="detail-recon">';
            html += '<div class="detail-recon-label"><span data-i18n-en="Reconstruction" data-i18n-zh="复盘">' + (isZh ? '复盘' : 'Reconstruction') + '</span></div>';
            html += '<div class="detail-recon-text">' + formatReconText(s.caption) + '</div>';
            html += '</div>';
        }
        // NOTE: 有打乱时插入 twisty-player 占位符 + alg.cubing.net 链接
        var reconText = s.recon || s.caption || '';
        var scrambleForPlayer = s.wcaScramble || s.optimalScramble || extractScrambleFromRecon(reconText);
        if (scrambleForPlayer && reconText) {
            html += '<div class="recon-twisty-container"></div>';
            // NOTE: 构建 alg.cubing.net 链接
            var setupStr = encodeURIComponent(scrambleForPlayer);
            var algStr = encodeURIComponent(extractAlgWithComments(reconText));
            var puzzleStr = (s.event && s.event.indexOf('2') >= 0) ? '2x2x2' : '3x3x3';
            var algUrl = 'https://alg.cubing.net/?setup=' + setupStr + '&alg=' + algStr + '&puzzle=' + puzzleStr;
            var cubedbUrl = 'https://cubedb.net/?puzzle=' + (puzzleStr === '2x2x2' ? '2x2' : '3x3') + '&scramble=' + setupStr + '&alg=' + algStr;
            html += '<div class="recon-external-links">';
            html += '<a href="' + algUrl + '" target="_blank" rel="noopener noreferrer">alg.cubing.net</a>';
            html += ' <a href="' + cubedbUrl + '" target="_blank" rel="noopener noreferrer">cubedb.net</a>';
            // NOTE: caption 复制按钮——动态生成 caption 文本并复制到剪贴板
            var captionText = generateCaption(reconText);
            if (captionText) {
                html += ' <a href="#" class="caption-copy-btn" data-caption="' + escHtml(captionText).replace(/"/g, '&quot;') + '"' +
                    ' data-i18n-en="caption" data-i18n-zh="字幕">caption</a>';
            }
            // NOTE: 复制分享链接按钮
            var shareUrl = location.origin + '/recon/#' + s.id;
            html += ' <a href="#" class="share-link-btn" data-url="' + shareUrl + '"' +
                ' data-i18n-en="link" data-i18n-zh="链接">link</a>';
            html += '</div>';
        }
        html += '</div>';

        // 右列：统计网格 + 打乱 + 元数据
        html += '<div>';

        // NOTE: 统计网格（从 recon 文本自动计算的统计值）
        html += buildStatsGrid(s, isZh);

        if (s.optimalScramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="Optimal Scramble (scr*)" data-i18n-zh="最少步打乱 (scr*)">' + (isZh ? '最少步打乱 (scr*)' : 'Optimal Scramble (scr*)') + '</span></div>';
            html += '<div class="detail-scramble-text">' + escHtml(s.optimalScramble) + '</div>';
            html += '</div>';
        }
        if (s.wcaScramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="WCA Scramble (scr)" data-i18n-zh="WCA 打乱 (scr)">' + (isZh ? 'WCA 打乱 (scr)' : 'WCA Scramble (scr)') + '</span></div>';
            html += '<div class="detail-scramble-text">' + escHtml(s.wcaScramble) + '</div>';
            html += '</div>';
        }

        // 元数据
        html += '<div class="detail-meta">';
        if (s.cube) {
            html += '<div class="detail-meta-item"><span class="detail-meta-label">🧊</span><span class="detail-meta-value">' + escHtml(s.cube) + '</span></div>';
        }
        if (s.reconer) {
            html += '<div class="detail-meta-item"><span class="detail-meta-label">✍️</span><span class="detail-meta-value">' + escHtml(s.reconer) + '</span></div>';
        }
        html += '</div>';

        // NOTE: note 内容可能很长（包含替代解法等），独立显示
        if (s.note) {
            html += '<div class="detail-note">';
            html += '<div class="detail-scramble-label">📝 ' + (isZh ? '备注' : 'Note') + '</div>';
            html += '<div class="detail-recon-text">' + escHtml(s.note) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        html += '</div>'; // detail-grid

        // NOTE: 管理员操作按钮（编辑/恢复/历史）+ 删除按钮
        var isAdminUser = typeof WcaAuth !== 'undefined' && WcaAuth.isAdmin();

        // NOTE: 删除权限：本人提交的复盘（personId 匹配）或管理员
        var canDelete = false;
        if (s.personId && typeof WcaAuth !== 'undefined') {
            var currentUser = WcaAuth.getUser();
            if (currentUser && currentUser.wcaId === s.personId) canDelete = true;
        }
        if (isAdminUser) canDelete = true;

        if (isAdminUser || canDelete) {
            html += '<div class="detail-admin-actions">';
            if (isAdminUser) {
                html += '<button class="recon-btn recon-btn-edit" data-solve-id="' + s.id + '">' +
                    (isZh ? '✏️ 编辑' : '✏️ Edit') + '</button>';
                if (s._edited) {
                    html += '<button class="recon-btn recon-btn-restore" data-solve-id="' + s.id + '">' +
                        (isZh ? '↩️ 恢复原始' : '↩️ Restore') + '</button>';
                }
                html += '<button class="recon-btn recon-btn-history" data-solve-id="' + s.id + '">' +
                    (isZh ? '📋 历史' : '📋 History') + '</button>';
            }
            if (canDelete) {
                // NOTE: 删除按钮紧跟其他按钮
                html += '<button class="recon-btn recon-btn-danger" onclick="window.dispatchEvent(new CustomEvent(\'recon-local-delete\',{detail:\'' + s.id + '\'}))">' +
                    '🗑️ ' + (isZh ? '删除' : 'Delete') +
                    '</button>';
            }
            html += '</div>';
        }

        html += '</div>'; // detail-content
        return html;
    }

    // NOTE: 管理员恢复原始数据（删除 Firestore 覆盖层）
    function handleRestore(solveId) {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        if (!confirm(isZh ? '确定恢复为原始数据？' : 'Restore original data?')) return;
        ReconStore.deleteEdit(solveId).then(function () {
            location.reload();
        }).catch(function (err) {
            console.error('Failed to restore:', err);
            alert('Restore failed: ' + err.message);
        });
    }

    // NOTE: 显示编辑历史弹窗（任务 4 实现具体 UI）
    function showEditHistory(solveId) {
        ReconStore.getEditHistory(solveId).then(function (history) {
            var isZh = localStorage.getItem('i18n_locale') === 'zh';
            if (history.length === 0) {
                alert(isZh ? '暂无编辑历史' : 'No edit history');
                return;
            }
            // NOTE: 简单弹窗展示历史记录，任务 4 替换为模态框
            var msg = (isZh ? '编辑历史 (#' : 'Edit History (#') + solveId + ')\n\n';
            history.forEach(function (h) {
                var time = h.editedAt ? new Date(h.editedAt.seconds * 1000).toLocaleString() : '?';
                msg += time + '  by ' + (h.editedBy || '?') + '\n';
                if (h.before && h.after) {
                    for (var key in h.after) {
                        if (key.charAt(0) === '_') continue;
                        msg += '  ' + key + ': ' + (h.before[key] || '') + ' → ' + h.after[key] + '\n';
                    }
                }
                msg += '\n';
            });
            alert(msg);
        }).catch(function (err) {
            console.error('Failed to load history:', err);
        });
    }

    /**
     * NOTE: 构建统计网格 HTML。
     * 展示从 recon 文本自动计算的统计值（STM、TPS、F2L、LL 等）。
     */
    function buildStatsGrid(s, isZh) {
        // NOTE: Cross 类型数字 → 可读标签
        const CROSS_LABELS = { 0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross' };

        // NOTE: 定义统计项列表：[JSON字段, 英文标签, 中文标签, 格式化函数(可选)]
        const items = [
            ['stm', 'STM', 'STM'],
            ['tps', 'TPS', 'TPS'],
            ['crossStm', 'Cross', 'Cross'],
            ['f2l', 'F2L', 'F2L'],
            ['ll', 'LL', 'LL'],
            ['crossType', '?x', '?x', function (v) { return CROSS_LABELS[v] || v; }],
            ['freePair', 'Free Pair', '基态'],
            ['yRot', 'y rot', 'y 旋转'],
            ['regrip', 'Regrip', '换手'],
            ['lockup', 'Lockup', '卡顿'],
            ['sMove', 'S move', 'S 步'],
            ['crossColor', 'Color', '底色', function (v) {
                // NOTE: 使用对应的魔方面颜色着色
                var color = FACE_COLORS[v];
                if (color) return '<span style="color:' + color + ';font-weight:600">' + v + '</span>';
                return v;
            }],
            ['ollShort', 'OLL', 'OLL'],
            ['pllShort', 'PLL', 'PLL'],
        ];

        // NOTE: 过滤出有值的统计项
        var visibleItems = [];
        for (var i = 0; i < items.length; i++) {
            var key = items[i][0];
            var val = s[key];
            if (val !== undefined && val !== null && val !== '') {
                visibleItems.push(items[i]);
            }
        }
        if (visibleItems.length === 0) return '';

        var html = '<div class="detail-stats">';
        html += '<div class="detail-stats-label">📊 ' + (isZh ? '统计' : 'Stats') + '</div>';
        html += '<div class="detail-stats-grid">';
        for (var j = 0; j < visibleItems.length; j++) {
            var item = visibleItems[j];
            var key = item[0];
            var label = isZh ? item[2] : item[1];
            var val = s[key];
            var fmt = item[3];
            var displayVal = fmt ? fmt(val) : escHtml(String(val));
            html += '<div class="stat-item">' +
                '<span class="stat-label">' + escHtml(label) + '</span>' +
                '<span class="stat-value">' + displayVal + '</span>' +
                '</div>';
        }
        html += '</div></div>';
        return html;
    }

    // ==================== 格式化工具 ====================

    function formatResult(val) {
        if (val == null) return '';
        if (val >= 9999) return 'DNF';
        if (typeof val !== 'number') return String(val);
        return val.toFixed(3);
    }

    // NOTE: 平均成绩只需精确到百分位，≥60 秒时显示为 分:秒.xx
    function formatAvg(val) {
        if (val == null) return '';
        if (val >= 9999) return 'DNF';
        if (val >= 60) {
            var m = Math.floor(val / 60);
            var s = (val % 60).toFixed(2);
            // NOTE: 秒部分不足 10 时补前导零（如 1:05.23）
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
        if (typeof val !== 'number') return String(val);
        return val.toFixed(2);
    }

    function formatTps(val) {
        if (val == null) return '';
        if (typeof val !== 'number') return String(val);
        return val.toFixed(2);
    }

    // NOTE: 从 WCA 格式名字中提取英文名和中文名
    // "Ruimin Yan (颜瑞民)" → {en: "Ruimin Yan", zh: "颜瑞民"}
    // "Max Park" → {en: "Max Park", zh: null}
    function parseSolverName(fullName) {
        var m = fullName.match(/^(.+?)\s*\((.+)\)$/);
        if (m) return { en: m[1], zh: m[2] };
        return { en: fullName, zh: null };
    }

    // NOTE: 查找选手国旗 ISO2。solver 字段已含完整 WCA 格式名（如 "Ruimin Yan (颜瑞民)"）
    function solverCountry(solve) {
        if (personCountries[solve.person]) return personCountries[solve.person];

        // NOTE: fallback——社区复盘可能只存了中文名或英文名，
        // 在 personCountries 的 key 中模糊搜索
        var name = solve.person || '';
        if (name) {
            for (var key in personCountries) {
                if (key.indexOf(name) !== -1) return personCountries[key];
            }
        }
        return '';
    }

    // NOTE: ISO2 代码转国旗图标（使用 flag-icons CSS 库，与 stats 页面一致）
    function countryFlag(iso2) {
        if (!iso2) return '';
        return '<span class="fi fi-' + iso2.toLowerCase() + '"></span>';
    }

    // NOTE: Record 标记格式化为 badge（白字彩色圆角方框）
    // 颜色规则：WR=红色, 洲际(AsR/ER/CR)=黄色, NR=绿色, 个人(PR/PB)=蓝色
    // 前缀 F=女子纪录，颜色同上
    function formatRecord(val) {
        if (!val) return '';
        val = String(val); // NOTE: 防御性强转（edit overlay 可能存入非字符串）
        // NOTE: 处理 "WR cancelled" 等被取消的纪录，用紫色 + 红色对角线（CSS 实现）
        const cancelled = /\bcancelled\b/i.test(val);
        const recordType = cancelled ? val.replace(/\s*cancelled\s*/i, '').trim() : val;
        // NOTE: 如果被取消，统一使用紫色的 cancelled 样式，否则用对应级别的颜色
        const cls = cancelled ? 'cancelled' : getRecordClass(recordType);
        return '<span class="record-badge record-' + cls + '">' + escHtml(recordType) + '</span>';
    }

    function getRecordClass(val) {
        // NOTE: B=Best 与 R=Record 同色；F=女子纪录颜色同上
        const v = val.toUpperCase();
        // 世界纪录/世界最好（红色）
        if (/^[FXU]?W[RB]$|^1STWR$|^RWR$|^YTW[RB]$|^XWR$/.test(v)) return 'wr';
        // WCR（橙色）
        if (v === 'WCR') return 'wcr';
        // 洲际纪录（黄色）：AsR/AsB, ER/EB, CR/CB, SAR, NAR 等
        if (/(?:AS|E|C)[RB]$/.test(v) || /^(?:SAR|NAR|FASR|XASR|UASR)$/.test(v)) return 'cr';
        // 国家纪录/国家最好（绿色）
        if (/^[FXU]?N[RB]$|^NWR$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
        // 个人纪录/个人最好（蓝色）
        if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
            || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
        // 其他（灰色）
        return 'other';
    }

    function formatRound(s) {
        let r = s.round || '';
        if (s.solveNum) r += (r ? ' #' : '#') + s.solveNum;
        return r;
    }

    function displaySolverName(s) {
        // NOTE: 中文模式下优先显示中文名，从 solver 括号中提取
        const isZh = localStorage.getItem('i18n_locale') === 'zh';
        const parsed = parseSolverName(s.person || '');
        if (parsed.zh) {
            const text = isZh ? parsed.zh : parsed.en;
            return `<span data-i18n-en="${escHtml(parsed.en)}" data-i18n-zh="${escHtml(parsed.zh)}">${escHtml(text)}</span>`;
        }
        return escHtml(parsed.en);
    }

    function getReconPreview(s) {
        const text = s.recon || s.caption || '';
        if (!text) return '';
        return text.split('\n')[0].trim();
    }

    // NOTE: 魔方面颜色映射（用于注释中的颜色字母着色）
    const FACE_COLORS = {
        W: '#e8e8e8', // 白色（暗色背景上用浅灰白，避免太刺眼）
        Y: '#facc15', // 黄色
        R: '#ef4444', // 红色
        O: '#f97316', // 橙色
        G: '#22c55e', // 绿色
        B: '#3b82f6'  // 蓝色
    };

    /**
     * NOTE: 对注释文本中的魔方面颜色字母着色。
     * 只处理「独立的颜色字母」，即前后都不是英文字母的 W/Y/R/O/G/B，
     * 这样可以避免误匹配 OLL/PLL/ZBLL/CMLL/EG/VLS 等算法名中的字母。
     */
    function colorizeComment(commentHtml) {
        // NOTE: 正则将连续的字母、数字及常见的连接符（-+()*.）匹配为一个整体 token。
        // 这样可以确保 OLL(CP)-R- 或 EPLL-U- 不会被中途截断而导致后续字母被误着色。
        return commentHtml.replace(/[A-Za-z0-9+\-()*.]+/g, function (word) {
            // NOTE: 清理 token 首尾的标点，便于判断（如 (BR) -> BR）
            var cleanWord = word.replace(/^[+\-()*.]+/, '').replace(/[+\-()*.]+$/, '');
            if (!cleanWord) return word;

            // NOTE: 提取开头的字母部分检查是否在算法白名单中
            var baseName = cleanWord.replace(/[-+()0-9.*].*$/, '');
            if (/^(?:OLL|PLL|ZBLL|ZBLS|EPLL|OCLL|COLL|CMLL|EG|VLS|VH|WV|CLL|CSP|OBL|CP|EP|EO|EOLRb|DR|insp|cross|xcross|pscross|psxcross|xxxcross|xxcross|layer|face|cancel|into|auto|Skip|Fail|STM|SPS|TPS|better|NR|pair|pairs|free|predicted|counting|full|move|edge|Reconstruction|PBL|OLLCP|1LLL)$/i.test(baseName)) {
                return word;
            }

            // NOTE: 处理加号连接的多个 token（如 GRc+GOe）
            if (word.includes('+')) {
                return word.split('+').map(part => colorizePart(part)).join('+');
            }
            return colorizePart(word);
        });
    }

    function colorizePart(word) {
        // 先去掉可能存在的包裹标点，再对剩余的部分染色。例如 "(BR)" -> 着色 BR 然后包回括号
        var prefixMatch = word.match(/^[+\-()*.]+/);
        var suffixMatch = word.match(/[+\-()*.]+$/);
        var prefix = prefixMatch ? prefixMatch[0] : '';
        var suffix = suffixMatch ? suffixMatch[0] : '';
        var inner = word.substring(prefix.length, word.length - suffix.length);

        if (!inner) return word;

        // NOTE: 纯颜色字母组成的 token（如 BR, WO, GR, W, Y）→ 逐字母着色
        if (/^[WYROGB]+$/.test(inner)) {
            inner = inner.split('').map(function (ch) {
                return '<span style="color:' + FACE_COLORS[ch] + ';font-weight:600">' + ch + '</span>';
            }).join('');
            return prefix + inner + suffix;
        }
        // NOTE: 颜色字母开头 + 特定小写后缀（如 e=棱块, c=角块）→ 只着色大写部分
        var m = inner.match(/^([WYROGB]+)([ec])$/);
        if (m) {
            inner = m[1].split('').map(function (ch) {
                return '<span style="color:' + FACE_COLORS[ch] + ';font-weight:600">' + ch + '</span>';
            }).join('') + m[2];
            return prefix + inner + suffix;
        }
        return word;
    }

    function formatReconText(text) {
        if (!text) return '';
        // NOTE: 先 HTML 转义，再对 // 注释部分着色
        return escHtml(text).replace(
            /\/\/(.*?)(?=\n|$)/g,
            function (match, content) {
                return '<span class="recon-comment">//' + colorizeComment(content) + '</span>';
            }
        );
    }

    function escHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
