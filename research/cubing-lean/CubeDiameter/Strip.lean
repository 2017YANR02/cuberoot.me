module

public import CubeDiameter.Cost
public import Mathlib.Data.Finset.Powerset

@[expose] public section

namespace CubeDiameter.Rectangle.Selection
open Representatives
open scoped BigOperators

variable (s : Selection n)

/-- Active rows of this column for this stage. -/
def pattern (active : ℕ → ℕ → Bool) (j : ℕ) := s.rows.filter (fun i => active i j)

def group (active : ℕ → ℕ → Bool) (p : Finset ℕ) : Selection n where
  size := s.size
  rows := s.rows ∩ p
  cols := s.cols.filter (fun j => s.pattern active j = p)
  disjoint := s.disjoint.mono Finset.inter_subset_left (Finset.filter_subset ..)
  shallow := fun i hi => s.shallow i (Finset.union_subset_union
    Finset.inter_subset_left (Finset.filter_subset ..) hi)

/-- Each requested pair belongs to exactly one rectangle; no rectangle contains
    an unrequested pair. -/
theorem group_covers (active : ℕ → ℕ → Bool) (i j : ℕ) :
    (∃! p, p ∈ s.rows.powerset ∧ i ∈ (s.group active p).rows ∧ j ∈ (s.group active p).cols) ↔
      i ∈ s.rows ∧ j ∈ s.cols ∧ active i j = true := by
  constructor
  · rintro ⟨p,⟨_,hr,hc⟩,_⟩
    obtain ⟨hi,hp⟩ := Finset.mem_inter.mp hr
    obtain ⟨hj,he⟩ := Finset.mem_filter.mp hc
    exact ⟨hi,hj,(Finset.mem_filter.mp (he ▸ hp : i ∈ s.pattern active j)).2⟩
  · rintro ⟨hi,hj,ha⟩
    refine ⟨s.pattern active j, ⟨Finset.mem_powerset.mpr (Finset.filter_subset ..),
      Finset.mem_inter.mpr ⟨hi,Finset.mem_filter.mpr ⟨hi,ha⟩⟩,Finset.mem_filter.mpr ⟨hj,rfl⟩⟩, ?_⟩
    intro q h; exact (Finset.mem_filter.mp h.2.2).2.symm

/-- Concatenate the expanded word once for each column pattern. -/
noncomputable def stripWord (active : ℕ → ℕ → Bool) (w : List (Move 6)) : List (Move n) :=
  s.rows.powerset.toList.flatMap fun p => (s.group active p).batch.expand w

private theorem sum_group_cols (active : ℕ → ℕ → Bool) :
    ∑ p ∈ s.rows.powerset, (s.group active p).cols.card = s.cols.card := by
  symm
  exact Finset.card_eq_sum_card_fiberwise (f := s.pattern active)
    (fun _ _ => Finset.mem_powerset.mpr (Finset.filter_subset ..))

private theorem sum_group_rows (active : ℕ → ℕ → Bool) :
    ∑ p ∈ s.rows.powerset, (s.group active p).rows.card ≤ 2^s.rows.card * s.rows.card := by
  calc
    _ ≤ ∑ _p ∈ s.rows.powerset, s.rows.card := Finset.sum_le_sum
      (fun _ _ => Finset.card_le_card Finset.inter_subset_left)
    _ = _ := by simp

private theorem length_flatMap_toList [DecidableEq α] (a : Finset α) (f : α → List β) :
    (a.toList.flatMap f).length = ∑ p ∈ a, (f p).length := by
  classical
  rw [List.length_flatMap]
  change (a.toList.map (fun p => (f p).length)).sum = _
  exact Finset.sum_map_toList ..

private theorem strip_cost (active : ℕ → ℕ → Bool) (A B C : ℕ) :
    (∑ p ∈ s.rows.powerset, (A + B*(s.group active p).rows.card + C*(s.group active p).cols.card))
      ≤ 2^s.rows.card * (A + B*s.rows.card) + C*s.cols.card := by
  simp only [Finset.sum_add_distrib, ← Finset.mul_sum, Finset.sum_const,Finset.card_powerset,
    nsmul_eq_mul,s.sum_group_cols]
  have h := Nat.mul_le_mul_left B (s.sum_group_rows active)
  nlinarith only [h]

theorem strip_length (active : ℕ → ℕ → Bool) (w : List (Move 6)) :
    (s.stripWord active w).length ≤
      2^s.rows.card * (occurrences w 0 + occurrences w 1*s.rows.card)
        + occurrences w 2*s.cols.card := by
  simpa only [stripWord,length_flatMap_toList,length_expand]
    using s.strip_cost active (occurrences w 0) (occurrences w 1) (occurrences w 2)

end CubeDiameter.Rectangle.Selection
