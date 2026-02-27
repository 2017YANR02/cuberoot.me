# -*- coding: utf-8 -*-
"""
Recon 统计计算引擎。
移植 Google Sheets (sheet_functions.md) 中的所有复盘统计公式。
从 recon 文本自动计算出所有统计值，不依赖 Google Sheets 预计算。

用法:
    from recon_stats import computeAllStats
    stats = computeAllStats(reconText, singleTime)
"""

import re
import math


# ==================== 基础工具函数 ====================

def deleteComment(recon):
    """
    删除每一行从 // 开始到该行结尾的所有内容。
    对应 Sheet 函数: DELETE_COMMENT(recon)
    """
    if not recon:
        return ""
    cleaned = []
    for line in recon.split("\n"):
        noComment = re.sub(r"//.*", "", line)
        # NOTE: TEXTJOIN(TRUE) 忽略空字符串
        stripped = noComment.strip()
        if stripped:
            cleaned.append(stripped)
    return "\n".join(cleaned)


def expandAlg(alg):
    """
    展开括号重复标记: (moves)2 → moves moves, (moves)3 → moves moves moves。
    对应 Sheet 函数: EXPANDALG(alg)
    """
    if not alg:
        return ""
    result = re.sub(r'\(([^()]+)\)2', r'\1 \1', alg)
    result = re.sub(r'\(([^()]+)\)3', r'\1 \1 \1', result)
    return result


def htm(alg):
    """
    计算算法的步数 (Half Turn Metric)。
    移除空格/括号/旋转/数字/特殊字符后，剩余字符数即为步数。
    对应 Sheet 函数: HTM(alg)
    """
    if not alg:
        return 0
    # NOTE: 移除: 空格、括号、prime(')、旋转(xyz)、数字(234)、特殊符号(·↑↓./)、换行
    cleaned = re.sub(r"[ ()'xyz234·↑↓./\n\r]", "", alg)
    return len(cleaned)


def findStage(recon, stageName):
    """
    提取指定阶段的算法（// 之前的部分）。
    对应 Sheet 函数: STAGE(cell, stage)

    NOTE: SEARCH 是大小写不敏感的，匹配注释中的阶段名（如 "// OLL-R+"）。
    返回该行 // 之前的算法文本。
    """
    if not recon or not stageName:
        return ""
    target = stageName.lower()
    for line in recon.split("\n"):
        if target in line.lower():
            idx = line.find("//")
            if idx >= 0:
                return line[:idx].strip()
            return line.strip()
    return ""


def startToStage(recon, stageName):
    """
    提取从开头（inspection 之后）到指定阶段的所有步骤。
    对应 Sheet 函数: START_TO_STAGE(recon, stage)
    """
    if not recon or not stageName:
        return ""
    try:
        # NOTE: FIND 是大小写敏感的
        stagePos = recon.find(stageName)
        if stagePos < 0:
            # 备用：大小写不敏感搜索
            stagePos = recon.lower().find(stageName.lower())
        if stagePos < 0:
            return ""

        inspPos = recon.find("insp")
        if inspPos >= 0:
            # NOTE: 从 "insp" 后 4 个字符开始（跳过 "insp" 本身）
            start = inspPos + 4
        else:
            # NOTE: 跳过前两行（STM 摘要行 + 打乱行）
            firstNl = recon.find("\n")
            if firstNl < 0:
                return ""
            secondNl = recon.find("\n", firstNl + 1)
            if secondNl < 0:
                return ""
            start = secondNl + 1

        temp = recon[start:stagePos]
        if temp.startswith("\n"):
            temp = temp[1:]
        return temp
    except Exception:
        return ""


# ==================== 简单统计函数 ====================

def countY(recon):
    """
    统计 y 旋转和 d 旋转次数（inspection 之后）。
    对应 Sheet 公式: y 列

    NOTE: 先移除 "Gd" 避免算法分类名（如 ZBLL-Gd）中的 'd' 被误计。
    """
    if not recon:
        return 0
    text = recon.replace("Gd", "")
    inspIdx = text.find("insp")
    afterPart = text[inspIdx:] if inspIdx >= 0 else text
    return afterPart.count('y') + afterPart.count('d')


