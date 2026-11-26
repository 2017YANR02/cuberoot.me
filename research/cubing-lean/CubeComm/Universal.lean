import CubeComm.Catalog
import CubeComm.CubeGroup

namespace CubeComm

open Equiv

private theorem corners (p : Perm (Fin 8)) (v : Vec 8 3) (even : Perm.sign p = 1)
    (legal : balanced v) : Realizes p v := by
  have hit := List.all_eq_true.mp cornerCatalog_complete _ (shape_mem p even)
  obtain ⟨r, _, hr⟩ : ∃ r ∈ cornerCatalog, r.parts = p.cycleType.sort (· ≤ ·) := by simpa using hit
  exact transport (representative_conj p r hr) (realize_representative r) v legal

private theorem edges (p : Perm (Fin 12)) (v : Vec 12 2) (even : Perm.sign p = 1)
    (legal : balanced v) : Realizes p v := by
  by_cases idPerm : p = 1
  · subst p; exact realize_identity_edges _ legal
  have nonempty : p.cycleType.sort (· ≤ ·) ≠ [] := by
    intro h
    have zero := congrArg (fun l : List ℕ => (l : Multiset ℕ)) h
    exact idPerm (Perm.cycleType_eq_zero.mp (by simpa using zero))
  have hit := List.all_eq_true.mp edgeCatalog_complete _ (List.mem_filter.mpr
    ⟨shape_mem p even, by simpa using nonempty⟩)
  obtain ⟨r, _, hr⟩ : ∃ r ∈ edgeCatalog, r.parts = p.cycleType.sort (· ≤ ·) := by simpa using hit
  exact transport (representative_conj p r hr) (realize_representative r) v legal

/-- Every even legal 3×3×3 cubie state is a single commutator of two legal elements
of exact order 24. Each factor acts as an 8-cycle on corner slots and a 12-cycle on edge slots. -/
theorem every_even_cube (g : cubeGroup) (even : EvenCube g) :
    ∃ A B : cubeGroup, FullCycles A ∧ FullCycles B ∧ orderOf A = 24 ∧ orderOf B = 24 ∧
      A * B * A⁻¹ * B⁻¹ = g := by
  obtain ⟨s, legal, target, sign⟩ := even
  obtain ⟨ca, cb, cornersEq⟩ := corners s.cp s.twists sign legal.2.1
  obtain ⟨ea, eb, edgesEq⟩ := edges s.ep s.flips (legal.1.symm.trans sign) legal.2.2
  refine ⟨pairFactors ca ea, pairFactors cb eb, pair_full .., pair_full ..,
    pair_order .., pair_order .., Subtype.ext ?_⟩
  exact (Prod.ext cornersEq edgesEq : _ = s.action).trans target

end CubeComm
