"""
纪录快讯消息格式化 — WCA Live 与 cubing.com 共用。

模板规则记在 breaking_news_prompt.md(不存在源文件时按本文件逻辑为准):
  WR 中文: 纪录快讯! [成绩][项目][单次/平均]世界纪录WR [人名][国旗]| [比赛]
  WR 英文: BREAKING NEWS! [成绩] [项目] WR [Single/Avg] [人名][国旗]| [比赛]
  CR 中文: 纪录快讯! [成绩][项目][单次/平均][纪录类型][纪录缩写] [人名][国旗]| [比赛]
  CR 英文: Breaking News! [成绩] [项目] [纪录缩写] [Single/Avg] [人名][国旗]| [比赛]
  NR 中文: 纪录快讯! [成绩][项目][单次/平均][国家中文名]纪录[国旗]NR [人名] | [比赛]
  NR 英文: Breaking News! [成绩] [项目][国旗]NR [Single/Avg] [人名] | [比赛]
"""
import re

from monitor_utils import country_flag
from wca_rankings import RANKINGS


# === 项目名映射 ===

EVENT_CN_MAP = {
    "3x3x3 Cube": "三阶魔方",
    "2x2x2 Cube": "二阶魔方",
    "4x4x4 Cube": "四阶魔方",
    "5x5x5 Cube": "五阶魔方",
    "6x6x6 Cube": "六阶魔方",
    "7x7x7 Cube": "七阶魔方",
    "3x3x3 Blindfolded": "三盲",
    "3x3x3 Fewest Moves": "最少步",
    "3x3x3 One-Handed": "三阶魔方单手",
    "Clock": "魔表",
    "Megaminx": "五魔",
    "Pyraminx": "金字塔魔方",
    "Skewb": "斜转魔方",
    "Square-1": " SQ1魔方",  # NOTE: prompt 明确要求中文 SQ1 前必须有空格
    "4x4x4 Blindfolded": "四盲",
    "5x5x5 Blindfolded": "五盲",
    "3x3x3 Multi-Blind": "多盲",
    # cubing.com 自创事件(非 WCA 官方)
    "Mirror Blocks": "镜面魔方",
    "Ivy Cube": "三叶魔方",
    "Individual": "个人赛",
    "Team": "团体赛",
}

EVENT_EN_MAP = {
    "3x3x3 Cube": "3x3",
    "2x2x2 Cube": "2x2",
    "4x4x4 Cube": "4x4",
    "5x5x5 Cube": "5x5",
    "6x6x6 Cube": "6x6",
    "7x7x7 Cube": "7x7",
    "3x3x3 Blindfolded": "3BLD",
    "3x3x3 Fewest Moves": "FMC",
    "3x3x3 One-Handed": "OH",
    "Clock": "Clock",
    "Megaminx": "Megaminx",
    "Pyraminx": "Pyraminx",
    "Skewb": "Skewb",
    "Square-1": "SQ1",
    "4x4x4 Blindfolded": "4BLD",
    "5x5x5 Blindfolded": "5BLD",
    "3x3x3 Multi-Blind": "3BLD",
    "Mirror Blocks": "Mirror",
    "Ivy Cube": "Ivy",
    "Individual": "Individual",
    "Team": "Team",
}

# WCA event id → 标准英文 event name(cubing.com 只给 id 不给名字)
EVENT_NAME_BY_ID = {
    "333": "3x3x3 Cube",
    "222": "2x2x2 Cube",
    "444": "4x4x4 Cube",
    "555": "5x5x5 Cube",
    "666": "6x6x6 Cube",
    "777": "7x7x7 Cube",
    "333bf": "3x3x3 Blindfolded",
    "333fm": "3x3x3 Fewest Moves",
    "333oh": "3x3x3 One-Handed",
    "clock": "Clock",
    "minx": "Megaminx",
    "pyram": "Pyraminx",
    "skewb": "Skewb",
    "sq1": "Square-1",
    "444bf": "4x4x4 Blindfolded",
    "555bf": "5x5x5 Blindfolded",
    "333mbf": "3x3x3 Multi-Blind",
    # cubing.com 自创事件
    "mirror": "Mirror Blocks",
    "ivy": "Ivy Cube",
    "individual": "Individual",
    "team": "Team",
}