def countRegrip(recon):
    """
    统计换手次数（↑↓· 字符计数）。
    对应 Sheet 公式: regrip 列
    """
    if not recon:
        return 0
    return recon.count('↑') + recon.count('↓') + recon.count('·')


def countLockup(recon):
    """
    统计卡顿次数（"..." 出现次数）。
    对应 Sheet 公式: lockup 列
    """
    if not recon:
        return 0
    return recon.count("...")


def crossType(recon):
    """
    检测 Cross 类型: 0=cross, 1=xcross, 2=xxcross, 3=xxxcross, 4=xxxxcross。
    对应 Sheet 公式: ?x 列

    NOTE: 按最长匹配优先检测，避免 "xxcross" 被误识别为 "xcross"。
    """
    if not recon:
        return None
    lower = recon.lower()
    if "xxxxcross" in lower:
        return 4
    if "xxxcross" in lower:
        return 3
    if "xxcross" in lower:
        return 2
    if "xcross" in lower:
        return 1
    if "cross" in lower:
        return 0
    return None


def countS(recon):
    """
    统计 S slice 步数。
    对应 Sheet 公式: S 列

    NOTE: 计算所有大写 'S' 出现次数，减去 "STM" 和 "TPS" 中的 S。
    Google Sheets SUBSTITUTE 是大小写敏感的。
    """
    if not recon:
        return 0
    total = recon.count('S')
    # NOTE: 减去 STM/TPS/SPS 等关键字中的 S
    if "STM" in recon:
        total -= 1
    if "TPS" in recon:
        total -= 1
    if "SPS" in recon:
        total -= 1
    return max(total, 0)


def crossColor(recon):
    """
    提取十字颜色（W/Y/R/O/G/B）。
    对应 Sheet 公式: cross color 列

    NOTE: 从注释 "// Y cross" 中提取颜色字母。
    如果有 inspection 行，取第二个 "// " 后的字母；否则取第一个。
    """
    if not recon:
        return ""
    if "cross" not in recon.lower():
        return ""

    hasInsp = "insp" in recon.lower()
    # NOTE: 找所有 "// " 的位置
    positions = []
    idx = 0
    while True:
        pos = recon.find("// ", idx)
        if pos < 0:
            break
        positions.append(pos)
        idx = pos + 3

    if hasInsp and len(positions) >= 2:
        # NOTE: 第一个 "// " 是 insp，第二个是 cross 颜色
        charPos = positions[1] + 3
    elif len(positions) >= 1:
        charPos = positions[0] + 3
    else:
        return ""

    if charPos < len(recon):
        return recon[charPos]
    return ""


def parseStm(recon):
    """
    从 recon 首行解析总 STM 数（例如 "33STM" → 33）。
    对应 Sheet 公式: STM 列
    """
    if not recon:
        return None
    match = re.search(r'^(\d+)STM', recon)
    if match:
        val = int(match.group(1))
        return val if val > 0 else None
    return None


def parseTps(stm, single):
    """
    计算 TPS = STM / floor(single, 0.01)。
    对应 Sheet 公式: TPS 列
    """
    if stm is None or single is None or single <= 0:
        return None
    # NOTE: 对应 Sheet 的 FLOOR(S2, 0.01)
    floored = math.floor(single * 100) / 100
    if floored <= 0:
        return None
    return round(stm / floored, 2)


# ==================== Cross STM ====================

def crossStm(recon):
    """
    计算 Cross 阶段的 STM。
    对应 Sheet 公式: ?x STM 列

    NOTE: 根据 crossType 确定阶段名，然后计算从开头到该阶段的步数。
    """
    ct = crossType(recon)
    if ct is None:
        return None
    stageNames = {0: "cross", 1: "xcross", 2: "xxcross", 3: "xxxcross", 4: "xxxxcross"}
    # NOTE: 也要匹配 pseudo 变体
    sn = stageNames[ct]
    # NOTE: 在 recon 中找到实际使用的阶段关键字
    lower = recon.lower()
    for variant in ["ps" + sn, sn]:
        if variant in lower:
            sn = variant
            break

    text = startToStage(recon, sn)
    if not text:
        return None
    return htm(expandAlg(deleteComment(text)))


