/**
 * WCA OAuth2 认证模块
 * 功能：Implicit Grant 流程 → 获取 WCA 用户身份（ID、姓名、头像）
 * NOTE: 使用 implicit grant（response_type=token）避免 CORS 问题
 */
var WcaAuth = (function () {
    'use strict';

    // NOTE: WCA OAuth 配置（implicit grant 不需要 client_secret）
    var CONFIG = {
        clientId: 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4',
        authorizeUrl: 'https://www.worldcubeassociation.org/oauth/authorize',
        meUrl: 'https://www.worldcubeassociation.org/api/v0/me',
        scope: 'public',
        // NOTE: 根据当前域名自动构建回调地址（支持 github.io / toolkit.cuberoot.me / localhost）
        redirectUri: window.location.origin + '/recon/callback.html'
    };

    var SESSION_KEY = 'wca_user';
    var STATE_KEY = 'wca_oauth_state';

    // ==================== 登录 ====================

    /** 跳转到 WCA 授权页（implicit grant，token 直接通过 URL hash 返回） */
    function login() {
        var state = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem(STATE_KEY, state);

        var params = [
            'client_id=' + encodeURIComponent(CONFIG.clientId),
            'redirect_uri=' + encodeURIComponent(CONFIG.redirectUri),
            'response_type=token',
            'scope=' + encodeURIComponent(CONFIG.scope),
            'state=' + encodeURIComponent(state)
        ].join('&');

        window.location.href = CONFIG.authorizeUrl + '?' + params;
    }

    /**
     * 切换账号：清除本地 session → 跳转 WCA 登出 → 自动重新登录
     * NOTE: WCA OAuth (Doorkeeper) 无 prompt=login 参数，已登录的 WCA session
     *       会自动授权同一账号。必须先清除 WCA session 才能登录其他账号。
     *       由于 WCA (Devise) 的 sign_out 需要 DELETE 方法且存在跨域限制，
     *       我们在新窗口打开 WCA 官网让用户手动登出，然后本页自动触发重新登录。
     */
    function switchAccount() {
        logout();
        // NOTE: 在新标签页打开 WCA 官网，用户可在那里登出当前账号
        window.open('https://www.worldcubeassociation.org', '_blank');
        // NOTE: 设置标记 + 刷新页面，页面加载后显示 Login 按钮
        //       用户在 WCA 登出后，回到本页点击 Login 即可用新账号登录
        location.reload();
    }

    // ==================== 回调处理 ====================

    /**
     * 从 URL hash 解析 access_token，获取用户信息
     * NOTE: implicit grant 的 token 在 URL fragment（#）中，不经过服务端
     */
    function handleCallback() {
        var hash = window.location.hash.substring(1);
        var params = new URLSearchParams(hash);
        var accessToken = params.get('access_token');
        var state = params.get('state');

        // NOTE: 验证 state 防 CSRF
        var savedState = sessionStorage.getItem(STATE_KEY);
        if (!savedState || savedState !== state) {
            return Promise.reject(new Error('OAuth state mismatch'));
        }
        sessionStorage.removeItem(STATE_KEY);

        if (!accessToken) {
            return Promise.reject(new Error('No access_token in callback'));
        }

        return fetchMe(accessToken);
    }

    /** 调用 WCA API 获取用户信息 */
    function fetchMe(accessToken) {
        return fetch(CONFIG.meUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken },
            cache: 'no-store'
        })
            .then(function (res) {
                if (!res.ok) throw new Error('WCA /me failed: ' + res.status);
                return res.json();
            })
            .then(function (data) {
                var me = data.me;
                var user = {
                    wcaId: me.wca_id,
                    name: me.name,
                    avatar: me.avatar && me.avatar.thumb_url ? me.avatar.thumb_url : '',
                    country: me.country_iso2 || ''
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
                return user;
            });
    }

    // ==================== 会话管理 ====================

    function getUser() {
        try {
            var data = sessionStorage.getItem(SESSION_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('wca_access_token');
    }

    function isLoggedIn() {
        return getUser() !== null;
    }

    // NOTE: 管理员 WCA ID 列表（前端硬编码，仅控制 UI 显示）
    var ADMIN_WCA_IDS = ['2017YANR02'];

    function isAdmin() {
        var user = getUser();
        return user !== null && ADMIN_WCA_IDS.indexOf(user.wcaId) >= 0;
    }

    return {
        login: login,
        switchAccount: switchAccount,
        handleCallback: handleCallback,
        getUser: getUser,
        getAccessToken: function () {
            return sessionStorage.getItem('wca_access_token') || '';
        },
        logout: logout,
        isLoggedIn: isLoggedIn,
        isAdmin: isAdmin
    };
})();

