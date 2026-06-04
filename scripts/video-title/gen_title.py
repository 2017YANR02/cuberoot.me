"""
WCA 比赛视频标题生成工具

用法：
  python gen_title.py                                        # 交互模式
  python gen_title.py "5.55 3x3 NR Avg Nahm"                 # 命令行模式
  python gen_title.py --list                                 # 列出所有近期纪录
  python gen_title.py "标题" --uploader "频道名"               # 指定视频发布者
  python gen_title.py "标题" --uploader "名" --channel-id "ID" # 带频道ID

执行流程：

  YouTube 视频标题 + 频道名(--uploader) + 频道ID(--channel-id)
          │
          ▼
  ┌─ 1. 选手身份识别 ──────────────────────────────┐
  │  选手名一律从 --uploader 获取（禁止从标题猜测）│
  │  查 channel_aliases.json（频道名 or channel_id）│
  │  → 获取 WCA ID                                 │
  └────────────────────────────────────────────────┘
          │
          ▼
  ┌─ 2. 纪录路径（优先）──────────────────────────┐
  │  用 WCA ID 过滤 recentRecords（只看该选手）    │
  │  再用标题关键词（成绩/项目/类型）匹配           │
  │  命中 → 生成纪录快讯标题（含 NR/CR/WR 格式）  │
  └────────────────────────────────────────────────┘
          │ (未命中：⚠ fallback 原因会打印)
          ▼
  ┌─ 3. Fallback 路径 ─────────────────────────────┐
  │  _extract_title_parts: 拆标题 → 成绩/项目/类型 │
  │  WCA API 查选手历史成绩 → 找到比赛名           │
  │  WCA Live 补充最近比赛（REST API 有几天延迟）  │
  │  → 生成通用双语标题（标注 PR / 世界排名）      │
  └────────────────────────────────────────────────┘

  输出示例（纪录路径）:
    info_chs: 5.55三阶魔方平均韩国纪录🇰🇷NR/WR43 Seung Hyuk Nahm | Paradise Park Bangkok NxNxN 2026🇹🇭
    info_eng: 5.55 3x3 🇰🇷NR/WR43 Avg Seung Hyuk Nahm | Paradise Park Bangkok NxNxN 2026🇹🇭

  输出示例（Fallback 路径，PR + 世界排名）:
    info_chs: 19.02四阶魔方单次PR/WR21 Teodor Zajder🇵🇱 | Cube Factory League Rogów 2026🇵🇱
    info_eng: 19.02 4x4 PR/WR21 Single Teodor Zajder🇵🇱 | Cube Factory League Rogów 2026🇵🇱

  输出示例（Fallback 路径，非 PR 但有世界排名）:
    info_chs: 2.35魔表平均WR4 Volodymyr Kapustianskyi🇺🇸 | Eau Clock Wisconsin 2026🇺🇸
    info_eng: 2.35 Clock WR4 Avg Volodymyr Kapustianskyi🇺🇸 | Eau Clock Wisconsin 2026🇺🇸
"""

import io
import json
import os.path
import re
import sys

# NOTE: Windows 终端默认 GBK 编码，无法输出国旗 emoji，强制 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import requests

from wca_live_records import query_recent_records, format_record_message
from record_format import (
    format_time,
    split_name,
    COUNTRY_CN_MAP,
    ISO2_TO_CR,
    CR_ABBR_CN,
    EVENT_CN_MAP,
    EVENT_EN_MAP,
)
from wca_rankings import RANKINGS
from monitor_utils import country_flag


# === 话题标签生成 ===

# 英文话题标签映射（去掉空格/特殊字符，全小写）
_EVENT_TAG_EN = {
    "3x3x3 Cube": "3x3", "2x2x2 Cube": "2x2", "4x4x4 Cube": "4x4",
    "5x5x5 Cube": "5x5", "6x6x6 Cube": "6x6", "7x7x7 Cube": "7x7",
    "3x3x3 Blindfolded": "3bld", "3x3x3 Fewest Moves": "fmc",
    "3x3x3 One-Handed": "oh", "Clock": "clock",
    "Megaminx": "megaminx", "Pyraminx": "pyraminx", "Skewb": "skewb",
    "Square-1": "sq1", "4x4x4 Blindfolded": "4bld",
    "5x5x5 Blindfolded": "5bld", "3x3x3 Multi-Blind": "multibld",
}

# 纪录类型的英文话题标签
_RECORD_TAG_EN = {
    "WR": "worldrecord",
    "NR": "nationalrecord",
    "CR": "continentalrecord",
}


def generate_topics(
    event_name: str,
    record_tag: str | None = None,
    person_iso2: str | None = None,
) -> tuple[str, str]:
    """
    生成中英文话题标签行。
    event_name: WCA 事件全名（如 "4x4x4 Cube"）
    record_tag: 纪录类型 "WR"/"NR"/"CR" 或 None（非纪录）
    person_iso2: 选手国家代码（NR/CR 时用于确定国名/洲名）
    返回 (cn_topics, en_topics)
    """
    # NOTE: 基础话题：#魔方 + 具体项目
    event_cn = EVENT_CN_MAP.get(event_name, event_name).strip()
    event_en = _EVENT_TAG_EN.get(event_name, event_name.lower().replace(" ", ""))
    cn_tags = [f"#魔方", f"#{event_cn}"]
    en_tags = [f"#rubikscube", f"#{event_en}"]

    # NOTE: 纪录话题
    if record_tag == "WR":
        cn_tags.append("#世界纪录")
        en_tags.append("#worldrecord")
    elif record_tag == "NR" and person_iso2:
        country_cn = COUNTRY_CN_MAP.get(person_iso2, "")
        if country_cn:
            cn_tags.append(f"#{country_cn}纪录")
        en_tags.append("#nationalrecord")
    elif record_tag == "CR" and person_iso2:
        cr_abbr = ISO2_TO_CR.get(person_iso2, "CR")
        cr_cn = CR_ABBR_CN.get(cr_abbr, "洲际纪录")
        cn_tags.append(f"#{cr_cn}")
        en_tags.append("#continentalrecord")

    return " ".join(cn_tags), " ".join(en_tags)


