module

public import CubeDiameter.Permnet61
public import Mathlib.Combinatorics.Colex

@[expose] public section

namespace CubeDiameter.Network
open Finset
open scoped BigOperators

/-- The numerical bit mask of a set of wire indices. -/
def mask (s : Finset ℕ) : ℕ := ∑ i ∈ s, 2^i

theorem bit_mask (s : Finset ℕ) (i : ℕ) : (mask s).testBit i = decide (i ∈ s) := by
  apply Bool.eq_iff_iff.mpr
  rw [decide_eq_true_eq,← Nat.mem_bitIndices,← List.mem_toFinset,mask,Finset.toFinset_bitIndices_sum_two_pow]

theorem mask_lt (hs : s ⊆ range d) : mask s < 2^d :=
  Nat.geomSum_lt (by decide) (fun _ hi => mem_range.mp (hs hi))

theorem weight_mask (hs : s ⊆ range d) : weight d (mask s) = s.card := by
  induction d generalizing s with
  | zero =>
    have he : s = ∅ := by simpa using hs
    simp [he,weight]
  | succ d ih =>
    by_cases hm : d ∈ s
    · let t := s.erase d
      have ht : t ⊆ range d := by
        intro i hi
        obtain ⟨hn,hs'⟩ := mem_erase.mp hi
        have := mem_range.mp (hs hs')
        exact mem_range.mpr (by omega)
      have hv : mask s = 2^d + mask t := by
        exact (Finset.add_sum_erase s (fun i => 2^i) hm).symm
      have hc : s.card = t.card+1 := by
        exact (Finset.card_erase_add_one hm).symm
      simp only [weight,hv,show ¬2^d+mask t < 2^d by omega,ite_false,Nat.add_sub_cancel_left,ih ht,hc]
      omega
    · have ht : s ⊆ range d := by
        intro i hi
        have hh := mem_range.mp (hs hi)
        have ne : i ≠ d := fun h => hm (h ▸ hi)
        exact mem_range.mpr (by omega)
      simp [weight,mask_lt ht,ih ht]

def perm : Stage → Equiv.Perm ℕ
  | [] => Equiv.refl ℕ
  | (a,b) :: ss => (Equiv.swap a b).trans (perm ss)

private theorem swap_map (s : Finset ℕ) (a b : ℕ) (ha : a ∈ s) (hb : b ∉ s) :
    s.map (Equiv.swap a b).toEmbedding = insert b (s.erase a) := by
  have he := insert_erase ha
  conv_lhs => rw [← he]
  rw [map_insert]
  simp only [Equiv.toEmbedding_apply,Equiv.swap_apply_left]
  congr 1
  ext x
  simp only [mem_map,mem_erase,Equiv.toEmbedding_apply]
  constructor
  · rintro ⟨y,⟨hy,hs⟩,rfl⟩
    have hyb : y ≠ b := fun h => hb (h ▸ hs)
    simpa [Equiv.swap_apply_def,hy,hyb] using And.intro hy hs
  · rintro ⟨hx,hs⟩
    exact ⟨x,⟨hx,hs⟩,Equiv.swap_apply_of_ne_of_ne hx (fun h => hb (h ▸ hs))⟩

private theorem swap_map_same (s : Finset ℕ) (a b : ℕ) (h : a ∈ s ↔ b ∈ s) :
    s.map (Equiv.swap a b).toEmbedding = s := by
  ext x
  rw [Finset.mem_map_equiv]
  by_cases hxa : x = a
  · subst x; simpa using h.symm
  · by_cases hxb : x = b
    · subst x; simpa using h
    · simp [Equiv.swap_apply_of_ne_of_ne hxa hxb]

theorem swap_mask {s : Finset ℕ} (hs : s ⊆ range d) (a b : ℕ) (hab : a ≤ b) :
    swapIndex d a b (mask s) = mask (s.map (Equiv.swap a b).toEmbedding) := by
  simp only [swapIndex,mask_lt hs,ite_true,bit_mask]
  have hp : 2^a ≤ 2^b := Nat.pow_le_pow_right (by decide) hab
  by_cases ha : a ∈ s <;> by_cases hb : b ∈ s
  · simp [ha,hb,swap_map_same s a b (by simp [ha,hb])]
  · rw [swap_map s a b ha hb]
    have he : mask s = 2^a + mask (s.erase a) := by
      exact (Finset.add_sum_erase s (fun i => 2^i) ha).symm
    simp [ha,hb,mask] at he ⊢
    omega
  · rw [Equiv.swap_comm a b,swap_map s b a hb ha]
    have he : mask s = 2^b + mask (s.erase b) := by
      exact (Finset.add_sum_erase s (fun i => 2^i) hb).symm
    simp [ha,hb,mask] at he ⊢
    rw [he]
    exact (show ∀ A B K : ℕ, A ≤ B → B+K-(B-A) = A+K by omega) _ _ _ hp
  · simp [ha,hb,swap_map_same s a b (by simp [ha,hb])]

end CubeDiameter.Network
