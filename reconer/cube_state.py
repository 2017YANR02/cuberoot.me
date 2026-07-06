"""
cube_state.py - 魔方状态机

完全基于 functions.cpp 的 54-sticker 置换表。
每个转动定义为 54 个 facelet 的置换 (permutation)。

Facelet 编号 (与 functions.cpp 一致):
  U面: 0-8    R面: 9-17   F面: 18-26
  D面: 27-35  L面: 36-44  B面: 45-53

颜色约定:
  U=0(白) R=1(红) F=2(绿) D=3(黄) L=4(橙) B=5(蓝)

宽转/中间层/整体旋转的展开规则来自 functions.cpp 的 move_convert 表。
"""

import re


# 54-sticker 置换表 — 直接从 functions.cpp 的 moves map 提取
# 含义: new_state[i] = old_state[perm[i]]
_MOVE_PERMS = {
    "U":  [6,3,0,7,4,1,8,5,2, 45,46,47,12,13,14,15,16,17, 9,10,11,21,22,23,24,25,26, 27,28,29,30,31,32,33,34,35, 18,19,20,39,40,41,42,43,44, 36,37,38,48,49,50,51,52,53],
    "U2": [8,7,6,5,4,3,2,1,0, 36,37,38,12,13,14,15,16,17, 45,46,47,21,22,23,24,25,26, 27,28,29,30,31,32,33,34,35, 9,10,11,39,40,41,42,43,44, 18,19,20,48,49,50,51,52,53],
    "U'": [2,5,8,1,4,7,0,3,6, 18,19,20,12,13,14,15,16,17, 36,37,38,21,22,23,24,25,26, 27,28,29,30,31,32,33,34,35, 45,46,47,39,40,41,42,43,44, 9,10,11,48,49,50,51,52,53],
    "D":  [0,1,2,3,4,5,6,7,8, 9,10,11,12,13,14,24,25,26, 18,19,20,21,22,23,42,43,44, 33,30,27,34,31,28,35,32,29, 36,37,38,39,40,41,51,52,53, 45,46,47,48,49,50,15,16,17],
    "D2": [0,1,2,3,4,5,6,7,8, 9,10,11,12,13,14,42,43,44, 18,19,20,21,22,23,51,52,53, 35,34,33,32,31,30,29,28,27, 36,37,38,39,40,41,15,16,17, 45,46,47,48,49,50,24,25,26],
    "D'": [0,1,2,3,4,5,6,7,8, 9,10,11,12,13,14,51,52,53, 18,19,20,21,22,23,15,16,17, 29,32,35,28,31,34,27,30,33, 36,37,38,39,40,41,24,25,26, 45,46,47,48,49,50,42,43,44],
    "L":  [53,1,2,50,4,5,47,7,8, 9,10,11,12,13,14,15,16,17, 0,19,20,3,22,23,6,25,26, 18,28,29,21,31,32,24,34,35, 42,39,36,43,40,37,44,41,38, 45,46,33,48,49,30,51,52,27],
    "L2": [27,1,2,30,4,5,33,7,8, 9,10,11,12,13,14,15,16,17, 53,19,20,50,22,23,47,25,26, 0,28,29,3,31,32,6,34,35, 44,43,42,41,40,39,38,37,36, 45,46,24,48,49,21,51,52,18],
    "L'": [18,1,2,21,4,5,24,7,8, 9,10,11,12,13,14,15,16,17, 27,19,20,30,22,23,33,25,26, 53,28,29,50,31,32,47,34,35, 38,41,44,37,40,43,36,39,42, 45,46,6,48,49,3,51,52,0],
    "R":  [0,1,20,3,4,23,6,7,26, 15,12,9,16,13,10,17,14,11, 18,19,29,21,22,32,24,25,35, 27,28,51,30,31,48,33,34,45, 36,37,38,39,40,41,42,43,44, 8,46,47,5,49,50,2,52,53],
    "R2": [0,1,29,3,4,32,6,7,35, 17,16,15,14,13,12,11,10,9, 18,19,51,21,22,48,24,25,45, 27,28,2,30,31,5,33,34,8, 36,37,38,39,40,41,42,43,44, 26,46,47,23,49,50,20,52,53],
    "R'": [0,1,51,3,4,48,6,7,45, 11,14,17,10,13,16,9,12,15, 18,19,2,21,22,5,24,25,8, 27,28,20,30,31,23,33,34,26, 36,37,38,39,40,41,42,43,44, 35,46,47,32,49,50,29,52,53],
    "F":  [0,1,2,3,4,5,44,41,38, 6,10,11,7,13,14,8,16,17, 24,21,18,25,22,19,26,23,20, 15,12,9,30,31,32,33,34,35, 36,37,27,39,40,28,42,43,29, 45,46,47,48,49,50,51,52,53],
    "F2": [0,1,2,3,4,5,29,28,27, 44,10,11,41,13,14,38,16,17, 26,25,24,23,22,21,20,19,18, 8,7,6,30,31,32,33,34,35, 36,37,15,39,40,12,42,43,9, 45,46,47,48,49,50,51,52,53],
    "F'": [0,1,2,3,4,5,9,12,15, 29,10,11,28,13,14,27,16,17, 20,23,26,19,22,25,18,21,24, 38,41,44,30,31,32,33,34,35, 36,37,8,39,40,7,42,43,6, 45,46,47,48,49,50,51,52,53],
    "B":  [11,14,17,3,4,5,6,7,8, 9,10,35,12,13,34,15,16,33, 18,19,20,21,22,23,24,25,26, 27,28,29,30,31,32,36,39,42, 2,37,38,1,40,41,0,43,44, 51,48,45,52,49,46,53,50,47],
    "B2": [35,34,33,3,4,5,6,7,8, 9,10,42,12,13,39,15,16,36, 18,19,20,21,22,23,24,25,26, 27,28,29,30,31,32,2,1,0, 17,37,38,14,40,41,11,43,44, 53,52,51,50,49,48,47,46,45],
    "B'": [42,39,36,3,4,5,6,7,8, 9,10,0,12,13,1,15,16,2, 18,19,20,21,22,23,24,25,26, 27,28,29,30,31,32,17,14,11, 33,37,38,34,40,41,35,43,44, 47,50,53,46,49,52,45,48,51],
}