# 将用户输入的项目缩写映射到 WCA event name
# NOTE: 覆盖常见的非规范写法（视频标题中常见的缩写）
_EVENT_ALIAS = {}
for _name, _abbr in EVENT_EN_MAP.items():
    _EVENT_ALIAS[_abbr.lower()] = _name
# 补充常见别名
_EVENT_ALIAS.update({
    "3x3": "3x3x3 Cube",
    "2x2": "2x2x2 Cube",
    "4x4": "4x4x4 Cube",
    "5x5": "5x5x5 Cube",
    "6x6": "6x6x6 Cube",
    "7x7": "7x7x7 Cube",
    # NOTE: 视频标题中常用完整写法 NxNxN
    "2x2x2": "2x2x2 Cube",
    "3x3x3": "3x3x3 Cube",
    "4x4x4": "4x4x4 Cube",
    "5x5x5": "5x5x5 Cube",
    "6x6x6": "6x6x6 Cube",
    "7x7x7": "7x7x7 Cube",
    "3bld": "3x3x3 Blindfolded",
    "4bld": "4x4x4 Blindfolded",
    "5bld": "5x5x5 Blindfolded",
    "mbld": "3x3x3 Multi-Blind",
    "multi": "3x3x3 Multi-Blind",
    "multibld": "3x3x3 Multi-Blind",
    "fmc": "3x3x3 Fewest Moves",
    "oh": "3x3x3 One-Handed",
    "mega": "Megaminx",
    "megaminx": "Megaminx",
    "pyra": "Pyraminx",
    "pyraminx": "Pyraminx",
    "sq1": "Square-1",
    "square-1": "Square-1",
    "cube": "3x3x3 Cube",
})


def _score_match(record: dict, keywords: list[str]) -> int:
    """
    计算纪录与用户输入关键词的匹配度。
    越高越匹配，0 = 完全不匹配。
    """
    result = record["result"]
    person = result["person"]
    event = result["round"]["competitionEvent"]["event"]
    event_id = event["id"]

    person_name = person["name"].lower()
    event_name = event["name"].lower()
    time_str = format_time(record["attemptResult"], event_id)

    score = 0
    for kw in keywords:
        kw_lower = kw.lower()

        # 选手名匹配（部分匹配即可，如姓氏）
        if kw_lower in person_name:
            score += 10

        # 成绩匹配（精确匹配格式化后的成绩字符串）
        if kw_lower == time_str.lower():
            score += 20

        # 项目匹配：先通过别名表找到标准名，再比较
        matched_event = _EVENT_ALIAS.get(kw_lower)
        if matched_event and matched_event.lower() == event_name:
            score += 5

        # 纪录类型匹配
        tag = record["tag"]
        if kw_lower in ("wr", "world record") and tag == "WR":
            score += 3
        elif kw_lower in ("nr", "national record") and tag == "NR":
            score += 3
        elif kw_lower in ("cr", "continental record") and tag == "CR":
            score += 3

        # 单次/平均匹配
        rec_type = record["type"]
        if kw_lower in ("single", "s") and rec_type == "single":
            score += 2
        elif kw_lower in ("average", "avg", "a") and rec_type == "average":
            score += 2

    return score


def _parse_keywords(text: str) -> list[str]:
    """
    将用户输入拆分为关键词列表。
    保留数字（包括小数）、英文单词，去掉常见废词。
    """
    # NOTE: 用空格、常见分隔符和括号拆分
    # 括号作为分隔符而非简单去除，避免 "Average(Finally" 粘成 "AverageFinally"
    tokens = re.split(r"[\s,|\-\[\]()]+", text.strip())
    # 去除尾部标点，如 Average! → Average, singel: → singel
    tokens = [t.rstrip("!?.:;") for t in tokens]
    # 过滤掉纯粹的废词和空串
    # NOTE: YouTube 魔方视频标题常见的修饰词，不应被当作选手名
    # wr/nr/cr 也作为废词过滤：标题中的 NR/WR 不可靠，纪录类型只从 API 确认
    stopwords = {
        "in", "at", "the", "a", "an", "of", "by", "new", "record",
        "breaking", "news", "official", "rubik's", "rubiks", "cube",
        "from", "pr", "pb", "wr", "nr", "cr", "national", "world", "continental", "holder",
        "my", "best", "ever", "so", "close", "to", "solve",
        # NOTE: 多语言介词（瑞典语 av、德语 von、西语/法语 de 等）
        "av", "von", "de", "och", "und", "et",
    }
    return [t for t in tokens if t and t.lower() not in stopwords]


# NOTE: 最低匹配分数门槛。
# 真正的纪录视频标题通常含成绩(+20) + 选手名(+10) + 项目(+5) = 35+。
# 阈值 15 可以过滤掉只靠 "single"(+2) 或 "3x3"(+5) 碰巧命中的误匹配。
_MIN_MATCH_SCORE = 15


