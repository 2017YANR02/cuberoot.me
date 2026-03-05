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
        if (/(?:AS|E|C)[RB]$/.test(v) || /^(?:SAR|NAR|FASR|XASR|UASR)$/.test(v)) return 'cr';
        if (/^[FXU]?N[RB]$|^NWR$|^ANR$|^YTN[RB]$/.test(v)) return 'nr';
        if (/[PU]?[RB]$/.test(v) && (v.endsWith('PR') || v.endsWith('PB')
            || v === 'YTPR' || v === 'YTPB' || v === 'UPR' || v === 'UPB')) return 'pr';
        return 'other';
    }

    /** Record 标记格式化为 badge（白字彩色圆角方框） */
    function formatRecord(val) {
        if (!val) return '';
        val = String(val);
        var cancelled = /\bcancelled\b/i.test(val);
        var recordType = cancelled ? val.replace(/\s*cancelled\s*/i, '').trim() : val;
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
        if (val >= 9999) return 'DNF';
        if (val >= 60) {
            var m = Math.floor(val / 60);
            var s = (val % 60).toFixed(2);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
        if (typeof val !== 'number') return String(val);
        return val.toFixed(2);
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
        var isZh = localStorage.getItem('i18n_locale') === 'zh';
        if (isZh && compNamesZh && compNamesZh[comp]) return escHtml(compNamesZh[comp]);
        return escHtml(comp);
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
        displayCompName: displayCompName
    };
})();
