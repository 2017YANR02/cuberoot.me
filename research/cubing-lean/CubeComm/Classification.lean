import CubeComm.Coverage
import CubeComm.Oriented

namespace CubeComm

open Equiv

/-- Cycle lengths in Mathlib omit fixed points. A sign of +1 selects even permutations. -/
def evenShapes (n : ℕ) : List (List ℕ) :=
  ((List.range (n+1)).flatMap compositions).filter fun l =>
    decide (l.Pairwise (· ≤ ·) ∧ (∀ k ∈ l, 2 ≤ k) ∧ (-1 : ℤˣ)^(l.sum + l.length) = 1)

theorem shape_mem {n : ℕ} (p : Perm (Fin n)) (even : Perm.sign p = 1) :
    p.cycleType.sort (· ≤ ·) ∈ evenShapes n := by
  let l := p.cycleType.sort (· ≤ ·)
  have key : (l : Multiset ℕ) = p.cycleType := Multiset.sort_eq _ _
  have hs : l.sum = p.cycleType.sum := by simpa using congrArg Multiset.sum key
  have hl : l.length = p.cycleType.card := by simpa using congrArg Multiset.card key
  have lower : ∀ k ∈ l, 2 ≤ k := fun k hk => Perm.two_le_of_mem_cycleType
    (key ▸ (show k ∈ (l : Multiset ℕ) from hk))
  have limit : l.sum ≤ n := by simpa [hs] using p.sum_cycleType_le
  apply List.mem_filter.mpr
  refine ⟨List.mem_flatMap.mpr ⟨l.sum, List.mem_range.mpr (by omega),
    composition_mem l (fun k hk => by have := lower k hk; omega)⟩, ?_⟩
  exact decide_eq_true ⟨Multiset.pairwise_sort _ _, lower, by
    change (-1 : ℤˣ)^(l.sum + l.length) = 1
    rw [hs, hl, ← Perm.sign_of_cycleType, even]⟩

/-- The inverse lookup is computed only on the 8- or 12-element position type. -/
private def lookupInv [NeZero n] (f : PermMap n) (j : Fin n) :=
  ((List.finRange n).find? (fun i => f i == j)).getD 0

def reversible [NeZero n] (f : PermMap n) :=
  (∀ i, lookupInv f (f i) = i) ∧ ∀ j, f (lookupInv f j) = j

instance [NeZero n] (f : PermMap n) : Decidable (reversible f) := by unfold reversible; infer_instance

def tablePerm [NeZero n] (f : PermMap n) (h : reversible f) : Perm (Fin n) :=
  ⟨f, lookupInv f, h.1, h.2⟩

structure Representative (d m : ℕ) [NeZero m] where
  row : Row d m
  parts : List ℕ
  valid : row.OK
  invertible : reversible row.target.get
  cycleLengths : (tablePerm row.target.get invertible).cycleType = (parts : Multiset ℕ)

def Representative.perm [NeZero m] (r : Representative d m) := tablePerm r.row.target.get r.invertible

theorem representative_conj [NeZero m] (p : Perm (Fin (d+1))) (r : Representative d m)
    (h : r.parts = p.cycleType.sort (· ≤ ·)) : IsConj r.perm p := by
  apply Perm.isConj_iff_cycleType_eq.mpr
  exact r.cycleLengths.trans (h ▸ Multiset.sort_eq _ _)

end CubeComm