def find_matching_records(keywords: list[str], records: list[dict]) -> list[tuple[dict, int]]:
    """按匹配度排序返回 [(record, score)]，只返回 score >= _MIN_MATCH_SCORE 的"""
    scored = []
    for r in records:
        s = _score_match(r, keywords)
        if s >= _MIN_MATCH_SCORE:
            scored.append((r, s))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def print_record_summary(record: dict, idx: int = 0):
    """打印纪录的简要信息"""
    tag = record["tag"]
    rec_type = record["type"]
    result = record["result"]
    person = result["person"]
    event = result["round"]["competitionEvent"]["event"]
    comp = result["round"]["competitionEvent"]["competition"]
    time_str = format_time(record["attemptResult"], event["id"])
    type_str = "Single" if rec_type == "single" else "Avg"

    prefix = f"  [{idx}]" if idx else "  "
    print(f"{prefix} {tag} | {time_str} {event['name']} {type_str} | {person['name']} | {comp['name']}")


def strip_prefix(text: str) -> str:
    """
    去掉纪录快讯前缀，只保留纪录内容部分。
    "纪录快讯! 5.55..." → "5.55..."
    "BREAKING NEWS! 5.55..." → "5.55..."
    "Breaking News! 5.55..." → "5.55..."
    """
    for prefix in ["纪录快讯! ", "BREAKING NEWS! ", "Breaking News! "]:
        if text.startswith(prefix):
            return text[len(prefix):]
    return text


def print_formatted(record: dict):
    """打印格式化后的标题和话题，可直接复制使用"""
    cn, en, url = format_record_message(record)
    # NOTE: 从 record 中提取话题所需信息
    tag = record["tag"]
    event_name = record["result"]["round"]["competitionEvent"]["event"]["name"]
    iso2 = record["result"]["person"]["country"]["iso2"]
    cn_topics, en_topics = generate_topics(event_name, record_tag=tag, person_iso2=iso2)
    print()
    print(f"  info_chs: {strip_prefix(cn)}")
    print(f"            {cn_topics}")
    print(f"  info_eng: {strip_prefix(en)}")
    print(f"            {en_topics}")
    print(f"  链接: {url}")
    print()


def write_info_files(record: dict, out_dir: str):
    """
    将中英文标题写入 info_chs.md 和 info_eng.md。
    每个文件三行：标题、话题、简介（空行）。
    去掉 "纪录快讯!/Breaking News!" 前缀，直接覆盖。
    """
    from pathlib import Path
    cn, en, url = format_record_message(record)
    cn_title = strip_prefix(cn)
    en_title = strip_prefix(en)

    # NOTE: 从 record 中提取话题所需信息
    tag = record["tag"]
    event_name = record["result"]["round"]["competitionEvent"]["event"]["name"]
    iso2 = record["result"]["person"]["country"]["iso2"]
    cn_topics, en_topics = generate_topics(event_name, record_tag=tag, person_iso2=iso2)

    out = Path(out_dir)
    for fname, title, topics in [
        ("info_chs.md", cn_title, cn_topics),
        ("info_eng.md", en_title, en_topics),
    ]:
        fpath = out / fname
        fpath.write_text(f"{title}\n{topics}\n\n", encoding="utf-8")


def list_all_records(records: list[dict]):
    """列出所有近期纪录"""
    print(f"\nWCA Live 近期纪录 (共 {len(records)} 条):\n")
    for i, r in enumerate(records, 1):
        print_record_summary(r, i)
    print()


# === WCA REST API 回退逻辑 ===
# NOTE: 当 WCA Live recentRecords 匹配失败时（非纪录视频），
# 用 WCA REST API 查询选手信息和比赛历史来组装通用标题。

WCA_API = "https://www.worldcubeassociation.org/api/v0"

# WCA API event_id → event full name 的映射
_EVENT_ID_TO_NAME = {
    "222": "2x2x2 Cube", "333": "3x3x3 Cube", "444": "4x4x4 Cube",
    "555": "5x5x5 Cube", "666": "6x6x6 Cube", "777": "7x7x7 Cube",
    "333bf": "3x3x3 Blindfolded", "333fm": "3x3x3 Fewest Moves",
    "333oh": "3x3x3 One-Handed", "clock": "Clock", "minx": "Megaminx",
    "pyram": "Pyraminx", "skewb": "Skewb", "sq1": "Square-1",
    "444bf": "4x4x4 Blindfolded", "555bf": "5x5x5 Blindfolded",
    "333mbf": "3x3x3 Multi-Blind",
}


# 频道名映射表路径
_CHANNEL_ALIASES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "channel_aliases.json")


def _load_channel_alias(channel_name: str = "",
                        channel_id: str = "") -> dict | None:
    """
    查 channel_aliases.json，按频道名（key）或频道 ID 匹配。
    返回 {wca_id, channel_id?} 或 None。
    频道名可能变，channel_id 永久唯一，两个都查。
    """
    if not os.path.exists(_CHANNEL_ALIASES_PATH):
        return None
    try:
        with open(_CHANNEL_ALIASES_PATH, "r", encoding="utf-8") as f:
            aliases = json.load(f)
        # 优先按频道名（key）查
        if channel_name and channel_name in aliases:
            return aliases[channel_name]
        # 再按 channel_id 遍历查
        if channel_id:
            for entry in aliases.values():
                if entry.get("channel_id") == channel_id:
                    return entry
        return None
    except Exception:
        return None


