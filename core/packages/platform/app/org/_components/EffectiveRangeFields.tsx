export const teachingInputClass = "w-full min-w-0 rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function EffectiveRangeFields({ timezone }: { timezone: string }) {
  return (
    <>
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">开始时间（可选）</span>
        <input name="localFrom" type="datetime-local" className={teachingInputClass} />
      </label>
      <label className="block min-w-0">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">结束时间（可选）</span>
        <input name="localTo" type="datetime-local" className={teachingInputClass} />
      </label>
      <p className="text-[12px] leading-5 text-ink-3 sm:col-span-2">
        按 {timezone} 解释，区间为 [开始时间, 结束时间)。开始留空表示提交时生效，结束留空表示长期有效。
      </p>
    </>
  );
}
