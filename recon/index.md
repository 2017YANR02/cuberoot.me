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
</div>

<!-- NOTE: 主表格容器 -->
<div class="recon-table-wrap">
    <table id="recon-table">
        <thead>
            <tr>
                <th class="col-expand"></th>
                <th class="col-result" data-i18n="recon.col_result">Result</th>
                <th class="col-solver" data-i18n="recon.col_solver">Solver</th>
                <th class="col-method" data-i18n="recon.col_method">Method</th>
                <th class="col-comp" data-i18n="recon.col_comp">Competition</th>
                <th class="col-round" data-i18n="recon.col_round">Rnd</th>
                <th class="col-date" data-i18n="recon.col_date">Date</th>
                <th class="col-stm">STM</th>
                <th class="col-tps">TPS</th>
                <th class="col-oll">OLL</th>
                <th class="col-pll">PLL</th>
                <th class="col-ravg" data-i18n="recon.col_ravg">R Avg</th>
                <th class="col-rsingle" data-i18n="recon.col_rsingle">R Single</th>
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

<script src="/recon/recon.js" defer></script>
