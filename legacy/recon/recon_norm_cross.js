/**
 * Cross 解法标准化工具
 * 将含转体(x/y/z) + 双层转动(r/l/u/d/f/b) 的 cross 解法
 * 归一化为「最简起手转体 + 纯单层转动」形式，方便学习者理解。
 *
 * 移植自 norm_cross.cpp，算法一一对应。
 * NOTE: 仅适用于三阶(3x3)和三阶单手(3OH)项目。
 */
var ReconNormCross = (function () {
    'use strict';

    // --- 基础定义 ---
    // NOTE: 物理槽位索引，与 C++ FaceIndex 对齐
    var U = 0, L = 1, F = 2, R = 3, B = 4, D = 5;
    var FACE_NAMES = ['U', 'L', 'F', 'R', 'B', 'D'];

    // NOTE: 双层转动拆解表——key: 小写字母, value: [旋转轴, 旋转是否反向, 补偿槽位]
    // r = x + L,  l = x' + R,  u = y + D,  d = y' + U,  f = z + B,  b = z' + F
    var WIDE_MOVES = {
        r: ['x', false, L], l: ['x', true, R],
        u: ['y', false, D], d: ['y', true, U],
        f: ['z', false, B], b: ['z', true, F]
    };

    // --- 坐标变换 ---

    // NOTE: 每个旋转函数直接操作 6 元素数组 p[i]（物理槽位 i → 原始面 ID）
    function applyX(p) {
        var t = p[U]; p[U] = p[F]; p[F] = p[D]; p[D] = p[B]; p[B] = t;
    }
    function applyY(p) {
        var t = p[F]; p[F] = p[R]; p[R] = p[B]; p[B] = p[L]; p[L] = t;
    }
    function applyZ(p) {
        var t = p[U]; p[U] = p[L]; p[L] = p[D]; p[D] = p[R]; p[R] = t;
    }

    function applyRot(p, axis, count) {
        count = ((count % 4) + 4) % 4;
        var fn = axis === 'x' ? applyX : (axis === 'y' ? applyY : applyZ);
        for (var i = 0; i < count; i++) fn(p);
    }

    // --- BFS 最简转体求解 (0-2 步) ---

    function stateEqual(a, b) {
        for (var i = 0; i < 6; i++) { if (a[i] !== b[i]) return false; }
        return true;
    }

    function fmtRot(axis, count) {
        return axis + (count === 2 ? '2' : (count === 3 ? "'" : ''));
    }

    function solveSimplification(target) {
        var identity = [0, 1, 2, 3, 4, 5];
        if (stateEqual(target, identity)) return '';

        var axes = ['x', 'y', 'z'];
        var counts = [1, 2, 3];
        var i, j, k, l, a;

        // 1 步搜索
        for (i = 0; i < 3; i++) {
            for (j = 0; j < 3; j++) {
                a = identity.slice();
                applyRot(a, axes[i], counts[j]);
                if (stateEqual(a, target)) return fmtRot(axes[i], counts[j]);
            }
        }

        // 2 步搜索
        for (i = 0; i < 3; i++) {
            for (j = 0; j < 3; j++) {
                for (k = 0; k < 3; k++) {
                    if (axes[i] === axes[k]) continue;
                    for (l = 0; l < 3; l++) {
                        a = identity.slice();
                        applyRot(a, axes[i], counts[j]);
                        applyRot(a, axes[k], counts[l]);
                        if (stateEqual(a, target)) {
                            return fmtRot(axes[i], counts[j]) + ' ' + fmtRot(axes[k], counts[l]);
                        }
                    }
                }
            }
        }
        return '';
    }

    // --- 分词器（与 C++ 逐字符扫描一致） ---

    function tokenize(text) {
        var tokens = [];
        var i = 0, len = text.length;
        while (i < len) {
            var c = text[i];
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                var tok = c;
                var j = i + 1;
                // NOTE: 贪婪匹配修饰符 (2, ')
                while (j < len && (text[j] === '2' || text[j] === "'")) {
                    tok += text[j]; j++;
                }
                tokens.push(tok);
                i = j;
            } else {
                i++; // 跳过空格、干扰符(↓↑·)等
            }
        }
        return tokens;
    }

    // --- 主处理器 ---

    function normalizeTokens(tokens) {
        var p = [0, 1, 2, 3, 4, 5]; // 当前坐标状态
        var moves = []; // 记录的绝对面操作 [{face, amount}]

        var FACE_MAP = { U: U, L: L, F: F, R: R, B: B, D: D };

        for (var i = 0; i < tokens.length; i++) {
            var tok = tokens[i];
            var base = tok[0];
            var amount = tok.indexOf('2') >= 0 ? 2 : (tok.indexOf("'") >= 0 ? 3 : 1);

            // 1. 整体旋转
            if (base === 'x' || base === 'y' || base === 'z') {
                applyRot(p, base, amount);
                continue;
            }

            // 2. 单层转动
            if (FACE_MAP[base] !== undefined) {
                moves.push({ face: p[FACE_MAP[base]], amount: amount });
                continue;
            }

            // 3. 双层转动 → 拆解为旋转 + 补偿单层
            var w = WIDE_MOVES[base];
            if (w) {
                var rotAmt = w[1] ? ((4 - amount) % 4) : amount;
                applyRot(p, w[0], rotAmt);
                moves.push({ face: p[w[2]], amount: amount });
            }
        }

        // NOTE: 求最简起手转体
        var setup = solveSimplification(p);

        // NOTE: 反向映射——原始面 → 当前槽位
        var origToSlot = [0, 0, 0, 0, 0, 0];
        for (var s = 0; s < 6; s++) origToSlot[p[s]] = s;

        // NOTE: 构建面操作序列（不含 setup，分开返回）
        var moveParts = [];
        for (var m = 0; m < moves.length; m++) {
            var slot = origToSlot[moves[m].face];
            var suffix = moves[m].amount === 2 ? '2' : (moves[m].amount === 3 ? "'" : '');
            moveParts.push(FACE_NAMES[slot] + suffix);
        }
        return { setup: setup, moveParts: moveParts };
    }

    // --- 公开 API ---

    /**
     * 从完整解法文本中提取 cross 范围并标准化。
     * 保持原始行数——每行的面操作被替换为标准化结果，注释原样保留。
     * @param {string} solutionText - 多行解法文本
     * @returns {Object|null} { result: "y2 // insp\nR2 B' ...", hasWideMoves: true }
     *                        无双层转动时返回 null
     */
    function normalize(solutionText) {
        if (!solutionText) return null;

        var lines = solutionText.split('\n');

        // NOTE: 第一步——找最后一个注释含 cross 的行（初步范围）
        var lastCrossLine = -1;
        for (var i = 0; i < lines.length; i++) {
            var commentIdx = lines[i].indexOf('//');
            if (commentIdx >= 0) {
                var comment = lines[i].substring(commentIdx).toLowerCase();
                if (comment.indexOf('cross') >= 0) lastCrossLine = i;
            }
        }
        if (lastCrossLine < 0) return null;

        // NOTE: 第二步——在初步范围内找含双层转动的最后一行（最终范围）
        var lastWideLine = -1;
        for (var j = 0; j <= lastCrossLine; j++) {
            var movePart = lines[j];
            var ci = movePart.indexOf('//');
            if (ci >= 0) movePart = movePart.substring(0, ci);
            if (/[rudfbl]/.test(movePart)) lastWideLine = j;
        }
        if (lastWideLine < 0) return null; // 无双层转动

        // NOTE: 收集每行的元信息——面操作 token 数 + 注释
        var linesInfo = [];
        var allTokens = [];
        for (var k = 0; k <= lastWideLine; k++) {
            var ln = lines[k];
            var cPos = ln.indexOf('//');
            var lineComment = cPos >= 0 ? ln.substring(cPos).trim() : '';
            var moveStr = cPos >= 0 ? ln.substring(0, cPos) : ln;
            var lineTokens = tokenize(moveStr.trim());

            // NOTE: 统计该行产生多少个面操作（排除旋转 x/y/z）
            var moveCount = 0;
            for (var t = 0; t < lineTokens.length; t++) {
                var b = lineTokens[t][0];
                if (b !== 'x' && b !== 'y' && b !== 'z') moveCount++;
            }
            linesInfo.push({ moveCount: moveCount, comment: lineComment });
            allTokens = allTokens.concat(lineTokens);
        }

        if (allTokens.length === 0) return null;
        var norm = normalizeTokens(allTokens);

        // NOTE: 按每行原始面操作数分配标准化结果
        var outputLines = [];
        var moveIdx = 0;
        for (var n = 0; n < linesInfo.length; n++) {
            var parts = [];
            // NOTE: setup 转体放在第一行
            if (n === 0 && norm.setup) parts.push(norm.setup);
            var count = linesInfo[n].moveCount;
            for (var q = 0; q < count; q++) {
                if (moveIdx < norm.moveParts.length) parts.push(norm.moveParts[moveIdx++]);
            }
            var lineOutput = parts.join(' ');
            if (linesInfo[n].comment) {
                lineOutput = lineOutput
                    ? lineOutput + ' ' + linesInfo[n].comment
                    : linesInfo[n].comment;
            }
            if (lineOutput) outputLines.push(lineOutput);
        }

        return {
            result: outputLines.join('\n'),
            hasWideMoves: true
        };
    }

    return { normalize: normalize };
})();
