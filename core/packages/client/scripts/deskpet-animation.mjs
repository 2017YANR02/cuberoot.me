// Shared SVG keyframes for authored pet rigs. No script is embedded in assets.
export function createAnimator(prefix, duration) {
  if (!(duration > 0 && Number.isFinite(duration))) throw Error('Invalid animation duration');
  const styles = [];
  let serial = 0;
  const a = (art, frames, origin = '0px 0px', easing = 'ease-in-out') => {
    if (!frames?.length) return art;
    const name = `${prefix}-${++serial}`;
    const complete = [...frames];
    if (complete.at(-1)[0] !== 100) complete.push([100, complete[0][1]]);
    let previous = -1;
    for (const [time, css] of complete) {
      if (!Number.isFinite(time) || time < previous || time < 0 || time > 100 || /NaN|undefined|Infinity/.test(css)) throw Error(`Invalid keyframe in ${name}`);
      previous = time;
    }
    styles.push(`.${name}{transform-origin:${origin};animation:${name} ${duration}s ${easing} infinite}@keyframes ${name}{${complete.map(([time, css, curve]) => `${time}%{${css}${curve ? `animation-timing-function:${curve};` : ''}}`).join('')}}`);
    return `<g class="${name}">${art}</g>`;
  };
  return { a, styles };
}