def _save_channel_alias(channel_name: str, wca_id: str,
                        channel_id: str = ""):
    """
    自动保存频道→WCA ID 映射到缓存。
    已有的手动条目不会被覆盖（按 channel_name key 判断）。
    """
    try:
        aliases = {}
        if os.path.exists(_CHANNEL_ALIASES_PATH):
            with open(_CHANNEL_ALIASES_PATH, "r", encoding="utf-8") as f:
                aliases = json.load(f)
        # 不覆盖已有条目
        if channel_name in aliases:
            return
        entry = {"wca_id": wca_id}
        if channel_id:
            entry["channel_id"] = channel_id
        aliases[channel_name] = entry
        with open(_CHANNEL_ALIASES_PATH, "w", encoding="utf-8") as f:
            json.dump(aliases, f, ensure_ascii=False, indent=2)
        print(f"  已缓存映射: {channel_name} → {wca_id}")
    except Exception:
        pass


def search_wca_person(name: str) -> list[dict]:
    """
    用 WCA REST API 搜索选手，返回候选人列表 [{wca_id, name, country_iso2}, ...]。
    优先精确匹配名字，如果没有精确匹配则取第一个结果。
    """
    try:
        # NOTE: YouTube 频道名常用连字符（如 Seung-Hyuk），WCA 用空格
        search_name = name.replace("-", " ")
        r = requests.get(
            f"{WCA_API}/search/users",
            params={"q": search_name, "persons_table": "true"},
            timeout=10,
        )
        r.raise_for_status()
        results = r.json().get("result", [])
        if not results:
            return []

        # NOTE: 优先精确匹配。WCA 名字可能含括号内的本地名（如 "Seung Hyuk Nahm (남승혁)"），
        # 比较时去掉括号部分和连字符。
        search_lower = search_name.lower()
        def _normalize(n: str) -> str:
            """去掉括号内容和连字符"""
            return re.sub(r"\s*\([^)]*\)", "", n).replace("-", " ").strip().lower()

        exact = [p for p in results if _normalize(p["name"]) == search_lower]

        candidates = exact if exact else [results[0]]
        return [
            {"wca_id": p["wca_id"], "name": p["name"], "country_iso2": p["country_iso2"]}
            for p in candidates
        ]
    except Exception as e:
        print(f"  WCA API 搜人失败: {e}")
        return []


def find_competition_by_result(
    wca_id: str, time_cs: int, event_id: str, is_average: bool
) -> dict | None:
    """
    用 WCA REST API 查选手成绩，反查出对应的比赛。
    time_cs: 成绩（厘秒），event_id: WCA 项目 ID（如 '333'），
    is_average: True=查 average，False=查 best。
    返回 {comp_id, comp_name, comp_country_iso2, record_tag} 或 None。
    record_tag: 纪录标记（"WR"/"CR"/"NR" 或 None）。
    """
    # 第一步：查选手历史成绩（匹配成绩+项目）
    try:
        # NOTE: results 可能有 1000+ 条，需要较长超时
        print("  查询选手历史成绩...")
        r = requests.get(f"{WCA_API}/persons/{wca_id}/results", timeout=20)
        r.raise_for_status()
        all_results = r.json()
    except Exception as e:
        print(f"  WCA API 查成绩失败: {e}")
        return None

    # 按成绩 + 项目过滤
    field = "average" if is_average else "best"
    # NOTE: 同时提取 NR/CR/WR 纪录标记
    record_field = "regional_average_record" if is_average else "regional_single_record"
    matching_comps = []
    record_tag = None  # NR/CR/WR 或 None
    for res in all_results:
        if res["event_id"] == event_id and res.get(field) == time_cs:
            matching_comps.append(res["competition_id"])
            # NOTE: 取最新匹配记录的纪录标记（列表按时间顺序，后面覆盖前面）
            record_tag = res.get(record_field)

    print(f"  获取到 {len(all_results)} 条成绩，匹配 {len(matching_comps)} 条")

    if not matching_comps:
        return None

    # 取最后一个（最近的比赛），API 结果按时间顺序排列
    target_comp_id = matching_comps[-1]

    # 第二步：查比赛详情（获取比赛名称和国家）
    # NOTE: 即使这步失败，也要保留已获取的 record_tag 和 comp_id
    try:
        print("  查询比赛详情...")
        r2 = requests.get(f"{WCA_API}/persons/{wca_id}/competitions", timeout=10)
        r2.raise_for_status()
        comps = r2.json()
        print(f"  获取到 {len(comps)} 场比赛")

        # 记录最后一场比赛日期，用于 WCA Live 最新比赛查找
        last_date = comps[-1]["start_date"] if comps else "2000-01-01"

        for comp in comps:
            if comp["id"] == target_comp_id:
                return {
                    "comp_id": comp["id"],
                    "comp_name": comp["name"],
                    "comp_country_iso2": comp["country_iso2"],
                    "rest_last_date": last_date,
                    "record_tag": record_tag,
                }

        # 比赛没在列表里（成绩还没上传到 WCA 官网），用 ID 作为名字
        return {
            "comp_id": target_comp_id,
            "comp_name": target_comp_id,
            "comp_country_iso2": "",
            "rest_last_date": last_date,
            "record_tag": record_tag,
        }
    except Exception as e:
        # FIXME: 比赛列表获取失败，但成绩已匹配到——
        # 返回 comp_id 作为比赛名（不完美，但保留了 record_tag 不丢信息）
        print(f"  WCA API 查比赛失败: {e}")
        return {
            "comp_id": target_comp_id,
            "comp_name": target_comp_id,
            "comp_country_iso2": "",
            "rest_last_date": "2000-01-01",
            "record_tag": record_tag,
        }


