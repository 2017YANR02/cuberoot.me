<h2 data-i18n-en="Newcomer (Test)" data-i18n-zh="新人 (测试)">Newcomer (Test)</h2>

<p><em>此页面用于测试 wr_newcomer 选择器结构，无真实数据。</em></p>

<!-- ===== 1) metric 分段控件样式 ===== -->
<style>
.metric-selector{display:flex;align-items:center;gap:0;margin:16px 0}
.metric-selector-group{display:flex;gap:0}



.metric-panel{display:none}
.metric-panel.active{display:block}
</style>

<!-- ===== 2) source 分段控件样式 ===== -->
<style>
.source-selector{display:flex;align-items:center;gap:0;margin:16px 0}
.source-selector-group{display:flex;gap:0}



.source-panel{display:none}
.source-panel.active{display:block}
</style>

<!-- ===== 3) tab 样式 ===== -->
<style>
.stat-tabs{display:flex;gap:0;margin:16px 0 0}





.stat-panel{display:none;margin-top:12px}
.stat-panel.active{display:block}
.stat-panel table{border-collapse:collapse}
.stat-panel th,.stat-panel td{padding:6px 12px;border-bottom:1px solid #ddd;text-align:left}
.stat-panel th{background:#f6f8fa;font-weight:600}
</style>

<!-- ===== 4) newcomer-header-wrap 布局覆盖（修复版） ===== -->
<style>
.newcomer-header-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 16px 0; }
.newcomer-header-wrap .metric-selector, .newcomer-header-wrap .source-selector { margin: 0; }
.metric-panel { display: none; }
.metric-panel.active { display: contents; } /* NOTE: 只有 active 面板才用 contents 暴露子元素到 flex 布局 */
.metric-panel > :not(.source-selector) { width: 100%; } /* 让内容区域（如图表）换行显示占满整个宽度 */
</style>

<!-- ===== 外层容器 ===== -->
<div class="newcomer-header-wrap">

<!-- metric 选择器按钮 -->
<div class="metric-selector">
  <div class="metric-selector-group">
    <button class="segmented-btn metric-btn active" onclick="switchMetric('single')" data-i18n-en="Single">Single</button>
    <button class="segmented-btn metric-btn" onclick="switchMetric('average')" data-i18n-en="Average">Average</button>
  </div>
</div>

<!-- ===== Single Panel ===== -->
<div class="metric-panel active" id="metric-single">

<div class="source-selector">
  <div class="source-selector-group">
    <button class="segmented-btn source-btn active" onclick="switchSource(this,'single-1st-solve')" data-i18n-en="First Solve" data-i18n-zh="首次还原">First Solve</button>
    <button class="segmented-btn source-btn" onclick="switchSource(this,'single-1st-comp')" data-i18n-en="First Competition" data-i18n-zh="首场比赛">First Competition</button>
  </div>
</div>

<!-- source-panel: single / 1st-solve -->
<div class="source-panel active" id="source-single-1st-solve">

<div class="stat-tabs">
  <button class="segmented-btn stat-tab active" onclick="switchTab(event,'single-1st-solve-ranking')" data-i18n-en="Current Ranking" data-i18n-zh="排名">Current Ranking</button>
  <button class="segmented-btn stat-tab" onclick="switchTab(event,'single-1st-solve-history')" data-i18n-en="WR History" data-i18n-zh="历史">WR History</button>
</div>

<div id="single-1st-solve-ranking" class="stat-panel active">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">#</th><th>Person</th><th style="text-align:right">Result</th><th>Country</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">1</td><td>Test Person A</td><td style="text-align:right">5.03</td><td>China</td><td>2024-12-07</td><td>Test Comp 2024</td></tr>
<tr><td style="text-align:right">2</td><td>Test Person B</td><td style="text-align:right">6.16</td><td>China</td><td>2026-01-10</td><td>Test Comp 2026</td></tr>
</table>
</div>

<div id="single-1st-solve-history" class="stat-panel">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">Result</th><th style="text-align:right">Improvement</th><th style="text-align:right">Days</th><th>Person</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">5.03</td><td style="text-align:right">18.3%</td><td style="text-align:right">443</td><td>Test Person A</td><td>2024-12-07</td><td>Test Comp 2024</td></tr>
</table>
</div>

</div>

<!-- source-panel: single / 1st-comp -->
<div class="source-panel" id="source-single-1st-comp">

<div class="stat-tabs">
  <button class="segmented-btn stat-tab active" onclick="switchTab(event,'single-1st-comp-ranking')" data-i18n-en="Current Ranking" data-i18n-zh="排名">Current Ranking</button>
  <button class="segmented-btn stat-tab" onclick="switchTab(event,'single-1st-comp-history')" data-i18n-en="WR History" data-i18n-zh="历史">WR History</button>
</div>

<div id="single-1st-comp-ranking" class="stat-panel active">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">#</th><th>Person</th><th style="text-align:right">Result</th><th>Country</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">1</td><td>Test Person C</td><td style="text-align:right">4.99</td><td>USA</td><td>2025-03-15</td><td>Test Open 2025</td></tr>
</table>
</div>

