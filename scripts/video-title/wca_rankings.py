"""
WCA 世界排名模块

通过 WCA 官网的 JSON API 获取各项目 Top 100 排名数据。
请求方式：对排名页面 URL 发送 Accept: application/json 头，WCA 返回 JSON 格式的排名列表。

排名数据会缓存到本地 JSON 文件，3 天内有效，避免每次启动都请求 34 个榜单。

JSON API 格式示例:
GET https://www.worldcubeassociation.org/results/rankings/333/single
Accept: application/json
→ {"rows": [{"pos": 1, "best": 305, "average": 4429, ...}, ...]}
"""
import json
import logging
import random
import time
import requests
from pathlib import Path
from typing import Dict, Optional

log = logging.getLogger("wca_monitor.rankings")

SCRIPT_DIR = Path(__file__).resolve().parent
# 本地排名缓存文件
CACHE_FILE = SCRIPT_DIR / "rankings_cache.json"
# 缓存有效期（秒）：3 天（排名变化缓慢，无需频繁更新）
CACHE_TTL = 3 * 24 * 60 * 60

# 模拟浏览器请求头，关键是 Accept: application/json
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

# WCA 所有官方项目 ID
EVENT_IDS = [
    "333", "222", "444", "555", "666", "777",
    "333bf", "333fm", "333oh", "clock", "minx",
    "pyram", "skewb", "sq1", "444bf", "555bf", "333mbf"
]


class RankingCache:
    def __init__(self):
        # 结构: {event_id: {"single": {100th: int, ranks: [(score, rank)]}, "average": ...}}
        self._cache: Dict[str, Dict[str, dict]] = {}
        self._initialized = False

    def is_available(self) -> bool:
        return self._initialized

    def _load_disk_cache(self) -> bool:
        """尝试从磁盘加载有效的排名缓存，返回是否成功加载"""
        if not CACHE_FILE.exists():
            return False
        try:
            raw = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            cached_at = raw.get("cached_at", 0)
            if time.time() - cached_at > CACHE_TTL:
                log.info(f"排名缓存已过期 (>{CACHE_TTL // 3600}h)，需要重新获取")
                return False
            # ranks 在 JSON 中是 [[score,rank],...] 需要转回 tuple
            data = raw.get("data", {})
            for eid, types in data.items():
                self._cache[eid] = {}
                for tname, tdata in types.items():
                    self._cache[eid][tname] = {
                        "100th": tdata["100th"],
                        "ranks": [(s, r) for s, r in tdata["ranks"]],
                    }
            age_min = (time.time() - cached_at) / 60
            log.info(f"从本地缓存加载排名数据 ({age_min:.0f} 分钟前更新)")
            return True
        except Exception as e:
            log.warning(f"读取排名缓存失败: {e}")
            return False

    def _save_disk_cache(self):
        """将排名数据保存到磁盘"""
        try:
            serializable = {}
            for eid, types in self._cache.items():
                serializable[eid] = {}
                for tname, tdata in types.items():
                    serializable[eid][tname] = {
                        "100th": tdata["100th"],
                        "ranks": [list(pair) for pair in tdata["ranks"]],
                    }
            payload = {"cached_at": time.time(), "data": serializable}
            CACHE_FILE.write_text(
                json.dumps(payload, ensure_ascii=False), encoding="utf-8"
            )
            log.info(f"排名缓存已保存到 {CACHE_FILE.name}")
        except Exception as e:
            log.warning(f"保存排名缓存失败: {e}")

    def update_all(self):
        """
        全量更新所有项目的 Top 100 排名。
        优先使用本地缓存（3天 有效），缓存失效时通过 JSON API 获取。
        """
        # 尝试加载本地缓存
        if self._load_disk_cache():
            self._initialized = True
            return

        log.info("开始获取世界排名数据 (Top 100)，共 %d 个榜单...", len(EVENT_IDS) * 2)
        count = int(0)
        total = len(EVENT_IDS) * 2
        idx = int(0)

        for event_id in EVENT_IDS:
            self._cache.setdefault(event_id, {})
            for type_name in ["single", "average"]:
                idx += 1  # type: ignore
                try:
                    data = self._fetch_top100(event_id, type_name)
                    if data:
                        self._cache[event_id][type_name] = data
                        count += 1  # type: ignore
                        log.info(f"  [{idx}/{total}] {event_id}/{type_name} ✓ ({len(data['ranks'])} 条)")
                    else:
                        log.warning(f"  [{idx}/{total}] {event_id}/{type_name} ✗ (无数据)")
                except Exception as e:
                    log.warning(f"  [{idx}/{total}] {event_id}/{type_name} ✗ ({e})")

                # 短暂延迟防止限流 (0.3 ~ 0.6s)
                if idx < total:
                    time.sleep(random.uniform(0.3, 0.6))

        self._initialized = True
        log.info(f"世界排名获取完成: 成功 {count}/{total}")

        if count > 0:
            self._save_disk_cache()

    def get_world_rank(self, event_id: str, type_name: str, result: int) -> Optional[int]:
        """
        查询成绩的世界排名。
        如果成绩优于第100名，返回具体排名；否则返回 None。
        """
        if not self.is_available():
            return None

        type_key = "single" if type_name == "single" else "average"

        event_data = self._cache.get(event_id, {}).get(type_key)
        if not event_data:
            return None

        # 快速检查是否在 Top 100 内
        limit_100th = event_data["100th"]
        if limit_100th is not None and result > limit_100th:
            return None

        ranks = event_data["ranks"]

        # 新成绩比第一名还快 -> WR1
        if not ranks or result < ranks[0][0]:
            return 1

        # 线性查找（列表只有100项，足够快）
        for score, rank in ranks:
            if result <= score:
                return rank

        return None

    def _fetch_top100(self, event_id: str, type_name: str) -> Optional[dict]:
        """
        通过 WCA JSON API 获取单个榜单的 Top 100 数据。

        NOTE: WCA 排名页面在请求头中加 Accept: application/json 即可获取 JSON 响应，
        这是 WCA React 前端实际使用的 API。
        """
        url = f"https://www.worldcubeassociation.org/results/rankings/{event_id}/{type_name}"

        resp = requests.get(url, headers=_HEADERS, timeout=15)
        if resp.status_code != 200:
            log.warning(f"HTTP {resp.status_code} fetching {url}")
            return None

        data = resp.json()
        rows = data.get("rows", [])
        if not rows:
            return None

        # JSON API 返回的成绩字段：
        #   single 类型用 "best" 字段，average 类型用 "average" 字段
        # 成绩单位：厘秒（centiseconds），FMC 单位是步数，多盲有独立编码
        score_key = "best" if type_name == "single" else "average"

        ranks = []
        # NOTE: WCA JSON API 的 pos 字段不可靠（可能恒为 1），
        # 改用数组顺序推断排名。数据已按成绩从优到劣排序。
        # 并列处理：相同成绩共享同一排名
        prev_score = None
        for i, row in enumerate(rows):
            score = row.get(score_key)
            if score is None or score <= 0:
                continue
            # 并列：与前一名成绩相同则共享排名，否则排名 = 当前位置 + 1
            rank = ranks[-1][1] if (prev_score is not None and score == prev_score) else i + 1
            ranks.append((score, rank))
            prev_score = score

        if not ranks:
            return None

        return {
            "100th": ranks[-1][0],
            "ranks": ranks,
        }


# 全局单例
RANKINGS = RankingCache()

