// NOTE: 轻量级 i18n 引擎 — 纯前端运行时语言切换
// 通过 data-i18n 属性标记需要翻译的 HTML 元素，加载对应语言的 JSON 字典后替换文本
const I18n = {
    locale: 'en',
    dictionaries: {},       // { en: {...}, zh: {...} }
    _ready: false,
    _basePath: '',           // JSON 文件的基础路径，由 init 自动计算
    _observer: null,         // MutationObserver 实例

    // NOTE: WCA 项目名中英映射，用于 stats 表格数据的运行时翻译
    _eventZh: {
        "Rubik's Cube": "三阶魔方", "2x2x2 Cube": "二阶魔方",
        "4x4x4 Cube": "四阶魔方", "5x5x5 Cube": "五阶魔方",
        "6x6x6 Cube": "六阶魔方", "7x7x7 Cube": "七阶魔方",
        "3x3x3 Blindfolded": "三阶盲拧", "3x3x3 Fewest Moves": "三阶最少步",
        "3x3x3 One-Handed": "三阶单手", "Megaminx": "五魔方",
        "Pyraminx": "金字塔", "Rubik's Clock": "魔表",
        "Skewb": "斜转魔方", "Square-1": "SQ1",
        "4x4x4 Blindfolded": "四阶盲拧", "5x5x5 Blindfolded": "五阶盲拧",
        "3x3x3 Multi-Blind": "三阶多盲", "3x3x3 With Feet": "三阶脚拧",
        "Rubik's Magic": "八板", "Master Magic": "十二板",
        "Rubik's Cube: Multiple blind old style": "旧多盲",
    },
    // NOTE: 反向映射，用于切回英文时恢复原文
    _eventEn: {},

    // NOTE: 统计表头中英映射，用于 stats 表格 <th> 的运行时翻译
    _headerZh: {
        "Person": "选手", "Event": "项目", "Count": "次数",
        "Competition": "比赛", "Competitions": "比赛",
        "Date": "日期", "Single": "单次", "Average": "平均",
        "Rank": "排名", "Result": "成绩", "Details": "详情",
        "Started at": "开始于", "Ended at": "结束于",
        "DNF rate": "DNF 率", "DNFs": "DNF 次数", "Attempts": "尝试次数",
        "Gain": "提升", "Days": "天数",
        "Country": "国家", "Continent": "大洲", "Records": "纪录数",
        "Gold": "金牌", "Silver": "银牌", "Bronze": "铜牌", "Total": "总计",
        "Events": "项目数", "Competitions count": "比赛数",
        "List on WCA": "WCA 页面",
        "Year": "年份", "Years": "年数", "Week": "周",
        "Delegated": "代理数", "Delegated per year": "年均代理",
        "Streak": "连续", "Name": "姓名",
        "Parts": "词数", "First name": "名", "Last name": "姓",
        "Months": "月数", "Podiums": "登台", "Wins": "冠军",
    },
    _headerEn: {},

    // NOTE: Solver 页面 JS 会动态设置 textContent 的元素
    // 用 element ID → { en文本: zh文本 } 映射，MutationObserver 监听变化后自动翻译
    _dynamicTextZh: {
        "solveButton": { "Start": "开始", "Stop": "停止" },
        "summaryMaskOptions": {
            "Show Stickering Settings": "显示贴纸设置",
            "Hide Stickering Settings": "隐藏贴纸设置"
        }
    },
    _dynamicTextEn: {},   // 初始化时从 _dynamicTextZh 自动生成反向映射

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
        // 构建反向映射（中文 → 英文）
        for (const [en, zh] of Object.entries(this._eventZh)) {
            this._eventEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._headerZh)) {
            this._headerEn[zh] = en;
        }
        // 构建动态文本反向映射 { zh → en }
        for (const [id, map] of Object.entries(this._dynamicTextZh)) {
            this._dynamicTextEn[id] = {};
            for (const [en, zh] of Object.entries(map)) {
                this._dynamicTextEn[id][zh] = en;
            }
        }
        this._ready = true;
        this.apply();
        this._updateToggle();
        this._startObserver();
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
            if (!key) return;
            const translated = this.t(key);
            // NOTE: 翻译结果等于 key 本身说明字典中没有对应翻译，保留原文
            if (translated !== key) el.textContent = translated;
        });

        // placeholder 替换
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (!key) return;
            const translated = this.t(key);
            if (translated !== key) el.placeholder = translated;
        });

        // title 属性替换
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (!key) return;
            const translated = this.t(key);
            if (translated !== key) el.title = translated;
        });

        // NOTE: Stats 页面使用 data-i18n-en/zh 属性存储双语文本（由 Ruby 引擎生成）
        // 根据当前语言选择对应属性值进行替换，无需查字典
        document.querySelectorAll('[data-i18n-en][data-i18n-zh]').forEach(el => {
            const text = el.getAttribute(`data-i18n-${this.locale}`);
            if (text) el.textContent = text;
        });

        // NOTE: Stats 页面表格中的表头和 WCA 项目名运行时翻译
        if (this.locale === 'zh') {
            document.querySelectorAll('th').forEach(th => {
                const zh = this._headerZh[th.textContent.trim()];
                if (zh) th.textContent = zh;
            });
            document.querySelectorAll('td').forEach(td => {
                const zh = this._eventZh[td.textContent.trim()];
                if (zh) td.textContent = zh;
            });
        } else {
            // 切回英文时恢复原文——用反向映射
            document.querySelectorAll('th').forEach(th => {
                const en = this._headerEn[th.textContent.trim()];
                if (en) th.textContent = en;
            });
            document.querySelectorAll('td').forEach(td => {
                const en = this._eventEn[td.textContent.trim()];
                if (en) td.textContent = en;
            });
        }

        // NOTE: 翻译 JS 动态设置 textContent 的元素（如 Start/Stop 按钮）
        this._applyDynamicText();

        // HTML title 标签
        const titleEl = document.querySelector('title[data-i18n]');
        if (titleEl) {
            document.title = this.t(titleEl.getAttribute('data-i18n'));
        }
    },

    // NOTE: 对 _dynamicTextZh 中注册的元素进行翻译
    _applyDynamicText() {
        const map = this.locale === 'zh' ? this._dynamicTextZh : this._dynamicTextEn;
        for (const [id, textMap] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (!el) continue;
            const text = el.textContent.trim();
            if (textMap[text]) {
                el.textContent = textMap[text];
            }
        }
    },

    // NOTE: MutationObserver — 监听 _dynamicTextZh 注册的元素的 textContent 变化
    // 当 JS 代码（如 solver 页面）动态修改文本时，自动翻译为当前语言
    _startObserver() {
        if (this._observer) return;  // 防止重复注册
        this._observer = new MutationObserver(mutations => {
            if (!this._ready || this.locale === 'en') return;
            for (const m of mutations) {
                // 只处理 characterData（文本节点变化）或 childList（子节点替换）
                const el = m.target.nodeType === Node.TEXT_NODE ? m.target.parentElement : m.target;
                if (!el || !el.id) continue;
                const textMap = this._dynamicTextZh[el.id];
                if (!textMap) continue;
                const text = el.textContent.trim();
                if (textMap[text]) {
                    // HACK: 暂时断开 observer 避免无限递归
                    this._observer.disconnect();
                    el.textContent = textMap[text];
                    this._observeTargets();
                }
            }
        });
        this._observeTargets();
    },

    // NOTE: 对所有动态翻译目标元素注册 observer
    _observeTargets() {
        for (const id of Object.keys(this._dynamicTextZh)) {
            const el = document.getElementById(id);
            if (el) {
                this._observer.observe(el, {
                    childList: true,
                    characterData: true,
                    subtree: true
                });
            }
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
