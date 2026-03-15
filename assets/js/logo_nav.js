// NOTE: 全站 Logo 导航 — 动态注入固定定位的 CubeRoot logo，点击跳转首页
// 首页自动隐藏（无需跳转到自己）
(function () {
    // 首页不显示 logo
    if (location.pathname === '/' || location.pathname === '/index.html') return;

    var a = document.createElement('a');
    a.href = '/';
    a.setAttribute('aria-label', 'Home');

    // NOTE: 检测页面背景色亮度，自动选择合适的 logo
    // 深色背景用 CubeRoot-dark.png，浅色背景用 CubeRoot.png
    var bg = getComputedStyle(document.body).backgroundColor;
    var m = bg.match(/\d+/g);
    var isDark = m ? (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128 : false;
    var logoSrc = isDark ? '/CubeRoot-dark.png' : '/CubeRoot.png';
    a.style.cssText = [
        'position:fixed',
        'top:12px',
        'left:12px',
        'z-index:9999',
        'opacity:0.7',
        'transition:opacity 0.2s, transform 0.2s',
        'line-height:0',       // 消除 inline 元素底部间隙
    ].join(';');

    var img = document.createElement('img');
    img.src = logoSrc;
    img.alt = 'Home';
    img.style.cssText = 'width:36px;height:36px;border-radius:6px;';

    a.appendChild(img);

    a.addEventListener('mouseenter', function () {
        a.style.opacity = '1';
        a.style.transform = 'scale(1.1)';
    });
    a.addEventListener('mouseleave', function () {
        a.style.opacity = '0.7';
        a.style.transform = 'scale(1)';
    });

    document.body.appendChild(a);
})();
