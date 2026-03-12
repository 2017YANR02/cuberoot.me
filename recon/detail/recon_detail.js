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
                // NOTE: 盲拧项目用 execTime 算 TPS（手速 = 步数 / 执行时间）
                var BLD_EVENTS = ['3BLD', '4BLD', '5BLD', 'MBLD'];
                var tpsTime = (solve.execTime && BLD_EVENTS.indexOf(solve.event) >= 0)
                    ? solve.execTime
                    : solve.rawTime;
                var stats = ReconStats.computeAllStats(reconText, tpsTime);
                for (var key in stats) {
                    if (stats[key] !== null && stats[key] !== undefined && stats[key] !== '') {
                        solve[key] = stats[key];
                    }
                }
            }

            renderDetail(solve);

            // NOTE: 异步加载同轮次成绩，不阻塞主渲染
            renderSiblingsSolves(solve);
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
        titleParts.push('<span class="mono">' + U.formatResult(solve.rawTime) + '</span>');
        if (solve.regionalSingleRecord) titleParts.push(U.formatRecord(solve.regionalSingleRecord));
        if (solve.event) titleParts.push(U.escHtml(solve.event));
        if (solve.method) titleParts.push(U.escHtml(solve.method));
        // NOTE: 选手国旗——优先用 solve 自带的 personCountry，fallback 到静态映射
        var pCountry = solve.personCountry || U.solverCountry(solve.person, personCountries);
        var solverHtml = U.countryFlag(pCountry) + solverDisplay;
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

        // NOTE: 异步加载 Bilibili 封面图（不阻塞页面渲染）
        loadBiliCovers(container);

        // NOTE: 懒加载 twisty-player
        var twistyContainer = container.querySelector('.recon-twisty-container');
        if (twistyContainer && typeof window.ensureTwisty === 'function') {
            loadTwistyPlayer(twistyContainer, solve);
        }

        // NOTE: 绑定解法文本的 click/keydown 事件实现光标跟随
        var reconTextEl = container.querySelector('.detail-recon-text');
        if (reconTextEl) {
            reconTextEl.style.cursor = 'text';
            reconTextEl.setAttribute('tabindex', '0');
            reconTextEl.style.outline = 'none'; // NOTE: 去掉聚焦框
            reconTextEl.addEventListener('click', function () {
                var offset = getTextOffsetInElement(reconTextEl);
                if (offset >= 0) {
                    var fullText = (reconTextEl.textContent || '').replace(/\u200B/g, '');
                    var result = ReconAlgUtils.findTokenPositions(fullText);
                    offset = ReconAlgUtils.snapToTokenBoundary(offset, result.tokens);
                    detailCursorOffset = offset;
                    syncDetailAtOffset(reconTextEl, offset);
                }
            });
            reconTextEl.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' &&
                    e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                if (!currentDetailPlayer) return;
                var fullText = reconTextEl.textContent || '';
                // NOTE: 去掉可视光标的零宽空格
                fullText = fullText.replace(/\u200B/g, '');
                var result = ReconAlgUtils.findTokenPositions(fullText);
                var tokens = result.tokens;
                if (tokens.length === 0) return;

                var newPos = detailCursorOffset;
                if (e.key === 'ArrowRight') {
                    for (var i = 0; i < tokens.length; i++) {
                        if (tokens[i].start >= detailCursorOffset) {
                            newPos = tokens[i].end;
                            break;
                        }
                    }
                } else if (e.key === 'ArrowLeft') {
                    for (var j = tokens.length - 1; j >= 0; j--) {
                        if (tokens[j].end < detailCursorOffset) {
                            newPos = tokens[j].end;
                            break;
                        }
                    }
                } else {
                    // NOTE: ArrowUp/ArrowDown — 找当前光标所在行，跳到上/下一行的 token
                    var lines = fullText.split('\n');
                    var lineStarts = []; // 每行在全文中的起始偏移
                    var offset = 0;
                    for (var k = 0; k < lines.length; k++) {
                        lineStarts.push(offset);
                        offset += lines[k].length + 1;
                    }
                    // NOTE: 找当前光标所在行号
                    var curLine = 0;
                    for (var l = lineStarts.length - 1; l >= 0; l--) {
                        if (detailCursorOffset >= lineStarts[l]) {
                            curLine = l;
                            break;
                        }
                    }
                    var targetLine = e.key === 'ArrowDown' ? curLine + 1 : curLine - 1;
                    if (targetLine < 0 || targetLine >= lines.length) return;

                    // NOTE: 找目标行的 token
                    var targetStart = lineStarts[targetLine];
                    var targetEnd = targetStart + lines[targetLine].length;
                    if (e.key === 'ArrowDown') {
                        // 跳到目标行第一个 token 末尾
                        for (var m = 0; m < tokens.length; m++) {
                            if (tokens[m].start >= targetStart && tokens[m].end <= targetEnd) {
                                newPos = tokens[m].end;
                                break;
                            }
                        }
                    } else {
                        // ArrowUp: 跳到目标行最后一个 token 末尾
                        for (var n = tokens.length - 1; n >= 0; n--) {
                            if (tokens[n].start >= targetStart && tokens[n].end <= targetEnd) {
                                newPos = tokens[n].end;
                                break;
                            }
                        }
                    }
                }
                if (newPos === detailCursorOffset) return;
                e.preventDefault();
                detailCursorOffset = newPos;
                syncDetailAtOffset(reconTextEl, newPos);
            });
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

        // NOTE: YouTube facade 点击——缩略图替换为 iframe 并自动播放
        container.addEventListener('click', function (e) {
            var facade = e.target.closest('.detail-video-facade');
            if (!facade) return;
            var embedUrl = facade.getAttribute('data-embed-url');
            if (!embedUrl) return;
            facade.innerHTML = '<iframe src="' + embedUrl + '" allowfullscreen allow="autoplay; encrypted-media"></iframe>';
            facade.classList.remove('detail-video-facade');
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
            // NOTE: 有组号时追加 Grp A（英）/ A组（中）格式展示
            if (s.groupId) roundText += ', ' + (isZh
                ? U.escHtml(s.groupId) + '<span data-i18n-en="Group" data-i18n-zh="组">组</span>'
                : 'Grp ' + U.escHtml(s.groupId));
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
            var puzzleStr = ReconUtils.eventToPuzzle(s.event);
            // NOTE: alg.cubing.net 只支持 NxNxN 正阶魔方，非正阶用 alpha.twizzle.net
            var isCube = /^\d+x\d+x\d+$/.test(puzzleStr);
            var algUrl, algSiteName;
            if (isCube) {
                algUrl = 'https://alg.cubing.net/?setup=' + setupStr + '&alg=' + algStr + '&puzzle=' + puzzleStr;
                algSiteName = 'alg.cubing.net';
            } else {
                algUrl = 'https://alpha.twizzle.net/edit/?puzzle=' + puzzleStr + '&setup-alg=' + setupStr + '&alg=' + algStr;
                algSiteName = 'twizzle.net';
            }
            // NOTE: cubedb 用独立映射（格式不同于 twisty）
            var cubedbPuzzle = ReconUtils.eventToCubedbPuzzle(s.event);
            var cubedbUrl = 'https://cubedb.net/?puzzle=' + cubedbPuzzle + '&scramble=' + setupStr + '&alg=' + algStr;
            html += '<div class="recon-external-links">';
            html += '<a href="' + algUrl + '" target="_blank" rel="noopener noreferrer">' + algSiteName + '</a>';
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
        // NOTE: 当两种打乱都有时，顺序调整为：最少步打乱 → 解法 → 仅外层 → WCA打乱
        var hasBothScrambles = s.optimalScramble && s.wcaScramble;

        // NOTE: 最少步打乱（始终在前）
        if (s.optimalScramble) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="Optimal Scramble" data-i18n-zh="最少步打乱">' + (isZh ? '最少步打乱' : 'Optimal Scramble') + '</span></div>';
            html += '<div class="detail-scramble-text">' + U.escHtml(s.optimalScramble) + '</div>';
            html += '</div>';
        }
        // NOTE: 只有一种打乱时，WCA 打乱紧跟在最少步后面
        if (s.wcaScramble && !hasBothScrambles) {
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
        // NOTE: 仅三阶/三阶单手，且有双层转动时显示标准化 cross
        if (typeof ReconNormCross !== 'undefined' &&
            (s.event === '3x3' || s.event === 'OH') && solutionText) {
            var normResult = ReconNormCross.normalize(solutionText);
            if (normResult && normResult.hasWideMoves) {
                html += '<div class="detail-recon">';
                html += '<div class="detail-recon-label">🔄 <span data-i18n-en="Outer-layer-only Opening" data-i18n-zh="仅外层转动的开头">' + (isZh ? '仅外层转动的开头' : 'Outer-layer-only Opening') + '</span></div>';
                html += '<div class="detail-recon-text">' + formatReconText(normResult.result) + '</div>';
                html += '</div>';
            }
        }
        // NOTE: 两种打乱都有时，WCA 打乱放在解法和仅外层之后
        if (s.wcaScramble && hasBothScrambles) {
            html += '<div class="detail-scramble">';
            html += '<div class="detail-scramble-label"><span data-i18n-en="WCA Scramble" data-i18n-zh="WCA 打乱">' + (isZh ? 'WCA 打乱' : 'WCA Scramble') + '</span></div>';
            html += '<div class="detail-scramble-text">' + U.escHtml(s.wcaScramble) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        // 右列：视频 → 统计网格 + 元数据
        html += '<div>';
        // NOTE: 有视频链接时嵌入播放器（YouTube / Bilibili）
        if (s.videoUrl) {
            html += buildVideoEmbeds(s.videoUrl);
        }
        html += buildStatsGrid(s, isZh);

        // NOTE: 同轮次成绩容器（JS 异步填充，位于统计栏下方）
        html += '<div id="siblings-container"></div>';

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
            // NOTE: 盲拧专用——非盲拧项目 execTime/memoTime 为 null，不会显示
            ['execTime', 'Exec Time', '执行时间', function (v) { return parseFloat(v).toFixed(2); }],
            ['memoTime', 'Memo Time', '记忆时间', function (v) { return parseFloat(v).toFixed(2); }],
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

    // ==================== 视频嵌入 ====================

    /**
     * 从 video_url 字段（换行分隔的多 URL）构建视频 HTML
     * NOTE: YouTube / Bilibili 均使用 facade 模式（缩略图 + 播放按钮，点击加载 iframe）
     *       YouTube 缩略图直接用 img.youtube.com，Bilibili 异步通过 PHP 代理获取
     */
    function buildVideoEmbeds(videoUrlField) {
        var urls = videoUrlField.split('\n').map(function (u) { return u.trim(); }).filter(Boolean);
        if (urls.length === 0) return '';

        var html = '<div class="detail-video">';
        for (var i = 0; i < urls.length; i++) {
            var info = parseVideoUrl(urls[i]);
            if (!info) continue;

            if (info.type === 'youtube') {
                // NOTE: YouTube facade——静态缩略图即时可用
                html += '<div class="detail-video-wrap detail-video-facade" data-embed-url="' + ReconUtils.escHtml(info.embedUrl) + '&autoplay=1">';
                html += '<img src="https://img.youtube.com/vi/' + info.id + '/hqdefault.jpg" alt="YouTube" loading="lazy">';
                html += '<div class="detail-video-play"></div>';
                html += '</div>';
            } else {
                // NOTE: Bilibili facade——先渲染占位（灰色背景+播放按钮），异步加载封面图
                html += '<div class="detail-video-wrap detail-video-facade" data-embed-url="' + ReconUtils.escHtml(info.embedUrl) + '" data-bvid="' + info.id + '">';
                html += '<img class="detail-video-play-bili" src="/recon/assets/bilibili_logo.png" alt="Bilibili">';
                html += '</div>';
            }
        }
        html += '</div>';
        return html;
    }

    /**
     * 异步加载 Bilibili 封面图——渲染完成后调用
     * NOTE: 通过 PHP 代理调 Bilibili API（前端跨域不可达），带 7 天服务端缓存
     */
    function loadBiliCovers(container) {
        var facades = container.querySelectorAll('.detail-video-facade[data-bvid]');
        var API = 'https://toolkit.cuberoot.me/recon/api/';
        facades.forEach(function (el) {
            var bvid = el.getAttribute('data-bvid');
            fetch(API + '?action=biliCover&bvid=' + bvid)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.pic) {
                        var img = document.createElement('img');
                        img.src = data.pic;
                        img.alt = 'Bilibili';
                        img.loading = 'lazy';
                        // NOTE: Bilibili CDN 拒绝跨域 referer，不发送即可绕过 ORB 拦截
                        img.referrerPolicy = 'no-referrer';
                        // NOTE: 插入到播放按钮之前，确保按钮在图片上方
                        el.insertBefore(img, el.firstChild);
                    }
                })
                .catch(function () {
                    // NOTE: 封面获取失败时保留灰色占位，不影响点击播放功能
                });
        });
    }

    /**
     * 将用户输入的视频 URL 解析为 {type, id, embedUrl} 或 null
     * 支持格式：
     *   YouTube: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
     *   Bilibili: bilibili.com/video/BVID
     */
    function parseVideoUrl(url) {
        var m;
        // NOTE: YouTube 短链接 youtu.be/ID
        m = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
        if (m) return { type: 'youtube', id: m[1], embedUrl: 'https://www.youtube.com/embed/' + m[1] };

        // NOTE: YouTube 标准链接 youtube.com/watch?v=ID
        m = url.match(/youtube\.com\/watch\?.*v=([A-Za-z0-9_-]+)/);
        if (m) return { type: 'youtube', id: m[1], embedUrl: 'https://www.youtube.com/embed/' + m[1] };

        // NOTE: YouTube embed 链接
        m = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/);
        if (m) return { type: 'youtube', id: m[1], embedUrl: 'https://www.youtube.com/embed/' + m[1] };

        // NOTE: Bilibili 链接 bilibili.com/video/BVxxx
        m = url.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/);
        if (m) return { type: 'bilibili', id: m[1], embedUrl: 'https://player.bilibili.com/player.html?bvid=' + m[1] + '&autoplay=0' };

        return null;
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
        if (solve && solve.rawTime && typeof ReconStats !== 'undefined') {
            var stats = ReconStats.computeAllStats(text, solve.rawTime);
            if (stats.stm) {
                var flooredSingle = Math.floor(solve.rawTime * 100) / 100;
                result.push(stats.stm + 'STM /' + flooredSingle.toFixed(2) + '=' + (stats.tps || 0) + 'TPS');
            }
        }
        return result.join('\n');
    }

    // ==================== 魔方动画 ====================

    // NOTE: 详情页光标跟随所需的闭包变量
    var currentDetailPlayer = null;
    var detailScramble = '';
    var detailSolutionText = '';
    var detailFullAlg = ''; // NOTE: 完整清理后的公式，用于 timestamp 计算

    function loadTwistyPlayer(container, solve) {
        container.innerHTML = '<div style="color:#888;font-size:0.8em">加载中...</div>';
        // NOTE: 优先用 solution 列（纯解法）
        var reconText = solve.solution || solve.caption || '';
        var setup = solve.optimalScramble || solve.wcaScramble || extractScrambleFromRecon(reconText);
        var alg = extractAlgFromRecon(reconText);

        // NOTE: 保存数据用于光标跟随
        detailScramble = setup;
        detailSolutionText = reconText;
        detailFullAlg = alg; // NOTE: 完整清理后的公式

        // NOTE: SQ1 用 cubedb.net iframe（twisty-player 对 SQ1 渲染不友好）
        if (solve.event === 'SQ1') {
            var cubedbPuzzle = ReconUtils.eventToCubedbPuzzle(solve.event);
            var cubedbUrl = 'https://cubedb.net/?puzzle=' + cubedbPuzzle +
                '&scramble=' + encodeURIComponent(setup) +
                '&alg=' + encodeURIComponent(alg);
            container.innerHTML = '<iframe src="' + cubedbUrl + '" ' +
                'style="width:100%;height:400px;border:1px solid #444;border-radius:8px" ' +
                'allowfullscreen></iframe>';
            currentDetailPlayer = null;
            return;
        }

        window.ensureTwisty().then(function () {
            var Ctor = window.__TwistyPlayerCtor;
            if (!Ctor) { container.innerHTML = ''; return; }
            var puzzle = ReconUtils.eventToPuzzle(solve.event);
            var player = new Ctor({
                puzzle: puzzle,
                experimentalSetupAlg: setup,
                alg: alg
            });
            container.innerHTML = '';
            container.appendChild(player);
            currentDetailPlayer = player; // NOTE: 保存引用用于光标跟随
        }).catch(function () {
            container.innerHTML = '';
        });
    }

    /**
     * NOTE: 获取点击在 DOM 元素纯文本中的绝对偏移。
     * 遍历 anchorNode 的前置兄弟和父节点累加 textContent.length。
     */
    function getTextOffsetInElement(el) {
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return -1;
        var node = sel.anchorNode;
        var offset = sel.anchorOffset;
        if (!el.contains(node)) return -1;

        // NOTE: 从 anchorNode 向前遍历，累加前置兄弟的文本长度
        var current = node;
        while (current && current !== el) {
            var prev = current.previousSibling;
            while (prev) {
                offset += (prev.textContent || '').length;
                prev = prev.previousSibling;
            }
            current = current.parentNode;
        }
        return offset;
    }


    // NOTE: 详情页虚拟光标偏移
    var detailCursorOffset = 0;

    /**
     * NOTE: 在 DOM 元素的指定纯文本偏移处插入可视光标。
     * 遍历所有子文本节点找到偏移位置，在该处插入闪烁光标 span。
     */
    function insertVisualCursor(el, textOffset) {
        // NOTE: 先移除旧光标
        var old = el.querySelector('.detail-cursor');
        if (old) old.remove();

        // NOTE: 遍历文本节点找到偏移位置
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        var accumulated = 0;
        var targetNode = null;
        var localOffset = 0;
        while (walker.nextNode()) {
            var nodeLen = walker.currentNode.textContent.length;
            if (accumulated + nodeLen >= textOffset) {
                targetNode = walker.currentNode;
                localOffset = textOffset - accumulated;
                break;
            }
            accumulated += nodeLen;
        }
        if (!targetNode) return;

        // NOTE: 在文本节点的指定偏移处分割并插入光标
        var cursor = document.createElement('span');
        cursor.className = 'detail-cursor';
        cursor.textContent = '\u200B'; // NOTE: 零宽空格占位
        var afterNode = targetNode.splitText(localOffset);
        afterNode.parentNode.insertBefore(cursor, afterNode);
    }

    /** 根据文本偏移同步 twisty-player 并显示可视光标 */
    function syncDetailAtOffset(reconTextEl, textOffset) {
        // NOTE: 先插入可视光标
        insertVisualCursor(reconTextEl, textOffset);

        if (!currentDetailPlayer || !detailSolutionText) return;

        // NOTE: 去掉零宽空格获取纯文本
        var plainText = (reconTextEl.textContent || '').replace(/\u200B/g, '');

        // NOTE: 计算光标前的步数
        var textBefore = plainText.substring(0, textOffset);
        var algBefore = extractAlgFromRecon(textBefore);
        var moves = algBefore.trim().split(/\s+/).filter(function (s) { return s.length > 0; });
        var moveCount = moves.length;

        // NOTE: 通过 indexer 获取精确的毫秒时间戳，而非简单的 moveCount * 1000
        try {
            var model = currentDetailPlayer.experimentalModel;
            if (model && model.indexer) {
                model.indexer.get().then(function (indexer) {
                    if (typeof indexer.indexToMoveStartTimestamp === 'function') {
                        var totalMoves = typeof indexer.numAnimatedLeaves === 'function'
                            ? indexer.numAnimatedLeaves()
                            : (typeof indexer.numMoves === 'function' ? indexer.numMoves() : 0);
                        // NOTE: 如果光标在末尾，用 algDuration 跳到绝对末尾
                        if (moveCount >= totalMoves && typeof indexer.algDuration === 'function') {
                            currentDetailPlayer.timestamp = indexer.algDuration();
                        } else {
                            currentDetailPlayer.timestamp = indexer.indexToMoveStartTimestamp(moveCount);
                        }
                    }
                });
            }
        } catch (e) {
            // NOTE: 实验性 API 失败时静默忽略
        }
    }

    // ==================== 同轮次成绩 ====================

    /**
     * 异步加载并渲染同一轮次的所有成绩
     * NOTE: 优先从预构建的 wca_attempts.json 读取（秒返回），
     * 静态文件无数据时 fallback 到后端 wcaAttempts 代理（实时请求 WCA API）
     */
    function renderSiblingsSolves(solve) {
        var container = document.getElementById('siblings-container');
        if (!container) return;

        var U = ReconUtils;
        var wcaEventId = U.eventToWcaId(solve.event);

        // NOTE: 优先用 compWcaId，fallback 到 comp 显示名查映射表
        var wcaCompId = solve.compWcaId || compWcaIds[solve.comp] || '';

        // NOTE: 前置条件检查——缺任何必要字段则不显示
        if (!wcaCompId || !solve.personId || !solve.round || !wcaEventId) return;

        fetch('/recon/data/wca_attempts.json')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var compData = data[wcaCompId];
                if (!compData) return null;
                var personData = compData[solve.personId];
                if (!personData) return null;
                return personData;
            })
            .then(function (personData) {
                if (personData) {
                    // NOTE: 静态文件命中，直接渲染
                    renderSiblingsFromPersonData(container, solve, personData, wcaEventId);
                    return;
                }
                // NOTE: 静态文件无数据，fallback 到后端代理实时获取
                var apiUrl = 'https://toolkit.cuberoot.me/recon/api/?action=wcaAttempts'
                    + '&compId=' + encodeURIComponent(wcaCompId)
                    + '&personId=' + encodeURIComponent(solve.personId);
                return fetch(apiUrl)
                    .then(function (r) { return r.json(); })
                    .then(function (pd) {
                        if (pd && Object.keys(pd).length > 0) {
                            renderSiblingsFromPersonData(container, solve, pd, wcaEventId);
                        }
                    });
            })
            .catch(function () {
                // NOTE: 静默失败，不影响页面其他内容
            });
    }

    /**
     * 从 personData 中匹配轮次并渲染 siblings
     * personData 格式: {eventId_roundTypeId: {a: [...], r?: {solveNum: reconId}}}
     */
    function renderSiblingsFromPersonData(container, solve, personData, wcaEventId) {
        var U = ReconUtils;

        // NOTE: 在所有 eventId_roundTypeId 键中查找匹配当前轮次的
        var matchedKey = null;
        var keys = Object.keys(personData);
        for (var i = 0; i < keys.length; i++) {
            var parts = keys[i].split('_');
            // parts[0] = eventId, parts[1] = roundTypeId
            if (parts[0] === wcaEventId && U.roundMatchesWca(solve.round, parts[1])) {
                matchedKey = keys[i];
                break;
            }
        }
        if (!matchedKey) return;

        var entry = personData[matchedKey];
        var attempts = entry.a || [];
        var reconIds = entry.r || {}; // {solveNum: reconId}

        // NOTE: 过滤掉值为 0 的 attempt（Mo3 项目后面补 0）
        var solveCount = 0;
        for (var j = 0; j < attempts.length; j++) {
            if (attempts[j] !== 0) solveCount++;
        }
        if (solveCount === 0) return;

        // NOTE: Ao5 时找出最快/最慢索引，加括号显示（WCA 标准格式）
        // Mo3（3把）不加括号
        var bestIdx = -1, worstIdx = -1;
        if (solveCount >= 5) {
            var bestVal = Infinity, worstVal = -Infinity;
            for (var b = 0; b < attempts.length; b++) {
                if (attempts[b] === 0) continue;
                // DNF(-1)/DNS(-2) 视为无穷大（最差）
                var v = attempts[b] < 0 ? Infinity : attempts[b];
                if (v < bestVal) { bestVal = v; bestIdx = b; }
                if (v >= worstVal) { worstVal = v; worstIdx = b; }
            }
        }

        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        var html = '<div class="siblings-solves">';
        html += '<h3 class="siblings-title">';
        html += '<span data-i18n-en="Solves in this average" data-i18n-zh="本轮次所有成绩">';
        html += isZh ? '本轮次所有成绩' : 'Solves in this average';
        html += '</span></h3>';
        html += '<div class="siblings-list">';

        for (var k = 0; k < attempts.length; k++) {
            if (attempts[k] === 0) continue; // NOTE: Mo3 补 0 跳过

            var sn = k + 1; // solveNum 从 1 开始
            var timeStr = U.formatWcaTime(attempts[k]);
            // NOTE: 最快/最慢成绩加括号（WCA Ao5 标准格式）
            if (k === bestIdx || k === worstIdx) {
                timeStr = '(' + timeStr + ')';
            }
            var reconId = reconIds[String(sn)];
            // NOTE: 当前 solve 高亮标记
            var isCurrent = (String(solve.solveNum) === String(sn));
            var cls = 'sibling-item' + (isCurrent ? ' sibling-current' : '');

            html += '<div class="' + cls + '">';
            html += '<span class="sibling-num">#' + sn + '</span>';

            if (reconId && !isCurrent) {
                // NOTE: 有复盘且不是当前页，显示为可点击链接
                html += '<a href="/recon/detail/?id=' + reconId + '" class="sibling-time sibling-link">' + U.escHtml(timeStr) + '</a>';
            } else {
                html += '<span class="sibling-time">' + U.escHtml(timeStr) + '</span>';
            }

            if (reconId) {
                html += '<span class="sibling-recon-badge" title="Has recon">✓</span>';
            }
            html += '</div>';
        }

        html += '</div></div>';
        container.innerHTML = html;
    }

})();
