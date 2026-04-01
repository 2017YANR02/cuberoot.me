/**
 * Recon 统计计算引擎 (JavaScript 版)
 * 移植自 scripts/recon_stats.py，确保计算结果一致。
 * 用于客户端即时计算复盘统计，无需运行 Python 脚本。
 */

// NOTE: 使用全局对象导出，避免 ES module 兼容问题
var ReconStats = (function () {
    'use strict';

    // ==================== 基础工具函数 ====================

    /** 删除每行 // 之后的内容，对应 Sheet: DELETE_COMMENT */
    function deleteComment(recon) {
        if (!recon) return '';
        return recon.split('\n')
            .map(function (line) { return line.replace(/\/\/.*/, '').trim(); })
            .filter(Boolean)
            .join('\n');
    }

    /** 展开 (moves)2 → moves moves，对应 Sheet: EXPANDALG */
    function expandAlg(alg) {
        if (!alg) return '';
        var result = alg.replace(/\(([^()]+)\)2/g, '$1 $1');
        result = result.replace(/\(([^()]+)\)3/g, '$1 $1 $1');
        return result;
    }

    /** 计算步数 (HTM)，对应 Sheet: HTM */
    function htm(alg) {
        if (!alg) return 0;
        // NOTE: 移除空格/括号/旋转/数字/特殊符号/换行
        var cleaned = alg.replace(/[ ()'xyz234·↑↓./\n\r]/g, '');
        return cleaned.length;
    }

    /** 提取指定阶段的算法（// 前），对应 Sheet: STAGE */
    function findStage(recon, stageName) {
        if (!recon || !stageName) return '';
        var target = stageName.toLowerCase();
        var lines = recon.split('\n');
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().indexOf(target) >= 0) {
                var idx = lines[i].indexOf('//');
                if (idx >= 0) return lines[i].substring(0, idx).trim();
                return lines[i].trim();
            }
        }
        return '';
    }

    /** 提取从开头到指定阶段的步骤，对应 Sheet: START_TO_STAGE */
    function startToStage(recon, stageName) {
        if (!recon || !stageName) return '';
        try {
            var stagePos = recon.indexOf(stageName);
            if (stagePos < 0) stagePos = recon.toLowerCase().indexOf(stageName.toLowerCase());
            if (stagePos < 0) return '';

            var inspPos = recon.indexOf('insp');
            var start;
            if (inspPos >= 0) {
                start = inspPos + 4;
            } else {
                var firstNl = recon.indexOf('\n');
                if (firstNl < 0) return '';
                var secondNl = recon.indexOf('\n', firstNl + 1);
                if (secondNl < 0) return '';
                start = secondNl + 1;
            }
            var temp = recon.substring(start, stagePos);
            if (temp.charAt(0) === '\n') temp = temp.substring(1);
            return temp;
        } catch (e) {
            return '';
        }
    }

    // ==================== 简单统计函数 ====================

    /** y/d 旋转计数，对应 Sheet: y 列 */
    function countY(recon) {
        if (!recon) return 0;
        var text = recon.replace(/Gd/g, '');
        var inspIdx = text.indexOf('insp');
        var afterPart = inspIdx >= 0 ? text.substring(inspIdx) : text;
        var count = 0;
        for (var i = 0; i < afterPart.length; i++) {
            if (afterPart[i] === 'y' || afterPart[i] === 'd') count++;
        }
        return count;
    }

    /** 换手次数 ↑↓· 计数 */
    function countRegrip(recon) {
        if (!recon) return 0;
        var count = 0;
        for (var i = 0; i < recon.length; i++) {
            if (recon[i] === '↑' || recon[i] === '↓' || recon[i] === '·') count++;
        }
        return count;
    }

    /** 卡顿次数 "..." 计数 */
    function countLockup(recon) {
        if (!recon) return 0;
        var count = 0;
        var idx = 0;
        while ((idx = recon.indexOf('...', idx)) >= 0) {
            count++;
            idx += 3;
        }
        return count;
    }

    /** Cross 类型检测: 0-4 */
    function crossType(recon) {
        if (!recon) return null;
        var lower = recon.toLowerCase();
        if (lower.indexOf('xxxxcross') >= 0) return 4;
        if (lower.indexOf('xxxcross') >= 0) return 3;
        if (lower.indexOf('xxcross') >= 0) return 2;
        if (lower.indexOf('xcross') >= 0) return 1;
        if (lower.indexOf('cross') >= 0) return 0;
        return null;
    }

    /** S slice 步计数 */
    function countS(recon) {
        if (!recon) return 0;
        var total = 0;
        for (var i = 0; i < recon.length; i++) {
            if (recon[i] === 'S') total++;
        }
        if (recon.indexOf('STM') >= 0) total--;
        if (recon.indexOf('TPS') >= 0) total--;
        if (recon.indexOf('SPS') >= 0) total--;
        return Math.max(total, 0);
    }

    /** 十字颜色提取 */
    function crossColor(recon) {
        if (!recon) return '';
        if (recon.toLowerCase().indexOf('cross') < 0) return '';
        var hasInsp = recon.toLowerCase().indexOf('insp') >= 0;
        var positions = [];
        var idx = 0;
        while ((idx = recon.indexOf('// ', idx)) >= 0) {
            positions.push(idx);
            idx += 3;
        }
        var charPos;
        if (hasInsp && positions.length >= 2) {
            charPos = positions[1] + 3;
        } else if (positions.length >= 1) {
            charPos = positions[0] + 3;
        } else {
            return '';
        }
        return charPos < recon.length ? recon[charPos] : '';
    }

    /** 从首行解析 STM 数 */
    function parseStm(recon) {
        if (!recon) return null;
        var match = recon.match(/^(\d+)STM/);
        if (match) {
            var val = parseInt(match[1], 10);
            return val > 0 ? val : null;
        }
        return null;
    }

    /** TPS = STM / floor(single, 0.01) */
    function parseTps(stm, single) {
        if (stm == null || single == null || single <= 0) return null;
        var floored = Math.floor(single * 100) / 100;
        if (floored <= 0) return null;
        return Math.round((stm / floored) * 100) / 100;
    }

    // ==================== Cross STM ====================

    function crossStm(recon) {
        var ct = crossType(recon);
        if (ct === null) return null;
        var stageNames = { 0: 'cross', 1: 'xcross', 2: 'xxcross', 3: 'xxxcross', 4: 'xxxxcross' };
        var sn = stageNames[ct];
        var lower = recon.toLowerCase();
        if (lower.indexOf('ps' + sn) >= 0) sn = 'ps' + sn;
        var text = startToStage(recon, sn);
        if (!text) return null;
        return htm(expandAlg(deleteComment(text)));
    }

    // ==================== LL ====================

    function ll(recon) {
        if (!recon) return null;
        if (recon.toLowerCase().indexOf('cross') < 0) return null;

        function stageHtm(name) {
            return htm(expandAlg(findStage(recon, name)));
        }

        function trailingAuf(name) {
            var s = findStage(recon, name);
            if (!s) return 0;
            var cleaned = s.replace(/\/\/.*/g, '');
            cleaned = cleaned.replace(/[ ()'xyz23·↑↓./]/g, '');
            var match = cleaned.match(/(U+)$/);
            return match ? match[1].length : 0;
        }

        var upper = recon.toUpperCase();
        function has(kw) { return upper.indexOf(kw.toUpperCase()) >= 0; }

        if (has('OCLL Skip')) return stageHtm('PLL');
        if (has('OLL(CP) Skip')) return stageHtm('EPLL');
        if (has('OLL Skip')) return stageHtm('PLL');

        if (has('PLL Skip')) {
            if (has('COLL')) return stageHtm('COLL');
            if (has('OLL(CP)')) return stageHtm('OLL(CP)');
            if (has('VLS')) return trailingAuf('VLS');
            if (has('OLS')) return trailingAuf('OLS');
            if (has('SV')) return trailingAuf('SV');
            if (has('WV')) return trailingAuf('WV');
            return null;
        }

        if (has('LL Skip')) {
            var s = findStage(recon, 'LL');
            if (!s) return 0;
            var cl = s.replace(/\/\/.*/g, '').replace(/[ ()'xyz23·↑↓./]/g, '');
            var m = cl.match(/(U+)$/);
            return m ? m[1].length : 0;
        }

        if (has('WV') || has('SV') || has('VLS')) {
            if (has('EPLL')) return stageHtm('EPLL');
            if (has('PLL')) return stageHtm('PLL');
        }

        if (recon.indexOf('// EO') >= 0) return stageHtm('EO') + stageHtm('ZBLL');
        if (has('1LLL')) return stageHtm('1LLL');
        if (has('ZBLL')) return stageHtm('ZBLL');

        if (has('EPLL')) {
            if (has('COLL')) return stageHtm('COLL') + stageHtm('EPLL');
            if (has('OLL(CP)')) return stageHtm('OLL(CP)') + stageHtm('EPLL');
        }

        if (has('PLL')) {
            if (has('OCLL')) return stageHtm('OCLL') + stageHtm('PLL');
            if (has('OLL')) return stageHtm('OLL') + stageHtm('PLL');
        }

        return null;
    }

    // ==================== OLL / PLL ====================

    function caseInsensitiveFind(text, keyword) {
        return text.toLowerCase().indexOf(keyword.toLowerCase());
    }

    function extractToEndOfLine(text, startPos) {
        var nlPos = text.indexOf('\n', startPos);
        return nlPos < 0 ? text.substring(startPos) : text.substring(startPos, nlPos);
    }

    function ollFull(recon) {
        if (!recon) return '';
        var keywords = ['OLL', 'OCLL', 'COLL', 'CMLL'];
        for (var i = 0; i < keywords.length; i++) {
            var pos = caseInsensitiveFind(recon, keywords[i]);
            if (pos >= 0) {
                var val = extractToEndOfLine(recon, pos);
                var slashPos = val.indexOf('/');
                if (slashPos >= 0) val = val.substring(0, slashPos);
                return val.trim();
            }
        }
        var eoPos = caseInsensitiveFind(recon, 'EO');
        if (eoPos >= 0 && caseInsensitiveFind(recon, 'EOLS') < 0) {
            var val = extractToEndOfLine(recon, eoPos);
            var slashPos = val.indexOf('/');
            if (slashPos >= 0) val = val.substring(0, slashPos);
            return val.trim();
        }
        return '';
    }

    function pllFull(recon) {
        if (!recon) return '';
        if (!/cross/i.test(recon)) return '';
        var lastComment = '';
        recon.split('\n').forEach(function (line) {
            var commentIdx = line.indexOf('//');
            if (commentIdx >= 0) lastComment = line.substring(commentIdx + 2).trim();
        });
        if (!lastComment) return '';
        var slashPos = lastComment.indexOf('/');
        if (slashPos >= 0) return lastComment.substring(slashPos + 1).trim();
        return lastComment.trim();
    }

    function ollShort(ollFullVal) {
        if (!ollFullVal) return '';
        var result = ollFullVal.replace(/\([^)]*\)/g, '');
        result = result.replace(/ cancel into/g, '');
        result = result.replace(/(COLL|OCLL)/g, 'OLL');
        return result.trim();
    }

    function pllShort(pllFullVal) {
        if (!pllFullVal) return '';
        var result = pllFullVal.replace(/\([^)]*\)/g, '');
        result = result.replace(/ cancel into/g, '');
        result = result.replace(/(VLS\/|WV\/|SV\/)/g, '');
        return result.trim();
    }

    // ==================== Free Pair ====================

    function freePair(recon) {
        if (!recon) return null;
        var xcMatch = recon.match(/( cross| xcross| xxcross| xxxcross| xxxxcross)/i);
        if (!xcMatch) return null;
        var xcType = xcMatch[1];
        var xcPos = recon.indexOf(xcType);
        if (xcPos < 0) xcPos = recon.toLowerCase().indexOf(xcType.toLowerCase());
        if (xcPos < 0) return null;
        var afterXcross = recon.substring(xcPos + xcType.length);

        var pairLines = afterXcross.split('\n').filter(function (l) { return l.indexOf('//') >= 0; });
        if (pairLines.length === 0) return 0;

        var stageAfterXcross = pairLines.join('\n');
        var cleanedText = stageAfterXcross.replace(/[ ()'xyz23·↑↓.]/g, '');

        var cleanedLines = [];
        cleanedText.split('\n').forEach(function (line) {
            var trimmed = line.trim().replace(/^U+/, '');
            if (trimmed) cleanedLines.push(trimmed);
        });
        var deletePreAUF = cleanedLines.join('\n');

        var count = 0;
        deletePreAUF.split('\n').forEach(function (line) {
            var commentIdx = line.indexOf('//');
            if (commentIdx < 0) return;
            var algPart = line.substring(0, commentIdx);
            if (algPart.length >= 1 && algPart.length <= 4) count++;
        });

        var noCommentText = deleteComment(deletePreAUF);
        noCommentText.split('\n').forEach(function (line) {
            var t = line.trim();
            if (t === 'LRUR' || t === 'RLUL') count--;
        });

        return Math.max(count, 0);
    }

    // ==================== 统一入口 ====================

    function computeAllStats(recon, single) {
        // NOTE: 优先从首行解析 STM，失败时 fallback 为直接计算
        var stm = parseStm(recon);
        if (stm == null) {
            stm = htm(expandAlg(deleteComment(recon))) || null;
        }
        var tps = parseTps(stm, single);
        var ct = crossType(recon);
        var cStm = crossStm(recon);
        var llVal = ll(recon);
        var f2lVal = (stm != null && llVal != null) ? stm - llVal : null;
        var ollF = ollFull(recon);
        var pllF = pllFull(recon);

        return {
            freePair: freePair(recon),
            yRot: countY(recon),
            regrip: countRegrip(recon),
            lockup: countLockup(recon),
            crossType: ct,
            crossStm: cStm,
            f2l: f2lVal,
            ll: llVal,
            stm: stm,
            tps: tps,
            sMove: countS(recon),
            crossColor: crossColor(recon),
            ollFull: ollF,
            pllFull: pllF,
            ollShort: ollShort(ollF),
            pllShort: pllShort(pllF)
        };
    }

    // NOTE: 导出公共 API
    return {
        computeAllStats: computeAllStats
    };
})();