WCA_LIVE_API = "https://live.worldcubeassociation.org/api"


def find_latest_live_competition(
    wca_id: str, rest_last_date: str
) -> dict | None:
    """
    从 WCA Live 查找选手注册的比 rest_last_date 更新的比赛。
    用 competitions(from) 一次查询拿到所有近期比赛和参赛者，本地匹配。
    返回 {comp_id, comp_name, comp_country_iso2} 或 None。
    """
    try:
        from datetime import date, timedelta
        # NOTE: 从 REST API 最后一场日期的次日开始查，避免重复
        since = rest_last_date
        today = date.today().isoformat()

        # 一次查询拿到所有新比赛 + 全部 competitors
        q = ('{ competitions(from: "%s") { id name startDate '
             'venues { country { iso2 } } '
             'competitors { wcaId } } }' % since)
        r = requests.post(WCA_LIVE_API, json={"query": q}, timeout=15)
        data = r.json()
        if "errors" in data:
            return None

        all_comps = data.get("data", {}).get("competitions", [])

        # 只看已开始的比赛（排除未来的），且比 REST API 更新
        recent = [c for c in all_comps
                  if c["startDate"] > rest_last_date and c["startDate"] <= today]

        if not recent:
            return None

        # 在本地匹配选手 wcaId
        matched = []
        for c in recent:
            if any(p.get("wcaId") == wca_id for p in c.get("competitors", [])):
                matched.append(c)

        if not matched:
            return None

        # 取日期最近的那场
        matched.sort(key=lambda c: c["startDate"], reverse=True)
        best = matched[0]
        iso2 = ""
        if best.get("venues"):
            iso2 = best["venues"][0].get("country", {}).get("iso2", "")

        print(f"  WCA Live 找到: {best['name']} ({best['startDate']})")
        return {
            "comp_id": str(best["id"]),
            "comp_name": best["name"],
            "comp_country_iso2": iso2,
        }
    except Exception as e:
        print(f"  WCA Live 查比赛失败: {e}")
        return None


# NOTE: 多语言类型别名（瑞典语 singel、德语 einzelversuch 等）
_TYPE_SINGLE_ALIASES = {"single", "s", "solve", "singel"}
_TYPE_AVERAGE_ALIASES = {"average", "avg", "a", "ao5", "mean", "mo3"}


def _extract_title_parts(keywords: list[str], uploader: str | None = None) -> dict:
    """
    从关键词列表中分离出 成绩/项目/类型。
    选手名优先从 uploader（视频发布者）获取。
    返回 {time_str, event_name, event_id, rec_type, person_name, leftover}。
    leftover: 未被识别为成绩/项目/类型的关键词（可能包含选手名）。
    """
    time_str = None
    event_name = None
    event_id = None
    rec_type = "single"  # 默认
    leftover = []  # 未识别的关键词

    for kw in keywords:
        kw_lower = kw.lower()

        # 成绩：匹配数字格式（如 4.89, 1:23.45）
        if re.match(r"^\d+[.:]\d[\d.]*$", kw):
            if not time_str:
                time_str = kw
            continue

        # 项目：通过别名表匹配
        matched = _EVENT_ALIAS.get(kw_lower)
        if matched:
            event_name = matched
            # 反查 event_id
            for eid, ename in _EVENT_ID_TO_NAME.items():
                if ename == matched:
                    event_id = eid
                    break
            continue

        # 类型
        if kw_lower in _TYPE_SINGLE_ALIASES:
            rec_type = "single"
            continue
        if kw_lower in _TYPE_AVERAGE_ALIASES:
            rec_type = "average"
            continue

        # NOTE: 未识别的关键词保留在 leftover（可能是人名）
        leftover.append(kw)

    # NOTE: 选手名优先从视频发布者获取
    person = uploader
    if person:
        # 去除非拉丁字符（如韩文「남승혁」），只保留英文名
        person = re.sub(r"[^\x00-\x7F]+", "", person).strip()

    return {
        "time_str": time_str,
        "event_name": event_name or "3x3x3 Cube",
        "event_id": event_id or "333",
        "rec_type": rec_type,
        "person_name": person if person else None,
        "leftover": leftover,
    }


def _time_str_to_centiseconds(time_str: str) -> int | None:
    """将时间字符串转换为厘秒。如 '4.89' → 489, '1:23.45' → 8345"""
    try:
        if ":" in time_str:
            parts = time_str.split(":")
            minutes = int(parts[0])
            seconds = float(parts[1])
            # NOTE: 用 round 而非 int 截断，避免浮点精度问题
            # 例如 float('4.89') * 100 = 488.999...  int → 488  round → 489
            return round((minutes * 60 + seconds) * 100)
        else:
            return round(float(time_str) * 100)
    except (ValueError, IndexError):
        return None


