"""
批量测试 gen_title.py

读取 test.csv，逐行运行 gen_title.py，将完整输出写入 test_output.txt。
自动比对 info_eng / info_chs 与期望值，输出 PASS / FAIL。
"""

import csv
import subprocess
import sys
import io
import re

# NOTE: Windows 默认 stdout 编码为 GBK，遇到韩文等字符会崩溃
# 强制 UTF-8 避免重定向或直接运行时的编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_CSV = os.path.join(SCRIPT_DIR, "test_input.csv")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "test_output.txt")


def extract_info_lines(output: str) -> dict[str, str]:
    """从 gen_title.py 的输出中提取 info_chs 和 info_eng"""
    result = {}
    for line in output.splitlines():
        line = line.strip()
        if line.startswith("info_chs:"):
            result["info_chs"] = line[len("info_chs:"):].strip()
        elif line.startswith("info_eng:"):
            result["info_eng"] = line[len("info_eng:"):].strip()
    return result


def run_test(title: str, uploader: str, channel_id: str = "") -> tuple[str, dict[str, str]]:
    """运行 gen_title.py 并返回 (完整输出, {info_chs, info_eng})"""
    cmd = [sys.executable, "gen_title.py", title, "--uploader", uploader]
    if channel_id:
        cmd += ["--channel-id", channel_id]
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8",
        cwd=SCRIPT_DIR,
    )
    full_output = result.stdout + result.stderr
    info = extract_info_lines(full_output)
    return full_output, info


def main():
    with open(TEST_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cases = list(reader)

    total = len(cases)
    passed = 0
    lines = []  # 输出缓冲

    for i, case in enumerate(cases, 1):
        title = case["Title"]
        uploader = case["Uploader"]
        channel_id = case.get("Channel ID", "").strip()
        expect_eng = case.get("info_eng", "").strip()
        expect_chs = case.get("info_chs", "").strip()

        lines.append(f"{'='*60}")
        lines.append(f"Test {i}/{total}")
        lines.append(f"  Title:    {title}")
        lines.append(f"  Uploader: {uploader}")
        if channel_id:
            lines.append(f"  Channel:  {channel_id}")
        lines.append(f"{'─'*60}")

        # NOTE: 实时打印进度，让用户知道当前在跑哪个用例
        print(f"[{i}/{total}] {uploader}: {title[:50]}{'...' if len(title) > 50 else ''}", flush=True)

        full_output, actual = run_test(title, uploader, channel_id)
        lines.append(full_output)
        lines.append(f"{'─'*60}")

        # 比对结果
        # NOTE: 排名数字会随时间变化，用模糊匹配避免误报
        # /WR43 和裸 WR28 都归一成 WR?，只验证格式正确，不验证具体数字
        def _normalize_rank(s: str) -> str:
            return re.sub(r'/?WR\d+', 'WR?', s)

        ok = True
        actual_eng = actual.get("info_eng", "")
        actual_chs = actual.get("info_chs", "")

        if expect_eng and _normalize_rank(actual_eng) != _normalize_rank(expect_eng):
            lines.append(f"  FAIL info_eng:")
            lines.append(f"    expect: {expect_eng}")
            lines.append(f"    actual: {actual_eng}")
            ok = False
        if expect_chs and _normalize_rank(actual_chs) != _normalize_rank(expect_chs):
            lines.append(f"  FAIL info_chs:")
            lines.append(f"    expect: {expect_chs}")
            lines.append(f"    actual: {actual_chs}")
            ok = False

        if ok:
            lines.append(f"  ✓ PASS")
            passed += 1
        lines.append("")

    # 汇总
    lines.append(f"{'='*60}")
    lines.append(f"Result: {passed}/{total} passed")
    if passed < total:
        lines.append(f"  {total - passed} FAILED")

    output_text = "\n".join(lines)

    # 同时输出到终端和文件
    print(output_text)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(output_text + "\n")
    print(f"\n完整输出已写入: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
