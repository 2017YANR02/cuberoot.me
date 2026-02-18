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
        "Months": "月数", "Podiums": "登上领奖台", "Wins": "冠军",
        "First single": "首次单次", "First average": "首次平均",
        "Attempt 1": "尝试 1", "Attempt 2": "尝试 2", "Attempt 3": "尝试 3",
        "Counting": "有效次数", "Diff": "差值",
        "Start date": "开始日期", "End date": "结束日期",
        "Competitors": "参赛人数", "Solves": "完成次数",
        "People": "人数", "Place": "名次",
        "Competitions per year": "年均比赛", "Average event count": "平均项目数",
        "Events count": "项目数", "Finals": "决赛次数",
        "Continents": "大洲数", "Countries": "国家数",
        "Dates": "日期数", "Distance": "距离",
        "4th places": "第四名次数", "Moving average": "移动平均",
        "Mean": "平均", "Month": "月份", "Missed": "错过",
        "Results": "成绩数", "List": "列表",
        "Week start": "周起始", "Week end": "周结束",
        "Winned weeks": "获胜周数", "WRs": "世界纪录",
        "Type": "类型", "First win": "首次夺冠",
        "Countries of origin": "来源国家", "Citizen of": "国籍",
        "Region": "地区",
    },
    _headerEn: {},

    // NOTE: Solver/2x2x2 页面 JS 会动态设置 textContent 的元素
    // 用 element ID → { en文本: zh文本 } 映射，MutationObserver 监听变化后自动翻译
    _dynamicTextZh: {
        "solveButton": { "Start": "开始", "Stop": "停止", "End": "结束" },
        "summaryMaskOptions": {
            "Show Stickering Settings": "显示贴纸设置",
            "Hide Stickering Settings": "隐藏贴纸设置"
        },
        "summary_cubeUI": {
            "Show Cube Editor": "显示魔方编辑器",
            "Hide Cube Editor": "隐藏魔方编辑器"
        },
        "summary_preview": {
            "Show Preview": "显示预览",
            "Hide Preview": "隐藏预览"
        },
        "summaryAdvancedSettings": {
            "Show Advanced Settings": "显示高级设置",
            "Hide Advanced Settings": "隐藏高级设置"
        }
    },
    _dynamicTextEn: {},   // 初始化时从 _dynamicTextZh 自动生成反向映射

    // NOTE: Stats 页面标题映射（h2），用于运行时翻译
    _statsTitleZh: {
        "Average event count by competition": "每场比赛平均项目数",
        "Average of 100": "100 次平均", "Average of 12": "12 次平均",
        "Average of 25": "25 次平均", "Average of 5": "5 次平均",
        "Average of 50": "50 次平均",
        "Best first average": "最佳首次平均", "Best first single": "最佳首次单次",
        "Best medal collection from abroad by country": "各国海外奖牌最佳收藏",
        "Best medal collection from abroad by person": "个人海外奖牌最佳收藏",
        "Best potential FMC mean": "最佳潜在 FMC 平均",
        "Best result not providing a podium": "未登上领奖台的最佳成绩",
        "Best single counting into an average of 5": "计入 Ao5 的最佳单次",
        "Competition days count by region": "各地区比赛天数",
        "Competitions count by week": "每周比赛数",
        "Competitions per year by country": "各国年均比赛数",
        "Competitions per year by person": "个人年均比赛数",
        "Complete competition winners": "全项目冠军",
        "Current world records count by country": "各国现有世界纪录数",
        "Delegated competitions per year": "年均代理比赛数",
        "Fewest competitors contest": "参赛人数最少的比赛",
        "Longest competitions path": "最长比赛路径",
        "Longest standing records": "保持时间最长的纪录",
        "Longest streak of competitions in own country": "本国连续参赛最长纪录",
        "Longest streak of competitions with a personal record done": "连续刷新个人纪录最长纪录",
        "Longest streak of podiums": "连续登上领奖台最长纪录",
        "Longest streak of world records of the same type in the given event": "同一项目同类型连续世界纪录",
        "Longest time to achieve sub 10 3x3x3 average": "达成三阶 Sub10 平均耗时最长",
        "Most 4th places": "最多第四名",
        "Most attended competitions in a single month": "单月参赛最多",
        "Most attended competitions in a single week": "单周参赛最多",
        "Most competitions abroad": "海外参赛最多",
        "Most competitions before winning": "夺冠前参赛最多",
        "Most completed solves": "完成还原次数最多",
        "Most delegated competitions": "代理比赛最多",
        "Most distinct dates competed on": "不同参赛日期最多",
        "Most finals": "最多决赛", "Most frequent results": "最常见成绩",
        "Most podiums at a single competition": "单场比赛登台最多",
        "Most podiums together": "共同登台最多",
        "Most records at a single competition": "单场比赛破纪录最多",
        "Most solves before getting a successful BLD attempt": "盲拧首次成功前尝试次数最多",
        "Most visited continents": "到访大洲最多",
        "Most visited countries": "到访国家最多",
        "Moving average": "移动平均", "Name parts count": "名字词数",
        "Potentially seen world records": "可能见证的世界纪录",
        "Records in the highest number of events": "破纪录涉及项目最多",
        "Shortest amount of time to reach a milestone in competitions count": "达到比赛数里程碑最短时间",
        "Shortest time to get all singles": "获得所有单次最短时间",
        "Shortest time to get all singles and averages": "获得所有单次和平均最短时间",
        "Smallest difference between a single and an average": "单次与平均最小差值",
        "Winned week count": "周冠军次数",
        "World Championship podiums by country": "世锦赛各国登台统计",
        "World Championship podiums by person": "世锦赛个人登台统计",
        "World Championship records": "世锦赛纪录",
        "World records count by country": "各国世界纪录总数",
        "World records count by person": "个人世界纪录总数",
        "Worst result providing a podium": "登上领奖台的最差成绩",
        "Yearly rankings": "年度排名",
    },
    _statsTitleEn: {},

    // NOTE: Stats 页面描述映射（em/斜体文本），用于运行时翻译
    _statsDescZh: {
        "Note: In other words, average number of events competitors participated in.": "注：即选手平均参加了多少个项目。",
        "Note: 100 consecutive official attempts are considered. Only people from top 200 single are taken into account.": "注：取连续 100 次官方尝试的平均。仅考虑单次排名前 200 的选手。",
        "Note: 12 consecutive official attempts are considered. Only people from top 200 single are taken into account.": "注：取连续 12 次官方尝试的平均。仅考虑单次排名前 200 的选手。",
        "Note: 25 consecutive official attempts are considered. Only people from top 200 single are taken into account.": "注：取连续 25 次官方尝试的平均。仅考虑单次排名前 200 的选手。",
        "Note: 5 consecutive official attempts are considered. Only people from top 200 single are taken into account.": "注：取连续 5 次官方尝试的平均。仅考虑单次排名前 200 的选手。",
        "Note: 50 consecutive official attempts are considered. Only people from top 200 single are taken into account.": "注：取连续 50 次官方尝试的平均。仅考虑单次排名前 200 的选手。",
        "Note: In other words, it's the best average done when participating for the first time in the given event.": "注：即选手首次参加该项目时做出的最佳平均成绩。",
        "Note: In other words, it's the best first time done when participating for the first time in the given event.": "注：即选手首次参加该项目时做出的最佳单次成绩。",
        "Note: Only medals got abroad are taken into account.": "注：仅统计在海外获得的奖牌。",
        "Note: The means are computed by taking the best result for each attempt in the given round.": "注：平均值由每轮中每次尝试的最佳成绩计算得出。",
        "Note: Only finals are taken into account.": "注：仅统计决赛成绩。",
        "Note: Week is considered to start on Monday and end on Sunday.": "注：每周从周一开始，周日结束。",
        "Note: A complete win means taking the first place in every event on the given competition.": "注：完全获胜指在比赛的每个项目中均获得第一名。",
        "Note: Only delegates with at least 5 competitions are taken into account.": "注：仅统计至少代理过 5 场比赛的代表。",
        "Note: Calculated as the sum of direct distance between subsequent competitions.": "注：计算方式为相邻比赛之间直线距离的总和。",
        "Note: The streak ends whenever the person doesn't participate in a competition in own country.": "注：选手未在本国参加比赛时，连续记录终止。",
        "Note: All competitions that did not hold the given event are ignored. Results without any completed attempt are not eligible for podium. Only finals are taken into account.": "注：未举办该项目的比赛不计入。没有完成的尝试不具备登台资格。仅统计决赛。",
        "Note: Only those competitions count, which held the given event.": "注：仅统计举办了该项目的比赛。",
        "Note: Local names within parentheses are ignored.": "注：括号内的本地姓名不计入。",
        "Note: Potentially means that a person was on a competition and could see a world record being set.": "注：「可能见证」指该选手在比赛现场，有可能亲眼看到世界纪录的诞生。",
        "Note: All historical records are taken into account (i.e. not only the current ones).": "注：统计所有历史纪录（不仅限于当前纪录）。",
        "Note: Only current official events are taken into account.": "注：仅统计当前官方项目。",
        "Note: FMC is ignored because values are integers, thus it's likely to get the same single and average.": "注：FMC 不计入，因为其成绩为整数，单次和平均很可能相同。",
        "Note: In other words it's the number of weeks when the given person got the fastest single in the given event.": "注：即该选手在某项目中获得当周最快单次的周数。",
        "Note: This is a list of the best results from all World Championships. It corresponds to Olympic records for Olympic sports.": "注：这是历届世锦赛最佳成绩列表，类似于奥运会项目的奥运纪录。",
        "Note: Only finals are taken into account. Results where the main statistic is DNF are ignored.": "注：仅统计决赛。主成绩为 DNF 的结果不计入。",
        "Note: You may think of it as \"how well the given person has been doing recently\".": "注：可理解为「该选手近期表现如何」。",
        "Note: By definition these rankings include only results from the current year.": "注：按定义，此排名仅包含当年的成绩。",
    },
    _statsDescEn: {},

    // NOTE: 国家/地区英文名 → 中文名映射，用于 stats 表格中 Region/Country 列的翻译
    _countryZh: {
        "Afghanistan": "阿富汗", "Albania": "阿尔巴尼亚", "Algeria": "阿尔及利亚",
        "Andorra": "安道尔", "Angola": "安哥拉", "Antigua and Barbuda": "安提瓜和巴布达",
        "Argentina": "阿根廷", "Armenia": "亚美尼亚", "Aruba": "阿鲁巴",
        "Australia": "澳大利亚", "Austria": "奥地利", "Azerbaijan": "阿塞拜疆",
        "Bahamas": "巴哈马", "Bahrain": "巴林", "Bangladesh": "孟加拉国",
        "Barbados": "巴巴多斯", "Belarus": "白俄罗斯", "Belgium": "比利时",
        "Belize": "伯利兹", "Benin": "贝宁", "Bhutan": "不丹",
        "Bolivia": "玻利维亚", "Bosnia and Herzegovina": "波黑",
        "Botswana": "博茨瓦纳", "Brazil": "巴西", "Brunei": "文莱",
        "Bulgaria": "保加利亚", "Burkina Faso": "布基纳法索",
        "Cambodia": "柬埔寨", "Cameroon": "喀麦隆", "Canada": "加拿大",
        "Chad": "乍得", "Chile": "智利", "China": "中国",
        "Chinese Taipei": "中国台湾", "Colombia": "哥伦比亚",
        "Costa Rica": "哥斯达黎加", "Croatia": "克罗地亚", "Cuba": "古巴",
        "Cyprus": "塞浦路斯", "Czech Republic": "捷克",
        "Democratic Republic of the Congo": "刚果(金)",
        "Denmark": "丹麦", "Dominica": "多米尼克",
        "Dominican Republic": "多米尼加", "Ecuador": "厄瓜多尔",
        "Egypt": "埃及", "El Salvador": "萨尔瓦多", "Estonia": "爱沙尼亚",
        "Ethiopia": "埃塞俄比亚", "Fiji": "斐济", "Finland": "芬兰",
        "France": "法国", "Gabon": "加蓬", "Gambia": "冈比亚",
        "Georgia": "格鲁吉亚", "Germany": "德国", "Ghana": "加纳",
        "Greece": "希腊", "Grenada": "格林纳达", "Guatemala": "危地马拉",
        "Guinea": "几内亚", "Guyana": "圭亚那", "Haiti": "海地",
        "Honduras": "洪都拉斯", "Hong Kong, China": "中国香港",
        "Hungary": "匈牙利", "Iceland": "冰岛", "India": "印度",
        "Indonesia": "印度尼西亚", "Iran": "伊朗", "Iraq": "伊拉克",
        "Ireland": "爱尔兰", "Israel": "以色列", "Italy": "意大利",
        "Jamaica": "牙买加", "Japan": "日本", "Jordan": "约旦",
        "Kazakhstan": "哈萨克斯坦", "Kenya": "肯尼亚", "Kosovo": "科索沃",
        "Kuwait": "科威特", "Kyrgyzstan": "吉尔吉斯斯坦",
        "Laos": "老挝", "Latvia": "拉脱维亚", "Lebanon": "黎巴嫩",
        "Lesotho": "莱索托", "Liberia": "利比里亚", "Libya": "利比亚",
        "Lithuania": "立陶宛", "Luxembourg": "卢森堡",
        "Macau, China": "中国澳门", "Madagascar": "马达加斯加",
        "Malawi": "马拉维", "Malaysia": "马来西亚", "Mali": "马里",
        "Malta": "马耳他", "Mauritius": "毛里求斯", "Mexico": "墨西哥",
        "Moldova": "摩尔多瓦", "Mongolia": "蒙古", "Montenegro": "黑山",
        "Morocco": "摩洛哥", "Mozambique": "莫桑比克", "Myanmar": "缅甸",
        "Namibia": "纳米比亚", "Nepal": "尼泊尔", "Netherlands": "荷兰",
        "New Caledonia": "新喀里多尼亚", "New Zealand": "新西兰",
        "Nicaragua": "尼加拉瓜", "Niger": "尼日尔", "Nigeria": "尼日利亚",
        "North Macedonia": "北马其顿", "Norway": "挪威",
        "Oman": "阿曼", "Pakistan": "巴基斯坦", "Palestine": "巴勒斯坦",
        "Panama": "巴拿马", "Papua New Guinea": "巴布亚新几内亚",
        "Paraguay": "巴拉圭", "Peru": "秘鲁", "Philippines": "菲律宾",
        "Poland": "波兰", "Portugal": "葡萄牙", "Puerto Rico": "波多黎各",
        "Qatar": "卡塔尔", "Republic of Korea": "韩国",
        "Romania": "罗马尼亚", "Russia": "俄罗斯", "Rwanda": "卢旺达",
        "Saint Kitts and Nevis": "圣基茨和尼维斯",
        "Saint Lucia": "圣卢西亚", "Samoa": "萨摩亚",
        "Saudi Arabia": "沙特阿拉伯", "Senegal": "塞内加尔",
        "Serbia": "塞尔维亚", "Sierra Leone": "塞拉利昂",
        "Singapore": "新加坡", "Slovakia": "斯洛伐克", "Slovenia": "斯洛文尼亚",
        "Solomon Islands": "所罗门群岛", "South Africa": "南非",
        "South Sudan": "南苏丹", "Spain": "西班牙", "Sri Lanka": "斯里兰卡",
        "Sudan": "苏丹", "Suriname": "苏里南", "Sweden": "瑞典",
        "Switzerland": "瑞士", "Syria": "叙利亚",
        "Tajikistan": "塔吉克斯坦", "Tanzania": "坦桑尼亚",
        "Thailand": "泰国", "Togo": "多哥", "Tonga": "汤加",
        "Trinidad and Tobago": "特立尼达和多巴哥", "Tunisia": "突尼斯",
        "Turkey": "土耳其", "Turkmenistan": "土库曼斯坦",
        "Uganda": "乌干达", "Ukraine": "乌克兰",
        "United Arab Emirates": "阿联酋", "United Kingdom": "英国",
        "United States": "美国", "Uruguay": "乌拉圭",
        "Uzbekistan": "乌兹别克斯坦", "Vanuatu": "瓦努阿图",
        "Venezuela": "委内瑞拉", "Vietnam": "越南", "Yemen": "也门",
        "Zimbabwe": "津巴布韦",
        "Africa": "非洲", "Asia": "亚洲", "Europe": "欧洲",
        "North America": "北美洲", "South America": "南美洲",
        "Oceania": "大洋洲", "World": "世界",
        "Multiple Continents": "多大洲",
    },
    _countryEn: {},

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
        // 构建国家名反向映射
        for (const [en, zh] of Object.entries(this._countryZh)) {
            this._countryEn[zh] = en;
        }
        // 构建 stats 标题和描述的反向映射
        for (const [en, zh] of Object.entries(this._statsTitleZh)) {
            this._statsTitleEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._statsDescZh)) {
            this._statsDescEn[zh] = en;
        }
        // 构建动态文本反向映射 { zh → en }
        for (const [id, map] of Object.entries(this._dynamicTextZh)) {
            this._dynamicTextEn[id] = {};
            for (const [en, zh] of Object.entries(map)) {
                this._dynamicTextEn[id][zh] = en;
            }
        }
        // NOTE: 自动注入语言切换按钮（如果页面中还没有）
        this._injectToggle();
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

        // NOTE: 翻译 select option 中的 "None" 文本
        // 这些 option 带有 translate="no" 且 value=""，是各下拉框的默认选项
        document.querySelectorAll('select option[value=""]').forEach(opt => {
            const text = opt.textContent.trim();
            if (this.locale === 'zh' && text === 'None') {
                opt.textContent = '无';
            } else if (this.locale === 'en' && text === '无') {
                opt.textContent = 'None';
            }
        });

        // NOTE: Stats 页面 h2 标题翻译
        if (this.locale === 'zh') {
            document.querySelectorAll('h2').forEach(h2 => {
                const zh = this._statsTitleZh[h2.textContent.trim()];
                if (zh) h2.textContent = zh;
            });
        } else {
            document.querySelectorAll('h2').forEach(h2 => {
                const en = this._statsTitleEn[h2.textContent.trim()];
                if (en) h2.textContent = en;
            });
        }

        // NOTE: Stats 页面 h3 项目名翻译（复用 _eventZh 映射）
        if (this.locale === 'zh') {
            document.querySelectorAll('h3').forEach(h3 => {
                const zh = this._eventZh[h3.textContent.trim()];
                if (zh) h3.textContent = zh;
            });
        } else {
            document.querySelectorAll('h3').forEach(h3 => {
                const en = this._eventEn[h3.textContent.trim()];
                if (en) h3.textContent = en;
            });
        }

        // NOTE: Stats 页面国家/地区名翻译（td 中的 Region/Country 列）
        if (this.locale === 'zh') {
            document.querySelectorAll('td').forEach(td => {
                const zh = this._countryZh[td.textContent.trim()];
                if (zh) td.textContent = zh;
            });
        } else {
            document.querySelectorAll('td').forEach(td => {
                const en = this._countryEn[td.textContent.trim()];
                if (en) td.textContent = en;
            });
        }

        // NOTE: Stats 页面描述翻译（em 元素内的斜体文本）
        if (this.locale === 'zh') {
            document.querySelectorAll('em').forEach(em => {
                const text = em.textContent.trim();
                const zh = this._statsDescZh[text];
                if (zh) em.textContent = zh;
            });
        } else {
            document.querySelectorAll('em').forEach(em => {
                const text = em.textContent.trim();
                const en = this._statsDescEn[text];
                if (en) em.textContent = en;
            });
        }

        // NOTE: Stats 页面 "Updated on" 日期翻译
        if (this.locale === 'zh') {
            const _months = {January:'1',February:'2',March:'3',April:'4',May:'5',June:'6',July:'7',August:'8',September:'9',October:'10',November:'11',December:'12'};
            document.querySelectorAll('em').forEach(em => {
                const text = em.textContent.trim();
                const m = text.match(/^Updated on (\d+) (\w+) (\d+)$/);
                if (m) em.textContent = `更新于 ${m[3]} 年 ${_months[m[2]] || m[2]} 月 ${m[1]} 日`;
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

    // NOTE: 自动注入固定在右下角的语言切换按钮
    // 如果页面中已有 .lang-toggle（如 index.html），则跳过
    _injectToggle() {
        if (document.querySelector('[data-i18n-toggle]')) return;

        // 注入样式
        const style = document.createElement('style');
        style.textContent = `
            .lang-toggle-fixed {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 9999;
                display: inline-flex;
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid #444;
                background: rgba(20, 20, 30, 0.85);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
            .lang-toggle-fixed button {
                background: transparent;
                border: none;
                color: #777;
                padding: 5px 10px;
                font-size: 0.8rem;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
            }
            .lang-toggle-fixed button.active {
                background: rgba(100, 100, 180, 0.3);
                color: #fff;
            }
            .lang-toggle-fixed button:hover:not(.active) {
                color: #aaa;
            }
        `;
        document.head.appendChild(style);

        // 注入按钮
        const container = document.createElement('div');
        container.className = 'lang-toggle-fixed';
        const btnEn = document.createElement('button');
        btnEn.setAttribute('data-i18n-toggle', 'en');
        btnEn.textContent = 'EN';
        btnEn.onclick = () => this.setLocale('en');
        const btnZh = document.createElement('button');
        btnZh.setAttribute('data-i18n-toggle', 'zh');
        btnZh.textContent = '中文';
        btnZh.onclick = () => this.setLocale('zh');
        container.appendChild(btnEn);
        container.appendChild(btnZh);
        document.body.appendChild(container);
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
