# NOTE: 通用分段控件按钮样式——所有选择器按钮共用的外观
# 消费方在按钮上加 class="segmented-btn metric-btn" 即可
# metric-btn / source-btn / stat-tab 等前缀类名仅做 JS 作用域隔离
module SegmentedBtn
  def segmented_btn_styles
    return "" if @_segmented_btn_emitted # NOTE: 幂等守卫，每页只输出一次
    @_segmented_btn_emitted = true
    <<~HTML
      <style>
      .segmented-btn{padding:8px 20px;border:1px solid #4a6785;background:transparent;color:#8ab4f8;cursor:pointer;font-size:14px;font-weight:600;line-height:1.2;transition:all .2s;border-radius:0}
      .segmented-btn:first-child{border-radius:6px 0 0 6px}
      .segmented-btn:last-child{border-radius:0 6px 6px 0}
      .segmented-btn + .segmented-btn{border-left:none}
      .segmented-btn.active{background:#2c4a6e;border-color:#8ab4f8;color:#fff}
      .segmented-btn:hover:not(.active){background:rgba(138,180,248,0.08)}
      </style>
    HTML
  end
end
