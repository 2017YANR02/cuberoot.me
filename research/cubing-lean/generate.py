"""Rebuild Lean witness data deterministically. Only the Lean checks are trusted."""
from itertools import accumulate
from pathlib import Path
from random import Random


def partitions(n, minimum=1):
    if n == 0:
        yield ()
    for k in range(minimum, n + 1):
        for tail in partitions(n - k, k):
            yield (k,) + tail


def cycle_map(order):
    perm = [0] * len(order)
    for i, j in zip(order, order[1:] + order[:1]):
        perm[i] = j
    return perm


def representative(parts):
    perm = []
    for end, size in zip(accumulate(parts), parts):
        start = end - size
        perm.extend([*range(start + 1, end), start])
    return perm


def orbit(p, start):
    result = []
    i = start
    while i not in result:
        result.append(i)
        i = p[i]
    return result


def lift_basis(a, b, m):
    """Solve the two balance constraints and A B = T B A for every basis RHS."""
    n = len(a)
    width = 2 * n
    matrix = []
    for i in range(n):
        row = [0] * width
        row[b[i]] += 1
        row[n + i] += 1
        row[i] -= 1
        row[n + a[i]] -= 1
        dest = b[a[i]]
        matrix.append(row + [int(dest == j) - int(dest == n - 1) for j in range(n - 1)])
    matrix += [[1]*n + [0]*n + [0]*(n-1), [0]*n + [1]*n + [0]*(n-1)]
    pivots = []
    for col in range(width):
        k = len(pivots)
        pick = next((i for i in range(k, len(matrix)) if matrix[i][col] % m), None)
        if pick is None:
            continue
        matrix[k], matrix[pick] = matrix[pick], matrix[k]
        pivot = pow(matrix[k][col], -1, m)
        row = matrix[k] = [v * pivot % m for v in matrix[k]]
        for i, other in enumerate(matrix):
            factor = other[col] % m
            if i != k and factor:
                matrix[i] = [(v - factor * w) % m for v, w in zip(other, row)]
        pivots.append(col)
    if any(any(v % m for v in r[width:]) for r in matrix[len(pivots):]):
        return None
    values = [[0]*(n-1) for _ in range(width)]
    for col, row in zip(pivots, matrix):
        values[col] = row[width:]
    return [[sum(value[j] * m**i for i, value in enumerate(half))
             for j in range(n-1)] for half in (values[:n], values[n:])]


def witness(parts, m, rng):
    t = representative(parts)
    n = len(t)
    order = list(range(n))
    for _ in range(100000):
        rng.shuffle(order)
        b = cycle_map(order)
        tb = [t[v] for v in b]
        cycle = orbit(tb, 0)
        if len(cycle) != n:
            continue
        for shift in range(n):
            a = [0] * n
            for i, source in enumerate(order):
                a[source] = cycle[(i + shift) % n]
            if len(orbit(a, 0)) == n:
                basis = lift_basis(a, b, m)
                if basis is not None:
                    return t, a, b, *basis
    raise ValueError(parts)


def vector(xs):
    return '#v[' + ', '.join(map(str, xs)) + ']'


def write_representatives(catalog):
    lines = ['import CubeComm.Classification', '', 'namespace CubeComm', '']
    for d, m, label, entries in catalog:
        name = label + 'Catalog'
        lines += [f'def {name} : List (Representative {d} {m}) := [']
        for index, (row, parts) in enumerate(entries):
            lengths = [k for k in parts if k > 1]
            end = ',' if index + 1 < len(entries) else ']'
            lines += [f'  ⟨{row}, {lengths}, {row}_ok, by decide +kernel, by decide +kernel⟩{end}']
        lines += ['']
        required = f'(evenShapes {d+1})'
        if label == 'edge':
            required += '.filter (· != [])'
        lines += [f'theorem {name}_complete :',
                  f'    ({required}).all (fun s => ({name}.map Representative.parts).contains s) = true :=',
                  '  by decide +kernel', '']
    out = Path(__file__).parent / 'CubeComm' / 'Catalog.lean'
    out.write_text('\n'.join(lines + ['end CubeComm', '']))


def main():
    catalog = []
    rng = Random(20261125)
    lines = ['import CubeComm.Certificate', '', 'namespace CubeComm', '']
    for n, m, label in [(8, 3, 'corner'), (12, 2, 'edge')]:
        rows = []
        entries = []
        for parts in partitions(n):
            if (n - len(parts)) % 2 or (m == 2 and max(parts) == 1):
                continue
            name = label + '_' + '_'.join(map(str, parts))
            rows.append(name)
            entries.append((name, parts))
            data = witness(parts, m, rng)
            lines += [f'def {name} : Row {n-1} {m} :=',
                      '  ⟨' + ',\n   '.join(map(vector, data)) + '⟩',
                      f'theorem {name}_ok : {name}.OK := by decide +kernel', '']
        lines += [f'def {label}Rows : List (Row {n-1} {m}) :=',
                  '  [' + ',\n   '.join(rows) + ']', '',
                  f'theorem {label}Rows_ok : ∀ r ∈ {label}Rows, r.OK := by',
                  '  intro r h', f'  simp only [{label}Rows, List.mem_cons, List.not_mem_nil, or_false] at h',
                  '  rcases h with ' + ' | '.join(['rfl']*len(rows)),
                  *[f'  · exact {r}_ok' for r in rows], '']
        catalog.append((n-1, m, label, entries))
        print(label, len(rows), 'rows,', len(rows)*(n-1), 'unit witnesses')
    write_representatives(catalog)
    (Path(__file__).parent / 'CubeComm' / 'Rows.lean').write_text('\n'.join(lines + ['end CubeComm', '']))


if __name__ == '__main__':
    main()
