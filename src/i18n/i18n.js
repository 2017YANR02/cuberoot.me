// NOTE: 轻量级 i18n 引擎 — 纯前端运行时语言切换
// 通过 data-i18n 属性标记需要翻译的 HTML 元素，加载对应语言的 JSON 字典后替换文本
const I18n = {
    locale: 'en',
    dictionaries: {},       // { en: {...}, zh: {...} }
    _ready: false,
    _basePath: '',           // JSON 文件的基础路径，由 init 自动计算

    // NOTE: 初始化入口 — 自动检测语言、加载字典、应用翻译
    async init() {
        this._basePath = this._detectBasePath();
        // 优先级: localStorage > navigator.language > 默认 en
        const saved = localStorage.getItem('i18n_locale');
        if (saved && (saved === 'en' || saved === 'zh')) {
            this.locale = saved;
        } else if (navigator.language && navigator.language.startsWith('zh')) {
            this.locale = 'zh';
        }
        // 并行加载两种语言的字典
        await Promise.all([this._loadDict('en'), this._loadDict('zh')]);
        this._ready = true;
        this.apply();
        this._updateToggle();
    },

    // NOTE: 根据当前脚本的路径推断 JSON 文件所在目录
    _detectBasePath() {
        const scripts = document.querySelectorAll('script[src]');
        for (const s of scripts) {
            if (s.src.includes('i18n/i18n.js')) {
                return s.src.replace('i18n.js', '');
            }
        }
        // fallback: 相对路径
        return 'src/i18n/';
    },

    async _loadDict(lang) {
        if (this.dictionaries[lang]) return;
        try {
            const resp = await fetch(`${this._basePath}${lang}.json`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this.dictionaries[lang] = await resp.json();
        } catch (e) {
            console.warn(`[i18n] Failed to load ${lang}.json:`, e.message);
            this.dictionaries[lang] = {};
        }
    },

    // NOTE: 切换语言并更新页面
    setLocale(lang) {
        if (lang !== 'en' && lang !== 'zh') return;
        this.locale = lang;
        localStorage.setItem('i18n_locale', lang);
        this.apply();
        this._updateToggle();
    },

    // NOTE: 用点分 key（如 "solver.label"）查字典，支持嵌套
    t(key) {
        const dict = this.dictionaries[this.locale] || {};
        const parts = key.split('.');
        let val = dict;
        for (const p of parts) {
            if (val && typeof val === 'object' && p in val) {
                val = val[p];
            } else {
                return key; // fallback: 返回 key 本身
            }
        }
        return typeof val === 'string' ? val : key;
    },

    // NOTE: 遍历所有 data-i18n 元素，替换 textContent
    // 支持两种模式:
    //   data-i18n="key"           → 替换 textContent
    //   data-i18n-placeholder="key" → 替换 placeholder 属性
    //   data-i18n-title="key"    → 替换 title 属性
    apply() {
        if (!this._ready) return;

        // textContent 替换
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = this.t(key);
        });

        // placeholder 替换
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.placeholder = this.t(key);
        });

        // title 属性替换
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.title = this.t(key);
        });

        // HTML title 标签
        const titleEl = document.querySelector('title[data-i18n]');
        if (titleEl) {
            document.title = this.t(titleEl.getAttribute('data-i18n'));
        }
    },

    // NOTE: 更新语言切换按钮的高亮状态
    _updateToggle() {
        document.querySelectorAll('[data-i18n-toggle]').forEach(btn => {
            const lang = btn.getAttribute('data-i18n-toggle');
            btn.classList.toggle('active', lang === this.locale);
        });
    },

    // NOTE: 切换到另一种语言（toggle）
    toggle() {
        this.setLocale(this.locale === 'en' ? 'zh' : 'en');
    }
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
    I18n.init();
}

// 暴露到全局
window.I18n = I18n;
