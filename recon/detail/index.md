---
title: "Recon - Detail"
layout: default
---

<link rel="stylesheet" href="/recon/recon.css">

<!-- NOTE: 详情页头部：返回按钮 + 标题 + WCA 登录 -->
<div class="detail-page-header">
    <a href="/recon/" class="detail-back-link"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></a>
    <h1 id="detail-title"></h1>
    <!-- NOTE: WCA 登录区域（和列表页一致） -->
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