# ==================== LL (Last Layer) ====================

def ll(recon):
    """
    计算顶层 (Last Layer) 步数。
    对应 Sheet 函数: LL(recon)

    NOTE: 这是最复杂的函数，有大量分支判断不同的 LL 方法组合。
    """
    if not recon:
        return None
    if "cross" not in recon.lower():
        return None

    def _stageHtm(name):
        """提取阶段并计算 HTM"""
        return htm(expandAlg(findStage(recon, name)))

    def _trailingAuf(name):
        """
        计算 VLS/OLS/SV/WV 等阶段的尾部 AUF 步数。
        用于 PLL Skip 场景下，LL 只有最终的 AUF。
        """
        s = findStage(recon, name)
        if not s:
            return 0
        # NOTE: 移除注释和特殊字符后，计算尾部 U 步数
        cleaned = re.sub(r"//.*", "", s)
        cleaned = re.sub(r"[ ()'xyz23·↑↓./]", "", cleaned)
        # NOTE: 计算尾部连续 U 的长度
        match = re.search(r'(U+)$', cleaned)
        return len(match.group(1)) if match else 0

    upper = recon.upper()

    def _has(keyword):
        return keyword.upper() in upper

    # NOTE: 按优先级逐一检查 LL 方法组合

    # --- OLL Skip 系列 ---
    if _has("OCLL Skip"):
        return _stageHtm("PLL")

    if _has("OLL(CP) Skip"):
        return _stageHtm("EPLL")

    if _has("OLL Skip"):
        return _stageHtm("PLL")

    # --- PLL Skip 系列 ---
    if _has("PLL Skip"):
        if _has("COLL"):
            return _stageHtm("COLL")
        if _has("OLL(CP)"):
            return _stageHtm("OLL(CP)")
        if _has("VLS"):
            return _trailingAuf("VLS")
        if _has("OLS"):
            return _trailingAuf("OLS")
        if _has("SV"):
            return _trailingAuf("SV")
        if _has("WV"):
            return _trailingAuf("WV")
        return None

    # --- LL Skip ---
    if _has("LL Skip"):
        s = findStage(recon, "LL")
        if not s:
            return 0
        cleaned = re.sub(r"//.*", "", s)
        cleaned = re.sub(r"[ ()'xyz23·↑↓./]", "", cleaned)
        match = re.search(r'(U+)$', cleaned)
        return len(match.group(1)) if match else 0

    # --- VLS/WV/SV 后面接 EPLL/PLL ---
    if _has("WV") or _has("SV") or _has("VLS"):
        if _has("EPLL"):
            return _stageHtm("EPLL")
        if _has("PLL"):
            return _stageHtm("PLL")

    # --- EO + ZBLL ---
    if "// EO" in recon:
        return _stageHtm("EO") + _stageHtm("ZBLL")

    # --- 1LLL ---
    if _has("1LLL"):
        return _stageHtm("1LLL")

    # --- ZBLL 单独 ---
    if _has("ZBLL"):
        return _stageHtm("ZBLL")

    # --- COLL/OLL(CP) + EPLL ---
    if _has("EPLL"):
        if _has("COLL"):
            return _stageHtm("COLL") + _stageHtm("EPLL")
        if _has("OLL(CP)"):
            return _stageHtm("OLL(CP)") + _stageHtm("EPLL")

    # --- OCLL/OLL + PLL ---
    if _has("PLL"):
        if _has("OCLL"):
            return _stageHtm("OCLL") + _stageHtm("PLL")
        if _has("OLL"):
            return _stageHtm("OLL") + _stageHtm("PLL")

    return None


# ==================== OLL / PLL 提取 ====================

