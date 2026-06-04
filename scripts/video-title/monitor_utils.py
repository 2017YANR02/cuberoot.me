"""
WCA 监控套件 — 共享底座模块

提取三个监控脚本（纪录/粗饼比赛/WCA比赛）的通用逻辑：
- 配置加载
- 已知 ID 持久化
- Bark 推送
- 优雅停机
- 轮询休眠
- 日志初始化
- 国旗 Emoji
"""

import json
import logging
import signal
import sys
import time
from pathlib import Path

import requests

# === 路径 ===

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config.json"


# === 生命周期 ===

class GracefulKiller:
    """优雅停机信号捕获器，消除各脚本中重复的 nonlocal + signal 注册"""

    def __init__(self):
        self.kill_now = False
        signal.signal(signal.SIGINT, self._handler)
        signal.signal(signal.SIGTERM, self._handler)

    def _handler(self, signum, frame):
        self.kill_now = True


def poll_wait(seconds: int, killer: GracefulKiller):
    """带中断响应的按秒休眠器，替代各脚本中重复的 for _ in range() 样板"""
    for _ in range(seconds):
        if killer.kill_now:
            break
        time.sleep(1)


def setup_logging(name: str) -> logging.Logger:
    """统一日志格式"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    return logging.getLogger(name)


# === 配置 ===

def load_config() -> dict:
    """加载 config.json，校验必填字段并填充默认值"""
    if not CONFIG_PATH.exists():
        print(f"[ERROR] config.json not found: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    if not cfg.get("bark_device_key"):
        print("[ERROR] bark_device_key is required in config.json", file=sys.stderr)
        sys.exit(1)

    cfg.setdefault("bark_server", "https://api.day.app")
    # WCA Live 纪录监控默认 30 秒
    cfg.setdefault("poll_interval", 30)
    # 纪录类型过滤(两个纪录监控共用)
    cfg.setdefault("tags", ["WR", "CR"])
    # NR 国家过滤(两个纪录监控共用)
    cfg.setdefault("nr_countries", [])
    # 粗饼比赛监控默认 1 分钟
    cfg.setdefault("comp_poll_interval", 60)
    # WCA 比赛监控默认 1 分钟
    cfg.setdefault("wca_comp_poll_interval", 60)
    # 粗饼纪录监控默认 1 分钟(单场比赛 WS fetch 约 1-3 秒)
    cfg.setdefault("cubing_record_poll_interval", 60)
    # 粗饼纪录监控扫描窗口:扫 date.from 在过去 N 天内的中国比赛(默认 30 天)
    cfg.setdefault("cubing_record_window_days", 30)
    # WCA Live PR 扫描间隔(默认 60s,比 poll_interval 长以减少负载)
    cfg.setdefault("wca_pr_poll_interval", 60)
    # 关注选手目录(每个子目录名 = 一位选手 key,首字母 A-Z 前缀会被剥掉,
    # 其余作 key 与 cubing.com user.name 的括号内中文名 / 英文名匹配)。
    # 空则不开启 PR 监控,只推 WR/CR/NR。
    cfg.setdefault("watched_persons_dir", "")
    return cfg


# === 已知 ID 持久化 ===

def load_known_ids(path: Path) -> set:
    """从 JSON 文件加载已知 ID 集合"""
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_known_ids(path: Path, ids: set):
    """将已知 ID 集合持久化到 JSON 文件"""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(ids), f)


# === Bark 推送 ===

def send_bark(cfg: dict, title: str, body: str, url: str, group: str, *,
              sound: str = None, level: str = "timeSensitive") -> bool:
    """
    通用 Bark 推送。返回是否成功。
    各监控脚本通过 group 参数区分通知分组：
      - "WCA Records" — 纪录监控
      - "cubing-comp" — 粗饼比赛监控
      - "wca-comp"    — WCA 比赛监控
    """
    log = logging.getLogger("bark")
    server = cfg["bark_server"].rstrip("/")
    payload = {
        "device_key": cfg["bark_device_key"],
        "title": title,
        "body": body,
        "url": url,
        "group": group,
        "level": level,
        "isArchive": "1",
    }
    if sound:
        payload["sound"] = sound

    try:
        resp = requests.post(f"{server}/push", json=payload, timeout=10)
        resp.raise_for_status()
        result = resp.json()
        if result.get("code") != 200:
            log.warning("Bark push abnormal: %s", result)
            return False
        log.info("✅ Bark pushed: %s", title)
        return True
    except requests.RequestException as e:
        log.warning("Bark push error: %s", e)
        return False


# === 国旗 Emoji ===

def country_flag(iso2: str) -> str:
    """将 ISO 3166-1 alpha-2 国家代码转为 Emoji 国旗"""
    if not iso2 or len(iso2) != 2:
        return ""
    # NOTE: 利用 Unicode Regional Indicator 符号自动生成
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso2.upper())
