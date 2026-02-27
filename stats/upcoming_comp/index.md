---
layout: default
title: Upcoming Comps - Top Cubers
description: Track upcoming WCA competitions of the world's top cubers.
---

<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/stats_ui.css">
<style>
/* ── 时间轴与卡片专属样式 ────────────────────────────── */
#upcoming-comps-container {
    max-width: 800px;
    margin: 20px auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.timeline-header {
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(138, 180, 248, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

.timeline-header h1 {
    margin: 0;
    font-size: 24px;
    color: #e8eaed;
}

.timeline-meta {
    font-size: 13px;
    color: #9aa0a6;
}

/* 时间轴主线 */
.timeline {
    position: relative;
    padding-left: 20px;
}
.timeline::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 2px;
    background: rgba(138, 180, 248, 0.15);
}

/* 比赛卡片 */
.comp-card {
    position: relative;
    background: rgba(25, 30, 45, 0.6);
    border: 1px solid rgba(138, 180, 248, 0.1);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.comp-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    border-color: rgba(138, 180, 248, 0.3);
}

/* 时间轴节点圆圈 */
.comp-card::before {
    content: '';
    position: absolute;
    top: 24px;
    left: -21px; /* 对齐左边主线 */
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #8ab4f8;
    box-shadow: 0 0 0 4px rgba(20, 25, 40, 1);
}

/* 神仙打架 高亮特效 */
.comp-card.highlight {
    background: rgba(138, 180, 248, 0.05);
    border: 1px solid rgba(138, 180, 248, 0.4);
    box-shadow: 0 0 15px rgba(138, 180, 248, 0.1);
}
.comp-card.highlight::before {
    background: #fbbc04; /* 金黄色 */
    box-shadow: 0 0 0 4px rgba(20, 25, 40, 1), 0 0 8px #fbbc04;
}

.comp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.comp-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}
.comp-title a {
    color: #8ab4f8;
    text-decoration: none;
}
.comp-title a:hover {
    text-decoration: underline;
}

.comp-date {
    font-size: 12px;
    color: #abb2bf;
    background: rgba(255, 255, 255, 0.05);
    padding: 3px 7px;
    border-radius: 4px;
    white-space: nowrap;
    line-height: 1;
}

.comp-location {
    font-size: 14px;
    color: #9aa0a6;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.badge-clash {
    display: inline-block;
    font-size: 14px;
    margin-left: 0;
    vertical-align: middle;
    line-height: 1;
}

/* 参赛顶尖选手列表 */
.cuber-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.cuber-tag {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    background: rgba(138, 180, 248, 0.1);
    border: 1px solid rgba(138, 180, 248, 0.2);
    color: #e8eaed;
    padding: 5px 10px;
    border-radius: 16px;
    font-size: 13px;
    text-decoration: none;
    transition: all 0.2s;
}

.cuber-tag:hover {
    background: rgba(138, 180, 248, 0.2);
    border-color: rgba(138, 180, 248, 0.4);
    color: #fff;
}

/* 选手旁的事件简码标签 */
.cuber-tag .event-label {
    font-size: 11px;
    color: #9aa0a6;
    margin-left: 2px;
}
.cuber-tag .event-label .cubing-icon {
    font-size: 14px;
    vertical-align: middle;
}

/* 地点 + 项目图标行：桌面端一行，手机端换行 */
.comp-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}
.comp-meta .cubing-icon {
    vertical-align: middle;
    position: relative;
    top: -1px;
}

/* WR 项目图标颜色：当前保持者红色、历史保持者橙色 */
.wr-current {
    color: #d93025 !important;
}
.wr-former {
    color: #e8890c !important;
}

/* 占位与错误状态 */
.state-message {
    text-align: center;
    padding: 40px;
    color: #8ab4f8;
    font-size: 16px;
}

/* 工具栏布局 */
.toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
}

