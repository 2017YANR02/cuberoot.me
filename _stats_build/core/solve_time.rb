# A modified version of https://github.com/thewca/worldcubeassociation.org/blob/master/WcaOnRails/lib/solve_time.rb

class SolveTime
  include Comparable

  CLOCK_FORMAT = "%d:%02d:%02d.%02d"
  QUESTION_STRING = "?:??:??"
  DOT_STRING = "."
  ZERO_STRING = "0"
  EMPTY_STRING = ''
  DNF_STRING = "DNF"
  DNS_STRING = "DNS"

  DNF_VALUE = -1
  DNS_VALUE = -2
  SKIPPED_VALUE = 0

  def initialize(event_id, field, wca_value)
    @event_id = event_id
    @field = field&.to_sym
    self.wca_value = wca_value
  end

  attr_reader :wca_value, :time_centiseconds, :move_count

  def wca_value=(wca_value)
    @wca_value = wca_value
    @move_count = nil
    @attempted = nil
    @solved = nil
    @time_centiseconds = nil

    if @event_id == "333fm"
      # The average field for 333fm is stored the same way as for other events, multiplied by 100.
      # Otherwise, wca_value is simply the number of moves.
      @move_count = (@field == :average ? (wca_value / 100.0) : wca_value)
    elsif %w(333mbf 333mbo).include?(@event_id)
      mb_value = wca_value
      # Extract wca_value parts.
      old = mb_value / 1_000_000_000 != 0
      if old
        time_seconds = mb_value % 100_000
        mb_value /= 100_000
        @attempted = mb_value % 100
        mb_value /= 100
        @solved = 99 - mb_value % 100
      else
        missed = mb_value % 100
        mb_value /= 100
        time_seconds = mb_value % 100_000
        mb_value /= 100_000
        difference = 99 - (mb_value % 100)
        @solved = difference + missed
        @attempted = @solved + missed
      end

      @time_centiseconds = (time_seconds == 99_999 ? nil : time_seconds * 100)
    else
      @time_centiseconds = wca_value
    end
  end

  attr_reader :solved, :attempted

  def missed
    self.attempted - self.solved
  end

  def points
    self.solved - self.missed
  end

  def dn?
    dnf? || dns?
  end

  def dns?
    wca_value == DNS_VALUE
  end

  def dnf?
    wca_value == DNF_VALUE
  end

  def skipped?
    wca_value == SKIPPED_VALUE
  end

  def unskipped?
    !skipped?
  end

  def complete?
    !dn? && unskipped?
  end

  def incomplete?
    !complete?
  end

  def time_seconds
    time_centiseconds / 100.0
  end

  def time_minutes
    time_seconds / 60.0
  end

  protected def to_orderable
    [
      skipped? ? 1 : 0,
      dns? ? 1 : 0,
      dnf? ? 1 : 0,
      wca_value,
    ]
  end

  def <=>(other)
    to_orderable <=> other.to_orderable
  end

  def self.multibld_attempt_to_points(attempt_result)
    SolveTime.new("333mbf", :best, attempt_result).points
  end

  def self.centiseconds_to_clock_format(centiseconds)
    hours = centiseconds / 360_000
    minutes = (centiseconds % 360_000) / 6000
    seconds = (centiseconds % 6000) / 100
    centis = centiseconds % 100

    clock_format = format(CLOCK_FORMAT, hours, minutes, seconds, centis).sub(/^[0:]*/, EMPTY_STRING)
    if clock_format.start_with? DOT_STRING
      clock_format = ZERO_STRING + clock_format
    end
    clock_format
  end

  def clock_format
    return DNS_STRING if dns?
    return DNF_STRING if dnf?
    return EMPTY_STRING if skipped?

    if @event_id == '333fm'
      format_str = (@field == :average ? "%.2f" : "%.0f")
      format_str % @move_count
    elsif %w(333mbf 333mbo).include?(@event_id)
      # Build time string.
      if time_centiseconds.nil?
        result = QUESTION_STRING
      else
        result = EMPTY_STRING
        time_seconds = time_centiseconds / 100
        # Show 2/2 0:XX instead of 2/2 XX
        if time_seconds < 60
          result = "0:#{time_seconds}"
        else
          while time_seconds >= 60
            result = format(":%02d#{result}", time_seconds % 60)
            time_seconds /= 60
          end
          result = "#{time_seconds}#{result}"
        end
      end

      "#{@solved}/#{@attempted} #{result}"
    else
      SolveTime.centiseconds_to_clock_format(time_centiseconds)
    end
  end

  DNF = SolveTime.new(nil, nil, DNF_VALUE)
  DNS = SolveTime.new(nil, nil, DNS_VALUE)
  SKIPPED = SolveTime.new(nil, nil, SKIPPED_VALUE)
end
