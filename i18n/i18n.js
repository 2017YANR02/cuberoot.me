// NOTE: 轻量级 i18n 引擎 — 纯前端运行时语言切换
// 通过 data-i18n 属性标记需要翻译的 HTML 元素，加载对应语言的 JSON 字典后替换文本
const I18n = {
    locale: 'en',
    dictionaries: {},       // { en: {...}, zh: {...} }
    _ready: false,
    _basePath: '',           // JSON 文件的基础路径，由 init 自动计算
    _observer: null,         // MutationObserver 实例
    _compCountries: null,    // competition_id → country_id 映射（异步加载）
    _personCountries: null,  // wca_id → iso2 映射（异步加载）

    // NOTE: WCA 项目名中英映射，用于 stats 表格数据的运行时翻译
    _eventZh: {
        "Rubik's Cube": "三阶魔方", "2x2x2 Cube": "二阶魔方",
        "4x4x4 Cube": "四阶魔方", "5x5x5 Cube": "五阶魔方",
        "6x6x6 Cube": "六阶魔方", "7x7x7 Cube": "七阶魔方",
        "3x3x3 Blindfolded": "三盲", "3x3x3 Fewest Moves": "最少步",
        "3x3x3 One-Handed": "三阶单手", "Megaminx": "五魔",
        "Pyraminx": "金字塔", "Rubik's Clock": "魔表",
        "Skewb": "斜转", "Square-1": "SQ1",
        "4x4x4 Blindfolded": "四盲", "5x5x5 Blindfolded": "五盲",
        "3x3x3 Multi-Blind": "多盲", "3x3x3 With Feet": "三阶脚拧",
        "Rubik's Magic": "八板", "Master Magic": "十二板",
        "Rubik's Cube: Multiple blind old style": "旧多盲",
        // NOTE: 上游统计 SQL 输出的别名（与 WCA 官方全名不同）
        "3x3x3 Cube": "三阶魔方", "Clock": "魔表", "Magic": "八板",
        "3x3x3 Multi-Blind Old Style": "旧多盲",
    },
    // NOTE: 反向映射，用于切回英文时恢复原文
    _eventEn: {},

    // NOTE: 统计表头中英映射，用于 stats 表格 <th> 的运行时翻译
    _headerZh: {
        "Person": "选手", "Event": "项目", "Count": "次数",
        "Competition": "比赛", "Competitions": "比赛",
        "Date": "日期", "Start Date": "开始日期", "Start Comp": "开始比赛", "Single": "单次", "Average": "平均",
        "Rank": "排名", "Result": "成绩", "Details": "详情",
        "Started at": "开始于", "Ended at": "结束于",
        "DNF rate": "DNF 率", "DNFs": "DNF 次数", "Attempts": "尝试次数",
        "Gain": "提升", "Days": "天数", "Times": "成绩",
        "Country": "国家", "Continent": "大洲", "Records": "纪录数",
        "Gold": "金牌", "Silver": "银牌", "Bronze": "铜牌", "Total": "总计",
        "Events": "项目数", "Competitions count": "比赛数",
        "List on WCA": "WCA 页面",
        "Year": "年份", "Years": "年数", "Week": "周",
        "Delegated": "WCA代表次数", "Delegated per year": "年均WCA代表",
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
        "Region": "地区", "Improvement": "进步",
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
        },
        // NOTE: 所有 analyzer 的 summary 元素，Show/Hide 切换
        "summary_analyzer": {
            "Show Analyzer": "显示分析器",
            "Hide Analyzer": "隐藏分析器"
        },
        "summary_eo_analyzer": {
            "Show Analyzer": "显示分析器",
            "Hide Analyzer": "隐藏分析器"
        },
        "summary_panalyzer": {
            "Show Analyzer": "显示分析器",
            "Hide Analyzer": "隐藏分析器"
        },
        "summary_pair_analyzer": {
            "Show Analyzer": "显示分析器",
            "Hide Analyzer": "隐藏分析器"
        },
        "summary_pair_panalyzer": {
            "Show Analyzer": "显示分析器",
            "Hide Analyzer": "隐藏分析器"
        }
    },
    _dynamicTextEn: {},   // 初始化时从 _dynamicTextZh 自动生成反向映射

    // NOTE: Solver/训练器页面 label 和 button 的文本翻译映射
    // 因为不能修改上游 HTML（无 data-i18n 属性），所以在 apply() 中按文本匹配翻译
    // 只匹配没有 translate="no" 属性的 label，避免翻译面名(U/D/L/R/F/B)
    _solverLabelZh: {
        "Solver:": "求解器：", "Solver: ": "求解器：",
        "Scramble:": "打乱：", "Scramble: ": "打乱：",
        "Rotation:": "旋转：", "Rotation: ": "旋转：",
        "Slot:": "槽位：", "Slot: ": "槽位：",
        "Pseudo Slot Edge:": "Pseudo 槽位 Edge：", "Pseudo Slot Edge: ": "Pseudo 槽位 Edge：",
        "Pseudo Slot Corner:": "Pseudo 槽位 Corner：", "Pseudo Slot Corner: ": "Pseudo 槽位 Corner：",
        "Free Pair:": "Free Pair：", "Free Pair: ": "Free Pair：",
        "Free Pair Edge:": "Free Pair Edge：", "Free Pair Edge: ": "Free Pair Edge：",
        "Free Pair Corner:": "Free Pair Corner：", "Free Pair Corner: ": "Free Pair Corner：",
        "Last Layer Option:": "顶层选项：", "Last Layer Option: ": "顶层选项：",
        "Max Length:": "最大步数：", "Max Length: ": "最大步数：",
        "Max Count:": "最大数量：", "Max Count: ": "最大数量：",
        "Move Restrict:": "步法限制：", "Move Restrict: ": "步法限制：",
        "Face Option:": "面选项：", "Face Option: ": "面选项：",
        "Solver Option:": "求解选项：", "Solver Option: ": "求解选项：",
        "Count:": "数量：", "Count: ": "数量：",
        "Move Available Table:": "可用步法表：",
        "Center Restrict:": "中心限制：",
        "Pre Move:": "预转动：", "Pre Move: ": "预转动：",
        "Max Rotation Count:": "最大旋转次数：", "Max Rotation Count: ": "最大旋转次数：",
        // NOTE: 贴纸设置区域 label
        "Auto Stickering Setting": "自动贴纸设置",
        "Centers:": "中心块：", "Centers: ": "中心块：",
        "Edges Options": "棱块选项",
        "Corners Options": "角块选项",
        "Cross:": "十字：", "Cross: ": "十字：",
        "BL Slot:": "BL 槽位：", "BL Slot: ": "BL 槽位：",
        "BR Slot:": "BR 槽位：", "BR Slot: ": "BR 槽位：",
        "FR Slot:": "FR 槽位：", "FR Slot: ": "FR 槽位：",
        "FL Slot:": "FL 槽位：", "FL Slot: ": "FL 槽位：",
        "Last Layer:": "顶层：", "Last Layer: ": "顶层：",
        // NOTE: 状态显示 label
        "Number of solutions:": "解法数量：", "Number of solutions: ": "解法数量：",
        "Current Depth:": "当前深度：", "Current Depth: ": "当前深度：",
        // NOTE: button 文本
        "Random": "随机", "Reverse": "逆序", "Mirror": "镜像", "Clear": "清空",
        "Analyze": "分析", "Solve": "求解",
        "Export": "导出", "Copy": "复制",
        "Auto": "自动", "Reset": "重置", "Output": "输出",
        // NOTE: 贴纸设置 select option 文本
        "Regular": "常规", "Dim": "暗淡", "Oriented": "朝向", "Ignored": "忽略",
        // NOTE: Solver 类型下拉选项
        "F2L Lite": "F2L 轻量", "Pairing": "基态",
        "Pseudo F2L Lite": "伪 F2L 轻量", "Pseudo Pairing": "伪基态",
        "LL Substeps Lite": "LL 子集轻量", "LL Lite": "LL 轻量",
        "LL AUF Lite": "LL AUF 轻量", "Two Phase": "二阶段",
        "LL Substeps": "LL 子集",
        // NOTE: Cube Editor 按钮
        "Swap": "交换", "Flip": "翻转",
        "GetScramble": "获取打乱", "Get\nScramble": "获取\n打乱",
        // NOTE: 颜色名（Cube Editor 下拉选项）
        "White": "白", "Red": "红", "Green": "绿",
        "Yellow": "黄", "Orange": "橙", "Blue": "蓝",
        // NOTE: 训练器页面
        "Length:": "步数：", "Length: ": "步数：",
        "Back": "上一个", "Next": "下一个",
        "Ignore Pre-move Center": "忽略预转动中心",
        "Main Solver": "主求解器",
        // NOTE: Pairing / Pseudo 训练器 label
        "Free Pair:": "基态：", "Free Pair: ": "基态：",
        "Free Pair Edge:": "基态棱块：", "Free Pair Edge: ": "基态棱块：",
        "Free Pair Corner:": "基态角块：", "Free Pair Corner: ": "基态角块：",
        "Pseudo Slot Edge:": "伪槽位棱块：", "Pseudo Slot Edge: ": "伪槽位棱块：",
        "Pseudo Slot Corner:": "伪槽位角块：", "Pseudo Slot Corner: ": "伪槽位角块：",
        // NOTE: Disable Move → Rotation / Enable Rotation → Move 按钮
        "Disable Move\n                → Rotation": "禁用 Move → Rotation",
        "Enable Rotation\n                → Move": "启用 Rotation → Move",
    },
    // NOTE: 菜单链接翻译（抽屉菜单中的 <a> 元素，它们有 translate="no" 需要单独处理）
    _menuLinkZh: {
        "Source": "源码",
        "2x2x2 Solver": "二阶求解器",
        "Documentation": "文档",
        // NOTE: Cross/XCross/XXCross/EOCross 保持英文
        "Free Pair": "基态",
        "XCross Free Pair": "XCross + 基态",
        "Pseudo XCross": "伪 XCross",
        "Pseudo Free Pair": "伪基态",
        "Alg Trainer": "公式训练器",
        "JSON Editor": "JSON 编辑器",
    },
    _menuLinkEn: {},  // 初始化时自动生成反向映射
    // NOTE: textarea placeholder 翻译映射（文本较长，单独管理）
    _placeholderZh: {
        "Use // to write comments, as in algs // comment. \nWrite the //setup comment in the appropriate position when viewing on alg.cubing.net or cubedb.net.":
            "用 // 写注释，如 algs // comment。\n在 alg.cubing.net 或 cubedb.net 上查看时，将 //setup 注释写在合适位置。"
    },
    _placeholderEn: {},  // 初始化时自动生成反向映射
    _solverLabelEn: {},  // 初始化时自动生成反向映射



    // NOTE: 指标选择器按钮翻译（Metric / AoXR 合并页面的 .metric-btn 元素）
    // 按钮只有 data-i18n-en 属性，中文通过此映射查找
    _metricBtnZh: {
        "Single": "单次", "Average": "平均",
        "BAo5": "BAo5", "WAo5": "WAo5", "Mo5": "Mo5",
        "BPA": "BPA", "WPA": "WPA",
        "Median": "中位数", "Best Counting": "最佳计入",
        "Worst Counting": "最差计入", "Worst": "最差",
        "Variance": "方差", "Best/Avg": "最佳/平均",
        "Ao1R": "Ao1R", "Ao2R": "Ao2R",
        "Ao3R": "Ao3R", "Ao4R": "Ao4R",
    },
    _metricBtnEn: {},



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
        "Côte d'Ivoire": "科特迪瓦",
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
        "Liechtenstein": "列支敦士登",
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
        "San Marino": "圣马力诺",
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
        "Zambia": "赞比亚", "Zimbabwe": "津巴布韦",
        "Africa": "非洲", "Asia": "亚洲", "Europe": "欧洲",
        "North America": "北美洲", "South America": "南美洲",
        "Oceania": "大洋洲", "World": "世界",
        "Multiple Continents": "多大洲",
        // NOTE: WCA Countries 表中 id ≠ name 的别名（SQL 可能输出 country_id 而非 country.name）
        "USA": "美国", "Korea": "韩国", "Hong Kong": "中国香港", "Macau": "中国澳门",
        "Taiwan": "中国台湾", "Cote d_Ivoire": "科特迪瓦",
        "Sao Tome and Principe": "圣多美和普林西比",
    },
    _countryEn: {},

    // NOTE: 国家英文名 → 小写 ISO2 代码映射（来源：WCA 官方 countries.real.json + countries.fictive.json）
    // 用于在 stats 表格中根据国家名显示对应国旗图标
    _countryIso2: {
        "Afghanistan": "af", "Albania": "al", "Algeria": "dz", "Andorra": "ad",
        "Angola": "ao", "Antigua and Barbuda": "ag", "Argentina": "ar", "Armenia": "am",
        "Australia": "au", "Austria": "at", "Azerbaijan": "az", "Bahamas": "bs",
        "Bahrain": "bh", "Bangladesh": "bd", "Barbados": "bb", "Belarus": "by",
        "Belgium": "be", "Belize": "bz", "Benin": "bj", "Bhutan": "bt",
        "Bolivia": "bo", "Bosnia and Herzegovina": "ba", "Botswana": "bw",
        "Brazil": "br", "Brunei": "bn", "Bulgaria": "bg", "Burkina Faso": "bf",
        "Burundi": "bi", "Cabo Verde": "cv", "Cambodia": "kh", "Cameroon": "cm",
        "Canada": "ca", "Central African Republic": "cf", "Chad": "td",
        "Chile": "cl", "China": "cn", "Colombia": "co", "Comoros": "km",
        "Congo": "cg", "Costa Rica": "cr", "C\u00f4te d'Ivoire": "ci",
        "Croatia": "hr", "Cuba": "cu", "Cyprus": "cy", "Czech Republic": "cz",
        "Democratic People's Republic of Korea": "kp",
        "Democratic Republic of the Congo": "cd",
        "Denmark": "dk", "Djibouti": "dj", "Dominica": "dm",
        "Dominican Republic": "do", "Ecuador": "ec", "Egypt": "eg",
        "El Salvador": "sv", "Equatorial Guinea": "gq", "Eritrea": "er",
        "Estonia": "ee", "Eswatini": "sz", "Ethiopia": "et",
        "Federated States of Micronesia": "fm", "Fiji": "fj", "Finland": "fi",
        "France": "fr", "Gabon": "ga", "Gambia": "gm", "Georgia": "ge",
        "Germany": "de", "Ghana": "gh", "Greece": "gr", "Grenada": "gd",
        "Guatemala": "gt", "Guinea": "gn", "Guinea Bissau": "gw",
        "Guyana": "gy", "Haiti": "ht", "Honduras": "hn",
        "Hong Kong, China": "hk", "Hungary": "hu", "Iceland": "is",
        "India": "in", "Indonesia": "id", "Iran": "ir", "Iraq": "iq",
        "Ireland": "ie", "Israel": "il", "Italy": "it", "Jamaica": "jm",
        "Japan": "jp", "Jordan": "jo", "Kazakhstan": "kz", "Kenya": "ke",
        "Kiribati": "ki", "Kosovo": "xk", "Kuwait": "kw", "Kyrgyzstan": "kg",
        "Laos": "la", "Latvia": "lv", "Lebanon": "lb", "Lesotho": "ls",
        "Liberia": "lr", "Libya": "ly", "Liechtenstein": "li",
        "Lithuania": "lt", "Luxembourg": "lu", "Macau, China": "mo",
        "Madagascar": "mg", "Malawi": "mw", "Malaysia": "my", "Maldives": "mv",
        "Mali": "ml", "Malta": "mt", "Marshall Islands": "mh",
        "Mauritania": "mr", "Mauritius": "mu", "Mexico": "mx",
        "Moldova": "md", "Monaco": "mc", "Mongolia": "mn", "Montenegro": "me",
        "Morocco": "ma", "Mozambique": "mz", "Myanmar": "mm",
        "Namibia": "na", "Nauru": "nr", "Nepal": "np", "Netherlands": "nl",
        "New Zealand": "nz", "Nicaragua": "ni", "Niger": "ne", "Nigeria": "ng",
        "North Macedonia": "mk", "Norway": "no", "Oman": "om",
        "Pakistan": "pk", "Palau": "pw", "Palestine": "ps", "Panama": "pa",
        "Papua New Guinea": "pg", "Paraguay": "py", "Peru": "pe",
        "Philippines": "ph", "Poland": "pl", "Portugal": "pt", "Qatar": "qa",
        "Republic of Korea": "kr", "Romania": "ro", "Russia": "ru",
        "Rwanda": "rw", "Saint Kitts and Nevis": "kn", "Saint Lucia": "lc",
        "Saint Vincent and the Grenadines": "vc", "Samoa": "ws",
        "San Marino": "sm", "S\u00e3o Tom\u00e9 and Pr\u00edncipe": "st",
        "Saudi Arabia": "sa", "Senegal": "sn", "Serbia": "rs",
        "Seychelles": "sc", "Sierra Leone": "sl", "Singapore": "sg",
        "Slovakia": "sk", "Slovenia": "si", "Solomon Islands": "sb",
        "Somalia": "so", "South Africa": "za", "South Sudan": "ss",
        "Spain": "es", "Sri Lanka": "lk", "Sudan": "sd", "Suriname": "sr",
        "Sweden": "se", "Switzerland": "ch", "Syria": "sy",
        "Chinese Taipei": "tw",  // NOTE: 特殊处理，用 WCA 自定义梅花旗 SVG 而非 flag-icons
        "Tajikistan": "tj", "Tanzania": "tz", "Thailand": "th",
        "Timor-Leste": "tl", "Togo": "tg", "Tonga": "to",
        "Trinidad and Tobago": "tt", "Tunisia": "tn", "Turkey": "tr",
        "Turkmenistan": "tm", "Tuvalu": "tv", "Uganda": "ug",
        "Ukraine": "ua", "United Arab Emirates": "ae", "United Kingdom": "gb",
        "United States": "us", "Uruguay": "uy", "Uzbekistan": "uz",
        "Vanuatu": "vu", "Vatican City": "va", "Venezuela": "ve",
        "Vietnam": "vn", "Yemen": "ye", "Zambia": "zm", "Zimbabwe": "zw",
        // NOTE: _countryZh 中有但 WCA JSON 中未列出的非主权国家/地区，手动补充
        "Aruba": "aw", "New Caledonia": "nc", "Puerto Rico": "pr",
        // NOTE: WCA Countries 表中 id ≠ name 的条目（SQL 可能用 country_id 而非 country.name）
        "USA": "us", "Korea": "kr", "Hong Kong": "hk", "Macau": "mo",
        "Taiwan": "tw", "Cote d_Ivoire": "ci",
        "Sao Tome and Principe": "st",
        "Democratic People_s Republic of Korea": "kp",
    },

    // NOTE: 标记，避免重复注入国旗样式
    _flagStyleInjected: false,

    // NOTE: 初始化入口 — 自动检测语言、加载字典、应用翻译
    // 分为同步阶段和异步阶段，消除 FOUC（先显示英文再切中文的闪烁）
    async init() {
        this._basePath = this._detectBasePath();
        // 优先级: URL ?lang= > localStorage > navigator.language > 默认 en
        const urlLang = new URLSearchParams(window.location.search).get('lang');
        if (urlLang && (urlLang === 'en' || urlLang === 'zh')) {
            // NOTE: URL 参数优先级最高，且同步到 localStorage
            this.locale = urlLang;
            localStorage.setItem('i18n_locale', urlLang);
        } else {
            const saved = localStorage.getItem('i18n_locale');
            if (saved && (saved === 'en' || saved === 'zh')) {
                this.locale = saved;
            } else if (navigator.language && navigator.language.startsWith('zh')) {
                this.locale = 'zh';
            }
        }

        // NOTE: URL 没有 ?lang= 时自动追加，确保 URL 始终反映语言状态
        if (!urlLang) {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', this.locale);
            history.replaceState(null, '', url.toString());
        }

        // ── 同步阶段：在 await 让出执行权之前完成，确保首帧即为正确语言 ──

        // 构建反向映射（纯同步，不依赖网络）
        for (const [en, zh] of Object.entries(this._eventZh)) {
            this._eventEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._headerZh)) {
            this._headerEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._countryZh)) {
            this._countryEn[zh] = en;
        }

        for (const [id, map] of Object.entries(this._dynamicTextZh)) {
            this._dynamicTextEn[id] = {};
            for (const [en, zh] of Object.entries(map)) {
                this._dynamicTextEn[id][zh] = en;
            }
        }
        for (const [en, zh] of Object.entries(this._solverLabelZh)) {
            this._solverLabelEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._placeholderZh)) {
            this._placeholderEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._menuLinkZh)) {
            this._menuLinkEn[zh] = en;
        }
        for (const [en, zh] of Object.entries(this._metricBtnZh)) {
            this._metricBtnEn[zh] = en;
        }

        // NOTE: 同步快速翻译 — 处理 data-i18n-en/zh 属性（stats 页面标题/描述等）
        // 这些翻译已嵌入 HTML 属性，不需要 JSON 字典，可以立即应用
        this._ready = true;
        this._injectToggle();
        this.apply();
        this._updateToggle();

        // ── 异步阶段：加载 JSON 字典后做完整翻译（solver 页面需要） ──
        await Promise.all([this._loadDict('en'), this._loadDict('zh'), this._loadCompCountries(), this._loadPersonCountries()]);
        // NOTE: 字典加载完后再次 apply，翻译 data-i18n="key" 形式的元素（solver 页面）
        // 同时 comp_countries.json 也已加载，可以插入比赛国旗
        this.apply();
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

    // NOTE: 异步加载 competition_id → country_id 映射（由 generate_comp_countries.rb 生成）
    async _loadCompCountries() {
        if (this._compCountries) return;
        try {
            const resp = await fetch('/stats/comp_countries.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this._compCountries = await resp.json();
        } catch (e) {
            console.warn('[i18n] Failed to load comp_countries.json:', e.message);
            this._compCountries = {};
        }
    },

    // NOTE: 异步加载 wca_id → iso2 映射（由 generate_comp_countries.rb 生成，仅含 stats 页面出现的选手）
    async _loadPersonCountries() {
        if (this._personCountries) return;
        try {
            const resp = await fetch('/stats/person_countries.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this._personCountries = await resp.json();
        } catch (e) {
            console.warn('[i18n] Failed to load person_countries.json:', e.message);
            this._personCountries = {};
        }
    },

    // NOTE: 在比赛链接前插入比赛所在国家的国旗图标
    // 从 <a href="...competitions/XXX"> 提取 competition_id，查 _compCountries 映射
    // 用 data-comp-flag 标记已处理的 <a>，防止重复插入
    _applyCompetitionFlags() {
        if (!this._compCountries) return;

        document.querySelectorAll('td a[href*="competitions/"]').forEach(a => {
            // 跳过已处理的
            if (a.getAttribute('data-comp-flag')) return;

            // 从 URL 提取 competition_id
            const href = a.getAttribute('href') || '';
            // 匹配 /competitions/XXX 或 /competitions/XXX/...
            const m = href.match(/\/competitions\/([^\/\#\?]+)/);
            if (!m) return;

            const compId = m[1];
            const countryId = this._compCountries[compId];
            if (!countryId) return;

            const iso2 = this._countryIso2[countryId];
            if (!iso2) return;

            // 标记已处理
            a.setAttribute('data-comp-flag', iso2);

            // 在 <a> 前插入国旗
            const td = a.closest('td');
            if (!td) return;

            if (countryId === 'Taiwan') {
                // NOTE: Chinese Taipei 用 WCA 自定义梅花旗
                const img = document.createElement('img');
                img.src = '/assets/images/ChineseTaipei.svg';
                img.alt = 'Chinese Taipei';
                img.className = 'country-flag-ct';
                td.insertBefore(img, a);
            } else {
                const span = document.createElement('span');
                span.className = `fi fi-${iso2} country-flag`;
                td.insertBefore(span, a);
            }
            // 加一个空格分隔
            td.insertBefore(document.createTextNode(' '), a);
        });
    },

    // NOTE: 在选手链接前插入国籍国旗（基于 person_countries.json）
    // 从 <a href="...persons/WCAID"> 提取 WCA ID，查 _personCountries 得到 iso2
    // 用 data-person-flag 标记已处理的 <a>，防止重复插入
    _applyPersonFlags() {
        if (!this._personCountries) return;

        document.querySelectorAll('td a[href*="persons/"]').forEach(a => {
            if (a.getAttribute('data-person-flag')) return;

            const href = a.getAttribute('href') || '';
            const m = href.match(/\/persons\/([A-Z0-9]+)/);
            if (!m) return;

            const wcaId = m[1];
            const iso2 = this._personCountries[wcaId];
            if (!iso2) return;

            a.setAttribute('data-person-flag', iso2);

            // 在 <a> 前插入国旗
            const td = a.closest('td');
            if (!td) return;

            if (iso2 === 'tw') {
                // NOTE: Chinese Taipei 用 WCA 自定义梅花旗
                const img = document.createElement('img');
                img.src = '/assets/images/ChineseTaipei.svg';
                img.alt = 'Chinese Taipei';
                img.className = 'country-flag-ct';
                td.insertBefore(img, a);
            } else {
                const span = document.createElement('span');
                span.className = `fi fi-${iso2} country-flag`;
                td.insertBefore(span, a);
            }
            td.insertBefore(document.createTextNode(' '), a);
        });
    },

    // NOTE: 检测同时有 Person 和 Country 表头的表格，隐藏 Country 列
    // 因为国旗已通过 _applyPersonFlags 内嵌到 Person 列中
    _mergeCountryColumn() {
        // 表头可能是英文或中文
        const PERSON_HEADERS = new Set(['Person', '选手']);
        const COUNTRY_HEADERS = new Set(['Country', '国家']);

        document.querySelectorAll('table').forEach(table => {
            if (table.getAttribute('data-country-merged')) return;

            const ths = table.querySelectorAll('thead th, tr:first-child th');
            if (!ths.length) return;

            let countryIdx = -1;
            let hasPerson = false;
            ths.forEach((th, i) => {
                const t = th.textContent.trim();
                if (PERSON_HEADERS.has(t)) hasPerson = true;
                if (COUNTRY_HEADERS.has(t)) countryIdx = i;
            });

            // 只有同时有 Person 和 Country 列的表格才合并
            if (!hasPerson || countryIdx < 0) return;

            table.setAttribute('data-country-merged', 'true');

            // 隐藏 Country 表头
            ths[countryIdx].style.display = 'none';

            // 隐藏每行的 Country 单元格
            table.querySelectorAll('tbody tr, tr').forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length > countryIdx) {
                    tds[countryIdx].style.display = 'none';
                }
            });
        });
    },

    // NOTE: 切换语言并更新页面
    setLocale(lang) {
        if (lang !== 'en' && lang !== 'zh') return;
        this.locale = lang;
        localStorage.setItem('i18n_locale', lang);
        // NOTE: 同步语言到 URL 参数，使分享链接时携带语言偏好
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url.toString());
        this.apply();
        this._updateToggle();
        // NOTE: 通知其他页面语言已切换（如 upcoming_comp 重渲染）
        window.dispatchEvent(new CustomEvent('i18n:locale-changed', { detail: { locale: lang } }));
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
                const t = td.textContent.trim();
                // NOTE: td 可能包含项目名、表头值（如 Single/Average）
                const zh = this._eventZh[t] || this._headerZh[t];
                if (zh) td.textContent = zh;
            });
        } else {
            // 切回英文时恢复原文——用反向映射
            document.querySelectorAll('th').forEach(th => {
                const en = this._headerEn[th.textContent.trim()];
                if (en) th.textContent = en;
            });
            document.querySelectorAll('td').forEach(td => {
                const t = td.textContent.trim();
                const en = this._eventEn[t] || this._headerEn[t];
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

        // NOTE: Stats 页面 h3 项目名翻译（复用 _eventZh 和 _countryZh 映射）
        // h3 可能是项目名（如 "3x3x3 Cube"）或地区分类（如 "World"、"Continents"、"Countries"）
        const _h3ExtraZh = { "Continents": "各大洲", "Countries": "各国家/地区" };
        const _h3ExtraEn = { "各大洲": "Continents", "各国家/地区": "Countries" };
        if (this.locale === 'zh') {
            document.querySelectorAll('h3').forEach(h3 => {
                const t = h3.textContent.trim();
                const zh = this._eventZh[t] || this._countryZh[t] || _h3ExtraZh[t];
                if (zh) h3.textContent = zh;
            });
        } else {
            document.querySelectorAll('h3').forEach(h3 => {
                const t = h3.textContent.trim();
                const en = this._eventEn[t] || this._countryEn[t] || _h3ExtraEn[t];
                if (en) h3.textContent = en;
            });
        }

        // NOTE: Stats 页面国家/地区名翻译 + 国旗图标插入
        this._applyCountryFlags();

        // NOTE: 选手名前插入国籍国旗（基于 person_countries.json）
        this._applyPersonFlags();

        // NOTE: 中文模式下简化中国/中华台北/香港/澳门选手姓名
        this._applyLocalNames();

        // NOTE: 比赛名前插入比赛所在国家的国旗图标
        this._applyCompetitionFlags();

        // NOTE: 隐藏同时有 Person 和 Country 列的表格的 Country 列（国旗已内嵌到 Person 列）
        this._mergeCountryColumn();

        // NOTE: 指标选择器按钮翻译（Metric / AoXR 合并页面）
        if (this.locale === 'zh') {
            document.querySelectorAll('.metric-btn').forEach(btn => {
                const en = btn.getAttribute('data-i18n-en');
                if (en && this._metricBtnZh[en]) btn.textContent = this._metricBtnZh[en];
            });
        } else {
            document.querySelectorAll('.metric-btn').forEach(btn => {
                const text = btn.textContent.trim();
                const en = this._metricBtnEn[text] || btn.getAttribute('data-i18n-en');
                if (en) btn.textContent = en;
            });
        }

        // NOTE: 下拉菜单方案——翻译选项和触发器文本
        if (this.locale === 'zh') {
            document.querySelectorAll('.metric-dropdown-item').forEach(item => {
                const en = item.getAttribute('data-i18n-en');
                if (en && this._metricBtnZh[en]) item.textContent = this._metricBtnZh[en];
            });
        } else {
            document.querySelectorAll('.metric-dropdown-item').forEach(item => {
                const text = item.textContent.trim();
                const en = this._metricBtnEn[text] || item.getAttribute('data-i18n-en');
                if (en) item.textContent = en;
            });
        }
        // NOTE: 下拉触发器文本跟随当前选中项的语言
        const trigger = document.querySelector('[data-role="trigger-text"]');
        if (trigger) {
            const en = trigger.getAttribute('data-i18n-en');
            if (this.locale === 'zh' && en && this._metricBtnZh[en]) {
                trigger.textContent = this._metricBtnZh[en];
            } else if (this.locale === 'en' && en) {
                trigger.textContent = en;
            }
        }

        // NOTE: 项目选择器图标的 tooltip 语言切换
        document.querySelectorAll('.event-btn[data-tooltip-en]').forEach(btn => {
            btn.dataset.tooltip = this.locale === 'zh'
                ? (btn.dataset.tooltipZh || btn.dataset.tooltipEn)
                : btn.dataset.tooltipEn;
        });

        // NOTE: Stats 页面 "Updated on" 日期翻译
        if (this.locale === 'zh') {
            const _months = { January: '1', February: '2', March: '3', April: '4', May: '5', June: '6', July: '7', August: '8', September: '9', October: '10', November: '11', December: '12' };
            document.querySelectorAll('em').forEach(em => {
                const text = em.textContent.trim().replace(/\s+/g, ' ');
                const m = text.match(/^Updated on (\d+) (\w+) (\d+)$/);
                if (m) em.textContent = `更新于 ${m[3]} 年 ${_months[m[2]] || m[2]} 月 ${m[1]} 日`;
            });
        }

        // NOTE: 翻译 JS 动态设置 textContent 的元素（如 Start/Stop 按钮）
        this._applyDynamicText();

        // NOTE: Solver/训练器页面 label 和 button 的文本翻译
        // 通过文本匹配实现，无需修改上游 HTML
        this._applySolverLabels();

        // HTML title 标签
        const titleEl = document.querySelector('title[data-i18n]');
        if (titleEl) {
            document.title = this.t(titleEl.getAttribute('data-i18n'));
        }

        // NOTE: 解除 FOUC 隐藏——翻译全部完成后显示页面
        document.body.classList.add('i18n-ready');
        document.documentElement.classList.remove('i18n-loading');

        // NOTE: 注入国旗样式（仅一次）
        this._injectFlagStyles();
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

    // NOTE: 翻译 solver/训练器页面的 label 和 button 文本
    _applySolverLabels() {
        const map = this.locale === 'zh' ? this._solverLabelZh : this._solverLabelEn;
        // 翻译 label 元素（跳过带 translate="no" 的，如面名 U/D/L/R/F/B）
        document.querySelectorAll('label:not([translate="no"])').forEach(el => {
            const text = el.textContent.trim();
            if (text && map[text]) {
                el.textContent = map[text];
            }
        });
        // 翻译 button 元素（跳过带 translate="no" 和有 data-i18n 的）
        document.querySelectorAll('button:not([translate="no"]):not([data-i18n])').forEach(el => {
            const text = el.textContent.trim();
            if (text && map[text]) {
                el.textContent = map[text];
            }
        });
        // 翻译 select option（跳过带 translate="no" 的 select）
        document.querySelectorAll('select:not([translate="no"]) option:not([translate="no"])').forEach(el => {
            const text = el.textContent.trim();
            if (text && map[text]) {
                el.textContent = map[text];
            }
        });
        // NOTE: solver 类型 select (#solver) 有 translate="no"，需单独处理其 option 文本
        document.querySelectorAll('#solver option').forEach(el => {
            const text = el.textContent.trim();
            if (text && map[text]) {
                el.textContent = map[text];
            }
        });
        // 翻译 modal 面板中的 h2 标题
        document.querySelectorAll('.modal-header h2').forEach(el => {
            const text = el.textContent.trim();
            if (text && map[text]) {
                el.textContent = map[text];
            }
        });
        // 翻译 textarea 的 placeholder 属性
        // NOTE: HTML 中 placeholder 跨行，浏览器解析后换行符可能是 \n 或 \r\n，用 includes 匹配首段
        const phZh = "用 // 写注释，如 algs // comment。\n在 alg.cubing.net 或 cubedb.net 上查看时，将 //setup 注释写在合适位置。";
        const phEn = "Use // to write comments, as in algs // comment.";
        document.querySelectorAll('textarea[placeholder]').forEach(el => {
            const ph = el.getAttribute('placeholder');
            if (!ph) return;
            if (this.locale === 'zh' && ph.includes('Use // to write comments')) {
                el.setAttribute('placeholder', phZh);
            } else if (this.locale === 'en' && ph.includes('用 // 写注释')) {
                el.setAttribute('placeholder', phEn + " \nWrite the //setup comment in the appropriate position when viewing on alg.cubing.net or cubedb.net.");
            }
        });
        // 翻译 <a> 链接文本（训练器页面的 Warning / Note 提示文本）
        const noteZh = "注意：相邻对和对角对会启动不同的搜索实例。每种配置的初始生成都需要时间。";
        const noteEn = "Note: Different search instances are launched for adjacent pairs and diagonal pairs. Initial generation takes time for each.";
        document.querySelectorAll('a:not([translate="no"]):not([data-i18n])').forEach(el => {
            const text = el.textContent.trim();
            // NOTE: Warning 文本因 HTML 跨行，textContent 含空白；用 includes 关键字触发，整体替换
            if (this.locale === 'zh' && text.includes('Warning: This scrambler')) {
                if (text.includes('700 MB')) {
                    el.textContent = '警告：此打乱生成器首次运行会在本地生成约 700 MB 数据；初始打乱生成可能需要几秒到几十秒。';
                } else if (text.includes('600')) {
                    el.textContent = '警告：此打乱生成器首次运行会在本地生成约 600 MB 数据；初始打乱生成可能需要几十秒到几分钟。注意：bucket 模型会自动选择最低配置。';
                } else if (text.includes('150 MB')) {
                    el.textContent = '警告：此打乱生成器首次运行会在本地生成约 150 MB 数据；初始打乱生成可能需要几秒。';
                }
            } else if (this.locale === 'en' && text.includes('警告：此打乱生成器')) {
                if (text.includes('700 MB')) {
                    el.textContent = 'Warning: This scrambler generates about 700 MB locally on first run; initial scramble generation may take several seconds to tens of seconds.';
                } else if (text.includes('600 MB')) {
                    el.textContent = 'Warning: This scrambler generates about 600~ MB locally on first run; initial scramble generation may take several tens of seconds to minutes. Note that the bucket model automatically selects the minimum configuration.';
                } else if (text.includes('150 MB')) {
                    el.textContent = 'Warning: This scrambler generates about 150 MB locally on first run; initial scramble generation may take several seconds for setup.';
                }
            }
            // 翻译 Note 提示文本
            if (this.locale === 'zh' && text.includes('Note: Different search instances')) {
                el.textContent = noteZh + ' ';
            } else if (this.locale === 'en' && text.includes('注意：相邻对和对角对')) {
                el.textContent = noteEn + ' ';
            }
            // 翻译短文本（如 Main Solver）
            if (text && map[text]) {
                el.textContent = map[text];
            }
        });
        // 翻译抽屉菜单中的链接（这些有 translate="no"，需要单独处理）
        const menuMap = this.locale === 'zh' ? this._menuLinkZh : this._menuLinkEn;
        document.querySelectorAll('.drawer-content a').forEach(el => {
            const text = el.textContent.trim();
            if (text && menuMap[text]) {
                el.textContent = menuMap[text];
            }
        });
    },

    // NOTE: 注入国旗图标的微调 CSS（尺寸、间距、圆角）
    _injectFlagStyles() {
        if (this._flagStyleInjected) return;
        this._flagStyleInjected = true;
        const style = document.createElement('style');
        style.id = 'i18n-flag-style';
        style.textContent = `
            /* 国旗图标微调 */
            .country-flag {
                display: inline-block;
                vertical-align: middle;
                margin-right: 5px;
                border-radius: 2px;
                /* NOTE: 覆盖 flag-icons 默认尺寸 */
                width: 1.25em !important;
                line-height: 1em !important;
            }
            /* Chinese Taipei 自定义 SVG 图标 */
            .country-flag-ct {
                display: inline-block;
                vertical-align: middle;
                margin-right: 5px;
                width: 1.25em;
                height: 0.9em;
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    },

    // NOTE: 扫描表格 td，匹配到国家名时插入国旗图标 + 翻译文本
    // 用 data-country-en 属性标记已处理的 td，记录原始英文国家名
    // 切换语言时根据该属性恢复/翻译国家名，同时保留国旗图标
    _applyCountryFlags() {
        document.querySelectorAll('td').forEach(td => {
            // 检查是否已标记过（已有国旗的 td）
            const markedEn = td.getAttribute('data-country-en');
            if (markedEn) {
                // 已有国旗，只需更新文字（国旗 span 保留不动）
                const textNode = td.lastChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    if (this.locale === 'zh') {
                        const zh = this._countryZh[markedEn];
                        if (zh) textNode.textContent = ' ' + zh;
                    } else {
                        textNode.textContent = ' ' + markedEn;
                    }
                }
                return;
            }

            // 未标记：尝试匹配国家名（英文或中文）
            const rawText = td.textContent.trim();
            // 先尝试英文匹配
            let enName = rawText;
            if (!this._countryIso2[enName]) {
                // 可能是中文，尝试反查
                enName = this._countryEn[rawText];
            }
            if (!enName || !this._countryIso2[enName]) return;

            const iso2 = this._countryIso2[enName];
            // 标记原始英文名，防止重复处理
            td.setAttribute('data-country-en', enName);

            // 清空 td，重新构建内容：国旗 + 文字
            td.textContent = '';

            if (enName === 'Chinese Taipei') {
                // NOTE: Chinese Taipei 用 WCA 自定义梅花旗 SVG
                const img = document.createElement('img');
                img.src = '/assets/images/ChineseTaipei.svg';
                img.alt = 'Chinese Taipei';
                img.className = 'country-flag-ct';
                td.appendChild(img);
            } else {
                // 普通国家：用 flag-icons CSS class
                const span = document.createElement('span');
                span.className = `fi fi-${iso2} country-flag`;
                td.appendChild(span);
            }

            // 添加国家名文本
            const displayName = this.locale === 'zh'
                ? (this._countryZh[enName] || enName)
                : enName;
            td.appendChild(document.createTextNode(' ' + displayName));
        });
    },

    // NOTE: 中文模式下简化选手姓名：
    // 1. 括号内含 CJK 字符 → 只显示中文名（如 "耿暄一"）
    // 2. 括号内含其他非拉丁文字（泰文、韩文等）→ 只显示罗马名（如 "Tankhun Panyakham"）
    // 用 data-full-name 保存原始全名，切换语言时可恢复
    _applyLocalNames() {
        // 匹配 "Romanized Name (本地名)" 格式
        const LOCAL_NAME_RE = /^(.+?)\s*\(([^)]+)\)$/;
        // CJK 统一表意文字范围（中日韩汉字）
        const CJK_RE = /[\u4e00-\u9fff]/;

        document.querySelectorAll('td a[href*="persons"]').forEach(a => {
            const saved = a.getAttribute('data-full-name');
            if (saved) {
                // 已标记过，按语言切换
                if (this.locale === 'zh') {
                    const m = saved.match(LOCAL_NAME_RE);
                    if (m) {
                        a.textContent = CJK_RE.test(m[2]) ? m[2] : m[1].trim();
                    }
                } else {
                    a.textContent = saved;
                }
                return;
            }

            const text = a.textContent.trim();
            const m = text.match(LOCAL_NAME_RE);
            if (!m) return;

            // 保存完整名，标记已处理
            a.setAttribute('data-full-name', text);
            if (this.locale === 'zh') {
                // CJK → 显示中文名；其他非拉丁 → 显示罗马名
                a.textContent = CJK_RE.test(m[2]) ? m[2] : m[1].trim();
            }
        });
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

    // NOTE: 注入公共 toggle 样式（.lang-toggle 和 .lang-toggle-fixed 共用）
    // 主页用 .lang-toggle（嵌在 footer），其他页面注入 .lang-toggle-fixed（fixed 定位）
    // 用 id 防止重复注入
    _injectToggleStyles() {
        if (document.getElementById('i18n-toggle-style')) return;
        const style = document.createElement('style');
        style.id = 'i18n-toggle-style';
        style.textContent = `
            /* 公共：🌐 + 目标语言文字的单按钮设计 */
            .lang-toggle, .lang-toggle-fixed {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                border-radius: 6px;
                padding: 4px 10px;
                cursor: pointer;
                border: 1px solid #3a3a5c;
                background: transparent;
                color: #999;
                font-size: 0.78rem;
                transition: color 0.2s, border-color 0.2s, background 0.2s;
                user-select: none;
            }
            .lang-toggle:hover, .lang-toggle-fixed:hover {
                color: #e8eeff;
                border-color: rgba(100, 100, 180, 0.5);
                background: rgba(100, 100, 180, 0.12);
            }
            .lang-toggle .globe-icon, .lang-toggle-fixed .globe-icon {
                font-size: 0.95rem;
                line-height: 1;
            }
            /* fixed 专属 */
            .lang-toggle-fixed {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 9999;
                background: rgba(12, 12, 22, 0.88);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }
        `;
        document.head.appendChild(style);
    },

    // NOTE: 自动注入固定在右下角的语言切换按钮（🌐 + 目标语言文字）
    // 如果页面中已有 [data-i18n-toggle]（如 index.html），只补样式，不注入 DOM
    _injectToggle() {
        this._injectToggleStyles();
        if (document.querySelector('[data-i18n-toggle]')) return;

        const container = document.createElement('div');
        container.className = 'lang-toggle-fixed';
        container.setAttribute('data-i18n-toggle', 'true');
        const globe = document.createElement('span');
        globe.className = 'globe-icon';
        globe.textContent = '🌐';
        const label = document.createElement('span');
        label.className = 'lang-label';
        // NOTE: 显示目标语言（当前语言的反面）
        label.textContent = this.locale === 'en' ? '中文' : 'EN';
        container.appendChild(globe);
        container.appendChild(label);
        container.onclick = () => this.toggle();
        document.body.appendChild(container);
    },

    // NOTE: 更新语言切换按钮的文字（显示目标语言）
    _updateToggle() {
        document.querySelectorAll('[data-i18n-toggle] .lang-label').forEach(label => {
            label.textContent = this.locale === 'en' ? '中文' : 'EN';
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