# === 洲际/国家映射 ===

CR_ABBR_CN = {
    "AsR": "亚洲纪录",
    "ER": "欧洲纪录",
    "AfR": "非洲纪录",
    "OcR": "大洋洲纪录",
    "SAR": "南美洲纪录",
    "NAR": "北美洲纪录",
}

COUNTRY_CN_MAP = {
    # 亚洲 (AsR)
    "AF": "阿富汗", "AM": "亚美尼亚", "AZ": "阿塞拜疆", "BD": "孟加拉国",
    "BH": "巴林", "BN": "文莱", "BT": "不丹", "CN": "中国",
    "CY": "塞浦路斯", "GE": "格鲁吉亚", "HK": "中国香港", "ID": "印度尼西亚",
    "IL": "以色列", "IN": "印度", "IQ": "伊拉克", "IR": "伊朗",
    "JO": "约旦", "JP": "日本", "KG": "吉尔吉斯斯坦", "KH": "柬埔寨",
    "KR": "韩国", "KW": "科威特", "KZ": "哈萨克斯坦", "LA": "老挝",
    "LB": "黎巴嫩", "LK": "斯里兰卡", "MM": "缅甸", "MN": "蒙古",
    "MO": "中国澳门", "MY": "马来西亚", "NP": "尼泊尔", "OM": "阿曼",
    "PH": "菲律宾", "PK": "巴基斯坦", "QA": "卡塔尔", "SA": "沙特阿拉伯",
    "SG": "新加坡", "SY": "叙利亚", "TH": "泰国", "TJ": "塔吉克斯坦",
    "TM": "土库曼斯坦", "TW": "中国台湾", "UZ": "乌兹别克斯坦", "VN": "越南",
    "AE": "阿联酋", "YE": "也门",
    # 欧洲 (ER)
    "AL": "阿尔巴尼亚", "AT": "奥地利", "BA": "波黑", "BE": "比利时",
    "BG": "保加利亚", "BY": "白俄罗斯", "CH": "瑞士", "CZ": "捷克",
    "DE": "德国", "DK": "丹麦", "EE": "爱沙尼亚", "ES": "西班牙",
    "FI": "芬兰", "FR": "法国", "GB": "英国", "GR": "希腊",
    "HR": "克罗地亚", "HU": "匈牙利", "IE": "爱尔兰", "IS": "冰岛",
    "IT": "意大利", "LT": "立陶宛", "LU": "卢森堡", "LV": "拉脱维亚",
    "MD": "摩尔多瓦", "ME": "黑山", "MK": "北马其顿", "MT": "马耳他",
    "NL": "荷兰", "NO": "挪威", "PL": "波兰", "PT": "葡萄牙",
    "RO": "罗马尼亚", "RS": "塞尔维亚", "RU": "俄罗斯", "SE": "瑞典",
    "SI": "斯洛文尼亚", "SK": "斯洛伐克", "TR": "土耳其", "UA": "乌克兰",
    "XK": "科索沃",
    # 非洲 (AfR)
    "AO": "安哥拉", "BF": "布基纳法索", "BJ": "贝宁", "BW": "博茨瓦纳",
    "CD": "刚果(金)", "CI": "科特迪瓦", "CM": "喀麦隆", "DZ": "阿尔及利亚",
    "EG": "埃及", "ET": "埃塞俄比亚", "GA": "加蓬", "GH": "加纳",
    "GM": "冈比亚", "GN": "几内亚", "KE": "肯尼亚", "LR": "利比里亚",
    "LS": "莱索托", "LY": "利比亚", "MA": "摩洛哥", "MG": "马达加斯加",
    "ML": "马里", "MU": "毛里求斯", "MW": "马拉维", "MZ": "莫桑比克",
    "NA": "纳米比亚", "NE": "尼日尔", "NG": "尼日利亚", "RW": "卢旺达",
    "SD": "苏丹", "SL": "塞拉利昂", "SN": "塞内加尔", "SS": "南苏丹",
    "TD": "乍得", "TG": "多哥", "TN": "突尼斯", "TZ": "坦桑尼亚",
    "UG": "乌干达", "ZA": "南非", "ZW": "津巴布韦",
    # 大洋洲 (OcR)
    "AU": "澳大利亚", "FJ": "斐济", "GU": "关岛", "NC": "新喀里多尼亚",
    "NZ": "新西兰", "PF": "法属波利尼西亚", "PG": "巴布亚新几内亚",
    "SB": "所罗门群岛", "TO": "汤加", "VU": "瓦努阿图", "WS": "萨摩亚",
    # 南美洲 (SAR)
    "AR": "阿根廷", "BO": "玻利维亚", "BR": "巴西", "CL": "智利",
    "CO": "哥伦比亚", "EC": "厄瓜多尔", "GY": "圭亚那", "PE": "秘鲁",
    "PY": "巴拉圭", "SR": "苏里南", "UY": "乌拉圭", "VE": "委内瑞拉",
    # 北美洲 (NAR)
    "AG": "安提瓜和巴布达", "AW": "阿鲁巴", "BB": "巴巴多斯", "BS": "巴哈马",
    "BZ": "伯利兹", "CA": "加拿大", "CR": "哥斯达黎加", "CU": "古巴",
    "CW": "库拉索", "DM": "多米尼克", "DO": "多米尼加", "GD": "格林纳达",
    "GT": "危地马拉", "HN": "洪都拉斯", "HT": "海地", "JM": "牙买加",
    "KN": "圣基茨和尼维斯", "KY": "开曼群岛", "LC": "圣卢西亚", "MX": "墨西哥",
    "NI": "尼加拉瓜", "PA": "巴拿马", "PR": "波多黎各", "SV": "萨尔瓦多",
    "TC": "特克斯和凯科斯群岛", "TT": "特立尼达和多巴哥", "US": "美国",
    "VC": "圣文森特和格林纳丁斯", "VI": "美属维尔京群岛",
}