# 宽转/旋转展开表 — 从 functions.cpp 的 move_convert 提取
# NOTE: 将复合符号展开为基础转动序列
_MOVE_ALIASES = {
    # 双转方向无关
    "U2'": "U2", "D2'": "D2", "L2'": "L2", "R2'": "R2", "F2'": "F2", "B2'": "B2",
    # 宽转 (小写)
    "u": "y D", "u2": "y2 D2", "u2'": "y2 D2", "u'": "y' D'",
    "d": "y' U", "d2": "y2 U2", "d2'": "y2 U2", "d'": "y U'",
    "l": "x' R", "l2": "x2 R2", "l2'": "x2 R2", "l'": "x R'",
    "r": "x L",  "r2": "x2 L2", "r2'": "x2 L2", "r'": "x' L'",
    "f": "z B",  "f2": "z2 B2", "f2'": "z2 B2", "f'": "z' B'",
    "b": "z' F", "b2": "z2 F2", "b2'": "z2 F2", "b'": "z F'",
    # Uw/Dw/Lw/Rw/Fw/Bw 风格
    "Uw": "y D", "Uw2": "y2 D2", "Uw'": "y' D'",
    "Dw": "y' U", "Dw2": "y2 U2", "Dw'": "y U'",
    "Lw": "x' R", "Lw2": "x2 R2", "Lw'": "x R'",
    "Rw": "x L",  "Rw2": "x2 L2", "Rw'": "x' L'",
    "Fw": "z B",  "Fw2": "z2 B2", "Fw'": "z' B'",
    "Bw": "z' F", "Bw2": "z2 F2", "Bw'": "z F'",
    # 中间层
    "M": "x' L' R", "M2": "x2 L2 R2", "M2'": "x2 L2 R2", "M'": "x L R'",
    "E": "y' U D'", "E2": "y2 U2 D2", "E2'": "y2 U2 D2", "E'": "y U' D",
    "S": "z F' B",  "S2": "z2 F2 B2", "S2'": "z2 F2 B2", "S'": "z' F B'",
}

