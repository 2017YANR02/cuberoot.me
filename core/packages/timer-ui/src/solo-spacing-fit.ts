import type { SoloLayout } from '@cuberoot/shared/timer';

const gapProperties = {
  scrambleGap: '--solo-scramble-gap', sourceGap: '--solo-source-gap',
  timerGap: '--solo-timer-gap', cubeGap: '--solo-cube-gap',
} as const;

/** Also used by the editor's synchronous, reversible candidate measurement. */
export function fitSoloSpacing(stage: HTMLElement, layout: SoloLayout) {
  const entries = Object.entries(gapProperties) as [keyof typeof gapProperties, string][];
  const apply = (fraction: number) => {
    for (const [key, property] of entries) {
      const value = `${Math.floor(layout[key] * fraction)}px`;
      if (stage.style.getPropertyValue(property) !== value) stage.style.setProperty(property, value);
    }
  };
  const fits = () => stage.scrollHeight <= stage.clientHeight;
  // Probe synchronously and restore the final fit before paint. A bounded
  // search handles line wrapping and preview docking without feedback guesses.
  // Position offsets must not take space away from any other region.
  stage.style.setProperty('--solo-apply-offsets', '0');
  try {
    apply(1);
    if (!fits()) {
      apply(0);
      if (fits()) {
        let low = 0, high = 1;
        for (let attempt = 0; attempt < 8; attempt++) {
          const middle = (low + high) / 2;
          apply(middle);
          if (fits()) low = middle;
          else high = middle;
        }
        apply(low);
      }
      // If content itself exceeds the viewport, zero whitespace leaves the
      // existing whole-stage scroller available instead of clipping content.
    }
  } finally {
    stage.style.removeProperty('--solo-apply-offsets');
  }
}

/** Fit saved whitespace to the live stage, including source/footer content and
 * host navigation. Only rendered CSS changes; stored preferences stay intact. */
export function observeSoloSpacing(stage: HTMLElement, layout: SoloLayout) {
  const entries = Object.entries(gapProperties) as [keyof typeof gapProperties, string][];
  const originals = entries.map(([, property]) => ({
    value: stage.style.getPropertyValue(property), priority: stage.style.getPropertyPriority(property),
  }));
  const regions = [stage, ...stage.querySelectorAll<HTMLElement>(
    '.timing-surface, .timing-surface-scramble-top, .timing-surface-core, .timing-surface-sub, .timer-stage-source, .timer-stage-footer',
  )];
  let frame: number | null = null;
  let lastMeasurement = '';
  const measurement = () => regions.map(element => {
    const rect = element.getBoundingClientRect();
    return `${rect.width},${rect.height},${element.scrollHeight},${element.clientHeight}`;
  }).join(';');
  const fit = () => {
    frame = null;
    if (!stage.clientHeight || measurement() === lastMeasurement) return;
    fitSoloSpacing(stage, layout);
    // Ignore observer notifications caused by this fit's own final geometry.
    lastMeasurement = measurement();
  };
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(fit); };
  const observer = new ResizeObserver(schedule);
  regions.forEach(element => observer.observe(element));
  fit();
  return () => {
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    entries.forEach(([, property], index) => {
      const original = originals[index];
      if (original.value) stage.style.setProperty(property, original.value, original.priority);
      else stage.style.removeProperty(property);
    });
  };
}
