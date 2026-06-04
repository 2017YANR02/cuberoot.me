"""
从 subscriptions.txt 批量匹配 WCA 选手，填充 channel_aliases.json。
只保存精确匹配（API 返回恰好 1 人且名字完全一致）的条目。

用法:
    python build_channel_aliases.py [subscriptions.txt 路径]
"""

import json
import os
import re
import sys
import time

import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ALIASES_PATH = os.path.join(SCRIPT_DIR, "channel_aliases.json")
WCA_API = "https://www.worldcubeassociation.org/api/v0"

# NOTE: 包含这些关键词的频道名大概率不是个人选手，跳过以节省 API 调用
SKIP_KEYWORDS = [
    "music", "studio", "news", "topic", "gaming", "records", "official",
    "channel", "productions", "films", "entertainment", "network",
    "podcast", "airline", "aviation", "tutorial", "shorts",
    "beats", "remix", "royalty", "copyright", "relaxa", "ambient",
    "piano", "guitar", "symphony", "orchestra",
    "google", "apple", "microsoft", "amazon", "nvidia", "amd", "intel",
    "adobe", "canon", "dji", "gopro", "samsung",
    "cctv", "bbc", "cnn", "fox", "hbo", "disney",
    "cubing", "cube ", "cuber", "rubik", "speedcub",  # 社区频道，非个人
]

# NOTE: 这些频道名模式大概率是个人名字（2-4 个单词，首字母大写）
def _looks_like_person_name(name: str) -> bool:
    """粗筛：频道名像不像一个人名"""
    # 跳过太短或太长的
    if len(name) < 4 or len(name) > 50:
        return False
    # 跳过包含非人名关键词的
    lower = name.lower()
    for kw in SKIP_KEYWORDS:
        if kw in lower:
            return False
    # 跳过全大写（通常是品牌/组织）
    if name.isupper() and len(name) > 5:
        return False
    # 跳过包含特殊字符的（URL、标点密集的）
    if any(c in name for c in ['/', '|', '©', '®', '™']):
        return False
    return True


def load_subscriptions(path: str) -> list[dict]:
    """加载 subscriptions.txt，返回 [{title, channel_id}, ...]"""
    subs = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",", 2)
            if len(parts) >= 3:
                title, _url, ch_id = parts
                subs.append({"title": title, "channel_id": ch_id})
    return subs


def search_wca_exact(name: str) -> dict | None:
    """
    WCA API 搜索，仅返回名字精确匹配的唯一结果。
    返回 {wca_id, name, country_iso2} 或 None。
    """
    try:
        r = requests.get(
            f"{WCA_API}/search/users",
            params={"q": name, "persons_table": "true"},
            timeout=10,
        )
        results = r.json().get("result", [])
        # 精确匹配：名字完全一致
        exact = [p for p in results if p.get("name") == name]
        if len(exact) == 1:
            p = exact[0]
            return {
                "wca_id": p["wca_id"],
                "name": p["name"],
                "country_iso2": p.get("country_iso2", ""),
            }
        return None
    except Exception:
        return None


def main():
    # 输入路径
    sub_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(SCRIPT_DIR), "upload-video", "subscriptions.txt"
    )
    if not os.path.exists(sub_path):
        print(f"文件不存在: {sub_path}")
        sys.exit(1)

    # 加载已有缓存
    aliases = {}
    if os.path.exists(ALIASES_PATH):
        with open(ALIASES_PATH, "r", encoding="utf-8") as f:
            aliases = json.load(f)
    existing_count = len(aliases)
    # 已有的 channel_id 集合，避免重复
    existing_ch_ids = {v.get("channel_id") for v in aliases.values() if v.get("channel_id")}

    # 加载订阅列表
    subs = load_subscriptions(sub_path)
    print(f"订阅列表: {len(subs)} 个频道")
    print(f"已有映射: {existing_count} 条")

    # 过滤
    candidates = []
    for sub in subs:
        # 跳过已有缓存
        if sub["title"] in aliases or sub["channel_id"] in existing_ch_ids:
            continue
        if _looks_like_person_name(sub["title"]):
            candidates.append(sub)

    print(f"待查询候选: {len(candidates)} 个（已过滤非人名和已缓存）")
    print()

    matched = 0
    for i, sub in enumerate(candidates):
        name = sub["title"]
        ch_id = sub["channel_id"]

        # 进度显示
        print(f"\r  [{i+1}/{len(candidates)}] 查询: {name[:40]:<40}", end="", flush=True)

        person = search_wca_exact(name)
        if person:
            matched += 1
            aliases[name] = {"wca_id": person["wca_id"], "channel_id": ch_id}
            print(f"\r  ✅ {name} → {person['wca_id']} ({person['country_iso2']})" + " " * 20)

        # NOTE: WCA API 频率限制，适当间隔
        time.sleep(0.5)

    # 覆盖进度行
    print(f"\r" + " " * 80)
    print(f"\n完成! 新增 {matched} 条映射（总计 {len(aliases)} 条）")

    # 保存
    with open(ALIASES_PATH, "w", encoding="utf-8") as f:
        json.dump(aliases, f, ensure_ascii=False, indent=2)
    print(f"已保存到 {ALIASES_PATH}")


if __name__ == "__main__":
    main()
