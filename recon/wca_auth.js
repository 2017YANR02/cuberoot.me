/**
 * NOTE: wca_auth.js 已迁移到根目录 /wca_auth.js
 * 此文件保留仅为向后兼容，动态加载新路径
 */
(function() {
    'use strict';
    if (typeof WcaAuth !== 'undefined') return; // 已加载则跳过
    var s = document.createElement('script');
    s.src = '/wca_auth.js';
    document.head.appendChild(s);
})();
