<h2>Mode C：下拉菜单 + 全局 Tab</h2>
<p><em>metric-tab-wrap 布局，如 wr_metric。JS 检测到 .metric-dropdown 即跳过 metric 药丸按钮，改用下拉菜单。</em></p>
<div class="metric-tab-wrap" data-tab-mode="global">
<div class="metric-dropdown">
  <button class="metric-dropdown-trigger" onclick="toggleMetricDropdown()">
    <span data-i18n-en="BAo5" data-role="trigger-text">BAo5</span>
    <span class="arrow">▼</span>
  </button>
  <div class="metric-dropdown-panel">
    <div class="metric-dropdown-group-label">Best Average</div>
    <div class="metric-dropdown-items">
      <button class="metric-dropdown-item active" data-id="bao5" data-i18n-en="BAo5" onclick="selectFromDropdown('bao5')">BAo5</button>
      <button class="metric-dropdown-item" data-id="mo5" data-i18n-en="Mo5" onclick="selectFromDropdown('mo5')">Mo5</button>
    </div>
  </div>
</div>
<div class="metric-panel active" id="metric-bao5" data-label-en="BAo5">
<div id="bao5-ranking" class="stat-panel active" data-label-en="Ranking" data-label-zh="排名">
<p>BAo5 排名</p>
</div>
<div id="bao5-history" class="stat-panel" data-label-en="History" data-label-zh="历史">
<p>BAo5 历史</p>
</div>
</div>
<div class="metric-panel" id="metric-mo5" data-label-en="Mo5">
<div id="mo5-ranking" class="stat-panel active" data-label-en="Ranking" data-label-zh="排名">
<p>Mo5 排名</p>
</div>
<div id="mo5-history" class="stat-panel" data-label-en="History" data-label-zh="历史">
<p>Mo5 历史</p>
</div>
</div>
</div><!-- metric-tab-wrap -->