def ollFull(recon):
    """
    从 recon 文本中提取完整 OLL 名称。
    对应 Sheet 函数: OLL(recon)

    NOTE: 按优先级搜索 OLL/OCLL/COLL/CMLL/EO，提取到行尾。
    如果结果含 '/'，取 '/' 前的部分（分隔 OLL 和 PLL 名）。
    """
    if not recon:
        return ""
    # NOTE: 按 Sheet 中 IFS 的顺序搜索
    keywords = ["OLL", "OCLL", "COLL", "CMLL"]
    for kw in keywords:
        pos = _caseInsensitiveFind(recon, kw)
        if pos >= 0:
            val = _extractToEndOfLine(recon, pos)
            # NOTE: 如结果含 '/'，取 '/' 前的部分
            slashPos = val.find("/")
            if slashPos >= 0:
                val = val[:slashPos]
            return val.strip()

    # NOTE: EO 特殊处理：如果是 EOLS 则跳过
    eoPos = _caseInsensitiveFind(recon, "EO")
    if eoPos >= 0:
        eolsPos = _caseInsensitiveFind(recon, "EOLS")
        if eolsPos < 0:
            val = _extractToEndOfLine(recon, eoPos)
            slashPos = val.find("/")
            if slashPos >= 0:
                val = val[:slashPos]
            return val.strip()

    return ""


def pllFull(recon):
    """
    从 recon 文本中提取完整 PLL 名称。
    对应 Sheet 函数: PLL(recon)

    NOTE: 取最后一个注释行中 '/' 之后的部分（PLL 名通常在 OLL/PLL 注释的后半段）。
    如果没有 '/'，则取最后一个注释的完整文本。
    """
    if not recon:
        return ""
    if not re.search(r'cross', recon, re.IGNORECASE):
        return ""

    # NOTE: Sheet 公式: 取最后一个 "//" 后的文本，再找 "/" 后的部分
    # TRIM(RIGHT(SUBSTITUTE(recon, "//", REPT(" ", LEN(recon))), LEN(recon)))
    # 这等价于取最后一个 "//" 后的文本
    lastComment = ""
    for line in recon.split("\n"):
        commentIdx = line.find("//")
        if commentIdx >= 0:
            lastComment = line[commentIdx + 2:].strip()

    if not lastComment:
        return ""

    # NOTE: 找 '/'（不是 '//'），取其后的部分
    slashPos = lastComment.find("/")
    if slashPos >= 0:
        return lastComment[slashPos + 1:].strip()
    return lastComment.strip()


def ollShort(ollFullVal):
    """
    简化 OLL 名称（去括号内容 + cancel into + COLL/OCLL→OLL）。
    对应 Sheet 公式: OLL/CLL 列
    """
    if not ollFullVal:
        return ""
    result = re.sub(r'\([^)]*\)', '', ollFullVal)
    result = result.replace(" cancel into", "")
    result = re.sub(r'(COLL|OCLL)', 'OLL', result)
    return result.strip()


def pllShort(pllFullVal):
    """
    简化 PLL 名称（去括号内容 + cancel into + VLS/WV/SV 前缀）。
    对应 Sheet 公式: PLL/ELL 列
    """
    if not pllFullVal:
        return ""
    result = re.sub(r'\([^)]*\)', '', pllFullVal)
    result = result.replace(" cancel into", "")
    result = re.sub(r'(VLS/|WV/|SV/)', '', result)
    return result.strip()


# ==================== Free Pair ====================

def freePair(recon):
    """
    计算 Free Pair 数（F2L 阶段中步数 ≤4 的 pair 数量）。
    对应 Sheet 函数: FREEPAIR(recon)

    NOTE: 原理是找到 cross stage 之后的所有 F2L pair 行（含 // 注释的行），
    清理后检查每个 pair 的算法部分是否 ≤4 步。
    """
    if not recon:
        return None

    # Step 1: 识别 cross 类型
    xcMatch = re.search(
        r'( cross| xcross| xxcross| xxxcross| xxxxcross)',
        recon, re.IGNORECASE
    )
    if not xcMatch:
        return None
    xcType = xcMatch.group(1)

    # Step 2: 取 cross stage 之后的所有内容
    xcPos = recon.find(xcType)
    if xcPos < 0:
        xcPos = recon.lower().find(xcType.lower())
    if xcPos < 0:
        return None
    afterXcross = recon[xcPos + len(xcType):]

    # Step 3: 只保留含 "//" 的行（这些是 F2L pair 阶段行）
    pairLines = [l for l in afterXcross.split("\n") if "//" in l]
    if not pairLines:
        return 0

    stageAfterXcross = "\n".join(pairLines)

    # Step 4: 清理特殊字符
    cleanedText = re.sub(r"[ ()'xyz23·↑↓.]", "", stageAfterXcross)

    # Step 5: 删除每行开头的 pre-AUF (leading U moves)
    cleanedLines = []
    for line in cleanedText.split("\n"):
        trimmed = re.sub(r'^U+', '', line.strip())
        if trimmed:
            cleanedLines.append(trimmed)
    deletePreAUF = "\n".join(cleanedLines)

    # Step 6: 统计 free pair（算法部分 1-4 步的行）
    count = 0
    for line in deletePreAUF.split("\n"):
        commentIdx = line.find("//")
        if commentIdx < 0:
            continue
        algPart = line[:commentIdx]
        algLen = len(algPart)
        if 1 <= algLen <= 4:
            count += 1

    # Step 7: 减去 LRUR/RLUL 模式（这些不算 free pair）
    noCommentText = deleteComment(deletePreAUF)
    for pattern in ["LRUR", "RLUL"]:
        for line in noCommentText.split("\n"):
            if line.strip() == pattern:
                count -= 1

    return max(count, 0)


