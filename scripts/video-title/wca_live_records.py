"""
WCA Live 近期纪录查询 + 格式化 —— 从 wca-monitor/wca_record_monitor.py 抽出的精简子集。

只保留 gen_title.py 需要的两个入口:
  - query_recent_records(): 拉 WCA Live recentRecords
  - format_record_message(record): 单条 record → (cn, en, url)

原 wca_record_monitor.py 还混着 Bark 推送 / PR 扫描 / 邮件 / 已知 ID 持久化 等
监控逻辑(那些已在 core/packages/server/src/monitors/ 用 TS 重写并退役 Python),
这里只摘出纯查询 + 格式化,避免拽进 email_notifier(google OAuth)/pr_cache/
watched_ids/config.json 整条死链。逻辑与原文件 1:1。
"""

import requests

from record_format import format_record_message as _format_record_message
from wca_local_names import enrich_name

WCA_LIVE_API = "https://live.worldcubeassociation.org/api"

# GraphQL 查询:获取近期纪录的完整信息
RECORDS_QUERY = """
{
  recentRecords {
    id
    tag
    type
    attemptResult
    result {
      person {
        name
        wcaId
        country {
          name
          iso2
        }
      }
      round {
        id
        name
        competitionEvent {
          event {
            id
            name
          }
          competition {
            id
            name
            venues {
              country {
                iso2
              }
            }
          }
        }
      }
    }
  }
}
"""


def query_recent_records() -> list:
    """查询 WCA Live 最近的纪录列表"""
    resp = requests.post(
        WCA_LIVE_API,
        json={"query": RECORDS_QUERY},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", {}).get("recentRecords", [])


def _record_to_kwargs(record: dict) -> dict:
    """WCA Live GraphQL record → format_record_message kwargs"""
    result = record["result"]
    person = result["person"]
    round_obj = result["round"]
    event = round_obj["competitionEvent"]["event"]
    competition = round_obj["competitionEvent"]["competition"]
    venues = competition.get("venues", [])
    comp_iso2 = venues[0]["country"]["iso2"] if venues else ""
    round_id = round_obj["id"]
    comp_id = competition["id"]
    return {
        "tag": record["tag"],
        "rec_type": record["type"],
        "attempt_result": record["attemptResult"],
        "event_id": event["id"],
        "event_name": event["name"],
        # WCA Live 不返本地名,从 WCA REST API 补全 "Lim Hung" → "Lim Hung (林弘)"
        "person_name": enrich_name(person["name"], person.get("wcaId")),
        "person_iso2": person["country"]["iso2"],
        "person_country_en": person["country"]["name"],
        "comp_name": competition["name"],
        "comp_iso2": comp_iso2,
        "url": f"https://live.worldcubeassociation.org/competitions/{comp_id}/rounds/{round_id}",
    }


def format_record_message(record: dict):
    """单条 WCA Live record → (cn, en, url)"""
    return _format_record_message(**_record_to_kwargs(record))