# 整体旋转的面映射 — 从 functions.cpp 的 AlgConvertRotation 提取
# face_list[i] = 旋转后，原来面 i 的转动现在对应面 face_list[i] 的转动
_ROTATION_FACE_MAP = {
    "x":   [5, 4, 2, 3, 0, 1],  # U->B, D->F, L->L, R->R, F->U, B->D (NOTE: 原index映射)
    "x2":  [1, 0, 2, 3, 5, 4],
    "x'":  [4, 5, 2, 3, 1, 0],
    "y":   [0, 1, 5, 4, 2, 3],
    "y2":  [0, 1, 3, 2, 5, 4],
    "y'":  [0, 1, 4, 5, 3, 2],
    "z":   [3, 2, 0, 1, 4, 5],
    "z2":  [1, 0, 3, 2, 4, 5],
    "z'":  [2, 3, 1, 0, 4, 5],
}

# move_names 顺序: U=0,U2=1,U'=2, D=3,D2=4,D'=5, L=6,L2=7,L'=8, R=9,R2=10,R'=11, F=12,F2=13,F'=14, B=15,B2=16,B'=17
_FACE_NAMES = ["U", "D", "L", "R", "F", "B"]


def _alg_convert_rotation(move_indices, rotation):
    """将 move 索引列表按旋转映射转换 (与 functions.cpp AlgConvertRotation 一致)"""
    face_list = _ROTATION_FACE_MAP[rotation]
    return [3 * face_list[m // 3] + m % 3 for m in move_indices]


def _move_name_to_index(name):
    """18 个基础转动名 -> 索引 (0-17)"""
    move_names = ["U","U2","U'","D","D2","D'","L","L2","L'","R","R2","R'","F","F2","F'","B","B2","B'"]
    return move_names.index(name)


def _index_to_move_name(idx):
    move_names = ["U","U2","U'","D","D2","D'","L","L2","L'","R","R2","R'","F","F2","F'","B","B2","B'"]
    return move_names[idx]


class CubeState:
    """魔方状态机 — 基于 54-sticker 置换"""

    # 还原态: facelet i 的颜色 = i 所属面的中心色
    _SOLVED = list(range(54))

    def __init__(self, sc=None):
        # sc[i] = facelet i 当前显示的原始 facelet 编号
        self.sc = sc if sc is not None else list(range(54))

    def clone(self):
        return CubeState(self.sc[:])

    def is_solved(self):
        return self.sc == self._SOLVED

    def apply_perm(self, perm):
        """执行一次 54-sticker 置换"""
        new_sc = [self.sc[perm[i]] for i in range(54)]
        self.sc = new_sc
        return self

    def apply(self, move_str):
        """
        执行一个或多个动作字符串。
        支持所有 WCA 标准符号: U U' U2 U2' ... r r' r2 ... x y z ... M E S ...
        """
        tokens = _tokenize(move_str)
        # 展开 + 处理旋转
        expanded = _expand_tokens(tokens)
        for perm in expanded:
            self.apply_perm(perm)
        return self

    def get_color(self, facelet_idx):
        """获取 facelet 的颜色 (0-5)"""
        return self.sc[facelet_idx] // 9

    def get_face_colors(self, face):
        """
        获取某面的 9 个贴纸颜色 (3x3)。
        face: 'U'/'R'/'F'/'D'/'L'/'B'
        返回: [[c0,c1,c2],[c3,c4,c5],[c6,c7,c8]]
        """
        start = {'U': 0, 'R': 9, 'F': 18, 'D': 27, 'L': 36, 'B': 45}[face]
        flat = [self.get_color(start + i) for i in range(9)]
        return [flat[0:3], flat[3:6], flat[6:9]]

    def get_all_colors(self):
        """返回 54 个 facelet 颜色 (0-5)"""
        return [self.sc[i] // 9 for i in range(54)]

    def to_color_string(self):
        """返回 54 字符颜色字符串 (与 functions.cpp StateToInput 一致)"""
        face_map = {0: 'U', 1: 'R', 2: 'F', 3: 'D', 4: 'L', 5: 'B'}
        return ''.join(face_map[self.sc[i] // 9] for i in range(54))

    def __repr__(self):
        color_char = {0: 'W', 1: 'R', 2: 'G', 3: 'Y', 4: 'O', 5: 'B'}
        colors = self.get_all_colors()
        lines = []
        for row in range(3):
            lines.append('      ' + ' '.join(color_char[colors[row*3+i]] for i in range(3)))
        for row in range(3):
            parts = []
            for start in [36, 18, 9, 45]:
                parts.append(' '.join(color_char[colors[start+row*3+i]] for i in range(3)))
            lines.append('  '.join(parts))
        for row in range(3):
            lines.append('      ' + ' '.join(color_char[colors[27+row*3+i]] for i in range(3)))
        return '\n'.join(lines)


def _tokenize(move_str):
    """将动作字符串拆分为 token 列表，支持 U2' 等复合符号"""
    # 匹配: 大写字母(可选w) + 可选数字 + 可选撇号
    # 或: 小写字母 + 可选数字 + 可选撇号
    return re.findall(r"[A-Z]w?2?'?|[xyz]2?'?|[udlrfb]2?'?|[MES]2?'?", move_str)


def _expand_tokens(tokens):
    """
    将 token 列表展开为 54-sticker 置换序列。
    处理逻辑:
      1. 旋转 (x/y/z) 不直接改变 sticker，而是重映射后续转动的含义。
      2. 宽转/中间层通过 _MOVE_ALIASES 递归展开。
      3. 18 个基础转动直接查表。
    
    实现方式: 将所有符号展开为"不含旋转的基础转动序列"
    (与 functions.cpp ConvertScramble 逻辑一致)
    """
    # 第一步: 展开宽转/中间层为 (旋转 + 基础转动)
    flat_tokens = []
    for token in tokens:
        if token in _MOVE_ALIASES:
            flat_tokens.extend(_MOVE_ALIASES[token].split())
        elif token in _MOVE_PERMS or token in _ROTATION_FACE_MAP:
            flat_tokens.append(token)
        else:
            raise ValueError(f"Unknown move: {token}")

    # 第二步: 消除旋转，将旋转吸收进后续转动的面映射中
    # (与 ConvertScramble 第二遍逻辑一致)
    perms = []
    accumulated_moves = []  # 已收集的基础转动索引

    for token in flat_tokens:
        if token in _MOVE_PERMS:
            accumulated_moves.append(_move_name_to_index(token))
        elif token in _ROTATION_FACE_MAP:
            # 旋转: 将已积累的所有转动按此旋转进行面映射
            accumulated_moves = _alg_convert_rotation(accumulated_moves, token)
        else:
            raise ValueError(f"Unexpected token after expansion: {token}")

    # 将映射后的基础转动转为置换
    for idx in accumulated_moves:
        name = _index_to_move_name(idx)
        perms.append(_MOVE_PERMS[name])

    return perms


# ============================================================
# 逆序公式工具
# ============================================================
_MOVE_REVERSE = {
    "U": "U'", "U2": "U2", "U'": "U",
    "D": "D'", "D2": "D2", "D'": "D",
    "L": "L'", "L2": "L2", "L'": "L",
    "R": "R'", "R2": "R2", "R'": "R",
    "F": "F'", "F2": "F2", "F'": "F",
    "B": "B'", "B2": "B2", "B'": "B",
}


def reverse_algorithm(alg_str):
    """将公式逆序 (每步取逆，整体反转)"""
    tokens = _tokenize(alg_str)
    reversed_tokens = []
    for t in reversed(tokens):
        if t in _MOVE_REVERSE:
            reversed_tokens.append(_MOVE_REVERSE[t])
        else:
            # 对于非基础转动，先展开再逆序... 简化处理只支持基础转动
            raise ValueError(f"reverse_algorithm only supports basic moves, got: {t}")
    return ' '.join(reversed_tokens)


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== CubeState Tests ===")

    # 测试 1: 还原态
    cube = CubeState()
    assert cube.is_solved(), "FAIL: solved check"
    print("[PASS] Solved state")
    print(cube)
    print()

    # 测试 2: Sexy Move x6 = Identity
    cube2 = CubeState()
    for _ in range(6):
        cube2.apply("R U R' U'")
    assert cube2.is_solved(), "FAIL: Sexy Move x6"
    print("[PASS] Sexy Move x6 = Identity")

    # 测试 3: U4 = Identity
    cube3 = CubeState()
    cube3.apply("U U U U")
    assert cube3.is_solved(), "FAIL: U4"
    print("[PASS] U4 = Identity")

    # 测试 4: R4 = Identity
    cube4 = CubeState()
    cube4.apply("R R R R")
    assert cube4.is_solved(), "FAIL: R4"
    print("[PASS] R4 = Identity")

    # 测试 5: 所有基础转动的 X4 = Identity
    for move in ["U","D","L","R","F","B"]:
        c = CubeState()
        c.apply(f"{move} {move} {move} {move}")
        assert c.is_solved(), f"FAIL: {move}4"
    print("[PASS] All face^4 = Identity")

    # 测试 6: X * X' = Identity
    for move in ["U","D","L","R","F","B"]:
        c = CubeState()
        c.apply(f"{move} {move}'")
        assert c.is_solved(), f"FAIL: {move} {move}'"
    print("[PASS] All X * X' = Identity")

    # 测试 7: 宽转 r r' = Identity
    cube7 = CubeState()
    cube7.apply("r r'")
    assert cube7.is_solved(), "FAIL: r r'"
    print("[PASS] r r' = Identity")

    # 测试 8: 宽转 f f' = Identity
    cube8 = CubeState()
    cube8.apply("f f'")
    assert cube8.is_solved(), "FAIL: f f'"
    print("[PASS] f f' = Identity")

    # 测试 9: 宽转 u u' = Identity
    cube9 = CubeState()
    cube9.apply("u u'")
    assert cube9.is_solved(), "FAIL: u u'"
    print("[PASS] u u' = Identity")

    # 测试 10: Superflip
    cubeS = CubeState()
    cubeS.apply("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2")
    # Superflip: 所有棱翻转，但角不变。状态不是 solved
    assert not cubeS.is_solved(), "FAIL: Superflip should not be solved"
    print("[PASS] Superflip is not solved (as expected)")

    # 测试 11: GT 解法 — 正序执行再逆序执行 = Identity
    gt = "F L2 D' L' U R' F R2 U R' U2 L' U L R' U2 R U D' L F' L' F L U L' U' f U2 R U R' U2 f' U L' R U R' U' L U2 R U2 R' U'"
    # 程序自动计算逆序
    inv_map = {"U":"U'","U'":"U","U2":"U2","D":"D'","D'":"D","D2":"D2",
               "L":"L'","L'":"L","L2":"L2","R":"R'","R'":"R","R2":"R2",
               "F":"F'","F'":"F","F2":"F2","B":"B'","B'":"B","B2":"B2",
               "f":"f'","f'":"f"}
    gt_tokens = _tokenize(gt)
    gt_rev = ' '.join(inv_map[t] for t in reversed(gt_tokens))
    c11 = CubeState()
    c11.apply(gt)
    c11.apply(gt_rev)
    assert c11.is_solved(), "FAIL: GT forward + reverse"
    print("[PASS] GT solution forward + reverse = Identity")

    # 测试 12: to_color_string 验证
    c12 = CubeState()
    expected = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
    assert c12.to_color_string() == expected, f"FAIL: color string, got {c12.to_color_string()}"
    print("[PASS] to_color_string() correct")

    # 测试 13: U2' 符号支持
    c13a = CubeState()
    c13b = CubeState()
    c13a.apply("U2")
    c13b.apply("U2'")
    assert c13a.sc == c13b.sc, "FAIL: U2 != U2'"
    print("[PASS] U2' == U2")

    print("\n=== All tests passed ===")