def format_general_title(
    time_str: str, event_name: str, rec_type: str,
    person_name: str, person_iso2: str,
    comp_name: str | None, comp_iso2: str | None,
    is_pr: bool = False,
    event_id: str | None = None,
    time_cs: int | None = None,
    record_tag: str | None = None,
) -> tuple[str, str]:
    """
    组装通用中英文标题（fallback 路径）。
    record_tag: REST API 的纪录标记（"NR"/"CR"/"WR" 或 None），优先于 PR 逻辑。
    event_id/time_cs: 用于查询世界排名后缀 /WRxx。
    返回 (cn_title, en_title)。
    """
    event_cn = EVENT_CN_MAP.get(event_name, event_name)
    event_en = EVENT_EN_MAP.get(event_name, event_name)
    type_cn = "单次" if rec_type == "single" else "平均"
    type_en = "Single" if rec_type == "single" else "Avg"
    pr_tag = "PR" if is_pr else ""
    person_flag = country_flag(person_iso2) if person_iso2 else ""

    # NOTE: 用 split_name 拆分中英文名
    cn_name, en_name = split_name(person_name, person_iso2)

    # NOTE: 先查世界排名
    rank = None
    if event_id and time_cs:
        rank = RANKINGS.get_world_rank(event_id, rec_type, time_cs)

    # NOTE: 纪录标签优先级：NR/CR/WR > PR > 纯排名
    # NR+排名 → 韩国纪录🇰🇷NR/WR26（中文），🇰🇷NR/WR26（英文）
    # WR → 世界纪录WR（无需排名后缀，WR 本身就是第1）
    if record_tag:
        if record_tag == "NR":
            country_cn = COUNTRY_CN_MAP.get(person_iso2, "")
            cn_record = f"{country_cn}纪录{person_flag}" if country_cn else f"NR{person_flag}"
            en_record = f"{person_flag}"
            if rank:
                tag = f"{record_tag}/WR{rank}"
            else:
                tag = record_tag
            cn_tag_str = f"{cn_record}{tag}"
            en_tag_str = f"{en_record}{tag}"
        elif record_tag == "CR":
            cr_abbr = ISO2_TO_CR.get(person_iso2, "CR")
            cr_cn = CR_ABBR_CN.get(cr_abbr, "洲际纪录")
            cn_record = f"{cr_cn}{person_flag}"
            en_record = f"{person_flag}"
            if rank:
                tag = f"{cr_abbr}/WR{rank}"
            else:
                tag = cr_abbr
            cn_tag_str = f"{cn_record}{tag}"
            en_tag_str = f"{en_record}{tag}"
        else:  # WR
            cn_tag_str = f"世界纪录WR"
            en_tag_str = f"WR"
            # NOTE: WR 不显示排名后缀（WR1 无意义）
        # NOTE: 有纪录标记时不显示选手国旗（已包含在纪录前缀中）
        cn = f"{time_str}{event_cn}{type_cn}{cn_tag_str} {en_name}"
        en = f"{time_str} {event_en}{en_tag_str} {type_en} {en_name}"
    else:
        # 无纪录标记：保持原有 PR/WRxx 逻辑
        if is_pr and rank:
            tag = f"PR/WR{rank}"
        elif is_pr:
            tag = "PR"
        elif rank:
            tag = f"WR{rank}"
        else:
            tag = ""
        cn = f"{time_str}{event_cn}{type_cn}{tag} {cn_name}{person_flag}"
        en = f"{time_str} {event_en} {tag + ' ' if tag else ''}{type_en} {en_name}{person_flag}"

    if comp_name:
        comp_flag = country_flag(comp_iso2) if comp_iso2 else ""
        cn += f" | {comp_name}{comp_flag}"
        en += f" | {comp_name}{comp_flag}"

    return cn, en


