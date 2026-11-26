module

public import CubeKernel.Packed

/-! Bounds on the complete search tree and on input coordinates used in the
twin tests. These count words and comparisons, independently of data
representation, early acceptance, and runtime overhead. -/

@[expose] public section

namespace CubeKernel
open Finset

/-- Candidate words inspected by the exhaustive search starting at `current`.
Successful branches may stop early. Words are kept even when their sticker
positions coincide. -/
def searchNodes {α : Type} [DecidableEq α] [Fintype α]
    (current : List α) : Nat → Finset (List α)
  | 0 => {current}
  | k+1 => insert current (univ.biUnion fun t : α => searchNodes (current ++ [t]) k)

theorem search_iff_node {D : Type} {odd : Bool} [Fintype D] [DecidableEq D]
    (x : Sticker D odd → Option (Fin 3 × Bool)) (current : List (Turn D odd)) (k : Nat) :
    search x current k = true ↔ ∃ w ∈ searchNodes current k, paint w = x := by
  induction k generalizing current with
  | zero => simp [search, searchNodes]
  | succ k ih =>
    simp only [search, Bool.or_eq_true, decide_eq_true_eq, searchNodes, exists_mem_insert,
      mem_biUnion, mem_univ, true_and, ih]
    constructor
    · rintro (h | ⟨t,w,hw,hx⟩)
      · exact Or.inl h
      · exact Or.inr ⟨w,⟨t,hw⟩,hx⟩
    · rintro (h | ⟨w,⟨t,hw⟩,hx⟩)
      · exact Or.inl h
      · exact Or.inr ⟨t,w,hw,hx⟩

/-- The full tree contains at most (alphabet size + 1)^k distinct words. -/
theorem card_searchNodes_le {α : Type} [DecidableEq α] [Fintype α]
    (current : List α) (k : Nat) : (searchNodes current k).card ≤ (Fintype.card α+1)^k := by
  induction k generalizing current with
  | zero => simp [searchNodes]
  | succ k ih =>
    let v := (Fintype.card α + 1)^k
    have hv : 1 ≤ v := Nat.one_le_pow k _ (Nat.succ_pos _)
    have hsum : (∑ t : α, (searchNodes (current ++ [t]) k).card) ≤ Fintype.card α * v := by
      simpa [v] using
        (Finset.sum_le_sum (s := (univ : Finset α)) (fun t _ => ih (current ++ [t])))
    calc
      _ ≤ (univ.biUnion fun t : α => searchNodes (current ++ [t]) k).card + 1 :=
        card_insert_le _ _
      _ ≤ (∑ t : α, (searchNodes (current ++ [t]) k).card) + 1 := Nat.add_le_add_right card_biUnion_le 1
      _ ≤ Fintype.card α * v + v := Nat.add_le_add hsum hv
      _ = _ := by rw [pow_succ]; dsimp [v]; ring

namespace Physical.PackedCube

/-- For an accepted kernel, both the decision criterion and its complete
tree of candidate words refer to the newly packed, densely renumbered cube. -/
theorem kernel_search_tree (x y : PackedCube) (k : Nat) (h : x.kernel k = some y) :
    let tree := searchNodes ([] : List (Turn (Fin y.depthCount) y.odd)) k
    (Short x.colors k ↔ ∃ w ∈ tree, paint w = y.colors) ∧ tree.card ≤ (9*(4*k+7)+1)^k := by
  have H := kernel_correct x k
  rw [h] at H
  dsimp only at H ⊢
  have e : side y.depthCount y.odd = order y.depthCount y.odd := by cases y.odd <;> rfl
  have branch : Fintype.card (Turn (Fin y.depthCount) y.odd) ≤ 9*(4*k+7) := by
    rw [card_turn, Fintype.card_fin, e]
    exact Nat.mul_le_mul_left 9 H.2.1
  constructor
  · rw [H.2.2.2, ← search_iff_node, search_correct]
    simp [Short]
  · exact (card_searchNodes_le _ k).trans (Nat.pow_le_pow_left (Nat.succ_le_succ branch) k)

/-- All ordered ordinary-depth pairs, with one exact colour equality test
per surface coordinate. This counts the indexing domain for one complete
table of `Twins` comparisons. -/
theorem twin_comparison_count (r : Nat) (o : Bool) :
    Fintype.card (Fin r × Fin r × Sticker (Fin r) o) = r^2 * (6*(order r o)^2) := by
  have e : side r o = order r o := by cases o <;> rfl
  simp only [Sticker, Fintype.card_prod, Fintype.card_fin, Fintype.card_bool, card_slice, e]
  ring

end Physical.PackedCube
end CubeKernel
