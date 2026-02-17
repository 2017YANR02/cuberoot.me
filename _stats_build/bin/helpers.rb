module Helpers
  def self.timed_task(message)
    puts message
    task_start = Time.now
    yield
    duration = Time.now - task_start
    seconds_with_centiseconds = duration % 60
    minutes = duration.to_i / 60
    print "Took"
    print " #{minutes} minutes and" if minutes > 0
    printf " %0.2f seconds\n", seconds_with_centiseconds
  end
end
