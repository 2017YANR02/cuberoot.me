/**
 * Recon 复盘页面前端逻辑
 * 功能：加载 JSON、表格渲染、筛选搜索、行展开、排序、分页
 */
(function () {
    'use strict';

    // --- 常量 ---
    const PAGE_SIZE = 50; // NOTE: 每次加载的行数
    const DATA_URL = '/recon/recon_data.json';
    const COMP_COUNTRIES_URL = '/stats/comp_name_countries.json';
    const PERSON_COUNTRIES_URL = '/stats/person_name_countries.json';
    const DEFAULT_SORT = { key: 'date', asc: false };

    // --- 状态 ---
    let allSolves = [];       // 全部数据
    let filteredSolves = [];  // 筛选后的数据
    let displayCount = 0;     // 当前已显示的行数
    let sortCol = 'date';     // 当前排序列
    let sortDir = 'desc';     // 排序方向
    let expandedId = null;    // 当前展开的行 ID
    let compCountries = {};   // 比赛名 → ISO2 映射
    let personCountries = {};  // 选手名 → ISO2 映射

    // --- DOM 引用 ---
    let tbody, searchInput, filterSolver, filterMethod, filterEvent;
    let statsEl, showingEl, loadMoreBtn;

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        tbody = document.getElementById('recon-tbody');
        searchInput = document.getElementById('recon-search');
        filterSolver = document.getElementById('filter-solver');
        filterMethod = document.getElementById('filter-method');
        filterEvent = document.getElementById('filter-event');
        statsEl = document.getElementById('recon-stats');
        showingEl = document.getElementById('recon-showing');
        loadMoreBtn = document.getElementById('btn-load-more');

        // NOTE: 检测 URL ?user=wcaId 参数，进入用户模式
        var urlParams = new URLSearchParams(window.location.search);
        var userWcaId = urlParams.get('user');

        // NOTE: 加载数据
        try {
            const [reconResp, compResp, personResp] = await Promise.all([
                fetch(DATA_URL),
                fetch(COMP_COUNTRIES_URL),
                fetch(PERSON_COUNTRIES_URL)
            ]);
            const data = await reconResp.json();
            allSolves = data.solves || [];
            compCountries = await compResp.json();
            personCountries = await personResp.json();

            // NOTE: 预处理数据，提取 STM/TPS 用于排序和显示
            preprocessSolves(allSolves);
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#f87171">Failed to load data</td></tr>';
            console.error('Failed to load recon data:', e);
            return;
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

        // NOTE: caption 复制按钮——事件委托
        tbody.addEventListener('click', function (e) {
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

        // NOTE: 初始渲染（用户模式下跳过，由 enterUserMode 处理）
        if (!userWcaId) {
            applyFilters();
        }

        // NOTE: 初始化 WCA 登录 UI
        updateWcaAuthUI();

        // NOTE: 加载社区复盘（区分用户模式 / 全量模式）
        if (typeof ReconStore !== 'undefined') {
            if (userWcaId) {
                // NOTE: 用户模式：清空 CSV 数据，只显示该用户的 Firestore 复盘
                allSolves = [];
                enterUserMode(userWcaId);
            } else {
                ReconStore.loadAll().then(function (communityRecons) {
                    if (communityRecons.length > 0) {
                        allSolves = communityRecons.concat(allSolves);
                        applyFilters();
                    }
                }).catch(function (e) {
                    console.warn('Failed to load community recons:', e);
                });
            }
        }

        // NOTE: 监听客户端提交的本地复盘
        window.addEventListener('recon-local-add', function (e) {
            var solve = e.detail;
            allSolves.unshift(solve);
            applyFilters();
        });

        // NOTE: 监听删除本地/社区复盘
        window.addEventListener('recon-local-delete', function (e) {
            var id = e.detail;
            allSolves = allSolves.filter(function (s) { return s.id !== id; });
            applyFilters();
        });
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
        const solvers = new Set();
        const methods = new Set();
        const events = new Set();

        allSolves.forEach(s => {
            if (s.solver) solvers.add(s.solver);
            if (s.method) methods.add(s.method);
            if (s.event) events.add(s.event);
        });

        // NOTE: 按出现频率排序选手（最多的在前）
        const solverCounts = {};
        const solverZhMap = {};
        allSolves.forEach(s => {
            if (s.solver) {
                solverCounts[s.solver] = (solverCounts[s.solver] || 0) + 1;
                if (s.solverZh) solverZhMap[s.solver] = s.solverZh;
            }
        });
        const sortedSolvers = [...solvers].sort((a, b) => (solverCounts[b] || 0) - (solverCounts[a] || 0));

        const isZh = localStorage.getItem('i18n_locale') === 'zh';

        sortedSolvers.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            const cnt = solverCounts[name] || 0;
            const zhName = solverZhMap[name] || name;

            opt.setAttribute('data-i18n-en', `${name} (${cnt})`);
            opt.setAttribute('data-i18n-zh', `${zhName} (${cnt})`);
            opt.textContent = isZh ? opt.getAttribute('data-i18n-zh') : opt.getAttribute('data-i18n-en');

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

        filteredSolves = allSolves.filter(s => {
            if (solver && s.solver !== solver) return false;
            if (method && s.method !== method) return false;
            if (event && s.event !== event) return false;
            if (query) {
                // NOTE: 搜索范围：选手名（中英文）、比赛名、成绩、打乱、OLL/PLL、纪录标记
                const haystack = [
                    s.solver, s.solverZh, s.comp, s.scramble,
                    s.oll, s.pll, s.country, s.note,
                    s.single != null ? s.single.toFixed(3) : ''
                ].filter(Boolean).join(' ').toLowerCase();
                // NOTE: 纪录字段用精确匹配（大小写不敏感），搜 WR 不应匹配 FWR
                const q = query.toUpperCase();
                const recordMatch = (s.rAvg && s.rAvg.toUpperCase() === q)
                    || (s.rSingle && s.rSingle.toUpperCase() === q);
                if (!haystack.includes(query) && !recordMatch) return false;
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
            'col-official': 'official',
            'col-event': 'event',
            'col-method': 'method',
            'col-date': 'date',
            'col-comp': 'comp',
            'col-round': 'round',
            'col-aoxr': 'aoType',
            'col-avg': 'avg',
            'col-single': 'single',
            'col-dsingle': 'displaySingle',
            'col-solver': 'solver',
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

    function createSolveRow(solve) {
        const tr = document.createElement('tr');
        tr.className = 'solve-row' + (solve._community ? ' community-row' : '');
        tr.dataset.id = solve.id;

        const officialHtml = solve.official ? '✅' : '';

        tr.innerHTML =
            '<td class="col-official">' + officialHtml + '</td>' +
            '<td class="col-event">' + escHtml(solve.event || '') + '</td>' +
            '<td class="col-method">' + escHtml(solve.method || '') + '</td>' +
            '<td class="col-date">' + escHtml(solve.date || '') + '</td>' +
            '<td class="col-comp">' + countryFlag(compCountries[solve.comp]) + ' ' + escHtml(solve.comp || '') + '</td>' +
            '<td class="col-round">' + escHtml(solve.round || '') + '</td>' +
            '<td class="col-solvenum">' + (solve.solveNum || '') + '</td>' +
            '<td class="col-aoxr">' + escHtml(solve.aoType || '') + '</td>' +
            '<td class="col-avg">' + formatAvg(solve.avg) + (solve.rAvg ? ' ' + formatRecord(solve.rAvg) : '') + '</td>' +
            '<td class="col-single mono">' + formatResult(solve.single) + '</td>' +
            '<td class="col-dsingle mono">' + escHtml(solve.displaySingle || '') + (solve.rSingle ? ' ' + formatRecord(solve.rSingle) : '') + '</td>' +
            '<td class="col-solver">' + countryFlag(solverCountry(solve)) + ' ' + displaySolverName(solve) + '</td>' +
            '<td class="col-stm mono">' + (solve.stm || '') + '</td>' +
            '<td class="col-tps mono">' + (solve.tps ? solve.tps.toFixed(2) : '') + '</td>';

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
        td.colSpan = 13;
        td.innerHTML = buildDetailHtml(solve);
        detailRow.appendChild(td);

        solveRow.after(detailRow);
        solveRow.classList.add('expanded');
        expandedId = solve.id;

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
        // NOTE: 清除复盘专用标记（卡顿/换手），twisty-player 无法解析
        alg = alg.replace(/[.·↑↓⅓⅔]/g, '');
        // NOTE: 规范化步骤间距——twisty-player 无法解析连写的步骤（如 UD, U'D', U2'R）
        // 支持修饰符组合: 2, ', 2'（如 R2', U2'）
        alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESxyz])/g, '$1 ');
        return alg;
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
        return lines.slice(startIdx)
            .filter(function (line) { return line.trim().length > 0; })
            .join('\n')
            // NOTE: alg.cubing.net 不支持 ·↑↓，但支持 .
            .replace(/[·↑↓⅓⅔]/g, '');
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
            var setup = solve.wcaScramble || solve.scramble || extractScrambleFromRecon(reconText);
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
        var scrambleForPlayer = s.wcaScramble || s.scramble || extractScrambleFromRecon(reconText);
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
            html += '</div>';
        }
        html += '</div>';

        // 右列：统计网格 + 打乱 + 元数据
        html += '<div>';

        // NOTE: 统计网格（从 recon 文本自动计算的统计值）
        html += buildStatsGrid(s, isZh);

        if (s.scramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="Optimal Scramble (scr*)" data-i18n-zh="最少步打乱 (scr*)">' + (isZh ? '最少步打乱 (scr*)' : 'Optimal Scramble (scr*)') + '</span></div>';
            html += '<div class="detail-scramble-text">' + escHtml(s.scramble) + '</div>';
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

        // NOTE: 本地复盘或当前用户的社区复盘显示删除按钮
        var canDelete = false;
        if (s._local) {
            canDelete = true;
        } else if (s._community && typeof WcaAuth !== 'undefined') {
            var currentUser = WcaAuth.getUser();
            if (currentUser && currentUser.wcaId === s.wcaId) canDelete = true;
        }
        if (canDelete) {
            html += '<div class="detail-local-actions">' +
                '<button class="recon-btn recon-btn-danger" onclick="window.dispatchEvent(new CustomEvent(\'recon-local-delete\',{detail:\'' + s.id + '\'}))">' +
                '🗑️ ' + (isZh ? '删除' : 'Delete') +
                '</button></div>';
        }

        html += '</div>'; // detail-content
        return html;
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
        return val.toFixed(3);
    }

    // NOTE: 平均成绩只需精确到百分位
    function formatAvg(val) {
        if (val == null) return '';
        if (val >= 9999) return 'DNF';
        return val.toFixed(2);
    }

    function formatTps(val) {
        if (val == null) return '';
        return val.toFixed(2);
    }

    // NOTE: 查找选手国旗 ISO2。WCA 数据库中中国选手名格式为 "Ruimin Yan (颜瑞民)"
    // CSV 中 solver="Ruimin Yan", solverZh="颜瑞民"，需要拼成 WCA 格式查找
    function solverCountry(solve) {
        if (solve.solverZh) {
            var wcaName = solve.solver + ' (' + solve.solverZh + ')';
            if (personCountries[wcaName]) return personCountries[wcaName];
        }
        if (personCountries[solve.solver]) return personCountries[solve.solver];

        // NOTE: fallback——社区复盘可能只存了中文名或英文名，
        // 在 personCountries 的 key 中模糊搜索
        var name = solve.solver || '';
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
        const cls = getRecordClass(val);
        return '<span class="record-badge record-' + cls + '">' + escHtml(val) + '</span>';
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
        // NOTE: 中文模式下优先显示中文名，附加双语切换 data-i18n 属性
        const isZh = localStorage.getItem('i18n_locale') === 'zh';
        const enName = s.solver || '';
        if (s.solverZh) {
            const zhName = s.solverZh;
            const text = isZh ? zhName : enName;
            return `<span data-i18n-en="${escHtml(enName)}" data-i18n-zh="${escHtml(zhName)}">${escHtml(text)}</span>`;
        }
        return escHtml(enName);
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
