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

  OFFICIAL = ALL.first(17).to_h

  # NOTE: 所有有官方平均/mo3 的项目（OFFICIAL 去掉 333mbf，加入退役项目 333ft/magic/mmagic）
  # 333bf/444bf/555bf 用 mo3，333ft/magic/mmagic 用 ao5，333mbf 无平均故不含
  WITH_AVERAGE = OFFICIAL.reject { |id, _| id == "333mbf" }
                         .merge(ALL.select { |id, _| %w(333ft magic mmagic).include?(id) })

  BLD = ALL.select { |event_id, event_name| %w(333bf 444bf 555bf 333mbf).include?(event_id) }

  # NOTE: WCA 项目中文名称映射（value 是英文名 → 中文名）
  NAMES_ZH = {
    "Rubik's Cube" => "三阶魔方",
    "2x2x2 Cube" => "二阶魔方",
    "4x4x4 Cube" => "四阶魔方",
    "5x5x5 Cube" => "五阶魔方",
    "6x6x6 Cube" => "六阶魔方",
    "7x7x7 Cube" => "七阶魔方",
    "3x3x3 Blindfolded" => "三阶盲拧",
    "3x3x3 Fewest Moves" => "三阶最少步",
    "3x3x3 One-Handed" => "三阶单手",
    "Megaminx" => "五魔方",
    "Pyraminx" => "金字塔",
    "Rubik's Clock" => "魔表",
    "Skewb" => "斜转魔方",
    "Square-1" => "SQ1",
    "4x4x4 Blindfolded" => "四阶盲拧",
    "5x5x5 Blindfolded" => "五阶盲拧",
    "3x3x3 Multi-Blind" => "三阶多盲",
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
