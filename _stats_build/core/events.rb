module Events
  ALL = {
    "333"     => "Rubik's Cube",
    "222"     => "2x2x2 Cube",
    "444"     => "4x4x4 Cube",
    "555"     => "5x5x5 Cube",
    "666"     => "6x6x6 Cube",
    "777"     => "7x7x7 Cube",
    "333bf"   => "3x3x3 Blindfolded",
    "333fm"   => "3x3x3 Fewest Moves",
    "333oh"   => "3x3x3 One-Handed",
    "minx"    => "Megaminx",
    "pyram"   => "Pyraminx",
    "clock"   => "Rubik's Clock",
    "skewb"   => "Skewb",
    "sq1"     => "Square-1",
    "444bf"   => "4x4x4 Blindfolded",
    "555bf"   => "5x5x5 Blindfolded",
    "333mbf"  => "3x3x3 Multi-Blind",
    "333ft"   => "3x3x3 With Feet",
    "magic"   => "Rubik's Magic",
    "mmagic"  => "Master Magic",
    "333mbo"  => "Rubik's Cube: Multiple blind old style",
  }

  # NOTE: 所有正式 + 退役项目（用于 WR Single、wr_current 等覆盖全量项目的统计）
  OFFICIAL = ALL.dup

  # NOTE: 所有有官方平均/mo3 的项目（去掉 333mbf 和 333mbo——它们无平均）
  # 333bf/444bf/555bf 用 mo3，333ft/magic/mmagic 用 ao5
  WITH_AVERAGE = OFFICIAL.reject { |id, _| %w(333mbf 333mbo).include?(id) }

  # NOTE: Mo3 项目（一轮只有 3 把）——666, 777, 333bf, 333fm, 444bf, 555bf
  MO3_EVENTS = %w[666 777 333bf 333fm 444bf 555bf].freeze

  # NOTE: Ao5 项目（一轮 5 把）= WITH_AVERAGE 去掉 Mo3 项目
  # BAo5/WAo5/Mo5/BPA/WPA 等基于 5 把的指标只查这些项目
  WITH_AO5 = WITH_AVERAGE.reject { |id, _| MO3_EVENTS.include?(id) }

  BLD = ALL.select { |event_id, event_name| %w(333bf 444bf 555bf 333mbf).include?(event_id) }

  # NOTE: WCA 项目中文名称映射（value 是英文名 → 中文名）
  NAMES_ZH = {
    "Rubik's Cube" => "三阶魔方",
    "2x2x2 Cube" => "二阶魔方",
    "4x4x4 Cube" => "四阶魔方",
    "5x5x5 Cube" => "五阶魔方",
    "6x6x6 Cube" => "六阶魔方",
    "7x7x7 Cube" => "七阶魔方",
    "3x3x3 Blindfolded" => "三盲",
    "3x3x3 Fewest Moves" => "最少步",
    "3x3x3 One-Handed" => "三阶单手",
    "Megaminx" => "五魔",
    "Pyraminx" => "金字塔",
    "Rubik's Clock" => "魔表",
    "Skewb" => "斜转",
    "Square-1" => "SQ1",
    "4x4x4 Blindfolded" => "四盲",
    "5x5x5 Blindfolded" => "五盲",
    "3x3x3 Multi-Blind" => "多盲",
    "3x3x3 With Feet" => "三阶脚拧",
    "Rubik's Magic" => "八板",
    "Master Magic" => "十二板",
    "Rubik's Cube: Multiple blind old style" => "旧多盲",
  }.freeze

  # NOTE: 统计表头通用翻译映射（英文表头 → 中文表头）
  HEADER_ZH = {
    "Person" => "选手",
    "Event" => "项目",
    "Count" => "次数",
    "Competition" => "比赛",
    "Competitions" => "比赛",
    "Date" => "日期",
    "Single" => "单次",
    "Average" => "平均",
    "Rank" => "排名",
    "Result" => "成绩",
    "Details" => "详情",
    "Started at" => "开始于",
    "Ended at" => "结束于",
    "DNF rate" => "DNF 率",
    "DNFs" => "DNF 次数",
    "Attempts" => "尝试次数",
    "Gain" => "提升",
    "Days" => "天数",
    "Country" => "国家",
    "Continent" => "大洲",
    "Records" => "纪录数",
    "Gold" => "金牌",
    "Silver" => "银牌",
    "Bronze" => "铜牌",
    "Total" => "总计",
    "Events" => "项目数",
    "Competitions count" => "比赛数",
    "List on WCA" => "WCA 页面",
    "Year" => "年份",
    "Years" => "年数",
    "Delegated" => "代表数",
    "Delegated per year" => "年均代表",
    "Week" => "周",
    "Streak" => "连续",
    "Name" => "姓名",
    "Parts" => "词数",
    "First name" => "名",
    "Last name" => "姓",
    "Months" => "月数",
    "Podiums" => "登上领奖台",
    "Wins" => "冠军",
    "Round" => "轮次",
    "Sum" => "总和",
    "1st" => "第一名",
    "2nd" => "第二名",
    "3rd" => "第三名",
    "Times" => "成绩",
  }.freeze

  # NOTE: 根据英文名查找中文名，找不到则返回原文
  def self.zh(name)
    NAMES_ZH[name] || name
  end

  def self.header_zh(name)
    HEADER_ZH[name] || name
  end
end
