"""差分测试辅助: 从 stdin 读入每行一个 scramble, 输出应用后的 sc 数组 (逗号分隔)。

仅用于验证 TS 端口与原始 Python cube_state 逐状态一致。无第三方依赖。
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from cube_state import CubeState  # noqa: E402

for line in sys.stdin:
    line = line.rstrip("\n")
    c = CubeState()
    if line.strip():
        c.apply(line)
    print(",".join(str(x) for x in c.sc))
