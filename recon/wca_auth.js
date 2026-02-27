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
        // NOTE: 根据当前域名自动选择回调地址
        redirectUri: window.location.hostname === 'localhost'
            ? 'http://localhost:4000/recon/callback.html'
            : 'https://ruiminyan.github.io/recon/callback.html'
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
            headers: { 'Authorization': 'Bearer ' + accessToken }
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
    }

    function isLoggedIn() {
        return getUser() !== null;
    }

    return {
        login: login,
        handleCallback: handleCallback,
        getUser: getUser,
        logout: logout,
        isLoggedIn: isLoggedIn
    };
})();
