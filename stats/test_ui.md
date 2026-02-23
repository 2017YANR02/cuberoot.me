<h2 data-i18n-en="UI Test" data-i18n-zh="UI 测试">UI 测试</h2>

<p><em>此页面用于测试分段控件样式，无真实数据。</em></p>

<style>
.metric-selector{display:flex;align-items:center;gap:0;margin:16px 0}
.metric-selector-label{font-size:14px;font-weight:600;color:#c0c8d8;margin-right:12px}
.metric-selector-group{display:flex;gap:0}



.metric-panel{display:none}
.metric-panel.active{display:block}
</style>

<div class="metric-selector">
  <div class="metric-selector-group">
    <button class="segmented-btn metric-btn active" onclick="switchMetric('single')" data-i18n-en="Single" data-i18n-zh="单次">单次</button>
    <button class="segmented-btn metric-btn" onclick="switchMetric('average')" data-i18n-en="Average" data-i18n-zh="平均">平均</button>
  </div>
</div>

<div class="metric-panel active" id="metric-single">
<p>✅ Single 内容区域</p>
</div>

<div class="metric-panel" id="metric-average">
<p>✅ Average 内容区域</p>
</div>

<hr>

<h3>多轮均值页 — 4 个按钮</h3>

<style>
.aoxr-selector{display:flex;align-items:center;gap:0;margin:16px 0}
.aoxr-selector-group{display:flex;gap:0}
.aoxr-btn{padding:8px 20px;border:1px solid #4a6785;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:600;transition:all .2s;border-radius:0}
.aoxr-btn:first-child{border-radius:6px 0 0 6px}
.aoxr-btn:last-child{border-radius:0 6px 6px 0}
.aoxr-btn + .aoxr-btn{border-left:none}
.aoxr-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
.aoxr-btn:hover:not(.active){background:rgba(138,180,248,0.08)}
</style>

<div class="aoxr-selector">
  <div class="aoxr-selector-group">
    <button class="aoxr-btn active">Ao1R</button>
    <button class="aoxr-btn">Ao2R</button>
    <button class="aoxr-btn">Ao3R</button>
    <button class="aoxr-btn">Ao4R</button>
  </div>
</div>

<hr>

<h3>滚动平均页 — 5 个按钮</h3>

<div class="aoxr-selector">
  <div class="aoxr-selector-group">
    <button class="aoxr-btn active">Ao5</button>
    <button class="aoxr-btn">Ao12</button>
    <button class="aoxr-btn">Ao25</button>
    <button class="aoxr-btn">Ao50</button>
    <button class="aoxr-btn">Ao100</button>
  </div>
</div>

<hr>

<h3>新人页 — 双选择器（同一行）</h3>

<style>
/* 新人页布局和选择器样式 */
.newcomer-header-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 16px 0; }
.newcomer-header-wrap .metric-selector, .newcomer-header-wrap .source-selector { margin: 0; }
.metric-panel { display: none; }
.metric-panel.active { display: contents; } /* 仅 active 展开内容参与 parent flex 布局 */
.metric-panel > :not(.source-selector) { width: 100%; }

.source-selector{display:inline-flex;margin:16px 0;vertical-align:middle}
.source-selector-group{display:flex;gap:0}



.source-panel { display: none; }
.source-panel.active { display: block; }
</style>

<!-- 模拟 event_selector.js 注入的结构 -->
<div class="event-selector" style="width:100%; margin-bottom:16px; background:#1e1e1e; padding:10px;">📦 这是一个全局事件选择器 (例如 3x3x3)</div>

<div class="newcomer-header-wrap">
  <div class="metric-selector">
    <div class="metric-selector-group">
      <button class="segmented-btn metric-btn active" onclick="switchMetricUI('single')" data-i18n-en="Single" data-i18n-zh="单次">单次</button>
      <button class="segmented-btn metric-btn" onclick="switchMetricUI('average')" data-i18n-en="Average" data-i18n-zh="平均">平均</button>
    </div>
  </div>

  <!-- Single Panel -->
  <div class="metric-panel active" id="ui-metric-single">
    <div class="source-selector">
      <div class="source-selector-group">
        <button class="segmented-btn source-btn active" onclick="switchSourceUI(this, 's-1')" data-i18n-en="First Solve" data-i18n-zh="首次还原">首次还原</button>
        <button class="segmented-btn source-btn" onclick="switchSourceUI(this, 's-2')" data-i18n-en="First Comp" data-i18n-zh="首场比赛">首场比赛</button>
      </div>
    </div>
    
    <div class="source-panel active" id="source-s-1">
      <div style="padding: 20px; background: rgba(0,255,0,0.1); border: 1px dashed green;">
        <p>✅ (Single / First Solve) 的内容区域</p>
      </div>
    </div>
    <div class="source-panel" id="source-s-2">
      <div style="padding: 20px; background: rgba(0,255,0,0.1); border: 1px dashed green;">
        <p>✅ (Single / First Comp) 的内容区域</p>
      </div>
    </div>
  </div>

  <!-- Average Panel -->
  <div class="metric-panel" id="ui-metric-average">
    <div class="source-selector">
      <div class="source-selector-group">
        <button class="segmented-btn source-btn active" onclick="switchSourceUI(this, 'a-1')" data-i18n-en="First Solve" data-i18n-zh="首次还原">首次还原</button>
        <button class="segmented-btn source-btn" onclick="switchSourceUI(this, 'a-2')" data-i18n-en="First Comp" data-i18n-zh="首场比赛">首场比赛</button>
      </div>
    </div>

    <div class="source-panel active" id="source-a-1">
      <div style="padding: 20px; background: rgba(255,0,0,0.1); border: 1px dashed red;">
        <p>❌ (Average / First Solve) 这不应该在 Single 时显示！</p>
      </div>
    </div>
    <div class="source-panel" id="source-a-2">
      <div style="padding: 20px; background: rgba(255,0,0,0.1); border: 1px dashed red;">
        <p>❌ (Average / First Comp) 这不应该在 Single 时显示！</p>
      </div>
    </div>
  </div>

</div>

<script>
function switchMetricUI(id) {
  const container = document.querySelector('.newcomer-header-wrap');
  container.querySelectorAll('.metric-btn').forEach(b=>b.classList.remove('active'));
  container.querySelectorAll('.metric-panel').forEach(p=>p.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById('ui-metric-'+id).classList.add('active');
}

function switchSourceUI(btn, id) {
  const scope = btn.closest('.metric-panel') || document;
  scope.querySelectorAll('.source-btn').forEach(b=>b.classList.remove('active'));
  scope.querySelectorAll('.source-panel').forEach(p=>p.classList.remove('active'));
  
  btn.classList.add('active');
  document.getElementById('source-'+id).classList.add('active');
}
</script>

<hr>

<h3>聚合统计页 — 下拉菜单 + 全局 Tab（同一行）</h3>

<style>
.metric-toolbar{display:flex;align-items:center;gap:16px;margin:16px 0;flex-wrap:wrap}
.metric-dropdown{position:relative;display:inline-block;margin:0}
.metric-dropdown-trigger{
  display:flex;align-items:center;gap:8px;
  padding:10px 18px;
  border:1px solid #4a6785;border-radius:8px;
  background:rgba(255,255,255,0.03);
  color:#e0e0e0;cursor:pointer;
  font-size:15px;font-weight:500;
  transition:all .2s
}
.metric-dropdown-trigger:hover{border-color:#8ab4f8;background:rgba(138,180,248,0.08)}
.metric-dropdown-trigger .arrow{
  font-size:10px;color:#8ab4f8;
  transition:transform .2s
}

.stat-tabs{display:flex;gap:0;margin:0}




</style>

<div class="metric-toolbar">
  <div class="metric-dropdown">
    <button class="metric-dropdown-trigger">
      <span data-role="trigger-text">Single</span>
      <span class="arrow">▼</span>
    </button>
  </div>
  <div class="stat-tabs">
    <button class="segmented-btn stat-tab active">Current Ranking</button>
    <button class="segmented-btn stat-tab">WR History</button>
  </div>
</div>

<div class="metric-panel active" style="clear:both;">
<p>✅ 数据内容区域</p>
</div>

<hr>

<h3>旧样式对比 — 药丸按钮</h3>

<style>
.old-selector{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0}
.old-btn{padding:8px 16px;border:1px solid #4a6785;border-radius:20px;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:500;transition:all .2s}
.old-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
.old-btn:hover:not(.active){background:rgba(138,180,248,0.1)}
</style>

<div class="old-selector">
  <button class="old-btn active" data-i18n-en="Single" data-i18n-zh="单次">单次</button>
  <button class="old-btn" data-i18n-en="Average" data-i18n-zh="平均">平均</button>
</div>

<div class="old-selector">
  <button class="old-btn active">Ao1R</button>
  <button class="old-btn">Ao2R</button>
  <button class="old-btn">Ao3R</button>
  <button class="old-btn">Ao4R</button>
</div>

