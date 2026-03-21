"""
下载 2023GENG02 (耿暄一) 三阶单次成绩 + 计算滑动 Ao100
算法完全参考 _stats_build/statistics/abstract/average_of_x.rb

Ao100 = trimmed mean (5% each side)
  - 窗口 100 个 solves
  - 排序后去掉首尾各 ceil(100*0.05)=5 个
  - 中间 90 个取均值
  - DNF (-1) / DNS (-2) 视为 Infinity；若 90 个中仍有 Infinity → DNF
  - 最终值四舍五入到整数厘秒 (round())
"""
import json
import math
import urllib.request
import csv
import os

WCA_ID = "2023GENG02"
EVENT_ID = "333"
OUTPUT_DIR = "D:/tmp"

# 特殊值定义（参考 API_REFERENCE.md）
SKIPPED = 0   # 未参加
DNF_VAL = -1
DNS_VAL = -2


def fetch_results():
    """从 WCA API 获取选手全部成绩"""
    url = f"https://www.worldcubeassociation.org/api/v0/persons/{WCA_ID}/results"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def extract_singles(results):
    """
    提取三阶所有单次成绩（按时间顺序）
    返回 list of (value_cs, status, comp_id)
    value_cs: 厘秒值（DNF/DNS 用 -1/-2 原值）
    status: "OK" / "DNF" / "DNS"
    """
    # API 已按时间顺序返回（competition start_date + round_type rank）
    r333 = [r for r in results if r.get("event_id") == EVENT_ID]
    print(f"三阶轮次数: {len(r333)}")

    singles = []
    for r in r333:
        comp = r["competition_id"]
        for v in r.get("attempts", []):
            if v == SKIPPED:
                # 未参加的 slot，跳过（如 BestOf3 格式第 3 次）
                continue
            if v == DNF_VAL:
                singles.append((v, "DNF", comp))
            elif v == DNS_VAL:
                singles.append((v, "DNS", comp))
            elif v > 0:
                singles.append((v, "OK", comp))
    return singles


def write_singles_csv(singles, path):
    """输出单次成绩到 CSV"""
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["序号", "成绩(秒)", "成绩(厘秒)", "状态", "比赛"])
        for i, (val, status, comp) in enumerate(singles, 1):
            if status == "OK":
                sec = f"{val / 100:.2f}"
                cs = val
            else:
                sec = status
                cs = status
            w.writerow([i, sec, cs, status, comp])
    print(f"单次成绩已输出: {path} ({len(singles)} 个)")


def calc_ao100(window):
    """
    计算一个窗口的 Ao100 (trimmed mean)
    完全参考 average_of_x.rb 的 average() 方法

    返回: 厘秒值（int）或 None（DNF）
    """
    n = len(window)
    trim = math.ceil(n * 0.05)  # = 5

    # 将 DNF/DNS 映射为 Infinity
    vals = []
    for v in window:
        if v <= 0:  # DNF (-1) 或 DNS (-2)
            vals.append(float("inf"))
        else:
            vals.append(v)

    sorted_vals = sorted(vals)
    # 去掉首尾各 trim 个
    untrimmed = sorted_vals[trim: n - trim]

    # 若去掉后仍有 Infinity → DNF
    if untrimmed[-1] == float("inf"):
        return None

    mean_cs = sum(untrimmed) / len(untrimmed)
    return round(mean_cs)


def compute_rolling_ao100(singles):
    """
    滑动窗口计算所有位置的 Ao100
    返回 list of (end_index_1based, ao100_cs_or_None, is_pb, comp)
    """
    results = []
    best = float("inf")
    raw_values = [s[0] for s in singles]  # 厘秒原值（DNF=-1, DNS=-2）

    for i in range(99, len(raw_values)):
        window = raw_values[i - 99: i + 1]
        ao = calc_ao100(window)
        if ao is not None:
            is_pb = ao < best
            if is_pb:
                best = ao
        else:
            is_pb = False
        # 当前窗口末尾的单次成绩
        single_val = singles[i][0]
        single_status = singles[i][1]
        results.append((i + 1, single_val, single_status, ao, is_pb, singles[i][2]))

    return results


def write_ao100_csv(ao100_data, path):
    """输出滑动 Ao100 到 CSV"""
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["窗口结束序号", "单次(秒)", "Ao100(秒)", "Ao100(厘秒)", "是否PB", "比赛"])
        for end_idx, single_val, single_status, ao_cs, is_pb, comp in ao100_data:
            # 单次成绩列
            if single_status == "OK":
                single_sec = f"{single_val / 100:.2f}"
            else:
                single_sec = single_status  # DNF / DNS
            # Ao100 列
            if ao_cs is not None:
                sec = f"{ao_cs / 100:.2f}"
            else:
                sec = "DNF"
                ao_cs = "DNF"
            w.writerow([end_idx, single_sec, sec, ao_cs, "PB" if is_pb else "", comp])

    # 统计信息
    valid = [x for x in ao100_data if x[3] is not None]
    pbs = [x for x in ao100_data if x[4]]
    if valid:
        best_ao = min(x[3] for x in valid)
        print(f"\n滑动 Ao100 已输出: {path}")
        print(f"  总窗口数: {len(ao100_data)}")
        print(f"  有效(非DNF): {len(valid)}")
        print(f"  PB 次数: {len(pbs)}")
        print(f"  最佳 Ao100: {best_ao / 100:.2f}s ({best_ao}cs)")
    else:
        print("无有效 Ao100（成绩不足 100 个或全部 DNF）")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"正在从 WCA API 下载 {WCA_ID} 的成绩...")
    results = fetch_results()
    print(f"API 返回 {len(results)} 条记录")

    # Step 1: 提取并输出单次成绩
    singles = extract_singles(results)
    singles_path = os.path.join(OUTPUT_DIR, "geng02_333_singles.csv")
    write_singles_csv(singles, singles_path)

    # Step 2: 计算并输出滑动 Ao100
    ao100_data = compute_rolling_ao100(singles)
    ao100_path = os.path.join(OUTPUT_DIR, "geng02_333_ao100.csv")
    write_ao100_csv(ao100_data, ao100_path)


if __name__ == "__main__":
    main()
