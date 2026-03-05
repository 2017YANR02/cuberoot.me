---
title: "Recon - Detail"
layout: default
---

<link rel="stylesheet" href="/recon/recon.css">

<!-- NOTE: 详情页头部：返回按钮 + 标题 -->
<div class="detail-page-header">
    <a href="/recon/" class="detail-back-link" data-i18n-en="← Back to List" data-i18n-zh="← 返回列表">← Back to List</a>
    <h1 id="detail-title"></h1>
</div>

<!-- NOTE: 详情内容容器（JS 动态渲染） -->
<div id="detail-container">
    <div style="text-align:center;color:#888;padding:40px">Loading...</div>
</div>

<!-- NOTE: cubing/twisty 3D 动画播放器（懒加载，同列表页） -->
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

<script src="/recon/recon_stats.js"></script>
<script src="/recon/wca_auth.js"></script>
<script src="/recon/recon_api.js"></script>
<script src="/recon/recon_utils.js"></script>
<script src="/recon/recon_alg_utils.js"></script>
<script src="/recon/detail/recon_detail.js" defer></script>
