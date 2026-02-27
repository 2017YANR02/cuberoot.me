/**
 * Recon 复盘页面前端逻辑
 * 功能：加载 JSON、表格渲染、筛选搜索、行展开、排序、分页
 */
(function () {
    'use strict';

    // --- 常量 ---
    const PAGE_SIZE = 50; // NOTE: 每次加载的行数
    const DATA_URL = '/recon/recon_data.json';

    // --- 状态 ---
    let allSolves = [];       // 全部数据
    let filteredSolves = [];  // 筛选后的数据
    let displayCount = 0;     // 当前已显示的行数
    let sortCol = 'date';     // 当前排序列
    let sortDir = 'desc';     // 排序方向
    let expandedId = null;    // 当前展开的行 ID

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

        // NOTE: 加载数据
        try {
            const resp = await fetch(DATA_URL);
            const data = await resp.json();
            allSolves = data.solves || [];
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#f87171">Failed to load data</td></tr>';
            console.error('Failed to load recon data:', e);
            return;
        }

        // NOTE: 构建筛选器选项
        buildFilterOptions();

        // NOTE: 绑定事件
        searchInput.addEventListener('input', debounce(applyFilters, 200));
        filterSolver.addEventListener('change', applyFilters);
        filterMethod.addEventListener('change', applyFilters);
        filterEvent.addEventListener('change', applyFilters);
        loadMoreBtn.addEventListener('click', loadMore);

        // NOTE: 表头排序
        document.querySelectorAll('#recon-table thead th').forEach(th => {
            th.addEventListener('click', () => handleSort(th));
        });

        // NOTE: 初始渲染
        applyFilters();
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
        allSolves.forEach(s => {
            if (s.solver) solverCounts[s.solver] = (solverCounts[s.solver] || 0) + 1;
        });
        const sortedSolvers = [...solvers].sort((a, b) => (solverCounts[b] || 0) - (solverCounts[a] || 0));

        sortedSolvers.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name + ' (' + (solverCounts[name] || 0) + ')';
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
                // NOTE: 搜索范围：选手名（中英文）、比赛名、打乱、OLL/PLL
                const haystack = [
                    s.solver, s.solverZh, s.comp, s.scramble,
                    s.oll, s.pll, s.country, s.note
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(query)) return false;
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
            'col-result': 'single',
            'col-solver': 'solver',
            'col-method': 'method',
            'col-comp': 'comp',
            'col-round': 'round',
            'col-date': 'date',
            'col-stm': 'stm',
            'col-tps': 'tps',
            'col-oll': 'oll',
            'col-pll': 'pll'
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
            sortDir = ['single', 'stm', 'tps'].includes(col) ? 'asc' : 'desc';
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
            loadMoreBtn.style.display = 'none';
            showingEl.textContent = isZh
                ? `共 ${filteredSolves.length} 条`
                : `${filteredSolves.length} total`;
        } else {
            loadMoreBtn.style.display = '';
            showingEl.textContent = isZh
                ? `已显示 ${displayCount} / ${filteredSolves.length}`
                : `Showing ${displayCount} of ${filteredSolves.length}`;
        }
    }

    function createSolveRow(solve) {
        const tr = document.createElement('tr');
        tr.className = 'solve-row';
        tr.dataset.id = solve.id;

        tr.innerHTML =
            '<td class="col-expand"><span class="expand-icon">▶</span></td>' +
            '<td class="col-result">' + formatResult(solve.single) + '</td>' +
            '<td class="col-solver">' + escHtml(displaySolverName(solve)) + '</td>' +
            '<td class="col-method">' + escHtml(solve.method || '') + '</td>' +
            '<td class="col-comp">' + escHtml(solve.comp || '') + '</td>' +
            '<td class="col-round">' + escHtml(formatRound(solve)) + '</td>' +
            '<td class="col-date">' + escHtml(solve.date || '') + '</td>' +
            '<td class="col-stm">' + (solve.stm || '') + '</td>' +
            '<td class="col-tps">' + formatTps(solve.tps) + '</td>' +
            '<td class="col-oll">' + escHtml(solve.oll || '') + '</td>' +
            '<td class="col-pll">' + escHtml(solve.pll || '') + '</td>';

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
        td.colSpan = 11;
        td.innerHTML = buildDetailHtml(solve);
        detailRow.appendChild(td);

        solveRow.after(detailRow);
        solveRow.classList.add('expanded');
        expandedId = solve.id;
    }

    function buildDetailHtml(s) {
        const isZh = localStorage.getItem('i18n_locale') === 'zh';

        let html = '<div class="detail-content">';

        // NOTE: 打乱 + 复盘两列布局
        html += '<div class="detail-grid">';

        // 左列：打乱
        html += '<div>';
        if (s.scramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label">' + (isZh ? '打乱' : 'Scramble') + '</div>';
            html += '<div class="detail-scramble-text">' + escHtml(s.scramble) + '</div>';
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
        if (s.note) {
            html += '<div class="detail-meta-item"><span class="detail-meta-label">📝</span><span class="detail-meta-value">' + escHtml(s.note) + '</span></div>';
        }
        html += '</div>';
        html += '</div>';

        // 右列：复盘步骤
        html += '<div>';
        if (s.recon) {
            html += '<div class="detail-recon">';
            html += '<div class="detail-recon-label">' + (isZh ? '复盘' : 'Reconstruction') + '</div>';
            html += '<div class="detail-recon-text">' + formatReconText(s.recon) + '</div>';
            html += '</div>';
        } else if (s.caption) {
            html += '<div class="detail-recon">';
            html += '<div class="detail-recon-label">' + (isZh ? '复盘' : 'Reconstruction') + '</div>';
            html += '<div class="detail-recon-text">' + formatReconText(s.caption) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        html += '</div>'; // detail-grid
        html += '</div>'; // detail-content
        return html;
    }

    // ==================== 格式化工具 ====================

    function formatResult(val) {
        if (val == null) return '';
        if (val >= 9999) return 'DNF';
        return val.toFixed(3);
    }

    function formatTps(val) {
        if (val == null) return '';
        return val.toFixed(2);
    }

    function formatRound(s) {
        let r = s.round || '';
        if (s.solveNum) r += (r ? ' #' : '#') + s.solveNum;
        return r;
    }

    function displaySolverName(s) {
        // NOTE: 中文模式下优先显示中文名
        const isZh = localStorage.getItem('i18n_locale') === 'zh';
        if (isZh && s.solverZh) return s.solverZh;
        return s.solver || '';
    }

    function formatReconText(text) {
        if (!text) return '';
        // NOTE: 高亮步骤注释（// 后的内容）
        return escHtml(text).replace(
            /\/\/(.*?)(?=\n|$)/g,
            '<span class="recon-comment">//$1</span>'
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
            statsEl.textContent = isZh ? `共 ${total} 条复盘` : `${total} reconstructions`;
        } else {
            statsEl.textContent = isZh
                ? `${shown} / ${total} 条匹配`
                : `${shown} of ${total} matching`;
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
