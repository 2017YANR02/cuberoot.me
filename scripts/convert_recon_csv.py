# -*- coding: utf-8 -*-
"""
CSV → JSON 转换脚本：将 Google Sheets 导出的 Recon CSV 转换为前端可用的 JSON。

用法：
  python scripts/convert_recon_csv.py

输入：CubeAlgWB - Recon.csv（Google Sheets 导出）
输出：recon/recon_data.json
"""

import csv
import json
import os
import sys
from datetime import datetime

# NOTE: 路径相对于项目根目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
CSV_PATH = os.path.join(PROJECT_ROOT, "CubeAlgWB - Recon.csv")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "recon", "recon_data.json")


def parseCsvHeaders(headerRow):
    """
    CSV 表头是多行合并的（如 "event\n项目"），提取第一行英文名。
    返回 {列索引: 英文名} 的映射。
    """
    headers = {}
    for i, raw in enumerate(headerRow):
        # NOTE: 取第一行作为英文名，去首尾空格
        name = raw.split("\n")[0].strip()
        headers[i] = name
    return headers


def parseFloat(val):
    """安全解析浮点数，DNF/空值返回 None"""
    if not val or val.strip() in ("", "DNF", "-", "#REF!", "#VALUE!"):
        return None
    try:
        # NOTE: 有些值带括号如 (3.48) 表示最好/最差成绩
        cleaned = val.strip().strip("()")
        return float(cleaned)
    except ValueError:
        return None


def parseInt(val):
    """安全解析整数"""
    if not val or val.strip() in ("", "-", "#REF!", "#VALUE!"):
        return None
    try:
        return int(float(val.strip()))
    except ValueError:
        return None


def extractReconSteps(reconText):
    """
    从 recon 列文本中提取分步骤复盘。
    格式通常是：
      33STM /3.05=10.82TPS
      F2 L U2 F' D L2...  (打乱)
      x2 // insp
      ↑ l2 F L' U'↓R // Y cross
      U R' U2' R // BR
      ...
    返回纯步骤文本（去掉首行的 STM/TPS 摘要和第二行的打乱）。
    """
    if not reconText:
        return None
    return reconText.strip()


def buildSolveRecord(row, headers):
    """从 CSV 行构建单条 solve 记录"""

    def col(name):
        """根据列名获取该行的值"""
        for idx, hname in headers.items():
            if hname == name:
                return row[idx].strip() if idx < len(row) and row[idx] else ""
        return ""

    # NOTE: 过滤模板行（solver 为 "cuber name" 或 comp 为 "temp"）
    solver = col("solver")
    comp = col("comp")
    if solver == "cuber name" or comp == "temp":
        return None

    # NOTE: 只展示有复盘的数据（Phase 1）
    hasRecon = col("recon?")
    if hasRecon != "YES":
        return None

    single = parseFloat(col("single"))
    if single is None or single <= 0:
        return None

    # NOTE: solver 中文名在括号里，如 "Xuanyi Geng (耿暄一)"
    solverZh = ""
    if "(" in solver and ")" in solver:
        solverZh = solver[solver.index("(") + 1:solver.rindex(")")]
        solverEn = solver[:solver.index("(")].strip()
    else:
        solverEn = solver

    record = {
        "event": col("event"),
        "method": col("Method"),
        "date": col("date"),
        "comp": comp,
        "country": col("region_solver"),
        "round": col("round"),
        "solveNum": parseInt(col("#")),
        "single": single,
        "solver": solverEn,
    }

    # NOTE: 可选字段，有值才加入（减小 JSON 体积）
    if solverZh:
        record["solverZh"] = solverZh

    avg = parseFloat(col("avg"))
    if avg and avg > 0:
        record["avg"] = avg

    aoType = col("AoXR")
    if aoType and aoType.strip() not in ("", "-"):
        record["aoType"] = aoType.strip()

    stm = parseInt(col("STM"))
    if stm:
        record["stm"] = stm

    tps = parseFloat(col("TPS"))
    if tps:
        record["tps"] = tps

    # NOTE: OLL/PLL 案例名（使用 full 版本，更精确）
    ollFull = col("OLL_full")
    pllFull = col("PLL_full")
    if ollFull:
        record["oll"] = ollFull
    if pllFull:
        record["pll"] = pllFull

    # NOTE: 复盘文本和打乱
    recon = col("recon")
    if recon:
        record["recon"] = recon

    scramble = col("scr*")
    if scramble:
        record["scramble"] = scramble

    # NOTE: caption 列有完整的分步骤文本（每行一个步骤）
    caption = col("caption")
    if caption:
        record["caption"] = caption

    cube = col("cube")
    if cube:
        record["cube"] = cube

    note = col("note")
    if note:
        record["note"] = note

    reconer = col("reconer")
    if reconer:
        record["reconer"] = reconer

    return record


def main():
    if not os.path.exists(CSV_PATH):
        print(f"错误：找不到 CSV 文件: {CSV_PATH}")
        sys.exit(1)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    solves = []
    skipped = 0
    totalRows = 0

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        headerRow = next(reader)
        headers = parseCsvHeaders(headerRow)

        for row in reader:
            totalRows += 1
            record = buildSolveRecord(row, headers)
            if record:
                solves.append(record)
            else:
                skipped += 1

    # NOTE: 按日期降序排列（最新在前），与 reco.nz 一致
    solves.sort(key=lambda s: s.get("date", ""), reverse=True)

    # NOTE: 为每条记录分配递增 ID
    for i, s in enumerate(solves):
        s["id"] = i + 1

    output = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "totalSolves": len(solves),
        "solves": solves
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    # NOTE: 同时生成一份格式化版本用于调试（不提交 git）
    debugPath = OUTPUT_PATH.replace(".json", "_debug.json")
    with open(debugPath, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"转换完成！")
    print(f"  CSV 总行数: {totalRows}")
    print(f"  有效 solve: {len(solves)}")
    print(f"  跳过行数: {skipped}")
    print(f"  输出文件: {OUTPUT_PATH}")
    print(f"  调试文件: {debugPath}")

    # 统计各选手的 solve 数量
    solverCounts = {}
    for s in solves:
        name = s["solver"]
        solverCounts[name] = solverCounts.get(name, 0) + 1
    print(f"\n选手统计 ({len(solverCounts)} 人):")
    for name, count in sorted(solverCounts.items(), key=lambda x: -x[1]):
        print(f"  {name}: {count}")


if __name__ == "__main__":
    main()
