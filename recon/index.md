---
title: "Recon - Solve Reconstructions"
layout: default
---

<link rel="stylesheet" href="/recon/recon.css">

<h1 data-i18n="recon.title">Solve Reconstructions</h1>
<p class="recon-subtitle" data-i18n="recon.subtitle">Competition solve reconstructions and analysis for top cubers</p>

<!-- NOTE: 工具栏：搜索 + 筛选 -->
<div class="recon-toolbar">
    <input type="text" id="recon-search" placeholder="Search solver, competition, result, record..."
        data-i18n-placeholder="recon.search_placeholder" autocomplete="off">
    <div class="recon-filters">
        <select id="filter-solver">
            <option value="" data-i18n="recon.all_solvers">All Solvers</option>
        </select>
        <select id="filter-method">
            <option value="" data-i18n="recon.all_methods">All Methods</option>
        </select>
        <select id="filter-event">
            <option value="" data-i18n="recon.all_events">All Events</option>
        </select>
    </div>
    <div class="recon-stats" id="recon-stats"></div>
    <button id="btn-add-recon" class="recon-btn recon-btn-add" data-i18n-en="➕" data-i18n-zh="➕">➕</button>
    <!-- NOTE: WCA 登录区域 -->
    <div class="wca-auth-area" id="wca-auth-area">
        <button id="btn-wca-login" class="recon-btn wca-login-btn" onclick="WcaAuth.login()" data-i18n-en="Login" data-i18n-zh="登录">
            Login
        </button>
        <div id="wca-user-info" class="wca-user-info" style="display:none">
            <img id="wca-avatar" class="wca-avatar" src="" alt="">
            <span id="wca-name" class="wca-name"></span>
            <button id="btn-wca-logout" class="recon-btn wca-logout-btn" onclick="WcaAuth.logout();location.reload()">
                ✕
            </button>
        </div>
    </div>
</div>

<!-- NOTE: 主表格容器 -->
<div class="recon-table-wrap">
    <table id="recon-table">
        <thead>
            <tr>
                <th class="col-official" data-i18n-en="Official" data-i18n-zh="官方">Official</th>
                <th class="col-event" data-sort="event">Event</th>
                <th class="col-method" data-i18n="recon.col_method">Method</th>
                <th class="col-date" data-i18n="recon.col_date" data-sort="date">Date</th>
                <th class="col-comp" data-i18n="recon.col_comp">Competition</th>
                <th class="col-round" data-i18n-en="Rnd#" data-i18n-zh="轮#">Rnd#</th>
                <th class="col-aoxr" data-sort="aoType">AoXR</th>
                <th class="col-avg" data-i18n-en="Avg" data-i18n-zh="平均" data-sort="avg">Avg</th>
                <th class="col-single" data-i18n="recon.col_result" data-sort="single">Single</th>
                <th class="col-dsingle" data-i18n-en="Single" data-i18n-zh="单次" data-sort="displaySingle">Single</th>
                <th class="col-solver" data-i18n="recon.col_solver" data-sort="solver">Solver</th>
                <th class="col-stm" data-sort="stm">STM</th>
                <th class="col-tps" data-sort="tps">TPS</th>
            </tr>
        </thead>
        <tbody id="recon-tbody"></tbody>
    </table>
</div>

<!-- NOTE: 分页 / 加载更多 -->
<div class="recon-pagination" id="recon-pagination">
    <button id="btn-load-more" class="recon-btn" data-i18n="recon.load_more">Load More</button>
    <span id="recon-showing" class="recon-showing"></span>
</div>

<!-- NOTE: cubing/twisty 3D 动画播放器（懒加载） -->
<script type="module">
    let twistyPromise = null;
    function ensureTwisty() {
        if (!twistyPromise) {
            twistyPromise = import('https://cdn.cubing.net/v0/js/cubing/twisty')
                .then(mod => {
                    window.__TwistyPlayerCtor = mod.TwistyPlayer || mod.default;
                    return mod;
                })
                .catch(err => {
                    console.error('Twisty import failed:', err);
                    throw err;
                });
        }
        return twistyPromise;
    }
    window.ensureTwisty = ensureTwisty;
    // NOTE: 空闲时预加载
    try { ensureTwisty().catch(() => {}); } catch(e) {}
</script>

<!-- NOTE: Firebase compat SDK（CDN） -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>

<script src="/recon/recon_stats.js"></script>
<script src="/recon/wca_auth.js"></script>
<script src="/recon/firebase_store.js"></script>
<script src="/recon/recon.js" defer></script>
<script src="/recon/recon_submit.js" defer></script>
