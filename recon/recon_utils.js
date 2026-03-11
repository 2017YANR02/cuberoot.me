/**
 * Recon 共享工具函数
 * 列表页（recon.js）和详情页（recon_detail.js）共用的格式化、国旗、名字解析等函数。
 * NOTE: 所有函数设计为无状态纯函数，数据依赖通过参数传入。
 */
var ReconUtils = (function () {
    'use strict';

    /** HTML 转义 */
    function escHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** ISO2 代码转国旗图标（flag-icons CSS 库） */
    function countryFlag(iso2) {
        if (!iso2) return '';
        return '<span class="fi fi-' + iso2.toLowerCase() + '"></span>';
    }

    // NOTE: Record badge 颜色分类规则见 DEPLOYMENT.md「Record Badge 颜色规则」
    function getRecordClass(val) {
        var v = val.toUpperCase();
        if (/^[FXU]?W[RB]$|^1STWR$|^RWR$|^YTW[RB]$|^XWR$/.test(v)) return 'wr';
        if (v === 'WCR') return 'wcr';
        if (/(?:AS|E)[RB]$/.test(v) || /^(?:F|YT|X|U)?(?:SAR|SAB|NAR|NAB|OCR|OCB|AFR|AFB|ANR|ANB|ASR|ASB)$/.test(v)) return 'cr';
        if (/^[FXU]?N[RB]$|^NWR$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
        if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
            || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
        return 'other';
    }

    /** Record 标记格式化为 badge（白字彩色圆角方框） */
    function formatRecord(val) {
        if (!val) return '';
        val = String(val);
        // NOTE: 支持多种取消表述：cancel/cancelled/取消，前缀或后缀
        var cancelled = /\bcancell?ed?\b|取消/i.test(val);
        var recordType = cancelled
            ? val.replace(/\s*\bcancell?ed?\b\s*|\s*取消\s*/gi, '').trim()
            : val;
        var cls = cancelled ? 'cancelled' : getRecordClass(recordType);
        return '<span class="record-badge record-' + cls + '">' + escHtml(recordType) + '</span>';
    }

    /** 成绩格式化（秒，三位小数） */
    function formatResult(val) {
        if (val == null) return '';
        if (val >= 9999) return 'DNF';
        if (typeof val !== 'number') return String(val);
        return val.toFixed(3);
    }

    /** 平均成绩格式化（两位小数，≥60 秒显示为 分:秒.xx） */
    function formatAvg(val) {
        if (val == null) return '';
        // NOTE: API 可能返回字符串形式的数字（如 "4.190"），统一转为 number
        var n = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(n)) return String(val);
        if (n >= 9999) return 'DNF';
        if (n >= 60) {
            var m = Math.floor(n / 60);
            var s = (n % 60).toFixed(2);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
        return n.toFixed(2);
    }

    /**
     * 从 WCA 格式名字中提取英文名和中文名
     * "Ruimin Yan (颜瑞民)" → {en: "Ruimin Yan", zh: "颜瑞民"}
     * "Max Park" → {en: "Max Park", zh: null}
     */
    function parseSolverName(fullName) {
        var m = fullName.match(/^(.+?)\s*\((.+)\)$/);
        if (m) return { en: m[1], zh: m[2] };
        return { en: fullName, zh: null };
    }

    /** 选手名展示（中文模式优先显示中文名） */
    function displaySolverName(person) {
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        var parsed = parseSolverName(person || '');
        if (parsed.zh) {
            var text = isZh ? parsed.zh : parsed.en;
            return '<span data-i18n-en="' + escHtml(parsed.en) + '" data-i18n-zh="' + escHtml(parsed.zh) + '">' + escHtml(text) + '</span>';
        }
        return escHtml(parsed.en);
    }

    /**
     * 查找选手国旗 ISO2
     * @param {string} person - 选手名（WCA 格式）
     * @param {Object} personCountries - 选手名 → ISO2 映射表
     */
    function solverCountry(person, personCountries) {
        if (!person || !personCountries) return '';
        if (personCountries[person]) return personCountries[person];
        // NOTE: fallback——社区复盘可能只存了中文名或英文名，模糊搜索
        for (var key in personCountries) {
            if (key.indexOf(person) !== -1) return personCountries[key];
        }
        return '';
    }

    /**
     * 中文模式下优先显示中文比赛名
     * @param {string} comp - 英文比赛名
     * @param {Object} compNamesZh - 英文比赛名 → 中文比赛名映射表
     */
    function displayCompName(comp, compNamesZh) {
        if (!comp) return '';
        var zhName = compNamesZh && compNamesZh[comp];
        if (zhName) {
            // NOTE: 有中文名时用 data-i18n-en/zh 属性，使 i18n 切换时自动更新文本
            var isZh = localStorage.getItem('i18n_locale') === 'zh';
            var text = isZh ? zhName : comp;
            return '<span data-i18n-en="' + escHtml(comp) + '" data-i18n-zh="' + escHtml(zhName) + '">' + escHtml(text) + '</span>';
        }
        return escHtml(comp);
    }

    /**
     * 查表获取 WCA 比赛页面 URL
     * NOTE: 比赛名含特殊字符（变音符号等）时不能简单去空格，必须查映射表
     * @param {string} comp - 英文比赛名（cell_name）
     * @param {Object} compWcaIds - 比赛展示名 → WCA 比赛 ID 映射表
     * @returns {string} WCA 比赛页面 URL，未找到则返回空字符串
     */
    function compWcaUrl(comp, compWcaIds) {
        if (!comp || !compWcaIds) return '';
        var wcaId = compWcaIds[comp];
        if (!wcaId) return '';
        return 'https://www.worldcubeassociation.org/competitions/' + wcaId;
    }

    /**
     * 根据 WCA ID 生成选手个人页面 URL
     * @param {string} personId - WCA ID（如 "2023GENG02"）
     * @returns {string} WCA 个人页面 URL，无 personId 则返回空字符串
     */
    function personWcaUrl(personId) {
        if (!personId) return '';
        return 'https://www.worldcubeassociation.org/persons/' + personId;
    }

    // NOTE: 项目代码 → twisty-player puzzle 标识符映射
    var EVENT_PUZZLE_MAP = {
        '2x2': '2x2x2',
        '4x4': '4x4x4', '4BLD': '4x4x4',
        '5x5': '5x5x5', '5BLD': '5x5x5',
        '6x6': '6x6x6',
        '7x7': '7x7x7',
        'Megaminx': 'megaminx',
        'Pyraminx': 'pyraminx',
        'Skewb': 'skewb',
        'SQ1': 'square1',
        'Clock': 'clock'
    };
    /** 项目代码转 twisty-player puzzle 字符串，默认 3x3x3 */
    function eventToPuzzle(event) {
        return EVENT_PUZZLE_MAP[event] || '3x3x3';
    }

    // NOTE: cubedb.net 的 puzzle 参数格式与 twisty 不同
    var EVENT_CUBEDB_MAP = {
        '2x2': '2x2',
        '4x4': '4x4', '4BLD': '4x4',
        '5x5': '5x5', '5BLD': '5x5',
        '6x6': '6x6',
        '7x7': '7x7',
        'Megaminx': 'Megaminx',
        'Pyraminx': 'Pyraminx',
        'Skewb': 'Skewb',
        'SQ1': 'Square1',
        'Clock': 'Clock'
    };
    /** 项目代码转 cubedb.net puzzle 参数，默认 3x3 */
    function eventToCubedbPuzzle(event) {
        return EVENT_CUBEDB_MAP[event] || '3x3';
    }

    return {
        escHtml: escHtml,
        countryFlag: countryFlag,
        getRecordClass: getRecordClass,
        formatRecord: formatRecord,
        formatResult: formatResult,
        formatAvg: formatAvg,
        parseSolverName: parseSolverName,
        displaySolverName: displaySolverName,
        solverCountry: solverCountry,
        displayCompName: displayCompName,
        compWcaUrl: compWcaUrl,
        personWcaUrl: personWcaUrl,
        eventToPuzzle: eventToPuzzle,
        eventToCubedbPuzzle: eventToCubedbPuzzle
    };
})();