def fallback_wca_api(
    keywords: list[str], write_dir: str | None,
    uploader: str | None = None,
    channel_id: str | None = None,
) -> bool:
    """
    纪录匹配失败后的回退：用 WCA REST API 查询选手和比赛信息。
    uploader: YouTube 频道名，作为选手名的首选来源。
    channel_id: YouTube 频道 ID，用于查 channel_aliases.json 映射。
    成功则输出/写入标题并返回 True，失败返回 False。
    """
    parts = _extract_title_parts(keywords, uploader=uploader)
    if not parts["person_name"] or not parts["time_str"]:
        return False

    # NOTE: personal_records 用于判断成绩是否为 PR（个人最佳）
    personal_records = {}

    # NOTE: 先查频道映射表（按频道名或频道ID），处理缩写频道名
    alias = _load_channel_alias(parts["person_name"], channel_id or "")
    if alias:
        wca_id = alias["wca_id"]
        print(f"\n  频道映射命中: WCA ID = {wca_id}")
        # 用 /persons/{wca_id} 直接查选手真名、国家和 PR
        try:
            r = requests.get(f"{WCA_API}/persons/{wca_id}", timeout=10)
            resp = r.json()
            p = resp.get("person", {})
            personal_records = resp.get("personal_records", {})
            candidates = [{"wca_id": wca_id,
                           "name": p.get("name", wca_id),
                           "country_iso2": p.get("country_iso2", "")}]
            print(f"  选手: {candidates[0]['name']} ({candidates[0]['country_iso2']})")
        except Exception:
            candidates = [{"wca_id": wca_id, "name": wca_id, "country_iso2": ""}]
    else:
        print(f"\n  回退: WCA API 查询 '{parts['person_name']}'...")
        candidates = search_wca_person(parts["person_name"])
        # NOTE: 唯一匹配时自动缓存，下次直接命中
        if len(candidates) == 1 and channel_id:
            _save_channel_alias(parts["person_name"],
                                candidates[0]["wca_id"], channel_id)
        elif len(candidates) == 1:
            _save_channel_alias(parts["person_name"],
                                candidates[0]["wca_id"])
        # NOTE: 获取 personal_records 用于 PR 判断
        if len(candidates) == 1:
            try:
                r = requests.get(f"{WCA_API}/persons/{candidates[0]['wca_id']}", timeout=10)
                personal_records = r.json().get("personal_records", {})
            except Exception:
                pass
    if not candidates:
        # NOTE: uploader 不是 WCA 选手（如魔方协会频道），
        # 尝试用标题中未识别的 token 作为候选人名查 WCA API
        leftover = parts.get("leftover", [])
        if leftover:
            fallback_name = " ".join(leftover)
            print(f"  uploader 非选手，尝试从标题提取: '{fallback_name}'")
            candidates = search_wca_person(fallback_name)
            if len(candidates) == 1:
                # NOTE: 获取 personal_records 用于 PR 判断
                try:
                    r = requests.get(f"{WCA_API}/persons/{candidates[0]['wca_id']}", timeout=10)
                    personal_records = r.json().get("personal_records", {})
                except Exception:
                    pass
        if not candidates:
            print("  未找到 WCA 选手")
            return False

    if len(candidates) > 1:
        print(f"  找到 {len(candidates)} 个同名选手，用成绩消歧...")

    # NOTE: 重名消歧：逐个候选人查成绩，谁有匹配成绩就用谁
    time_cs = _time_str_to_centiseconds(parts["time_str"])
    person = candidates[0]
    comp = None
    rest_last_date = "2000-01-01"  # REST API 最后一场比赛的日期

    if time_cs:
        is_avg = parts["rec_type"] == "average"
        for candidate in candidates:
            print(f"  尝试: {candidate['name']} ({candidate['country_iso2']})")
            result = find_competition_by_result(
                candidate["wca_id"], time_cs, parts["event_id"], is_avg
            )
            if result:
                person = candidate
                comp = result
                # 记录 REST API 最后一场日期，用于后续 WCA Live 查询
                rest_last_date = result.get("rest_last_date", rest_last_date)
                break
    else:
        print(f"  找到: {person['name']} ({person['country_iso2']})")

    # NOTE: WCA REST API 成绩有几天延迟。
    # 只在 REST API 完全未找到比赛时，才用 WCA Live 补充比赛信息。
    # 如果 REST API 已找到成绩（comp 有值），不覆盖——宁可用 comp_id 做比赛名，
    # 也不能猜一个最近的比赛导致张冠李戴。
    if not comp:
        live_comp = find_latest_live_competition(person["wca_id"], rest_last_date)
        if live_comp:
            comp = live_comp
    elif comp.get("comp_name") == comp.get("comp_id"):
        # NOTE: REST API 成绩匹配到了但比赛详情获取失败（comp_name == comp_id），
        # 尝试用 WCA Live 补充比赛名，但保留 record_tag
        live_comp = find_latest_live_competition(person["wca_id"], rest_last_date)
        if live_comp and live_comp.get("comp_id"):
            # 仅补充比赛名和国家，不替换 record_tag
            comp["comp_name"] = live_comp["comp_name"]
            comp["comp_country_iso2"] = live_comp.get("comp_country_iso2", "")

    if comp:
        print(f"  比赛: {comp['comp_name']}")
    else:
        print(f"  选手: {person['name']} ({person['country_iso2']})")
        if time_cs:
            print("  未找到对应比赛成绩")

    # NOTE: 判断成绩是否为 PR（个人最佳）
    # WCA API 数据有几天延迟，若视频成绩优于（<=）官网 PR，同样是 PR
    is_pr = False
    time_cs = _time_str_to_centiseconds(parts["time_str"])
    if time_cs and personal_records:
        pr_type = "average" if parts["rec_type"] == "average" else "single"
        pr_data = personal_records.get(parts["event_id"], {}).get(pr_type, {})
        pr_best = pr_data.get("best")
        if pr_best and time_cs <= pr_best:
            is_pr = True
            print(f"  ✓ 成绩是 {parts['event_name']} {pr_type} PR")

    # NOTE: 从 find_competition_by_result 返回值提取纪录标记（NR/CR/WR）
    record_tag = comp.get("record_tag") if comp else None
    if record_tag:
        print(f"  ✓ 成绩是 {parts['event_name']} {record_tag}")

    cn, en = format_general_title(
        parts["time_str"], parts["event_name"], parts["rec_type"],
        person["name"], person["country_iso2"],
        comp["comp_name"] if comp else None,
        comp["comp_country_iso2"] if comp else None,
        is_pr=is_pr,
        event_id=parts["event_id"],
        time_cs=time_cs,
        record_tag=record_tag,
    )

    # NOTE: 有纪录标记时生成对应话题（#韩国纪录 等），否则只含基础项目
    cn_topics, en_topics = generate_topics(
        parts["event_name"], record_tag=record_tag, person_iso2=person["country_iso2"]
    )

    print()
    print(f"  info_chs: {cn}")
    print(f"            {cn_topics}")
    print(f"  info_eng: {en}")
    print(f"            {en_topics}")
    print()

    # 写入 info 文件（三行：标题、话题、简介）
    if write_dir:
        from pathlib import Path
        out = Path(write_dir)
        for fname, title, topics in [
            ("info_chs.md", cn, cn_topics),
            ("info_eng.md", en, en_topics),
        ]:
            fpath = out / fname
            fpath.write_text(f"{title}\n{topics}\n\n", encoding="utf-8")

    return True