# ISO2 → 洲际纪录缩写
_CONTINENT_COUNTRIES = {
    "AsR": (
        "AF,AM,AZ,BD,BH,BN,BT,CN,CY,GE,HK,ID,IL,IN,IQ,IR,JO,JP,KG,KH,"
        "KR,KW,KZ,LA,LB,LK,MM,MN,MO,MY,NP,OM,PH,PK,QA,SA,SG,SY,TH,TJ,"
        "TM,TW,UZ,VN,AE,YE"
    ),
    "ER": (
        "AL,AT,BA,BE,BG,BY,CH,CZ,DE,DK,EE,ES,FI,FR,GB,GR,HR,HU,IE,IS,"
        "IT,LT,LU,LV,MD,ME,MK,MT,NL,NO,PL,PT,RO,RS,RU,SE,SI,SK,TR,UA,XK"
    ),
    "AfR": (
        "AO,BF,BJ,BW,CD,CI,CM,DZ,EG,ET,GA,GH,GM,GN,KE,LR,LS,LY,MA,MG,"
        "ML,MU,MW,MZ,NA,NE,NG,RW,SD,SL,SN,SS,TD,TG,TN,TZ,UG,ZA,ZW"
    ),
    "OcR": "AU,FJ,GU,NC,NZ,PF,PG,SB,TO,VU,WS",
    "SAR": "AR,BO,BR,CL,CO,EC,GY,PE,PY,SR,UY,VE",
    "NAR": (
        "AG,AW,BB,BS,BZ,CA,CR,CU,CW,DM,DO,GD,GT,HN,HT,JM,KN,KY,LC,MX,"
        "NI,PA,PR,SV,TC,TT,US,VC,VI"
    ),
}

ISO2_TO_CR = {}
for _abbr, _countries in _CONTINENT_COUNTRIES.items():
    for _iso2 in _countries.split(","):
        ISO2_TO_CR[_iso2.strip()] = _abbr

