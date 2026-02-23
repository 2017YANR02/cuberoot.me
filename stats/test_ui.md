<h2 data-i18n-en="UI Test" data-i18n-zh="UI 测试">UI 测试</h2>

<p><em>此页面用于测试分段控件样式，无真实数据。</em></p>

<style>
.metric-selector{display:flex;align-items:center;gap:0;margin:16px 0}
.metric-selector-label{font-size:14px;font-weight:600;color:#c0c8d8;margin-right:12px}
.metric-selector-group{display:flex;gap:0}
.metric-btn{padding:8px 20px;border:1px solid #4a6785;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:600;transition:all .2s;border-radius:0}
.metric-btn:first-child{border-radius:6px 0 0 6px}
.metric-btn:last-child{border-radius:0 6px 6px 0}
.metric-btn + .metric-btn{border-left:none}
.metric-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
.metric-btn:hover:not(.active){background:rgba(138,180,248,0.08)}
.metric-panel{display:none}
.metric-panel.active{display:block}
</style>

<div class="metric-selector">
  <div class="metric-selector-group">
    <button class="metric-btn active" onclick="switchMetric('single')" data-i18n-en="Single" data-i18n-zh="单次">单次</button>
    <button class="metric-btn" onclick="switchMetric('average')" data-i18n-en="Average" data-i18n-zh="平均">平均</button>
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
.source-selector{display:inline-flex;margin:16px 0;vertical-align:middle}
.source-selector-group{display:flex;gap:0}
.source-btn{padding:8px 20px;border:1px solid #4a6785;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:600;transition:all .2s;border-radius:0}
.source-btn:first-child{border-radius:6px 0 0 6px}
.source-btn:last-child{border-radius:0 6px 6px 0}
.source-btn + .source-btn{border-left:none}
.source-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
.source-btn:hover:not(.active){background:rgba(138,180,248,0.08)}
</style>

<div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin:16px 0">

<div class="metric-selector" style="margin:0">
  <div class="metric-selector-group">
    <button class="metric-btn active" data-i18n-en="Single" data-i18n-zh="单次">单次</button>
    <button class="metric-btn" data-i18n-en="Average" data-i18n-zh="平均">平均</button>
  </div>
</div>

<div class="source-selector" style="margin:0">
  <div class="source-selector-group">
    <button class="source-btn active" data-i18n-en="First Solve" data-i18n-zh="首次还原">First Solve</button>
    <button class="source-btn" data-i18n-en="First Competition" data-i18n-zh="首场比赛">First Competition</button>
  </div>
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

