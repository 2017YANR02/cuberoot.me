# NOTE: AverageOfX -- "Ao100" / "Ao1000" etc.
# Computes: a person's best trimmed-mean of @solve_count consecutive official solves.
#
# Algorithm: sliding window.
# 1. For each person, line up ALL their attempts in chronological order.
# 2. Slide a window of length @solve_count across this sequence.
# 3. At every position compute the trimmed mean (5% trimmed each side).
# 4. Keep the best (lowest) one as the person's result.
#
# Data scope: per-event (TOP_N_BY_EVENT UNION WR holders).
# 支持双视图 Tab：Current Ranking + WR History
require_relative "../../core/grouped_statistic"
require_relative "../../core/events"
require_relative "../../core/solve_time"
require_relative "../../core/stat_panel"
require_relative "../../core/database"

class AverageOfX < GroupedStatistic
  include StatPanel

  # NOTE: 各项目的候选选手筛选范围（世界平均排名前 N）
  # 333 top-15，主流项目 top-30，特殊项目 top-300，333bf top-2000
  TOP_N_BY_EVENT = {
    "333" => 15,
    "222" => 30, "444" => 30, "555" => 30,
    "666" => 30, "777" => 30, "333ft" => 30, "skewb" => 30,
    "sq1" => 30, "333oh" => 30, "minx" => 30,
    "333fm" => 300, "pyram" => 300, "clock" => 300,
    "444bf" => 300, "555bf" => 300, "magic" => 300, "mmagic" => 300,
    "333bf" => 2000,
  }.freeze

  DEFAULT_TOP_N = 30

  # NOTE: Current Ranking 表头（含起止比赛 + Details）
  RANKING_HEADER_AOX = {
    "#" => :right, "Person" => :left, "Result" => :right,
    "Country" => :left, "Start Date" => :left, "Start Comp" => :left,
    "Date" => :left, "Competition" => :left, "Details" => :left
  }.freeze

  # NOTE: WR History 表头
  HISTORY_HEADER_AOX = {
    "Result" => :right, "Improvement" => :right, "Days" => :right,
    "Person" => :left, "Start Date" => :left, "Start Comp" => :left,
    "Date" => :left, "Competition" => :left, "Details" => :left
  }.freeze

  def initialize(solve_count:)
    @solve_count = solve_count

    @title = "Average of #{@solve_count}"

    @note = "#{@solve_count} consecutive official attempts are considered. " \
            "Top N varies by event: 333 top 15, most events top 30, " \
            "333fm/pyram/clock/444bf/555bf/magic/mmagic top 300, " \
            "333bf top 2000. " \
            "WR History candidates also include all single and average WR holders. " \
            "Tied results are not shown in WR History."
    @note_zh = "考虑连续 #{@solve_count} 次官方还原。" \
              "各项目 Top N：333 前 15，多数项目前 30，" \
              "333fm/pyram/clock/444bf/555bf/magic/mmagic 前 300，" \
              "333bf 前 2000。" \
              "WR 历史的候选人仅包括所有单次和平均 WR 获得者。" \
              "WR 历史不显示持平的成绩。"
    @table_header = RANKING_HEADER_AOX
  end

  # NOTE: 暴露给 average_of.rb 的 history 表头
  def history_header
    HISTORY_HEADER_AOX
  end

  # NOTE: class-level cache -- all subclasses (Ao100, Ao1000 ...) share one query result
  # 缓存文件统一命名 AverageOfX.marshal，确保任何子类（Ao3/Ao100 等）
  # 在不同进程中都能命中同一份磁盘缓存
  def query_results
    @@query_results ||= begin
      cache_file = File.join(CACHE_DIR, "AverageOfX.marshal")
      if ENV["STATS_USE_CACHE"] == "1" && File.exist?(cache_file)
        Marshal.load(File.binread(cache_file))
      else
        result = Database.client.query(query).to_a
        FileUtils.mkdir_p(CACHE_DIR)
        File.binwrite(cache_file, Marshal.dump(result))
        result
      end
    end
  end

  def query
    # NOTE: 候选人 = TOP_N_BY_EVENT UNION 所有 WR 持有者（single + average）
    # 一次查询同时覆盖 Current Ranking 和 WR History
    <<-SQL
      SELECT
        CONCAT('[', person.name, '](https://www.worldcubeassociation.org/persons/', person.wca_id, ')') person_link,
        person.wca_id AS person_id,
        person.country_id,
        result.event_id,
        #{Database::ATTEMPTS_SUBQUERY} AS attempts,
        CONCAT('[', competition.cell_name, '](https://www.worldcubeassociation.org/competitions/', competition.id, ')') competition_link,
        competition.start_date
      FROM results result
      JOIN persons person ON person.wca_id = person_id AND person.sub_id = 1
      JOIN competitions competition ON competition.id = competition_id
      JOIN round_types round_type ON round_type.id = round_type_id
      JOIN (
        SELECT event_id, person_id
        FROM (
          SELECT r.event_id, r.person_id,
            RANK() OVER (PARTITION BY r.event_id ORDER BY MIN(r.average)) AS global_rank
          FROM results r
          WHERE r.average > 0
          GROUP BY r.event_id, r.person_id
        ) ranked
        WHERE global_rank <= CASE ranked.event_id
          WHEN '333' THEN 15
          WHEN '333fm' THEN 300
          WHEN 'pyram' THEN 300
          WHEN 'clock' THEN 300
          WHEN '444bf' THEN 300
          WHEN '555bf' THEN 300
          WHEN 'magic' THEN 300
          WHEN 'mmagic' THEN 300
          WHEN '333bf' THEN 2000
          ELSE 30
        END
        UNION
        SELECT DISTINCT event_id, person_id FROM results
        WHERE regional_single_record = 'WR' OR regional_average_record = 'WR'
      ) candidates ON candidates.event_id = result.event_id AND candidates.person_id = result.person_id
      WHERE result.event_id NOT IN ('333mbf', '333mbo')
      ORDER BY competition.start_date, round_type.rank
    SQL
  end

  # NOTE: Current Ranking 数据——每人最佳 AoX，top 10
  # 格式：[[event_name, [[col1, col2, ...], ...]], ...]
  def ranking_data
    @ranking_data ||= compute_ranking
  end

  # NOTE: WR History 数据——全局 AoX WR 进展
  # 格式：[[event_name, [[col1, col2, ...], ...]], ...]
  def wr_history
    @wr_history ||= compute_wr_history
  end

  # NOTE: 兼容旧接口——data 仍返回基类 GroupedStatistic 需要的格式
  def data
    @data ||= ranking_data
  end

  # NOTE: 覆盖基类 markdown，使用双 Tab 视图
  def markdown
    top + tabbed_grouped_markdown(
      ranking_data: ranking_data,
      ranking_header: RANKING_HEADER_AOX,
      history_data: wr_history,
      history_header: HISTORY_HEADER_AOX
    )
  end

  # NOTE: Trimmed Mean (generalized WCA average)
  # WCA Ao5:   trim 1 per side (ceil(5*0.05) = 1)
  # Ao100:     trim 5 per side (ceil(100*0.05) = 5)
  # If any remaining solve is DNF (Infinity), the whole average is DNF.
  def average(solves, event_id)
    trimmed_per_side = (solves.length * 0.05).ceil
    untrimmed_solves = solves.sort.slice!(trimmed_per_side...-trimmed_per_side)
    return SolveTime::DNF if untrimmed_solves.last == Float::INFINITY
    values = untrimmed_solves
    mean_value = values.reduce(:+) / values.count.to_f
    # NOTE: FMC scores are in "moves" (integer); multiply by 100 to unify with centiseconds
    mean_value *= 100 if event_id == "333fm"
    SolveTime.new(event_id, :average, mean_value.round)
  end

  private

  # NOTE: 滑动窗口核心——为指定 event 的每个人计算最佳 AoX
  # 返回每人的 best 记录（含值、solves、起止比赛元数据）
  # 同时追踪每次刷新 PB 的记录（用于 WR History）
  def sliding_window_per_person(event_id)
    query_results
      .select { |r| r["event_id"] == event_id }
      .group_by { |r| r["person_id"] }
      .filter_map do |person_id, rows|
        # solves: 成绩值缓冲区 | meta: 每个 solve 对应的比赛元数据
        solves = []
        meta = []
        best = { aox: SolveTime::DNF, solves: [], start_meta: nil, end_meta: nil }
        # NOTE: pb_history 记录该选手每次刷新个人 PB 的时刻（WR History 用）
        pb_history = []

        rows.each do |row|
          comp_meta = { comp_link: row["competition_link"], date: row["start_date"] }
          (row["attempts"] || "").split(",").map(&:to_i).each do |value|
            next if value == SolveTime::SKIPPED_VALUE
            solves << (value > 0 ? value : Float::INFINITY)
            meta << comp_meta
            if solves.length == @solve_count
              current_aox = average(solves, event_id)
              if current_aox < best[:aox]
                best[:aox] = current_aox
                best[:solves] = solves.dup
                best[:start_meta] = meta.first
                best[:end_meta] = meta.last
                pb_history << {
                  aox: current_aox,
                  solves: solves.dup,
                  start_meta: meta.first,
                  end_meta: meta.last
                }
              end
              solves.shift
              meta.shift
            end
          end
        end

        next if best[:aox] == SolveTime::DNF

        first_row = rows.first
        {
          person_id: person_id,
          person_link: first_row["person_link"],
          country: first_row["country_id"],
          best: best,
          pb_history: pb_history
        }
      end
  end

  # NOTE: Current Ranking——每人最佳 AoX，按成绩排序取 top 10
  def compute_ranking
    Events::ALL.map do |event_id, event_name|
      persons = sliding_window_per_person(event_id)
      top10 = persons
        .sort_by { |p| p[:best][:aox] }
        .first(10)
        .each_with_index.map do |p, i|
          b = p[:best]
          [
            i + 1,
            p[:person_link],
            b[:aox].clock_format,
            p[:country],
            format_date(b[:start_meta][:date]),
            b[:start_meta][:comp_link],
            format_date(b[:end_meta][:date]),
            b[:end_meta][:comp_link],
            details_html(b[:solves], event_id)
          ]
        end
      [event_name, top10]
    end
  end

  # NOTE: WR History——合并所有人的 PB 进展，追踪全局最小值的刷新
  # 严格 < （tied WR 不计入）
  def compute_wr_history
    Events::ALL.map do |event_id, event_name|
      persons = sliding_window_per_person(event_id)

      # 合并所有人的 PB 记录，按达成时间排序
      all_pbs = persons.flat_map do |p|
        p[:pb_history].map { |pb| pb.merge(person_link: p[:person_link]) }
      end
      # NOTE: 同一日期可能有多个 PB（同一比赛中窗口连续刷新）
      # Ruby 3.4 的 sort_by 在混合 key 时对同 key 子组不保证稳定（实测会反转），
      # 若只按 date 排，同日期的 PB 顺序会被打乱，导致 WR 扫描跳过中间值。
      # 加第二键按 ao 值降序：同日期内从大到小扫描，保证不遗漏。
      all_pbs.sort_by! { |pb| [pb[:end_meta][:date], -pb[:aox].wca_value] }

      # 扫描全局最小值，严格 < 才计入（排除 tied）
      min_so_far = SolveTime::DNF
      wr_records = all_pbs.select do |pb|
        if pb[:aox] < min_so_far
          min_so_far = pb[:aox]
          true
        else
          false
        end
      end

      # 构建输出行
      results = wr_records.each_with_index.map do |r, i|
        metric_str = r[:aox].clock_format

        # 进步百分比
        if i > 0
          prev_val = wr_records[i - 1][:aox].wca_value.to_f
          curr_val = r[:aox].wca_value.to_f
          gain_str = "#{((prev_val - curr_val) / prev_val * 100).round(1)}%"
        else
          gain_str = ""
        end

        # 保持天数
        if i < wr_records.size - 1
          next_date = wr_records[i + 1][:end_meta][:date]
          days_str = (next_date - r[:end_meta][:date]).to_i.to_s
        else
          days_str = (Date.today - r[:end_meta][:date].to_date).to_i.to_s
        end

        [
          metric_str, gain_str, days_str,
          r[:person_link],
          format_date(r[:start_meta][:date]),
          r[:start_meta][:comp_link],
          format_date(r[:end_meta][:date]),
          r[:end_meta][:comp_link],
          details_html(r[:solves], event_id)
        ]
      end

      [event_name, results.reverse]
    end
  end

  # NOTE: Details HTML
  # ≤12 个成绩（Mo3/Ao5/Ao12）直接展示，不折叠
  # >12 个成绩（Ao25/Ao50/Ao100）用 <details> 折叠 + data-solves 懒加载
  LAZY_THRESHOLD = 12

  def details_html(solves, event_id)
    formatted = solves.map do |s|
      s == Float::INFINITY ? "DNF" : SolveTime.new(event_id, :single, s).clock_format
    end

    if formatted.size <= LAZY_THRESHOLD
      # NOTE: 直接展示——无折叠
      spans = formatted.map { |t| "<span>#{t}</span>" }.join
      "<div class=\"solve-list\">#{spans}</div>"
    else
      # NOTE: 折叠 + 懒加载
      csv = formatted.join(",")
      "<details class=\"solve-details\" data-solves=\"#{csv}\">" \
      "<summary>#{formatted.size} solves</summary></details>"
    end
  end

  def format_date(date)
    date.respond_to?(:strftime) ? date.strftime("%Y-%m-%d") : date.to_s
  end
end
