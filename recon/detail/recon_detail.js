/**
 * Recon 详情页逻辑
 * 功能：从 URL 参数读取复盘 ID，调 API 加载单条数据，渲染详情视图
 * NOTE: 详情渲染函数从 recon.js 迁移而来，列表页不再行内展开
 */
(function () {
    'use strict';

    // --- 辅助数据（在 init 时加载） ---
    var compCountries = {};
    var personCountries = {};
    var compNamesZh = {};
    var compWcaIds = {};

    // --- 魔方面颜色映射（用于注释中的颜色字母着色） ---
    var FACE_COLORS = {
        W: '#e8e8e8',
        Y: '#facc15',
        R: '#ef4444',
        O: '#f97316',
        G: '#22c55e',
        B: '#3b82f6'
    };

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        // NOTE: 支持两种 URL 格式获取复盘 ID：
        //   1. /recon/detail/?id=2263（本地开发 / 直接链接）
        //   2. /recon/2263（Nginx rewrite 后浏览器地址栏保留的路径）
        var params = new URLSearchParams(location.search);
        var id = params.get('id');
        if (!id) {
            var pathMatch = location.pathname.match(/\/recon\/(\d+)$/);
            if (pathMatch) {
                id = pathMatch[1];
            }
        }
        if (!id) {
            location.href = '/recon/';
            return;
        }

        // NOTE: 不再做 replaceState URL 重写，保持 /recon/detail/?id=X 原样

        // NOTE: 初始化 WCA 登录 UI（详情页需要鉴权才能显示管理员按钮）
        updateWcaAuthUI();

        // NOTE: 并行加载辅助数据和复盘数据
        // 优先使用 recon 专用精简文件（~21KB），fallback 到全量文件（~9.6MB）
        var auxPromise = fetch('/recon/recon_aux_data.json').then(function (r) { return r.json(); })
            .then(function (aux) {
                return {
                    compCountries: aux.compCountries || {},
                    personCountries: aux.personCountries || {},
                    compNamesZh: aux.compNamesZh || {},
                    compWcaIds: aux.compWcaIds || {}
                };
            })
            .catch(function () {
                // NOTE: fallback 到全量文件
                return Promise.all([
                    fetch('/stats/comp_name_countries.json').then(function (r) { return r.json(); }).catch(function () { return {}; }),
                    fetch('/stats/person_name_countries.json').then(function (r) { return r.json(); }).catch(function () { return {}; }),
                    fetch('/recon/comp_names_zh.json').then(function (r) { return r.json(); }).catch(function () { return {}; }),
                    fetch('/stats/comp_name_to_wca_id.json').then(function (r) { return r.json(); }).catch(function () { return {}; })
                ]).then(function (results) {
                    return {
                        compCountries: results[0],
                        personCountries: results[1],
                        compNamesZh: results[2],
                        compWcaIds: results[3]
                    };
                });
            });

        Promise.all([
            auxPromise,
            // NOTE: 优先用 loadOne 单条查询；若后端尚未部署 get action 则 fallback 到 loadAll
            ReconStore.loadOne(id).catch(function () {
                return ReconStore.loadAll().then(function (all) {
                    var found = all.find(function (s) { return String(s.id) === String(id); });
                    if (!found) throw new Error('Not found');
                    return found;
                });
            })
        ]).then(function (results) {
            var aux = results[0];
            compCountries = aux.compCountries;
            personCountries = aux.personCountries;
            compNamesZh = aux.compNamesZh;
            compWcaIds = aux.compWcaIds;
            var solve = results[1];

            // NOTE: 计算统计（STM、TPS、OLL、PLL 等）
            if (typeof ReconStats !== 'undefined') {
                // NOTE: 优先用 solution 列（纯解法），fallback 到 recon（含统计+打乱的旧格式）
                var reconText = solve.solution || solve.caption || '';
                var stats = ReconStats.computeAllStats(reconText, solve.single);
                for (var key in stats) {
                    if (stats[key] !== null && stats[key] !== undefined && stats[key] !== '') {
                        solve[key] = stats[key];
                    }
                }
            }

            renderDetail(solve);
        }).catch(function (err) {
            var container = document.getElementById('detail-container');
            container.innerHTML = '<div style="text-align:center;padding:60px;color:#f87171">' +
                '<p><span data-i18n-en="Recon #' + id + ' not found" data-i18n-zh="未找到复盘 #' + id + '">' +
                (localStorage.getItem('i18n_locale') === 'zh' ? '未找到复盘 #' + id : 'Recon #' + id + ' not found') + '</span></p>' +
                '<a href="/recon/" style="color:#60a5fa">←</a>' +
                '</div>';
            console.error('Failed to load recon:', err);
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
            document.getElementById('wca-name').textContent = user.name || user.wcaId;
        } else {
            loginBtn.style.display = '';
            userInfo.style.display = 'none';
        }
    }

    // ==================== 渲染 ====================

    function renderDetail(solve) {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        var U = ReconUtils;

        // NOTE: 更新页面标题——包含 ID、成绩、项目、方法、国旗+选手名
        var titleEl = document.getElementById('detail-title');
        var solverDisplay = U.displaySolverName(solve.person);
        var titleParts = ['<span style="color:#888;font-size:0.7em">#' + solve.id + '</span>'];
        titleParts.push('<span class="mono">' + U.formatResult(solve.single) + '</span>');
        if (solve.regionalSingleRecord) titleParts.push(U.formatRecord(solve.regionalSingleRecord));
        if (solve.event) titleParts.push(U.escHtml(solve.event));
        if (solve.method) titleParts.push(U.escHtml(solve.method));
        var solverHtml = U.countryFlag(U.solverCountry(solve.person, personCountries)) + solverDisplay;
        // NOTE: 有 WCA ID 时选手名可点击跳转 WCA 个人页面
        var personUrl = U.personWcaUrl(solve.personId);
        if (personUrl) {
            solverHtml = '<a href="' + U.escHtml(personUrl) + '" target="_blank" rel="noopener noreferrer">' + solverHtml + '</a>';
        }
        titleParts.push(solverHtml);
        titleEl.innerHTML = titleParts.join(' ');

        // NOTE: 更新浏览器标签页标题
        var parsed = U.parseSolverName(solve.person || '');
        document.title = '#' + solve.id + ' ' + (isZh && parsed.zh ? parsed.zh : parsed.en) + ' - Recon';

        // NOTE: 渲染详情内容
        var container = document.getElementById('detail-container');
        container.innerHTML = buildDetailHtml(solve);

        // NOTE: 懒加载 twisty-player
        var twistyContainer = container.querySelector('.recon-twisty-container');
        if (twistyContainer && typeof window.ensureTwisty === 'function') {
            loadTwistyPlayer(twistyContainer, solve);
        }

        // NOTE: 绑定按钮事件
        bindButtonEvents(container, solve);
    }

    function bindButtonEvents(container, solve) {
        // NOTE: caption 复制按钮
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.caption-copy-btn');
            if (!btn) return;
            e.preventDefault();
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

        // NOTE: 分享链接复制按钮
        container.addEventListener('click', function (e) {
            var linkBtn = e.target.closest('.share-link-btn');
            if (!linkBtn) return;
            e.preventDefault();
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

        // NOTE: 管理员编辑按钮
        var editBtn = container.querySelector('.recon-btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', function () {
                location.href = '/recon/submit/?id=' + solve.id;
            });
        }

        // NOTE: 管理员恢复按钮
        var restoreBtn = container.querySelector('.recon-btn-restore');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', function () {
                var isZh = localStorage.getItem('i18n_locale') === 'zh';
                if (!confirm(isZh ? '确定恢复为原始数据？' : 'Restore original data?')) return;
                ReconStore.deleteEdit(solve.id).then(function () {
                    location.reload();
                }).catch(function (err) {
                    console.error('Failed to restore:', err);
                    alert('Restore failed: ' + err.message);
                });
            });
        }

        // NOTE: 管理员历史按钮
        var historyBtn = container.querySelector('.recon-btn-history');
        if (historyBtn) {
            historyBtn.addEventListener('click', function () {
                showEditHistory(solve.id);
            });
        }

        // NOTE: 删除按钮（本人或管理员）
        var deleteBtn = container.querySelector('.recon-btn-danger');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () {
                var isZh = localStorage.getItem('i18n_locale') === 'zh';
                if (!confirm(isZh ? '确定删除 #' + solve.id + ' 吗？' : 'Delete #' + solve.id + '?')) return;
                ReconStore.deleteRecon(solve.id).then(function () {
                    location.href = '/recon/';
                }).catch(function (err) {
                    alert('Delete failed: ' + err.message);
                });
            });
        }
    }

    function showEditHistory(solveId) {
        ReconStore.getEditHistory(solveId).then(function (history) {
            var isZh = localStorage.getItem('i18n_locale') === 'zh';
            if (history.length === 0) {
                alert(isZh ? '暂无编辑历史' : 'No edit history');
                return;
            }
            var msg = (isZh ? '编辑历史 (#' : 'Edit History (#') + solveId + ')\n\n';
            history.forEach(function (h) {
                var time = h.editedAt ? new Date(h.editedAt * 1000).toLocaleString() : '?';
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

    // ==================== 详情 HTML 构建（从 recon.js 迁移） ====================

    function buildDetailHtml(s) {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        var U = ReconUtils;

        var html = '<div class="detail-content">';

        // NOTE: 摘要第一行——比赛信息（日期后无逗号，其他用逗号分隔）
        var line1 = U.escHtml(s.date || '');
        var line1Rest = [];
        if (s.comp) {
            // NOTE: 国旗直接用数据库 country（已统一为 ISO2）
            var compDisplay = U.countryFlag(s.country) + ' ' + U.displayCompName(s.comp, compNamesZh);
            // NOTE: 优先用数据库的 compWcaId，fallback 到映射表
            var wcaUrl = s.compWcaId
                ? 'https://www.worldcubeassociation.org/competitions/' + s.compWcaId
                : U.compWcaUrl(s.comp, compWcaIds);
            // NOTE: 有 WCA 链接时渲染为 <a> 标签，否则纯文本
            if (wcaUrl) {
                compDisplay = '<a href="' + U.escHtml(wcaUrl) + '" target="_blank" rel="noopener noreferrer" class="comp-link">' + compDisplay + '</a>';
            }
            line1Rest.push(compDisplay);
        }
        if (s.round) {
            var roundText = U.escHtml(s.round) + (s.solveNum ? '#' + s.solveNum : '');
            // NOTE: 有组号时追加 Grp A 格式展示
            if (s.groupId) roundText += ', Grp ' + U.escHtml(s.groupId);
            line1Rest.push(roundText);
        }
        if (line1Rest.length > 0) line1 += ' ' + line1Rest.join(', ');
        html += '<div class="detail-summary">' + line1 + '</div>';

        // NOTE: 摘要第二行——纪录信息（无内容则不渲染）
        var line2Parts = [];
        if (s.average != null) {
            var avgText = U.formatAvg(s.average) + ' <span data-i18n-en="Avg" data-i18n-zh="平均">' + (isZh ? '平均' : 'Avg') + '</span>';
            if (s.regionalAverageRecord) avgText += ' ' + U.formatRecord(s.regionalAverageRecord);
            line2Parts.push(avgText);
        }
        if (s.aoType) {
            var aoText = U.escHtml(s.aoType);
            if (s.regionalAoxrRecord) aoText += ' ' + U.formatRecord(s.regionalAoxrRecord);
            line2Parts.push(aoText);
        }
        if (line2Parts.length > 0) {
            html += '<div class="detail-summary">' + line2Parts.join(', ') + '</div>';
        }

        // NOTE: 复盘 + 统计两列布局
        html += '<div class="detail-grid">';

        // 左列：预览动画 → 打乱 → 解法 → 外部链接
        html += '<div>';
        // NOTE: 优先用 solution 列（纯解法），fallback 到 recon
        var solutionText = s.solution || s.caption || '';
        // NOTE: 有打乱时插入 twisty-player 占位符
        var scrambleForPlayer = s.optimalScramble || s.wcaScramble || '';
        // NOTE: alg 提取优先用 solution（纯解法，无需跳过统计/打乱行）
        var algSourceText = solutionText;
        if (scrambleForPlayer && solutionText) {
            html += '<div class="recon-twisty-container"></div>';
            var setupStr = encodeURIComponent(scrambleForPlayer);
            var algStr = encodeURIComponent(extractAlgWithComments(algSourceText));
            var puzzleStr = (s.event && s.event.indexOf('2') >= 0) ? '2x2x2' : '3x3x3';
            var algUrl = 'https://alg.cubing.net/?setup=' + setupStr + '&alg=' + algStr + '&puzzle=' + puzzleStr;
            var cubedbUrl = 'https://cubedb.net/?puzzle=' + (puzzleStr === '2x2x2' ? '2x2' : '3x3') + '&scramble=' + setupStr + '&alg=' + algStr;
            html += '<div class="recon-external-links">';
            html += '<a href="' + algUrl + '" target="_blank" rel="noopener noreferrer">alg.cubing.net</a>';
            html += ' <a href="' + cubedbUrl + '" target="_blank" rel="noopener noreferrer">cubedb.net</a>';
            var captionText = generateCaption(algSourceText, s);
            if (captionText) {
                html += ' <a href="#" class="caption-copy-btn" data-caption="' + U.escHtml(captionText).replace(/"/g, '&quot;') + '"' +
                    ' data-i18n-en="caption" data-i18n-zh="字幕">caption</a>';
            }
            // NOTE: 分享链接
            var shareUrl = location.origin + '/recon/detail/?id=' + s.id;
            html += ' <a href="#" class="share-link-btn" data-url="' + shareUrl + '"' +
                ' data-i18n-en="link" data-i18n-zh="链接">link</a>';
            html += '</div>';
        }
        // NOTE: 打乱展示
        if (s.optimalScramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="Optimal Scramble" data-i18n-zh="最少步打乱">' + (isZh ? '最少步打乱' : 'Optimal Scramble') + '</span></div>';
            html += '<div class="detail-scramble-text">' + U.escHtml(s.optimalScramble) + '</div>';
            html += '</div>';
        }
        if (s.wcaScramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="WCA Scramble" data-i18n-zh="WCA 打乱">' + (isZh ? 'WCA 打乱' : 'WCA Scramble') + '</span></div>';
            html += '<div class="detail-scramble-text">' + U.escHtml(s.wcaScramble) + '</div>';
            html += '</div>';
        }
        // NOTE: 解法区块
        if (solutionText) {
            html += '<div class="detail-recon">';
            html += '<div class="detail-recon-label"><span data-i18n-en="Solution" data-i18n-zh="解法">' + (isZh ? '解法' : 'Solution') + '</span></div>';
            html += '<div class="detail-recon-text">' + formatReconText(solutionText) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        // 右列：统计网格 + 元数据
        html += '<div>';
        html += buildStatsGrid(s, isZh);

        // 元数据
        html += '<div class="detail-meta">';
        if (s.cube) {
            html += '<div class="detail-meta-item"><span class="detail-meta-label">🧊</span><span class="detail-meta-value">' + U.escHtml(s.cube) + '</span></div>';
        }
        if (s.reconer) {
            // NOTE: 有 reconerId 时渲染为 WCA 个人主页链接（与 addedBy 模式一致）
            var reconerDisplay = U.displaySolverName(s.reconer);
            var reconerHtml = s.reconerId
                ? '<a href="https://www.worldcubeassociation.org/persons/' + U.escHtml(s.reconerId) + '" target="_blank">' + reconerDisplay + '</a>'
                : reconerDisplay;
            html += '<div class="detail-meta-item"><span class="detail-meta-label">✍️</span><span class="detail-meta-value">' + reconerHtml + '</span></div>';
        }
        if (s.reconDate) {
            html += '<div class="detail-meta-item"><span class="detail-meta-label">📅</span><span class="detail-meta-value">' + U.escHtml(s.reconDate) + '</span></div>';
        }
        if (s.addedBy) {
            var addedByDisplay = U.displaySolverName(s.addedBy);
            var addedByHtml = s.addedById
                ? '<a href="https://www.worldcubeassociation.org/persons/' + U.escHtml(s.addedById) + '" target="_blank">' + addedByDisplay + '</a>'
                : addedByDisplay;
            html += '<div class="detail-meta-item"><span class="detail-meta-label">➕</span><span class="detail-meta-value">' + addedByHtml + '</span></div>';
        }
        html += '</div>';

        if (s.note) {
            html += '<div class="detail-note">';
            html += '<div class="detail-scramble-label">📝 <span data-i18n-en="Note" data-i18n-zh="备注">' + (isZh ? '备注' : 'Note') + '</span></div>';
            html += '<div class="detail-recon-text">' + U.escHtml(s.note) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        html += '</div>'; // detail-grid

        // NOTE: 权限判断——添加者可编辑/删除自己提交的复盘，管理员可操作所有复盘
        var isAdminUser = typeof WcaAuth !== 'undefined' && WcaAuth.isAdmin();
        var isOwner = false;
        if (s.addedById && typeof WcaAuth !== 'undefined') {
            var currentUser = WcaAuth.getUser();
            if (currentUser && currentUser.wcaId === s.addedById) isOwner = true;
        }

        if (isAdminUser || isOwner) {
            html += '<div class="detail-admin-actions">';
            // NOTE: 本人和管理员都能编辑
            html += '<button class="recon-btn recon-btn-edit" data-solve-id="' + s.id + '">' +
                '<span data-i18n-en="Edit" data-i18n-zh="编辑">' + (isZh ? '编辑' : 'Edit') + '</span></button>';
            // NOTE: Restore / History 仅管理员可见（这些是覆盖层管理功能）
            if (isAdminUser) {
                if (s._edited) {
                    html += '<button class="recon-btn recon-btn-restore" data-solve-id="' + s.id + '">' +
                        '<span data-i18n-en="Restore" data-i18n-zh="恢复">' + (isZh ? '恢复' : 'Restore') + '</span></button>';
                }
                html += '<button class="recon-btn recon-btn-history" data-solve-id="' + s.id + '">' +
                    '<span data-i18n-en="History" data-i18n-zh="历史">' + (isZh ? '历史' : 'History') + '</span></button>';
            }
            // NOTE: 本人和管理员都能删除
            html += '<button class="recon-btn recon-btn-danger">' +
                '<span data-i18n-en="Delete" data-i18n-zh="删除">' + (isZh ? '删除' : 'Delete') + '</span></button>';
            html += '</div>';
        }

        html += '</div>'; // detail-content
        return html;
    }

    // ==================== 统计网格 ====================

    function buildStatsGrid(s, isZh) {
        var U = ReconUtils;
        var CROSS_LABELS = { 0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross' };

        var items = [
            ['stm', 'STM', 'STM'],
            ['tps', 'TPS', 'TPS'],
            ['crossStm', 'Cross', 'Cross'],
            ['f2l', 'F2L', 'F2L'],
            ['ll', 'LL', '顶层'],
            ['crossType', '?x', '?x', function (v) { return CROSS_LABELS[v] || v; }],
            ['freePair', 'Free Pair', '基态'],
            ['yRot', 'y rot', 'y 转体'],
            ['regrip', 'Regrip', '换手'],
            ['lockup', 'Lockup', '卡顿'],
            ['sMove', 'S move', 'S转动'],
            ['crossColor', 'Color', '底色', function (v) {
                var color = FACE_COLORS[v];
                if (color) return '<span style="color:' + color + ';font-weight:600">' + v + '</span>';
                return v;
            }],
            ['ollShort', 'OLL', 'OLL'],
            ['pllShort', 'PLL', 'PLL'],
        ];

        var visibleItems = [];
        for (var i = 0; i < items.length; i++) {
            var val = s[items[i][0]];
            if (val !== undefined && val !== null && val !== '') {
                visibleItems.push(items[i]);
            }
        }
        if (visibleItems.length === 0) return '';

        var html = '<div class="detail-stats">';
        html += '<div class="detail-stats-label">📊 <span data-i18n-en="Stats" data-i18n-zh="统计">' + (isZh ? '统计' : 'Stats') + '</span></div>';
        html += '<div class="detail-stats-grid">';
        for (var j = 0; j < visibleItems.length; j++) {
            var item = visibleItems[j];
            var enLabel = item[1];
            var zhLabel = item[2];
            var label = isZh ? zhLabel : enLabel;
            var val = s[item[0]];
            var fmt = item[3];
            var displayVal = fmt ? fmt(val) : U.escHtml(String(val));
            // NOTE: 标签相同时无需 data-i18n 属性（如 STM、TPS、OLL、PLL）
            var labelHtml = (enLabel === zhLabel)
                ? U.escHtml(label)
                : '<span data-i18n-en="' + U.escHtml(enLabel) + '" data-i18n-zh="' + U.escHtml(zhLabel) + '">' + U.escHtml(label) + '</span>';
            html += '<div class="stat-item">' +
                '<span class="stat-label">' + labelHtml + '</span>' +
                '<span class="stat-value">' + displayVal + '</span>' +
                '</div>';
        }
        html += '</div></div>';
        return html;
    }

    // ==================== 文本格式化（从 recon.js 迁移） ====================

    function formatReconText(text) {
        if (!text) return '';
        return ReconUtils.escHtml(text).replace(
            /\/\/(.*?)(?=\n|$)/g,
            function (match, content) {
                return '<span class="recon-comment">//' + colorizeComment(content) + '</span>';
            }
        );
    }

    /**
     * NOTE: 对注释文本中的魔方面颜色字母着色。
     * 只处理「独立的颜色字母」，避免误匹配算法名中的字母。
     */
    function colorizeComment(commentHtml) {
        return commentHtml.replace(/[A-Za-z0-9+\-()*.]+/g, function (word) {
            var cleanWord = word.replace(/^[+\-()*.]+/, '').replace(/[+\-()*.]+$/, '');
            if (!cleanWord) return word;
            var baseName = cleanWord.replace(/[-+()0-9.*].*$/, '');
            if (/^(?:OLL|PLL|ZBLL|ZBLS|EPLL|OCLL|COLL|CMLL|EG|VLS|VH|WV|CLL|CSP|OBL|CP|EP|EO|EOLRb|DR|insp|cross|xcross|pscross|psxcross|xxxcross|xxcross|layer|face|cancel|into|auto|Skip|Fail|STM|SPS|TPS|better|NR|pair|pairs|free|predicted|counting|full|move|edge|Reconstruction|PBL|OLLCP|1LLL)$/i.test(baseName)) {
                return word;
            }
            if (word.includes('+')) {
                return word.split('+').map(function (part) { return colorizePart(part); }).join('+');
            }
            return colorizePart(word);
        });
    }

    function colorizePart(word) {
        var prefixMatch = word.match(/^[+\-()*.]+/);
        var suffixMatch = word.match(/[+\-()*.]+$/);
        var prefix = prefixMatch ? prefixMatch[0] : '';
        var suffix = suffixMatch ? suffixMatch[0] : '';
        var inner = word.substring(prefix.length, word.length - suffix.length);
        if (!inner) return word;
        if (/^[WYROGB]+$/.test(inner)) {
            inner = inner.split('').map(function (ch) {
                return '<span style="color:' + FACE_COLORS[ch] + ';font-weight:600">' + ch + '</span>';
            }).join('');
            return prefix + inner + suffix;
        }
        var m = inner.match(/^([WYROGB]+)([ec])$/);
        if (m) {
            inner = m[1].split('').map(function (ch) {
                return '<span style="color:' + FACE_COLORS[ch] + ';font-weight:600">' + ch + '</span>';
            }).join('') + m[2];
            return prefix + inner + suffix;
        }
        return word;
    }

    // ==================== 公式提取（从 recon.js 迁移） ====================

    /** 提取纯解法（去除统计行、打乱行、// 注释） */
    function extractAlgFromRecon(text) {
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

    /** 从复盘文本第2行提取打乱公式 */
    function extractScrambleFromRecon(text) {
        if (!text) return '';
        var lines = text.split('\n');
        if (lines.length > 1 && /^\d+STM\s/i.test(lines[0])) {
            return lines[1].trim();
        }
        return '';
    }

    /**
 * 从 solution 文本动态生成 caption
 * 去掉 insp 行，去掉 // 后的注释，末尾附加实时计算的统计行
 */
    function generateCaption(text, solve) {
        if (!text) return '';
        var lines = text.split('\n');
        var result = lines
            .filter(function (line) {
                // NOTE: 过滤 insp 行和空行
                return line.trim().length > 0 && !/\binsp\b/i.test(line);
            })
            .map(function (line) {
                // NOTE: 去掉 // 后的注释，保留解法部分
                var pos = line.indexOf('//');
                return pos >= 0 ? line.substring(0, pos).trimEnd() : line;
            })
            .filter(function (line) { return line.trim().length > 0; });
        // NOTE: 用 ReconStats 实时计算 STM/TPS 统计行
        if (solve && solve.single && typeof ReconStats !== 'undefined') {
            var stats = ReconStats.computeAllStats(text, solve.single);
            if (stats.stm) {
                var flooredSingle = Math.floor(solve.single * 100) / 100;
                result.push(stats.stm + 'STM /' + flooredSingle.toFixed(2) + '=' + (stats.tps || 0) + 'TPS');
            }
        }
        return result.join('\n');
    }

    // ==================== 魔方动画 ====================

    function loadTwistyPlayer(container, solve) {
        container.innerHTML = '<div style="color:#888;font-size:0.8em">加载中...</div>';
        window.ensureTwisty().then(function () {
            var Ctor = window.__TwistyPlayerCtor;
            if (!Ctor) { container.innerHTML = ''; return; }
            // NOTE: 优先用 solution 列（纯解法）
            var reconText = solve.solution || solve.caption || '';
            var setup = solve.optimalScramble || solve.wcaScramble || extractScrambleFromRecon(reconText);
            var alg = extractAlgFromRecon(reconText);
            var puzzle = '3x3x3';
            if (solve.event && solve.event.indexOf('2') >= 0) puzzle = '2x2x2';
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

})();
