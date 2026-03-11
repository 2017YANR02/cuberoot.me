/**
 * Recon 公式清理工具（共享模块）
 * 功能：清除复盘文本中各种外部播放器不支持的标记
 * 被 recon.js 和 recon_submit_page.js 共同使用
 */
var ReconAlgUtils = (function () {
    'use strict';

    /**
     * 清理公式供 twisty-player 使用
     * - 删除 .·↑↓⅓⅔()（卡顿/换手/分数/分组标记）
     * - 规范化步骤间距（UD → U D，twisty-player 无法解析连写步骤）
     */
    function cleanForPlayer(alg) {
        alg = alg.replace(/[.·↑↓⅓⅔()]/g, '');
        // NOTE: 在连写的步骤之间插入空格
        // 支持修饰符组合: 2, ', 2'（如 R2', U2'）
        alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESruldfbmesxyz])/g, '$1 ');
        return alg;
    }

    /**
     * 清理公式供 alg.cubing.net 使用
     * - 删除 ·↑↓⅓⅔（但保留 .，alg.cubing.net 支持 . 标记）
     */
    function cleanForAlgCubingNet(alg) {
        return alg.replace(/[·↑↓⅓⅔]/g, '');
    }

    // NOTE: 魔方指令 token 正则（R, R', R2, R2', x, y2 等）
    var TOKEN_RE = /[RUFLDBrufldbxyzMSE][2']?'?/g;

    /**
     * 扫描文本的非注释区域，返回所有 token 的位置数组。
     * 同时返回每行 // 注释的起始位置，用于判断光标是否在注释区。
     * @returns {{ tokens: {start:number, end:number}[], commentStarts: {pos:number, lineEnd:number}[] }}
     */
    function findTokenPositions(text) {
        var tokens = [];
        var commentStarts = [];
        var lines = text.split('\n');
        var offset = 0;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var commentIdx = line.indexOf('//');
            if (commentIdx >= 0) {
                commentStarts.push({ pos: offset + commentIdx, lineEnd: offset + line.length });
            }
            var instrPart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
            TOKEN_RE.lastIndex = 0;
            var m;
            while ((m = TOKEN_RE.exec(instrPart)) !== null) {
                tokens.push({ start: offset + m.index, end: offset + m.index + m[0].length });
            }
            offset += line.length + 1;
        }
        return { tokens: tokens, commentStarts: commentStarts };
    }

    /** 判断光标是否在注释区域内 */
    function isCursorInComment(cursorPos, commentStarts) {
        for (var i = 0; i < commentStarts.length; i++) {
            var c = commentStarts[i];
            if (cursorPos >= c.pos && cursorPos <= c.lineEnd) return true;
        }
        return false;
    }

    /**
     * 如果偏移落在 token 内部，吸附到最近的 token 边界。
     * 例如 U|2' → |U2' 或 U2'|，取距离更近的一头。
     */
    function snapToTokenBoundary(offset, tokens) {
        if (tokens.length === 0) return offset;

        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            // NOTE: 在 token 内部 → 吸附到更近的边界
            if (offset > t.start && offset < t.end) {
                return (offset - t.start <= t.end - offset) ? t.start : t.end;
            }
        }

        // NOTE: 在 token 间的空白区域 → 吸附到最近的 token 边界
        var bestDist = Infinity;
        var bestPos = offset;
        for (var j = 0; j < tokens.length; j++) {
            var ds = Math.abs(offset - tokens[j].start);
            var de = Math.abs(offset - tokens[j].end);
            if (ds < bestDist) { bestDist = ds; bestPos = tokens[j].start; }
            if (de < bestDist) { bestDist = de; bestPos = tokens[j].end; }
        }
        return bestPos;
    }

    return {
        cleanForPlayer: cleanForPlayer,
        cleanForAlgCubingNet: cleanForAlgCubingNet,
        findTokenPositions: findTokenPositions,
        isCursorInComment: isCursorInComment,
        snapToTokenBoundary: snapToTokenBoundary
    };
})();