# 反向:用于 cubing.com region 英文国名 → iso2
COUNTRY_EN_MAP = {
    "China": "CN", "Hong Kong": "HK", "Taiwan": "TW", "Macau": "MO", "Macao": "MO",
    "Japan": "JP", "Korea": "KR", "South Korea": "KR", "North Korea": "KP",
    "Singapore": "SG", "Malaysia": "MY", "Thailand": "TH", "Vietnam": "VN",
    "Indonesia": "ID", "Philippines": "PH", "India": "IN", "Pakistan": "PK",
    "Mongolia": "MN", "Kazakhstan": "KZ", "Uzbekistan": "UZ",
    "United States": "US", "USA": "US", "Canada": "CA", "Mexico": "MX",
    "United Kingdom": "GB", "France": "FR", "Germany": "DE", "Italy": "IT",
    "Spain": "ES", "Russia": "RU", "Poland": "PL", "Netherlands": "NL",
    "Australia": "AU", "New Zealand": "NZ", "Brazil": "BR",
}


# === 名字拆分 ===

_NAME_PAREN_RE = re.compile(r"\s*\(([^)]+)\)\s*$")


def _has_cjk(s: str) -> bool:
    """是否含 CJK Unified Ideographs(基本汉字 4E00-9FFF)"""
    return any("一" <= c <= "鿿" for c in s)


def split_name(full_name: str, iso2: str):
    """
    拆分 WCA 名字为 (cn_name, en_name)。
    名字括号里含中文(CJK)的,cn_name 用括号内的中文,en_name 用前面的英文。
    这覆盖中国大陆/港澳台选手,以及马来西亚 / 新加坡等用中文名注册的华人选手
    (如 Lim Hung (林弘))。括号里非中文 / 无括号则中英文都用英文名。
    iso2 参数保留作未来扩展,当前不参与判断。
    """
    m = _NAME_PAREN_RE.search(full_name)
    en_name = _NAME_PAREN_RE.sub("", full_name)
    if m and _has_cjk(m.group(1)):
        return m.group(1), en_name
    return en_name, en_name


# 用 mean-of-3 而非 average-of-5 的项目:EN 文案该用 "Mean" 而非 "Avg"
_MEAN_EVENTS = {"666", "777", "333fm", "444bf", "555bf"}


def _type_en(event_id: str, rec_type: str) -> str:
    if rec_type == "single":
        return "Single"
    return "Mean" if event_id in _MEAN_EVENTS else "Avg"


# === 时间格式化 ===

