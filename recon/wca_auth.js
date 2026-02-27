/**
 * WCA OAuth2 认证模块
 * 功能：Authorization Code 流程 → 获取 WCA 用户身份（ID、姓名、头像）
 */
var WcaAuth = (function () {
    'use strict';

    // NOTE: WCA OAuth 配置
    var CONFIG = {
        clientId: 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4',
        clientSecret: 'VWuxOldakkxcI-Tl7koalES5ir_Xw_y5bUw38N-mJ-Y',
        authorizeUrl: 'https://www.worldcubeassociation.org/oauth/authorize',
        tokenUrl: 'https://www.worldcubeassociation.org/oauth/token',
        meUrl: 'https://www.worldcubeassociation.org/api/v0/me',
        scope: 'public',
        // NOTE: 根据当前域名自动选择回调地址
        redirectUri: window.location.hostname === 'localhost'
            ? 'http://localhost:4000/recon/callback.html'
            : 'https://ruiminyan.github.io/recon/callback.html'
    };

    var SESSION_KEY = 'wca_user';
    var STATE_KEY = 'wca_oauth_state';

    // ==================== 登录 ====================

    /** 跳转到 WCA 授权页 */
    function login() {
        // NOTE: 生成随机 state 防 CSRF
        var state = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem(STATE_KEY, state);

        var params = [
            'client_id=' + encodeURIComponent(CONFIG.clientId),
            'redirect_uri=' + encodeURIComponent(CONFIG.redirectUri),
            'response_type=code',
            'scope=' + encodeURIComponent(CONFIG.scope),
            'state=' + encodeURIComponent(state)
        ].join('&');

        window.location.href = CONFIG.authorizeUrl + '?' + params;
    }

    // ==================== 回调处理 ====================

    /** 用 authorization code 换取 access_token，再获取用户信息 */
    function handleCallback(code, state) {
        // NOTE: 验证 state 防 CSRF
        var savedState = sessionStorage.getItem(STATE_KEY);
        if (!savedState || savedState !== state) {
            return Promise.reject(new Error('OAuth state mismatch'));
        }
        sessionStorage.removeItem(STATE_KEY);

        // NOTE: 用 code 换 token
        var body = [
            'grant_type=authorization_code',
            'code=' + encodeURIComponent(code),
            'client_id=' + encodeURIComponent(CONFIG.clientId),
            'client_secret=' + encodeURIComponent(CONFIG.clientSecret),
            'redirect_uri=' + encodeURIComponent(CONFIG.redirectUri)
        ].join('&');

        return fetch(CONFIG.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Token exchange failed: ' + res.status);
                return res.json();
            })
            .then(function (tokenData) {
                return fetchMe(tokenData.access_token);
            })
            .then(function (user) {
                // NOTE: 持久化用户信息到 sessionStorage
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
                return user;
            });
    }

    /** 调用 WCA API 获取用户信息 */
    function fetchMe(accessToken) {
        return fetch(CONFIG.meUrl, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        })
            .then(function (res) {
                if (!res.ok) throw new Error('WCA /me failed: ' + res.status);
                return res.json();
            })
            .then(function (data) {
                var me = data.me;
                return {
                    wcaId: me.wca_id,
                    name: me.name,
                    avatar: me.avatar && me.avatar.thumb_url ? me.avatar.thumb_url : '',
                    country: me.country_iso2 || ''
                };
            });
    }

    // ==================== 会话管理 ====================

    /** 获取当前登录用户，未登录返回 null */
    function getUser() {
        try {
            var data = sessionStorage.getItem(SESSION_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /** 登出 */
    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    /** 是否已登录 */
    function isLoggedIn() {
        return getUser() !== null;
    }

    // NOTE: 导出公共 API
    return {
        login: login,
        handleCallback: handleCallback,
        getUser: getUser,
        logout: logout,
        isLoggedIn: isLoggedIn
    };
})();