/* 搜索框 */
.search-box {
    flex: 1 1 100%;
    padding: 10px 14px;
    border: 1px solid rgba(138, 180, 248, 0.2);
    border-radius: 8px;
    background: rgba(25, 30, 45, 0.6);
    color: #e8eaed;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
}
.search-box:focus {
    border-color: rgba(138, 180, 248, 0.5);
}
.search-box::placeholder {
    color: #6b7280;
}

/* 月份分组折叠 */
.month-group summary {
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    color: #8ab4f8;
    padding: 8px 0;
    margin-bottom: 8px;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 8px;
    font-variant-numeric: tabular-nums;
}
.month-group summary::before {
    content: '▶';
    font-size: 10px;
    transition: transform 0.2s;
}
.month-group[open] summary::before {
    transform: rotate(90deg);
}
.month-group summary .comp-count {
    font-size: 13px;
    font-weight: 400;
    color: #9aa0a6;
}

/* 搜索栏 + 折叠按钮容器 */
.toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    align-items: center;
}
.toolbar .search-box {
    margin-bottom: 0;
    flex: 1;
}
.toggle-btn {
    white-space: nowrap;
    padding: 10px 14px;
    border: 1px solid rgba(138, 180, 248, 0.2);
    border-radius: 8px;
    background: rgba(25, 30, 45, 0.6);
    color: #8ab4f8;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}
.toggle-btn:hover {
    border-color: rgba(138, 180, 248, 0.5);
    background: rgba(138, 180, 248, 0.1);
}

/* 国家过滤下拉框 */
.country-filter {
    padding: 10px 14px;
    border: 1px solid rgba(138, 180, 248, 0.2);
    border-radius: 8px;
    background: rgba(25, 30, 45, 0.6);
    color: #8ab4f8;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    outline: none;
    min-width: 150px;
}
.country-filter:hover,
.country-filter:focus {
    border-color: rgba(138, 180, 248, 0.5);
    background: rgba(138, 180, 248, 0.1);
}
.country-filter option {
    background: #1a1f2e;
    color: #e8eaed;
}

/* 即将开始（7天内）高亮 */
.comp-card.soon {
    border-left: 3px solid #fbbc04;
}
.comp-card.soon::before {
    animation: pulse 2s infinite;
}
@keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 4px rgba(20, 25, 40, 1); }
    50% { box-shadow: 0 0 0 4px rgba(20, 25, 40, 1), 0 0 12px rgba(251, 188, 4, 0.6); }
}

.badge-soon {
    display: inline-block;
    font-size: 14px;
    margin-left: 0;
    vertical-align: middle;
    line-height: 1;
}

/* 月份统计摘要行 */
.month-stats {
    display: inline-flex;
    gap: 0px;
    font-size: 13px;
    color: #9aa0a6;
    margin-left: 12px;
}
.month-stats span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 50px;
}

/* ── 手机端布局修复 ──────────────────────────────────── */
@media (max-width: 500px) {
    /* 标题 + meta 上下排列，各获全宽 */
    .timeline-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }
    .timeline-header h1 {
        font-size: 20px;
    }

    /* display:contents 让 <h2> 盒模型消失，子元素直接进入 comp-header flex 布局 */
    .comp-header {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 4px 0;
    }
    .comp-title {
        display: contents;
    }
    /* 名称链接独占第一行 */
    .comp-title a {
        flex-basis: 100%;
    }
    /* 日期顶到最右 */
    .comp-date {
        margin-left: auto;
        align-self: center;
    }

    /* 搜索框强制独占一行 */
    .toolbar .search-box {
        flex-basis: 100%;
    }

    /* 国家过滤 + 折叠按钮同行：min-width 允许缩小，flex-basis: 0 从零起步 */
    .country-filter {
        min-width: 0;
        flex: 1 1 0;
    }
}
</style>