def format_time(centiseconds: int, event_id: str) -> str:
    """WCA 厘秒成绩 → 可读字符串。FMC / 多盲有独立编码。"""
    if centiseconds <= 0:
        return "DNF"
    if event_id == "333fm":
        # FMC: 单次=步数, 平均=步数*100
        if centiseconds < 1000:
            return f"{centiseconds}"
        return f"{centiseconds / 100:.2f}"
    if event_id == "333mbf":
        # 多盲编码 0DDTTTTTMM(D=差值, T=时间秒, M=错误数)
        dd = 99 - (centiseconds // 10000000)
        ttttt = (centiseconds // 100) % 100000
        mm = centiseconds % 100
        solved = dd + mm
        minutes = ttttt // 60
        seconds = ttttt % 60
        return f"{solved}/{solved + mm} {minutes}:{seconds:02d}"
    total_seconds = centiseconds / 100
    if total_seconds >= 60:
        minutes = int(total_seconds // 60)
        secs = total_seconds - minutes * 60
        return f"{minutes}:{secs:05.2f}"
    return f"{total_seconds:.2f}"


# === 主格式化函数 ===

def format_record_message(
    *,
    tag: str,
    rec_type: str,
    attempt_result: int,
    event_id: str,
    event_name: str,
    person_name: str,
    person_iso2: str,
    person_country_en: str,
    comp_name: str,
    comp_iso2: str,
    url: str,
    comp_name_en: str = None,
    tied: bool = False,
    pr_rank: int = 1,
):
    """
    参数化的纪录消息格式化。两个 monitor 共用。

    tag 取值:
      "WR"                            — 世界纪录
      "NR"                            — 国家纪录
      "PR"                            — 个人纪录(职业生涯)
      "CR" | "AsR" | "ER" | "AfR"
        | "OcR" | "SAR" | "NAR"       — 洲际纪录(CR 表示由 iso2 推导,其余直接使用)

    comp_name 用于中文文案,comp_name_en 用于英文(缺省 fallback 到 comp_name)。

    返回 (cn_text, en_text, url)。
    """
    comp_flag = country_flag(comp_iso2)
    person_flag = country_flag(person_iso2)
    cn_name, en_name = split_name(person_name, person_iso2)
    time_str = format_time(attempt_result, event_id)
    cn_event = EVENT_CN_MAP.get(event_name, event_name)
    en_event = EVENT_EN_MAP.get(event_name, event_name)
    type_cn = "单次" if rec_type == "single" else "平均"
    type_en = _type_en(event_id, rec_type)
    cn_comp_label = f"{comp_name}{comp_flag}"
    en_comp_label = f"{comp_name_en or comp_name}{comp_flag}"

    if tag == "WR":
        cn = f"纪录快讯! {time_str}{cn_event}{type_cn}世界纪录WR {cn_name}{person_flag}| {cn_comp_label}"
        en = f"BREAKING NEWS! {time_str} {en_event} WR {type_en} {en_name}{person_flag}| {en_comp_label}"
        cr_abbr = None
    elif tag == "NR":
        country_cn = COUNTRY_CN_MAP.get(person_iso2, person_country_en or person_iso2)
        cn = f"纪录快讯! {time_str}{cn_event}{type_cn}{country_cn}纪录{person_flag}NR {cn_name} | {cn_comp_label}"
        en = f"Breaking News! {time_str} {en_event}{person_flag}NR {type_en} {en_name} | {en_comp_label}"
        cr_abbr = None
    elif tag == "PR":
        tied_cn = "(平)" if tied else ""
        tied_en = "(Tied)" if tied else ""
        if pr_rank and pr_rank > 1:
            # 非真破 PR(历史第 N 快):走"成绩快讯/Result News"模板,无"个人纪录"/person_flag/WR rank;
            # 选手名前直接空格,不带国旗(比赛名后仍带 comp_flag)。
            # EN: rank 前置(数字后立刻 PR<rank>,再 Single/Avg)
            cn = f"成绩快讯! {time_str}{cn_event}{type_cn}PR{pr_rank} {cn_name} | {cn_comp_label}"
            en = f"Result News! {time_str} PR{pr_rank} {type_en} {en_event} {en_name} | {en_comp_label}"
        else:
            cn = f"PR快讯! {time_str}{cn_event}{type_cn}个人纪录{person_flag}PR{tied_cn} {cn_name} | {cn_comp_label}"
            en = f"PR News! {time_str} {en_event}{person_flag}PR{tied_en} {type_en} {en_name} | {en_comp_label}"
        cr_abbr = None
    else:
        cr_abbr = tag if tag in CR_ABBR_CN else ISO2_TO_CR.get(person_iso2, "CR")
        cr_cn = CR_ABBR_CN.get(cr_abbr, "洲际纪录")
        cn = f"纪录快讯! {time_str}{cn_event}{type_cn}{cr_cn}{cr_abbr} {cn_name}{person_flag}| {cn_comp_label}"
        en = f"Breaking News! {time_str} {en_event} {cr_abbr} {type_en} {en_name}{person_flag}| {en_comp_label}"

    # 在 NR / CR / PR 后追加 /WRxx(WR 已含"世界纪录"字样,不再叠加;
    # PR 已经标了 PR<rank> 的也跳过,避免出现 PR39/WR123)
    if tag != "WR" and not (tag == "PR" and pr_rank and pr_rank > 1):
        rank = RANKINGS.get_world_rank(event_id, rec_type, attempt_result)
        if rank:
            suffix = f"/WR{rank}"
            if tag == "NR":
                cn = cn.replace("NR", f"NR{suffix}", 1)
                en = en.replace("NR", f"NR{suffix}", 1)
            elif tag == "PR":
                # 用 {person_flag}PR(tied) 作锚点,避免命中"PR快讯! / PR News!"前缀里的 PR;
                # tied 时 /WRn 要贴在 (平)/(Tied) 之后(样例: PR(平)/WR8)
                tied_cn = "(平)" if tied else ""
                tied_en = "(Tied)" if tied else ""
                anchor_cn = f"{person_flag}PR{tied_cn}"
                anchor_en = f"{person_flag}PR{tied_en}"
                cn = cn.replace(anchor_cn, f"{anchor_cn}{suffix}", 1)
                en = en.replace(anchor_en, f"{anchor_en}{suffix}", 1)
            else:
                cn = cn.replace(cr_abbr, f"{cr_abbr}{suffix}", 1)
                en = en.replace(cr_abbr, f"{cr_abbr}{suffix}", 1)

    return cn, en, url


# === 双纪录合并 ===

# tag 优先级:WR > 任一 CR(各洲缩写)> NR
def _tag_priority(tag: str) -> int:
    if tag == "WR":
        return 0
    if tag in CR_ABBR_CN or tag == "CR":
        return 1
    if tag == "NR":
        return 2
    return 3


def _resolve_cr_abbr(tag: str, person_iso2: str) -> str:
    """CR 通配 → 具体洲缩写(AsR/ER/...);本身就是具体缩写则直接返回"""
    if tag in CR_ABBR_CN:
        return tag
    return ISO2_TO_CR.get(person_iso2, "CR")


def _wr_suffix(event_id: str, rec_type: str, attempt_result: int, tag: str) -> str:
    """NR / CR / PR 的 /WRn 后缀;WR 隐含 WR1 不追加"""
    if tag == "WR":
        return ""
    rank = RANKINGS.get_world_rank(event_id, rec_type, attempt_result)
    return f"WR{rank}" if rank else ""


def format_combined_records(events: list):
    """
    多条同选手 / 同项目 / 同 round 的纪录合并推送。
    events 是 1 或 2 条 record-event dict,字段与 format_record_message 的 kwargs 同名。

    长度 1   → 退化为单条 format_record_message
    长度 2 同 tag(如 NR+NR) → 同类型双纪录模板:
        纪录快讯! <t单>单次<rs单>, <t均>平均<rs均><项目>双<国家>纪录<旗><tag> <人> | <比赛>
    长度 2 不同 tag(按优先级 WR>CR>NR 排序) → 拼接模板:
        纪录快讯! <r1 完整不含比赛>| <r2 缩减:成绩+类型+tag/WR> | <比赛>

    返回 (cn, en, url),url 取 events[0]["url"](合并的前提是同 round)。
    """
    if len(events) == 1:
        return format_record_message(**events[0])
    if len(events) != 2:
        raise ValueError(f"format_combined_records expects 1 or 2 events, got {len(events)}")

    e0, e1 = events
    if e0["tag"] == e1["tag"]:
        return _combine_same_tag(events)
    return _combine_diff_tag(events)


def _combine_same_tag(events: list):
    """两条同 tag(必然 sr+ar)合并"""
    events = sorted(events, key=lambda e: 0 if e["rec_type"] == "single" else 1)
    single, avg = events

    tag = single["tag"]
    event_id = single["event_id"]
    event_name = single["event_name"]
    person_iso2 = single["person_iso2"]
    comp_iso2 = single["comp_iso2"]
    comp_flag = country_flag(comp_iso2)
    cn_comp_label = f"{single['comp_name']}{comp_flag}"
    en_comp_label = f"{single.get('comp_name_en') or single['comp_name']}{comp_flag}"
    person_flag = country_flag(person_iso2)
    cn_name, en_name = split_name(single["person_name"], person_iso2)
    cn_event = EVENT_CN_MAP.get(event_name, event_name)
    en_event = EVENT_EN_MAP.get(event_name, event_name)

    t_s = format_time(single["attempt_result"], event_id)
    t_a = format_time(avg["attempt_result"], event_id)
    avg_en = "Mean" if event_id in _MEAN_EVENTS else "Avg"

    # tag=PR 且任一 pr_rank>1 = 非真破 PR,走"成绩快讯"模板(无"双个人纪录"/person_flag)
    s_rank = single.get("pr_rank") or 1
    a_rank = avg.get("pr_rank") or 1
    if tag == "PR" and (s_rank > 1 or a_rank > 1):
        rs_s = f"PR{s_rank}" if s_rank > 1 else "PR"
        rs_a = f"PR{a_rank}" if a_rank > 1 else "PR"
        cn = (f"成绩快讯! {t_s}单次{rs_s}, {t_a}平均{rs_a}"
              f"{cn_event} {cn_name} | {cn_comp_label}")
        en = (f"Result News! {t_s} {rs_s} Single, {t_a} {rs_a} {avg_en} "
              f"{en_event} {en_name} | {en_comp_label}")
        return cn, en, single["url"]

    rs_s = _wr_suffix(event_id, "single", single["attempt_result"], tag)
    rs_a = _wr_suffix(event_id, "average", avg["attempt_result"], tag)

    # 纪录类型描述
    if tag == "WR":
        type_cn, type_en, display_tag = "世界纪录", "WR", "WR"
    elif tag == "NR":
        country_cn = COUNTRY_CN_MAP.get(
            person_iso2, single.get("person_country_en") or person_iso2)
        type_cn, type_en, display_tag = f"{country_cn}纪录", "NR", "NR"
    elif tag == "PR":
        type_cn, type_en, display_tag = "个人纪录", "PR", "PR"
    else:
        cr_abbr = _resolve_cr_abbr(tag, person_iso2)
        type_cn, type_en, display_tag = CR_ABBR_CN.get(cr_abbr, "洲际纪录"), cr_abbr, cr_abbr

    # EN 中 rs 为空时不要留空格
    rs_s_en = f" {rs_s}" if rs_s else ""
    rs_a_en = f" {rs_a}" if rs_a else ""

    # 仅 WR 用全大写 "BREAKING NEWS!",PR 用 "PR快讯!" / "PR News!",CR/NR 用 "Breaking News!"
    if tag == "WR":
        en_prefix = "BREAKING NEWS!"
    elif tag == "PR":
        en_prefix = "PR News!"
    else:
        en_prefix = "Breaking News!"
    cn_prefix = "PR快讯!" if tag == "PR" else "纪录快讯!"

    cn = (f"{cn_prefix} {t_s}单次{rs_s}, {t_a}平均{rs_a}"
          f"{cn_event}双{type_cn}{person_flag}{display_tag} {cn_name} | {cn_comp_label}")
    en = (f"{en_prefix} {t_s} Single{rs_s_en}, {t_a} {avg_en}{rs_a_en} "
          f"{en_event}{person_flag}Double {type_en} {en_name} | {en_comp_label}")

    return cn, en, single["url"]


def _combine_diff_tag(events: list):
    """两条不同 tag 合并,按 tag 优先级排序。

    国旗规则:整条合并消息里 person_flag 只出现一次。
    - r2 是 NR 时:flag 由 r2 缩减片段在 NR 前承担,r1 末尾的 flag 去掉。
    - 否则:flag 留在 r1 单条模板的原位(NR/WR/CR 模板各自的 flag 位置)。
    """
    events = sorted(events, key=lambda e: _tag_priority(e["tag"]))
    r1, r2 = events

    cn1, en1, url = format_record_message(**r1)
    comp_flag = country_flag(r1["comp_iso2"])
    cn_comp_label = f"{r1['comp_name']}{comp_flag}"
    en_comp_label = f"{r1.get('comp_name_en') or r1['comp_name']}{comp_flag}"
    cn1_no_comp = cn1[:-len(cn_comp_label)].rstrip()
    if cn1_no_comp.endswith("|"):
        cn1_no_comp = cn1_no_comp[:-1].rstrip()
    en1_no_comp = en1[:-len(en_comp_label)].rstrip()
    if en1_no_comp.endswith("|"):
        en1_no_comp = en1_no_comp[:-1].rstrip()

    # r2 缩减;NR 时段内含 flag(NR 前)
    cn2 = _reduce_segment_cn(r2, include_flag=True)
    en2 = _reduce_segment_en(r2, include_flag=True)

    # r2 是 NR 时,把 r1 末尾(人名后)的 person_flag 去掉,避免重复
    r1_flag = country_flag(r1["person_iso2"])
    if r2["tag"] == "NR":
        if r1_flag and cn1_no_comp.endswith(r1_flag):
            cn1_no_comp = cn1_no_comp[:-len(r1_flag)]
        if r1_flag and en1_no_comp.endswith(r1_flag):
            en1_no_comp = en1_no_comp[:-len(r1_flag)]

    # 分隔符规则:r1 末尾是国旗 → "| "(无前空格);末尾是字母数字 → " | "(前有空格)
    cn_sep = "| " if r1_flag and cn1_no_comp.endswith(r1_flag) else " | "
    en_sep = "| " if r1_flag and en1_no_comp.endswith(r1_flag) else " | "

    cn = f"{cn1_no_comp}{cn_sep}{cn2} | {cn_comp_label}"
    en = f"{en1_no_comp}{en_sep}{en2} | {en_comp_label}"
    return cn, en, url


def _reduce_segment_cn(ev: dict, *, include_flag: bool = False) -> str:
    """r2 的中文缩减片段(无项目/人名/比赛)。NR 分支根据 include_flag 加 NR 前国旗。"""
    tag = ev["tag"]
    event_id = ev["event_id"]
    person_iso2 = ev["person_iso2"]
    t = format_time(ev["attempt_result"], event_id)
    type_cn = "单次" if ev["rec_type"] == "single" else "平均"

    if tag == "WR":
        return f"{t}{type_cn}世界纪录WR"
    if tag == "NR":
        country_cn = COUNTRY_CN_MAP.get(person_iso2, ev.get("person_country_en") or person_iso2)
        rank = RANKINGS.get_world_rank(event_id, ev["rec_type"], ev["attempt_result"])
        suffix = f"/WR{rank}" if rank else ""
        flag = country_flag(person_iso2) if include_flag else ""
        return f"{t}{type_cn}{country_cn}纪录{flag}NR{suffix}"
    cr_abbr = _resolve_cr_abbr(tag, person_iso2)
    rank = RANKINGS.get_world_rank(event_id, ev["rec_type"], ev["attempt_result"])
    suffix = f"/WR{rank}" if rank else ""
    return f"{t}{type_cn}{CR_ABBR_CN.get(cr_abbr, '洲际纪录')}{cr_abbr}{suffix}"


def _reduce_segment_en(ev: dict, *, include_flag: bool = False) -> str:
    """r2 的英文缩减片段(无项目/人名/比赛)。NR 分支根据 include_flag 加 NR 前国旗。"""
    tag = ev["tag"]
    event_id = ev["event_id"]
    person_iso2 = ev["person_iso2"]
    t = format_time(ev["attempt_result"], event_id)
    type_en = _type_en(event_id, ev["rec_type"])

    if tag == "WR":
        return f"{t} WR {type_en}"
    if tag == "NR":
        rank = RANKINGS.get_world_rank(event_id, ev["rec_type"], ev["attempt_result"])
        suffix = f"/WR{rank}" if rank else ""
        flag = country_flag(person_iso2) if include_flag else ""
        return f"{t}{flag}NR{suffix} {type_en}"
    cr_abbr = _resolve_cr_abbr(tag, person_iso2)
    rank = RANKINGS.get_world_rank(event_id, ev["rec_type"], ev["attempt_result"])
    suffix = f"/WR{rank}" if rank else ""
    return f"{t} {cr_abbr}{suffix} {type_en}"
