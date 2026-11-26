"""Regenerate OrderWitnesses.lean with a short Schreier–Sims certificate.

Run: uv run --with sympy==1.14.0 python CubeMixing/generate_order.py
SymPy discovers generators; Lean checks every sticker multiplication and orbit.
"""

from collections import deque
from pathlib import Path
from math import prod

from sympy.combinatorics import Permutation, PermutationGroup


def face(axis, high):
    images = []
    for s in range(54):
        normal, within = divmod(s, 18)
        side, cell = divmod(within, 9)
        u, v = divmod(cell, 3)
        point = [u + 1, v + 1]
        point.insert(normal, 4 * side)
        x, y, z = point
        if point[axis] in ((3, 4) if high else (0, 1)):
            point = ((x, 4-z, y), (z, y, 4-x), (4-y, x, z))[axis]
        normal = next(i for i, c in enumerate(point) if c in (0, 4))
        tangent = [c - 1 for i, c in enumerate(point) if i != normal]
        images.append(18 * normal + 9 * (point[normal] == 4) + 3*tangent[0] + tangent[1])
    return tuple(images)


class Nodes:
    """Hash-cons permutation products; node i * j means apply j first."""

    def __init__(self):
        self.perms = []
        self.ops = []
        self.index = {}
        self.inverses = {}
        self.add(tuple(range(54)), (".one",))

    def add(self, p, op):
        if p not in self.index:
            self.index[p] = len(self.ops)
            self.perms.append(p)
            self.ops.append(op)
        return self.index[p]

    def mul(self, i, j):
        left, right = self.perms[i], self.perms[j]
        return self.add(tuple(left[t] for t in right), (".mul", i, j))

    def inverse(self, i):
        if i not in self.inverses:
            op = self.ops[i]
            if op[0] == ".one":
                j = i
            elif op[0] == ".face":
                j = self.mul(self.mul(i, i), i)
            else:
                j = self.mul(self.inverse(op[2]), self.inverse(op[1]))
            self.inverses[i] = j
            self.inverses[j] = i
        return self.inverses[i]


def generate():
    nodes = Nodes()
    faces = []
    for axis in range(3):
        for high in (False, True):
            perm = face(axis, high)
            nodes.add(perm, (".face", axis, str(high).lower()))
            faces.append(Permutation(perm))
    base, generators, recipes = PermutationGroup(faces).schreier_sims_incremental(slp_dict=True)

    def node(g):
        key = tuple(g.array_form)
        if key in nodes.index:
            return nodes.index[key]
        if g not in recipes:
            return nodes.inverse(node(~g))
        parts = [node(s) for s in recipes[g]]
        acc = 0
        for part in parts:
            acc = nodes.mul(acc, part)
        assert nodes.perms[acc] == key
        return acc

    strong = [node(g) for g in generators]
    rows = []
    for i, b in enumerate(base):
        fixing = [g for g in strong if all(nodes.perms[g][p] == p for p in base[:i])]
        reps = {b: 0}
        queue = deque([b])
        while queue:
            x = queue.popleft()
            for g in fixing:
                y = nodes.perms[g][x]
                if y not in reps:
                    reps[y] = nodes.mul(g, reps[x])
                    queue.append(y)
        rows.append((b, list(reps.values())))
    assert prod(len(reps) for _, reps in rows) == 43252003274489856000
    wanted = {j for _, reps in rows for j in reps}
    for j in reversed(range(len(nodes.ops))):
        if j in wanted and nodes.ops[j][0] == ".mul":
            wanted.update(nodes.ops[j][1:])
    order = sorted(wanted)
    numbering = {j: i for i, j in enumerate(order)}
    proofs = ["module", "", "public import CubeMixing.OrderVerifier", "",
        "/-! Straight-line certificate. Each local check involves at most 54 sticker images. -/",
        "", "@[expose] public section", "", "namespace CubeMixing.OrderWitnesses",
        "open OrderCheck", "", "namespace Nodes", ""]
    codes = [sum(x << (6*i) for i, x in enumerate(nodes.perms[j])) for j in order]
    for i, j in enumerate(order):
        op = nodes.ops[j]
        if op[0] == ".one":
            rule = "cert_one _"
        elif op[0] == ".face":
            rule = f"cert_face _ {op[1]} {op[2]}"
        else:
            rule = f"cert_mul _ node{numbering[op[1]]} node{numbering[op[2]]}"
        proofs.extend([f"theorem node{i} : Certified {codes[i]} :=",
            f"  {rule} (by decide +kernel)", ""])
    proofs.extend(["end Nodes", "", "def rowWitnesses : List (Sticker × List {c : Nat // Certified c}) := ["])
    for b, reps in rows:
        proofs.append(f"  ({b}, [")
        for j in reps:
            i = numbering[j]
            proofs.append(f"    ⟨{codes[i]}, Nodes.node{i}⟩,")
        proofs.append("  ]),")
    proofs.extend(["]", "", "end CubeMixing.OrderWitnesses", ""])
    Path(__file__).with_name("OrderWitnesses.lean").write_text("\n".join(proofs))
    print(f"{len(order)} nodes, orbit sizes {[len(reps) for _, reps in rows]}")


if __name__ == "__main__":
    generate()
