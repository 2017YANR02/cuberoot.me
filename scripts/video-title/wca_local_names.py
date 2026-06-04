"""
WCA 本地名(CJK localName)补全模块。

WCA Live GraphQL 的 person.name 不含括号注释 —— 例如返回 "Lim Hung",
而 WCA 主站 REST API 返回 "Lim Hung (林弘)"。本模块从 REST API 补查,
把 WCA Live 拿到的英文名升级成 "英文名 (本地名)" 的形式,再交给
record_format.split_name 拆出中文用于推送标题。

cubing.com 的 user.name 本来就是这种带括号形式,无需补查。
"""
import json
import logging
import requests
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_FILE = SCRIPT_DIR / "wca_local_names_cache.json"
WCA_PERSON_URL = "https://www.worldcubeassociation.org/api/v0/persons/{wca_id}"

log = logging.getLogger("wca_local_names")

_HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

_cache: dict = None


def _load() -> dict:
    global _cache
    if _cache is not None:
        return _cache
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _cache = json.load(f)
        except Exception as e:
            log.warning("load %s failed: %s; starting empty", CACHE_FILE.name, e)
            _cache = {}
    else:
        _cache = {}
    return _cache


def _save():
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_cache, f, ensure_ascii=False, indent=0)
    except Exception as e:
        log.warning("save %s failed: %s", CACHE_FILE.name, e)


def _fetch(wca_id: str) -> str:
    """返回 WCA 主站给的 name 字段(可能形如 'Lim Hung (林弘)' 或纯英文)"""
    r = requests.get(WCA_PERSON_URL.format(wca_id=wca_id),
                     headers=_HEADERS, timeout=10)
    r.raise_for_status()
    return r.json().get("name", "")


def enrich_name(name: str, wca_id: str) -> str:
    """
    如果 name 不含括号但本地缓存 / WCA REST API 知道选手的本地名,返回
    'English (本地)' 的拼合;否则原样返回 name。

    cache 行为:
      cache[wca_id] = "Lim Hung (林弘)"   # 有 localName
      cache[wca_id] = ""                  # 查过、无 localName(避免反复请求)
    """
    if not name or "(" in name or not wca_id:
        return name
    cache = _load()
    if wca_id in cache:
        cached = cache[wca_id]
        return cached if cached else name
    try:
        full = _fetch(wca_id)
    except requests.RequestException as e:
        log.debug("fetch %s failed: %s", wca_id, e)
        return name
    cache[wca_id] = full if "(" in full else ""
    _save()
    return cache[wca_id] if cache[wca_id] else name