def interactive_mode(records: list[dict]):
    """交互模式：循环输入关键词搜索纪录"""
    print("\n=== 纪录标题生成工具 ===")
    print(f"已加载 {len(records)} 条近期纪录")
    print("输入关键词搜索（如: 5.55 3x3 Nahm），输入 list 列出全部，输入 q 退出\n")

    while True:
        try:
            user_input = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input:
            continue
        if user_input.lower() in ("q", "quit", "exit"):
            break
        if user_input.lower() == "list":
            list_all_records(records)
            continue

        keywords = _parse_keywords(user_input)
        if not keywords:
            print("  请输入有效的关键词\n")
            continue

        matches = find_matching_records(keywords, records)

        if not matches:
            print("  未找到匹配纪录，试试其他关键词\n")
            continue

        if len(matches) == 1 or matches[0][1] > matches[1][1] * 1.5:
            # 唯一匹配或最高分明显领先 → 直接输出
            print_formatted(matches[0][0])
        else:
            # 多条匹配 → 列出让用户选择
            print(f"\n  找到 {len(matches)} 条匹配，请选择：\n")
            top = matches[:8]
            for i, (r, s) in enumerate(top, 1):
                print_record_summary(r, i)

            try:
                choice = input("\n  输入编号 (1-{}): ".format(len(top))).strip()
                idx = int(choice) - 1
                if 0 <= idx < len(top):
                    print_formatted(top[idx][0])
                else:
                    print("  无效编号\n")
            except (ValueError, EOFError, KeyboardInterrupt):
                print()
                continue


def main():
    raw_args = sys.argv[1:]

    # 解析 --write <目录> 参数
    write_dir = None
    if "--write" in raw_args:
        wi = raw_args.index("--write")
        if wi + 1 < len(raw_args):
            write_dir = raw_args[wi + 1]
            raw_args = raw_args[:wi] + raw_args[wi + 2:]
        else:
            raw_args = raw_args[:wi]

    # --uploader: YouTube 频道名，用作选手名的首选来源
    uploader = None
    ui = next((i for i, a in enumerate(raw_args) if a == "--uploader"), -1)
    if ui >= 0:
        if ui + 1 < len(raw_args):
            uploader = raw_args[ui + 1]
            raw_args = raw_args[:ui] + raw_args[ui + 2:]
        else:
            raw_args = raw_args[:ui]

    # --channel-id: YouTube 频道 ID，用于查 channel_aliases.json
    channel_id = None
    ci = next((i for i, a in enumerate(raw_args) if a == "--channel-id"), -1)
    if ci >= 0:
        if ci + 1 < len(raw_args):
            channel_id = raw_args[ci + 1]
            raw_args = raw_args[:ci] + raw_args[ci + 2:]
        else:
            raw_args = raw_args[:ci]

    # --auto: 非交互模式，匹配失败时静默退出
    auto_mode = "--auto" in raw_args

    args = [a for a in raw_args if not a.startswith("--")]
    flags = [a for a in raw_args if a.startswith("--")]

    # 初始化排名缓存（用于 /WRxx 后缀）
    print("加载世界排名数据...")
    RANKINGS.update_all()

    print("查询 WCA Live 近期纪录...")
    records = query_recent_records()
    print(f"获取到 {len(records)} 条纪录")

    # --list: 列出全部
    if "--list" in flags:
        list_all_records(records)
        return

    # 命令行模式：参数作为关键词
    if args:
        all_text = " ".join(args)
        keywords = _parse_keywords(all_text)

        # NOTE: 有 uploader 时，先按选手身份过滤纪录列表，再做关键词匹配
        # 杜绝标题关键词碰巧匹配到其他选手纪录的问题
        filtered_records = records
        if uploader:
            alias = _load_channel_alias(uploader, channel_id or "")
            uploader_wca_id = alias["wca_id"] if alias else None

            if uploader_wca_id:
                # 按 WCA ID 精确过滤
                filtered_records = [
                    r for r in records
                    if r["result"]["person"].get("wcaId") == uploader_wca_id
                ]
            else:
                # 无缓存时按名字模糊过滤
                ul = uploader.lower()
                filtered_records = [
                    r for r in records
                    if ul in r["result"]["person"]["name"].lower()
                ]

        matches = find_matching_records(keywords, filtered_records)
        if not matches:
            # NOTE: 诊断日志：说明 fallback 原因
            if len(filtered_records) == 0:
                print(f"\n  ⚠ WCA Live 无该选手纪录 → fallback")
            else:
                print(f"\n  ⚠ WCA Live 有 {len(filtered_records)} 条纪录但关键词不匹配 → fallback")
            if fallback_wca_api(keywords, write_dir, uploader=uploader,
                               channel_id=channel_id):
                return
            if auto_mode:
                print("未匹配到纪录，跳过")
                return
            print("\n未找到匹配纪录")
            sys.exit(1)

        best = matches[0][0]

        # 多条高分匹配时，auto 模式取第一条，手动模式提示
        if not auto_mode and len(matches) > 1 and matches[1][1] >= matches[0][1] * 0.7:
            print(f"  (还有 {len(matches) - 1} 条可能匹配，用交互模式查看)")

        # 输出最佳匹配
        print_formatted(best)

        # 写入 info 文件
        if write_dir:
            write_info_files(best, write_dir)
        return

    # 无参数 → 交互模式（auto 模式下直接退出）
    if auto_mode:
        print("无关键词，跳过")
        return
    interactive_mode(records)


if __name__ == "__main__":
    main()