<div id="upcoming-comps-container">
    <div class="timeline-header">
        <h1 data-i18n-en="Top Cubers' Upcoming Comps" data-i18n-zh="顶尖选手近期比赛">Top Cubers' Upcoming Comps</h1>
        <div class="timeline-meta" id="update-meta" data-i18n-en="Loading..." data-i18n-zh="加载中...">Loading...</div>
    </div>
    
    <p id="desc-en" style="font-size: 13px; color: #9aa0a6; margin: 0 0 16px 0; line-height: 1.6;">
        Tracking cubers who are currently <strong style="color:#e8eaed">ranked in the world top 10</strong> (single or average) in any official event, 
        or have <strong style="color:#e8eaed">held a World Record</strong> at any point in history.
        Each cuber's tag shows their relevant events, with <span style="color:#d93025;">red</span> icons indicating a current World Record holder, and <span style="color:#e8890c;">orange</span> icons indicating a former one.
        <br>Monthly stats: 📋 competitions · 🌍 countries · 👤 cubers · 🔥 clashing (3+ top cubers) · ⏰ starting within 7 days.
    </p>
    <p id="desc-zh" style="font-size: 13px; color: #9aa0a6; margin: 0 0 16px 0; line-height: 1.6; display: none;">
        追踪目前在任意官方项目中<strong style="color:#e8eaed">世界排名前 10</strong>（单次或平均）的选手，以及历史上<strong style="color:#e8eaed">曾保持过世界纪录</strong>的选手。
        每位选手标签显示其上榜项目，<span style="color:#d93025;">红色</span>图标表示该项目的现任世界纪录保持者，<span style="color:#e8890c;">橙色</span>表示前任世界纪录保持者。
        <br>月度统计：📋 比赛 · 🌍 国家 · 👤 选手 · 🔥 扎堆（3+ 位顶尖选手）· ⏰ 7 天内开赛。
    </p>
    <div class="toolbar">
        <input type="text" class="search-box" id="search-input" placeholder="Search by competition, cuber, WCA ID, or country..." data-placeholder-en="Search by competition, cuber, WCA ID, or country..." data-placeholder-zh="搜索比赛、选手、WCA ID 或国家...">
        <select class="country-filter" id="country-filter">
            <option value="" data-i18n-en="All Countries" data-i18n-zh="所有国家">All Countries</option>
        </select>
        <button class="toggle-btn" id="toggle-all-btn" data-i18n-en="▲ Collapse All" data-i18n-zh="▲ 全部折叠">▲ Collapse All</button>
    </div>
    
    <div id="timeline-body" class="timeline">
        <div class="state-message" data-i18n-en="Loading schedule data..." data-i18n-zh="加载赛事数据...">Loading schedule data...</div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const DATA_URL = '{{ site.baseurl }}/stats/upcoming_comps.json';
    const timelineBody = document.getElementById('timeline-body');
    const updateMeta = document.getElementById('update-meta');
    const searchInput = document.getElementById('search-input');
    const countryFilter = document.getElementById('country-filter');

    // NOTE: 7 天内比赛高亮阈值（毫秒），方便调整
    const SOON_DAYS = 7;
    const SOON_MS = SOON_DAYS * 24 * 60 * 60 * 1000;

    // NOTE: ISO 3166-1 alpha-2 → 国家全名
    const COUNTRY_MAP = {
        'AF':'Afghanistan','AL':'Albania','DZ':'Algeria','AD':'Andorra','AO':'Angola',
        'AR':'Argentina','AM':'Armenia','AU':'Australia','AT':'Austria','AZ':'Azerbaijan',
        'BH':'Bahrain','BD':'Bangladesh','BY':'Belarus','BE':'Belgium','BJ':'Benin',
        'BT':'Bhutan','BO':'Bolivia','BA':'Bosnia and Herzegovina','BR':'Brazil',
        'BN':'Brunei','BG':'Bulgaria','KH':'Cambodia','CM':'Cameroon','CA':'Canada',
        'CL':'Chile','CN':'China','CO':'Colombia','CR':'Costa Rica','HR':'Croatia',
        'CU':'Cuba','CY':'Cyprus','CZ':'Czech Republic','DK':'Denmark','DO':'Dominican Republic',
        'EC':'Ecuador','EG':'Egypt','SV':'El Salvador','EE':'Estonia','ET':'Ethiopia',
        'FI':'Finland','FR':'France','GE':'Georgia','DE':'Germany','GH':'Ghana',
        'GR':'Greece','GT':'Guatemala','HN':'Honduras','HK':'Hong Kong','HU':'Hungary',
        'IS':'Iceland','IN':'India','ID':'Indonesia','IR':'Iran','IQ':'Iraq',
        'IE':'Ireland','IL':'Israel','IT':'Italy','JM':'Jamaica','JP':'Japan',
        'JO':'Jordan','KZ':'Kazakhstan','KE':'Kenya','KR':'South Korea','KW':'Kuwait',
        'KG':'Kyrgyzstan','LA':'Laos','LV':'Latvia','LB':'Lebanon','LT':'Lithuania',
        'LU':'Luxembourg','MO':'Macau','MK':'North Macedonia','MY':'Malaysia','MV':'Maldives',
        'MT':'Malta','MX':'Mexico','MD':'Moldova','MN':'Mongolia','ME':'Montenegro',
        'MA':'Morocco','MZ':'Mozambique','MM':'Myanmar','NP':'Nepal','NL':'Netherlands',
        'NZ':'New Zealand','NI':'Nicaragua','NG':'Nigeria','NO':'Norway','OM':'Oman',
        'PK':'Pakistan','PA':'Panama','PY':'Paraguay','PE':'Peru','PH':'Philippines',
        'PL':'Poland','PT':'Portugal','QA':'Qatar','RO':'Romania','RU':'Russia',
        'SA':'Saudi Arabia','RS':'Serbia','SG':'Singapore','SK':'Slovakia','SI':'Slovenia',
        'ZA':'South Africa','ES':'Spain','LK':'Sri Lanka','SE':'Sweden','CH':'Switzerland',
        'TW':'Taiwan','TJ':'Tajikistan','TZ':'Tanzania','TH':'Thailand','TN':'Tunisia',
        'TR':'Turkey','UA':'Ukraine','AE':'United Arab Emirates',
        'GB':'United Kingdom','US':'United States','UY':'Uruguay','UZ':'Uzbekistan',
        'VE':'Venezuela','VN':'Vietnam',
        'XA':'Multiple Countries (Asia)','XE':'Multiple Countries (Europe)',
        'XN':'Multiple Countries (North America)','XS':'Multiple Countries (South America)',
        'XW':'Multiple Countries (World)','XF':'Multiple Countries (Africa)',
        'XO':'Multiple Countries (Oceania)',
    };
    // NOTE: 常见别名 → ISO2 码，使搜索 "usa"/"uk" 也能匹配
    const COUNTRY_ALIASES = {
        'usa':'US', 'uk':'GB', 'england':'GB', 'britain':'GB',
        'korea':'KR', 'south korea':'KR', 'uae':'AE', 'czech':'CZ',
        'holland':'NL',
    };

    // NOTE: 后端短名 → WCA eventId，用于生成 cubing-icon class
    const SHORT_TO_EVENT_ID = {
        '3':'333','2':'222','4':'444','5':'555','6':'666','7':'777',
        '3bf':'333bf','fm':'333fm','oh':'333oh',
        'minx':'minx','py':'pyram','clock':'clock',
        'sk':'skewb','sq1':'sq1',
        '4bf':'444bf','5bf':'555bf','mbf':'333mbf',
        'ft':'333ft','mbo':'333mbo','mag':'magic','mmag':'mmagic',
    };

    // NOTE: 语言辅助函数 — 复用 i18n.js 的 locale 状态
    function isZh() { return window.I18n?.locale === 'zh'; }

    // 获取国家全名（英文），fallback 到 ISO2 码
    function getCountryName(iso2) {
        return COUNTRY_MAP[iso2] || iso2;
    }

    // NOTE: 获取国家显示名（根据当前语言）
    function getCountryDisplay(iso2) {
        const en = getCountryName(iso2);
        if (isZh() && window.I18n?._countryZh) {
            return I18n._countryZh[en] || en;
        }
        return en;
    }

    // NOTE: 构建搜索用的国家文本（ISO码 + 英文名 + 别名 + 中文名），全小写
    function buildCountrySearchText(iso2) {
        const enName = getCountryName(iso2).toLowerCase();
        const aliases = Object.entries(COUNTRY_ALIASES)
            .filter(([, v]) => v === iso2)
            .map(([k]) => k);
        // NOTE: 追加中文国家名，支持搜索"中国""日本"等
        const zhName = (window.I18n?._countryZh?.[COUNTRY_MAP[iso2]] || '').toLowerCase();
        return [iso2.toLowerCase(), enName, ...aliases, zhName].filter(Boolean).join(' ');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isZh()) return `${d.getMonth() + 1}月${d.getDate()}日`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // NOTE: 将日期字符串转为年月分组键 — "2026-02"
    function getMonthKey(dateStr) {
        const d = new Date(dateStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }

    // 渲染单张比赛卡片的 HTML
    function renderCompCard(comp) {
        const isClash = comp.top_cubers.length >= 3;
        const highlightClass = isClash ? 'highlight' : '';
        const clashBadge = isClash ? '<span class="badge-clash">🔥</span>' : '';

        // NOTE: 7 天内即将开始且尚未结束的比赛高亮
        const now = new Date();
        const startDate = new Date(comp.start_date + 'T00:00:00');
        const endDate = new Date((comp.end_date || comp.start_date) + 'T23:59:59');
        const daysUntil = startDate - now;
        const isSoon = now <= endDate && daysUntil <= SOON_MS;
        const soonClass = isSoon ? 'soon' : '';
        const soonBadge = isSoon ? '<span class="badge-soon">⏰</span>' : '';

        let dateDisplay = formatDate(comp.start_date);
        if (comp.end_date && comp.end_date !== comp.start_date) {
            dateDisplay += ' - ' + formatDate(comp.end_date);
        }

        // NOTE: 根据当前语言选择比赛名和城市
        const displayName = isZh() ? (comp.name_zh || comp.name) : comp.name;
        const displayCity = isZh() ? (comp.city_zh || comp.city) : comp.city;
        const countryDisplay = getCountryDisplay(comp.country);
        const locDisplay = `${displayCity}, ${countryDisplay}`;
        const countrySearchText = buildCountrySearchText(comp.country);
        // NOTE: 搜索属性同时存中英文，确保两种语言下搜索都命中
        const searchName = `${comp.name} ${comp.name_zh || ''} ${comp.city} ${comp.city_zh || ''}`.toLowerCase();

        const cubersHtml = comp.top_cubers.map(c => {
            // NOTE: 中文模式下简化选手姓名（与 i18n.js _applyLocalNames 逻辑一致）
            // "Yiheng Wang (王艺衡)" → "王艺衡"（CJK）；非 CJK 括号内容 → 保留罗马名
            let displayCuberName = c.name;
            if (isZh()) {
                const m = c.name.match(/^(.+?)\s*\(([^)]+)\)$/);
                if (m && /[\u4e00-\u9fff]/.test(m[2])) displayCuberName = m[2];
            }
            let evHtml = '';
            if (c.events && c.events.length > 0) {
                const evParts = c.events.map(ev => {
                    const wrClass = ev.wr === 'current' ? ' wr-current' : (ev.wr === 'former' ? ' wr-former' : '');
                    const eid = SHORT_TO_EVENT_ID[ev.id] || ev.id;
                    return `<span class="cubing-icon event-${eid}${wrClass}"></span>`;
                });
                evHtml = `<span class="event-label">${evParts.join(' ')}</span>`;
            }
            return `<a href="https://www.worldcubeassociation.org/persons/${c.id}" class="cuber-tag" target="_blank" rel="noopener noreferrer">${displayCuberName} ${evHtml}</a>`;
        }).join('');

        const eventHtml = comp.events ? `<div style="display:inline-flex;align-items:center;gap:4px;color:#556070;transform:translateY(-5px);">${comp.events.map(e => `<span class="cubing-icon event-${SHORT_TO_EVENT_ID[e] || e}" style="font-size:14px;"></span>`).join('')}</div>` : '';

        return `
        <div class="comp-card ${highlightClass} ${soonClass}" data-comp-name="${searchName}" data-cuber-names="${comp.top_cubers.map(c => c.name.toLowerCase() + ' ' + c.id.toLowerCase()).join(' ')}" data-country="${comp.country}" data-country-search="${countrySearchText}">
            <div class="comp-header">
                <h2 class="comp-title">
                    <a href="${comp.cubing_china_url || 'https://www.worldcubeassociation.org/competitions/' + comp.id}" target="_blank" rel="noopener noreferrer">
                        ${comp.name.includes('Championship') ? '🏆 ' : ''}<span class="fi fi-${comp.country.toLowerCase()}" style="margin-right:6px;font-size:0.8em;"></span>${displayName}
                    </a>${clashBadge}${soonBadge}
                </h2>
                <div class="comp-date">${dateDisplay}</div>
            </div>
            <div class="comp-meta">
                <div class="comp-location">📍 ${locDisplay}</div>
                ${comp.competitor_limit ? `<span style="color:#9aa0a6;font-size:13px;transform:translateY(-7px);display:inline-block;">👥${comp.competitor_limit}</span>` : ''}
                ${eventHtml}
            </div>
            <div class="cuber-list">
                ${cubersHtml}
            </div>
        </div>
        `;
    }

    // NOTE: 统一过滤入口 — 搜索框和国家下拉框联动（AND 逻辑）
    function applyFilters() {
        const query = searchInput.value.toLowerCase().trim();
        const country = countryFilter.value;
        const cards = timelineBody.querySelectorAll('.comp-card');
        cards.forEach(card => {
            const compName = card.dataset.compName || '';
            const cuberNames = card.dataset.cuberNames || '';
            const countrySearch = card.dataset.countrySearch || '';
            // NOTE: 搜索同时匹配比赛名、选手名/ID、国家名/别名
            const matchText = !query || compName.includes(query) || cuberNames.includes(query) || countrySearch.includes(query);
            const matchCountry = !country || card.dataset.country === country;
            card.style.display = (matchText && matchCountry) ? '' : 'none';
        });

        // NOTE: 如果某个月份分组内所有卡片都被隐藏，则隐藏整个分组
        timelineBody.querySelectorAll('.month-group').forEach(group => {
            const visibleCards = group.querySelectorAll('.comp-card:not([style*="display: none"])');
            group.style.display = visibleCards.length > 0 ? '' : 'none';
        });
    }

    // NOTE: 缓存 JSON 数据，供语言切换时重渲染
    let cachedData = null;

    // NOTE: 切换描述段落和 placeholder 的语言
    function applyLangUI() {
        const zh = isZh();
        const descEn = document.getElementById('desc-en');
        const descZh = document.getElementById('desc-zh');
        if (descEn) descEn.style.display = zh ? 'none' : '';
        if (descZh) descZh.style.display = zh ? '' : 'none';
        // NOTE: 切换搜索框 placeholder
        const si = document.getElementById('search-input');
        if (si) si.placeholder = si.getAttribute(zh ? 'data-placeholder-zh' : 'data-placeholder-en') || si.placeholder;
    }

    // NOTE: 主渲染函数 — 从 data 渲染整个页面（可重复调用）
    function renderAll(data) {
        const zh = isZh();
        let timeStr = new Date(data.updated_at).toLocaleString();
        updateMeta.textContent = zh
            ? `更新于: ${timeStr} | 追踪 ${data.total_cubers_tracked} 位选手`
            : `Updated: ${timeStr} | Tracking ${data.total_cubers_tracked} players`;
        // NOTE: 清除 update-meta 的 data-i18n 属性，防止 i18n.js 覆盖动态设置的文本
        updateMeta.removeAttribute('data-i18n-en');
        updateMeta.removeAttribute('data-i18n-zh');

        const comps = data.competitions || [];
        if (comps.length === 0) {
            timelineBody.innerHTML = `<div class="state-message">${zh ? '未找到追踪选手的近期比赛。' : 'No upcoming competitions found for the tracked players.'}</div>`;
            return;
        }

        // NOTE: 按月份分组
        const monthGroups = new Map();
        comps.forEach(comp => {
            const key = getMonthKey(comp.start_date);
            if (!monthGroups.has(key)) monthGroups.set(key, []);
            monthGroups.get(key).push(comp);
        });

        // NOTE: 重建国家下拉框（语言切换后显示名会变）
        const savedCountry = countryFilter.value;
        // 保留第一个 "All Countries" 选项，清除其余
        while (countryFilter.options.length > 1) countryFilter.remove(1);
        const countryCounts = {};
        comps.forEach(c => {
            countryCounts[c.country] = (countryCounts[c.country] || 0) + 1;
        });
        Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([iso2, count]) => {
                const opt = document.createElement('option');
                opt.value = iso2;
                opt.textContent = `${getCountryDisplay(iso2)} (${count})`;
                countryFilter.appendChild(opt);
            });
        countryFilter.value = savedCountry;

        let html = '';
        monthGroups.forEach((groupComps, monthName) => {
            // NOTE: 计算月份统计摘要
            const countrySet = new Set(groupComps.map(c => c.country));
            const cuberSet = new Set();
            let clashCount = 0;
            groupComps.forEach(c => {
                if (c.top_cubers.length >= 3) clashCount++;
                c.top_cubers.forEach(p => cuberSet.add(p.id));
            });

            // NOTE: \u00a0 是不换行空格，用于补位对齐数字列
            const pad = (n, w=3) => String(n).padStart(w, '\u00a0');
            const statsHtml = `<span class="month-stats">
                <span>📋 ${pad(groupComps.length)}</span>
                <span>🌍 ${pad(countrySet.size, 2)}</span>
                <span>👤 ${pad(cuberSet.size)}</span>
                ${clashCount > 0 ? `<span>🔥 ${pad(clashCount, 2)}</span>` : ''}
            </span>`;

            html += `<details class="month-group" open>
                <summary>${monthName} ${statsHtml}</summary>`;
            groupComps.forEach(comp => {
                html += renderCompCard(comp);
            });
            html += '</details>';
        });

        timelineBody.innerHTML = html;
        applyLangUI();
        applyFilters();
    }

    // 主加载流程
    fetch(DATA_URL)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load JSON');
            return response.json();
        })
        .then(data => {
            cachedData = data;
            renderAll(data);
        })
        .catch(error => {
            console.error('Error fetching comp data:', error);
            const msg = isZh() ? '加载近期比赛数据失败，请稍后重试。' : 'Failed to load upcoming competitions data. Please try again later.';
            timelineBody.innerHTML = `<div class="state-message" style="color: #f28b82;">${msg}</div>`;
        });

    // NOTE: 监听语言切换事件，用缓存数据重渲染
    window.addEventListener('i18n:locale-changed', () => {
        if (cachedData) renderAll(cachedData);
    });

    // NOTE: 搜索和国家过滤都调用统一入口
    searchInput.addEventListener('input', applyFilters);
    countryFilter.addEventListener('change', applyFilters);

    // NOTE: 一键全部收缩/展开月份分组
    const toggleBtn = document.getElementById('toggle-all-btn');
    let allExpanded = true;
    toggleBtn.addEventListener('click', function() {
        allExpanded = !allExpanded;
        const groups = timelineBody.querySelectorAll('.month-group');
        groups.forEach(g => { g.open = allExpanded; });
        toggleBtn.textContent = allExpanded
            ? (isZh() ? '▲ 全部折叠' : '▲ Collapse All')
            : (isZh() ? '▼ 全部展开' : '▼ Expand All');
    });
});
</script>
