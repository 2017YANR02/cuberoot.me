module

public import CubeMixing.Coloring
public import CubeMixing.NormalStep
public import Mathlib.Algebra.BigOperators.Fin
public import Mathlib.Data.Finset.Lattice.Fold
public import Mathlib.Tactic.Ring

/-! Exactly uniform independent choices from the 18 HTM moves, starting at
the solved state. Total variation on a finite space is the largest excess
of the walk's probability over uniform on an event. -/
@[expose] public section
namespace CubeMixing

open Finset
open scoped Classical
noncomputable instance stateFintype : Fintype faceGroup := Fintype.ofFinite _

def position : (t : ℕ) → (Fin t → Move) → faceGroup
  | 0, _ => 1
  | t+1, w => turn (w 0) * position t (Fin.tail w)

theorem position_eq_normal (t : ℕ) (w : Fin t → Move) :
    position t w = evalBlocks (normalWord t w) := by
  induction t with
  | zero => rfl
  | succ t ih => rw [position,normalWord,eval_normalStep,ih]

noncomputable def eventCount (t : ℕ) (E : Finset faceGroup) : ℕ :=
  (univ.filter fun w : Fin t → Move => position t w ∈ E).card

theorem card_le_eventCount (t : ℕ) (W : Finset (Fin t → Move)) (E : Finset faceGroup)
    (h : ∀ w ∈ W, position t w ∈ E) : W.card ≤ eventCount t E :=
  Finset.card_le_card fun w hw => mem_filter.mpr ⟨mem_univ w, h w hw⟩

noncomputable def probability (t : ℕ) (E : Finset faceGroup) : ℚ := eventCount t E / (18 : ℚ)^t

noncomputable def uniform (E : Finset faceGroup) : ℚ := E.card / (Nat.card faceGroup : ℚ)

noncomputable def totalVariation (t : ℕ) : ℚ :=
  univ.sup' univ_nonempty (fun E : Finset faceGroup => probability t E - uniform E)

theorem event_excess_le (t : ℕ) (E : Finset faceGroup) :
    probability t E - uniform E ≤ totalVariation t :=
  Finset.le_sup' (fun F : Finset faceGroup => probability t F - uniform F) (mem_univ E)

def pull (m : Move) (E : Finset faceGroup) :=
  E.map (Equiv.mulLeft (turn m)⁻¹).toEmbedding

private theorem mem_pull (m : Move) (E : Finset faceGroup) (x : faceGroup) :
    x ∈ pull m E ↔ turn m * x ∈ E := by
  simp [pull]

private theorem uniform_pull (m : Move) (E : Finset faceGroup) :
    uniform (pull m E) = uniform E := by simp [uniform,pull]

theorem eventCount_succ (t : ℕ) (E : Finset faceGroup) :
    eventCount (t+1) E = ∑ m : Move, eventCount t (pull m E) := by
  simp only [eventCount, card_filter]
  rw [← (Fin.consEquiv (fun _ : Fin (t+1) => Move)).sum_comp
    (fun w => if position (t+1) w ∈ E then 1 else 0), Fintype.sum_prod_type]
  apply Finset.sum_congr rfl
  intro m _
  apply Finset.sum_congr rfl
  intro w _
  change (if turn ((Fin.cons (α := fun _ : Fin (t+1) => Move) m w) 0) *
    position t (Fin.tail (Fin.cons (α := fun _ : Fin (t+1) => Move) m w)) ∈ E then 1 else 0) = _
  simp [mem_pull]

theorem probability_succ (t : ℕ) (E : Finset faceGroup) :
    probability (t+1) E = (∑ m : Move, probability t (pull m E)) / 18 := by
  rw [probability,eventCount_succ,Nat.cast_sum,pow_succ]
  simp only [probability,div_eq_mul_inv,← Finset.sum_mul]
  ring

theorem variation_antitone : Antitone totalVariation := by
  apply antitone_nat_of_succ_le
  intro t
  unfold totalVariation
  apply Finset.sup'_le
  intro E _
  have h (m : Move) : probability t (pull m E) ≤ totalVariation t + uniform E := by
    have bound := event_excess_le t (pull m E)
    rw [uniform_pull] at bound
    linarith
  have s := Finset.sum_le_sum (s := (univ : Finset Move)) (fun m _ => h m)
  have card_moves : Fintype.card Move = 18 := by decide
  simp [card_moves] at s
  change probability (t+1) E - uniform E ≤ totalVariation t
  rw [probability_succ]
  linarith

end CubeMixing