<div id="single-1st-comp-history" class="stat-panel">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">Result</th><th style="text-align:right">Improvement</th><th style="text-align:right">Days</th><th>Person</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">4.99</td><td style="text-align:right">10.0%</td><td style="text-align:right">200</td><td>Test Person C</td><td>2025-03-15</td><td>Test Open 2025</td></tr>
</table>
</div>

</div>

</div>

<!-- ===== Average Panel ===== -->
<div class="metric-panel" id="metric-average">

<div class="source-selector">
  <div class="source-selector-group">
    <button class="segmented-btn source-btn active" onclick="switchSource(this,'average-1st-solve')" data-i18n-en="First Solve" data-i18n-zh="首次还原">First Solve</button>
    <button class="segmented-btn source-btn" onclick="switchSource(this,'average-1st-comp')" data-i18n-en="First Competition" data-i18n-zh="首场比赛">First Competition</button>
  </div>
</div>

<!-- source-panel: average / 1st-solve -->
<div class="source-panel active" id="source-average-1st-solve">

<div class="stat-tabs">
  <button class="segmented-btn stat-tab active" onclick="switchTab(event,'average-1st-solve-ranking')" data-i18n-en="Current Ranking" data-i18n-zh="排名">Current Ranking</button>
  <button class="segmented-btn stat-tab" onclick="switchTab(event,'average-1st-solve-history')" data-i18n-en="WR History" data-i18n-zh="历史">WR History</button>
</div>

<div id="average-1st-solve-ranking" class="stat-panel active">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">#</th><th>Person</th><th style="text-align:right">Result</th><th>Country</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">1</td><td>Test Person D</td><td style="text-align:right">7.50</td><td>Japan</td><td>2025-06-01</td><td>Test Avg 2025</td></tr>
</table>
</div>

<div id="average-1st-solve-history" class="stat-panel">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">Result</th><th style="text-align:right">Improvement</th><th style="text-align:right">Days</th><th>Person</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">7.50</td><td style="text-align:right">5.0%</td><td style="text-align:right">100</td><td>Test Person D</td><td>2025-06-01</td><td>Test Avg 2025</td></tr>
</table>
</div>

</div>

<!-- source-panel: average / 1st-comp -->
<div class="source-panel" id="source-average-1st-comp">

<div class="stat-tabs">
  <button class="segmented-btn stat-tab active" onclick="switchTab(event,'average-1st-comp-ranking')" data-i18n-en="Current Ranking" data-i18n-zh="排名">Current Ranking</button>
  <button class="segmented-btn stat-tab" onclick="switchTab(event,'average-1st-comp-history')" data-i18n-en="WR History" data-i18n-zh="历史">WR History</button>
</div>

<div id="average-1st-comp-ranking" class="stat-panel active">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">#</th><th>Person</th><th style="text-align:right">Result</th><th>Country</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">1</td><td>Test Person E</td><td style="text-align:right">8.20</td><td>Korea</td><td>2025-07-01</td><td>Test AvgComp 2025</td></tr>
</table>
</div>

<div id="average-1st-comp-history" class="stat-panel">
<h3>Rubik's Cube</h3>
<table>
<tr><th style="text-align:right">Result</th><th style="text-align:right">Improvement</th><th style="text-align:right">Days</th><th>Person</th><th>Date</th><th>Competition</th></tr>
<tr><td style="text-align:right">8.20</td><td style="text-align:right">3.0%</td><td style="text-align:right">50</td><td>Test Person E</td><td>2025-07-01</td><td>Test AvgComp 2025</td></tr>
</table>
</div>

</div>

</div>

</div><!-- newcomer-header-wrap -->

<!-- ===== JS: metric 切换 ===== -->
<script>
function switchMetric(id){
  // NOTE: metric 和 source 是独立选择器，切换 metric 时保持 source 选择不变
  var oldPanel = document.querySelector('.metric-panel.active');
  var srcIdx = 0;
  if(oldPanel){
    oldPanel.querySelectorAll('.source-btn').forEach(function(b,i){ if(b.classList.contains('active')) srcIdx = i; });
  }
  document.querySelectorAll('.metric-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.metric-btn').forEach(b=>b.classList.remove('active'));
  var panel = document.getElementById('metric-'+id);
  panel.classList.add('active');
  event.target.classList.add('active');
  // NOTE: 同步 source 索引到新 panel
  var newBtns = panel.querySelectorAll('.source-btn');
  if(newBtns[srcIdx]) newBtns[srcIdx].click();
}
</script>

<!-- ===== JS: source 切换 ===== -->
<script>
function switchSource(btn, id){
  var scope = btn.closest('.metric-panel') || document;
  scope.querySelectorAll('.source-btn').forEach(b=>b.classList.remove('active'));
  scope.querySelectorAll('.source-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('source-'+id).classList.add('active');
}
</script>

<!-- ===== JS: tab 切换 ===== -->
<script>
function switchTab(e,id){
  var scope=e.target.closest('.metric-panel')||document;
  scope.querySelectorAll('.stat-tab').forEach(t=>t.classList.remove('active'));
  scope.querySelectorAll('.stat-panel').forEach(p=>p.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(id).classList.add('active');
}
</script>
