// 跨页面传递 File 对象。File 不能进 URL/storage,只能 in-memory。
// 流程:LandingSearch + 选/拖文件 → setPendingVideo(file) → navigate('/frame-count')
//      → FrameCountPage 挂载时 consumePendingVideo() → loadFile()
let _pending: File | null = null;
export function setPendingVideo(f: File) { _pending = f; }
export function consumePendingVideo(): File | null {
  const f = _pending;
  _pending = null;
  return f;
}
