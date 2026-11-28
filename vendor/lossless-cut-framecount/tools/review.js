'use strict';
const el = (id) => document.getElementById(id);
const video = el('video');
const review = el('review');
let media,
  mediaUrl,
  timings = [],
  busy = false;
const lines = () =>
  review.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const tell = (message) => {
  el('status').textContent = message;
};
function update() {
  const texts = lines();
  const ready = Boolean(
    media &&
    texts.length &&
    texts.length === timings.length &&
    timings.every(
      ({ start, end }) =>
        Number.isFinite(start) &&
        end > start &&
        Math.round(end * 100) > Math.round(start * 100) &&
        start >= 0 &&
        end <= video.duration + 0.005,
    ),
  );
  el('save').disabled = !ready;
  el('burn').disabled = !ready || busy;
  el('caption').textContent = texts
    .filter(
      (_, i) =>
        video.currentTime >= timings[i]?.start &&
        video.currentTime < timings[i]?.end,
    )
    .join('\n');
}
function draw() {
  const texts = lines();
  const rows = el('rows');
  rows.replaceChildren();
  const count = Math.max(texts.length, timings.length);
  for (let i = 0; i < count; i++) {
    const timing = (timings[i] ??= {});
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('span');
    label.textContent = String(i + 1);
    row.append(label);
    for (const [key, title] of [
      ['start', '起点'],
      ['end', '终点'],
    ]) {
      const box = document.createElement('input');
      box.type = 'number';
      box.min = '0';
      box.step = '0.001';
      box.placeholder = title + '（秒）';
      box.setAttribute('aria-label', `第 ${i + 1} 阶段${title}`);
      if (timing[key] != null) box.value = timing[key];
      box.oninput = () => {
        timing[key] = box.valueAsNumber;
        update();
      };
      const mark = document.createElement('button');
      mark.textContent = '标' + title;
      mark.title = '使用视频当前时间';
      mark.disabled = !Number.isFinite(video.duration);
      mark.onclick = () => {
        box.value = video.currentTime.toFixed(3);
        box.oninput();
      };
      row.append(box, mark);
    }
    rows.append(row);
  }
  if (timings.length > texts.length) {
    const trim = document.createElement('button');
    trim.textContent = '移除末尾未配字幕的分段';
    trim.onclick = () => {
      timings.length = texts.length;
      draw();
    };
    rows.append(trim);
  }
  update();
}
function selectVideo(file) {
  if (!file || busy) return;
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  media = file;
  mediaUrl = URL.createObjectURL(file);
  video.src = mediaUrl;
  el('pick').hidden = true;
  el('replace').hidden = false;
  el('filename').textContent = file.name;
  tell('正在读取视频…');
  update();
}
el('pick').onclick = el('replace').onclick = () => el('media').click();
el('media').onchange = (e) => selectVideo(e.target.files[0]);
el('drop').ondragover = (e) => e.preventDefault();
el('drop').ondrop = (e) => {
  e.preventDefault();
  selectVideo(e.dataTransfer.files[0]);
};
video.onloadedmetadata = () => {
  draw();
  tell('视频已就绪。可以粘贴复盘文本并对齐时间。');
};
video.onerror = () => tell('浏览器无法预览这个视频，请使用 H.264 编码的 MP4。');
video.ontimeupdate = video.onseeked = update;
if (video.requestVideoFrameCallback) {
  const paint = (_, frame) => {
    el('caption').textContent = lines()
      .filter(
        (__, i) =>
          frame.mediaTime >= timings[i]?.start &&
          frame.mediaTime < timings[i]?.end,
      )
      .join('\n');
    video.requestVideoFrameCallback(paint);
  };
  video.requestVideoFrameCallback(paint);
}
review.oninput = () => {
  while (
    timings.length > lines().length &&
    !Object.values(timings.at(-1)).some(Number.isFinite)
  )
    timings.pop();
  draw();
};
el('unit').onchange = () => {
  el('fps').hidden = el('unit').value !== 'frames';
};
el('load').onclick = () => el('segments').click();
function timeValue(raw, csv) {
  if (raw == null || raw === '') return undefined;
  const s = String(raw).trim();
  if (!/^\d+(?::\d+){0,2}(?:\.\d+)?$/.test(s)) throw Error('分段时间格式有误');
  if (csv && el('unit').value === 'frames') {
    const fps = el('fps').valueAsNumber;
    if (!(fps > 0) || !/^\d+$/.test(s))
      throw Error('请填写帧率，并确认 CSV 中的时间为帧号');
    return Number(s) / fps;
  }
  return s.split(':').reduce((n, part) => n * 60 + Number(part), 0);
}
el('segments').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const raw = (await file.text()).replace(/^\uFEFF/, '');
    const csv = /\.csv$/i.test(file.name);
    let segments;
    if (csv) {
      const rows = csv_parse_sync.parse(raw, {
        skip_empty_lines: true,
        relax_column_count: true,
      });
      if (rows[0]?.[0]?.trim().toLowerCase() === 'start') rows.shift();
      segments = rows.map(([start, end, name]) => ({ start, end, name }));
    } else segments = JSON5.parse(raw).cutSegments;
    if (!Array.isArray(segments) || !segments.length)
      throw Error('文件里没有分段');
    const next = segments.map((s) => ({
      start: timeValue(s.start, csv) ?? 0,
      end: timeValue(s.end, csv),
    }));
    next.forEach((s, i) => {
      s.end ??=
        next[i + 1]?.start ??
        (Number.isFinite(video.duration) ? video.duration : undefined);
    });
    const names = segments.map((s, i) => String(s.name || `阶段 ${i + 1}`));
    if (!lines().length) review.value = names.join('\n');
    timings = next;
    draw();
    tell(`已导入 ${next.length} 个分段。请核对字幕行数和起止时间。`);
  } catch (err) {
    tell('导入失败：' + err.message);
  }
};
function assTime(seconds) {
  const n = Math.round(seconds * 100);
  const pad = (x) => String(x).padStart(2, '0');
  return `${Math.floor(n / 360000)}:${pad(Math.floor(n / 6000) % 60)}:${pad(Math.floor(n / 100) % 60)}.${pad(n % 100)}`;
}
function makeAss() {
  const w = video.videoWidth,
    h = video.videoHeight;
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,PingFang SC,${Math.max(12, Math.round(h * 0.052))},&H00FFFFFF,&H00FFFFFF,&H00000000,&H60000000,0,0,0,0,100,100,0,0,1,${Math.max(1, h * 0.002)},0,2,12,12,${Math.round(h * 0.12)},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  return (
    head +
    lines()
      .map(
        (s, i) =>
          `Dialogue: 0,${assTime(timings[i].start)},${assTime(timings[i].end)},Default,,0,0,0,,${s.replaceAll('\\', '＼').replaceAll('{', '｛').replaceAll('}', '｝')}`,
      )
      .join('\n') +
    '\n'
  );
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const stem = () => media.name.replace(/\.[^.]+$/, '');
el('save').onclick = () =>
  download(
    new Blob([makeAss()], { type: 'text/plain;charset=utf-8' }),
    stem() + '.ass',
  );
el('burn').onclick = async () => {
  busy = true;
  update();
  const name = stem() + '-sub.mp4';
  tell('正在这台 Mac 上压制，请保持页面打开…');
  try {
    const ass = new Blob([makeAss()]);
    const res = await fetch('/render', {
      method: 'POST',
      headers: { 'X-ASS-Bytes': String(ass.size) },
      body: new Blob([ass, media]),
    });
    if (!res.ok) throw Error(await res.text());
    download(await res.blob(), name);
    tell(`已生成 ${name}，请在下载中查看。`);
  } catch (err) {
    tell('导出失败：' + err.message);
  } finally {
    busy = false;
    update();
  }
};