# ==================== 辅助函数 ====================

def _caseInsensitiveFind(text, keyword):
    """大小写不敏感搜索（对应 Sheet 的 SEARCH 函数）"""
    pos = text.lower().find(keyword.lower())
    return pos


def _extractToEndOfLine(text, startPos):
    """从 startPos 提取到行尾"""
    nlPos = text.find("\n", startPos)
    if nlPos < 0:
        return text[startPos:]
    return text[startPos:nlPos]


# ==================== 统一入口 ====================

def computeAllStats(recon, single):
    """
    从 recon 文本计算所有统计值。

    参数:
        recon: 复盘文本（完整内容，包括首行 STM/TPS 摘要）
        single: 单次成绩（秒）

    返回:
        dict，包含所有统计字段。值为 None 表示该统计不适用。
    """
    stm = parseStm(recon)
    tps = parseTps(stm, single)
    ct = crossType(recon)
    cStm = crossStm(recon)
    llVal = ll(recon)
    # NOTE: F2L = STM - LL（不是 STM - crossSTM）
    f2lVal = (stm - llVal) if (stm is not None and llVal is not None) else None
    ollF = ollFull(recon)
    pllF = pllFull(recon)

    return {
        "freePair": freePair(recon),
        "yRot": countY(recon),
        "regrip": countRegrip(recon),
        "lockup": countLockup(recon),
        "crossType": ct,
        "crossStm": cStm,
        "f2l": f2lVal,
        "ll": llVal,
        "stm": stm,
        "tps": tps,
        "sMove": countS(recon),
        "crossColor": crossColor(recon),
        "ollFull": ollF,
        "pllFull": pllF,
        "ollShort": ollShort(ollF),
        "pllShort": pllShort(pllF),
    }


# ==================== 测试 ====================

if __name__ == "__main__":
    # 用户提供的测试用例
    testRecon = """33STM /3.05=10.82TPS
F2 L U2 F' D L2 B' L B' L2 B2 R B' D F' L' U
x2 // insp
↑ l2 F L' U'↓R // Y cross
U R' U2' R // BR
U↑ L U' L' // BO
U· L' U' L // GO
R U2' R' U' R U R' // GR (1.877)
F R' F' r U R U' r' U // ZBLL-L (0.484)"""

    expected = {
        "freePair": 3, "yRot": 0, "regrip": 4, "lockup": 0,
        "crossType": 0, "crossStm": 5, "f2l": 24, "ll": 9,
        "stm": 33, "tps": 10.82, "sMove": 0, "crossColor": "Y",
        "ollShort": "", "pllShort": "ZBLL-L",
    }

    result = computeAllStats(testRecon, 3.05)

    print("=== 测试结果 ===")
    allPass = True
    for key, exp in expected.items():
        actual = result[key]
        ok = "✓" if actual == exp else "✗"
        if actual != exp:
            allPass = False
        print(f"  {ok} {key}: {actual} (期望: {exp})")

    if allPass:
        print("\n全部通过！")
    else:
        print("\n有测试失败！")
