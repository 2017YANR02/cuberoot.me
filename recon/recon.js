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
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:#f87171">Failed to load data</td></tr>';
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
            'col-ravg': 'rAvg',
            'col-single': 'single',
            'col-rsingle': 'rSingle',
            'col-solver': 'solver'
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

        const officialHtml = solve.official ? '✅' : '';

        tr.innerHTML =
            '<td class="col-expand"><span class="expand-icon">▶</span></td>' +
            '<td class="col-official">' + officialHtml + '</td>' +
            '<td class="col-event">' + escHtml(solve.event || '') + '</td>' +
            '<td class="col-method">' + escHtml(solve.method || '') + '</td>' +
            '<td class="col-date">' + escHtml(solve.date || '') + '</td>' +
            '<td class="col-comp">' + countryFlag(compCountries[solve.comp]) + ' ' + escHtml(solve.comp || '') + '</td>' +
            '<td class="col-round">' + escHtml(formatRound(solve)) + '</td>' +
            '<td class="col-aoxr">' + escHtml(solve.aoType || '') + '</td>' +
            '<td class="col-avg mono">' + formatResult(solve.avg) + '</td>' +
            '<td class="col-ravg">' + formatRecord(solve.rAvg) + '</td>' +
            '<td class="col-single mono">' + formatResult(solve.single) + '</td>' +
            '<td class="col-rsingle">' + formatRecord(solve.rSingle) + '</td>' +
            '<td class="col-solver">' + countryFlag(solverCountry(solve)) + ' ' + displaySolverName(solve) + '</td>' +
            '<td class="col-recon-preview">' + escHtml(getReconPreview(solve)) + '</td>';

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
        td.colSpan = 14;
        td.innerHTML = buildDetailHtml(solve);
        detailRow.appendChild(td);

        solveRow.after(detailRow);
        solveRow.classList.add('expanded');
        expandedId = solve.id;
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
        html += '</div>';

        // 右列：打乱 + 元数据
        html += '<div>';
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

    // NOTE: 查找选手国旗 ISO2。WCA 数据库中中国选手名格式为 "Ruimin Yan (颜瑞民)"
    // CSV 中 solver="Ruimin Yan", solverZh="颜瑞民"，需要拼成 WCA 格式查找
    function solverCountry(solve) {
        if (solve.solverZh) {
            const wcaName = solve.solver + ' (' + solve.solverZh + ')';
            if (personCountries[wcaName]) return personCountries[wcaName];
        }
        return personCountries[solve.solver] || '';
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
        // 洲际纪录（黄色）：AsR/AsB, ER/EB, CR/CB, SAR, NAR, WCR 等
        if (/(?:AS|E|C)[RB]$/.test(v) || /^(?:SAR|NAR|WCR|FASR|XASR|UASR)$/.test(v)) return 'cr';
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
        const total = allSolves.length;
        const shown = filteredSolves.length;
        if (shown === total) {
            statsEl.innerHTML = `<span data-i18n-en="${total} reconstructions" data-i18n-zh="共 ${total} 条复盘"></span>`;
        } else {
            statsEl.innerHTML = `<span data-i18n-en="${shown} of ${total} matching" data-i18n-zh="${shown} / ${total} 条匹配"></span>`;
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
