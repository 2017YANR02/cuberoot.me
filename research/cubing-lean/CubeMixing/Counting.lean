module

public import CubeMixing.NormalStep
public import CubeMixing.CountingCertificate
public import Mathlib.Algebra.BigOperators.Fin

@[expose] public section

namespace CubeMixing

/-- Number of equally likely length-t words ending at one particular normal form. -/
def wordCount (t : Nat) (s : List Block) : Nat :=
  (Finset.univ.filter fun w : Fin t → Move => normalWord t w = s).card

theorem wordCount_succ (t : Nat) (s : List Block) (hs : Normal s) :
    wordCount (t+1) s = ∑ m : Move, wordCount t (normalStep (invMove m) s) := by
  have equivalent (m : Move) (w : Fin t → Move) :
      normalStep m (normalWord t w) = s ↔ normalWord t w = normalStep (invMove m) s := by
    constructor
    · intro H
      rw [← H, step_inverse m _ (normal_word t w)]
    · intro H
      rw [H]
      simpa [invMove_inv] using step_inverse (invMove m) s hs
  simp only [wordCount, Finset.card_filter]
  rw [← (Fin.consEquiv (fun _ : Fin (t+1) => Move)).sum_comp
    (fun w => if normalWord (t+1) w = s then 1 else 0), Fintype.sum_prod_type]
  apply Finset.sum_congr rfl
  intro m _
  apply Finset.sum_congr rfl
  intro w _
  change (if normalStep ((Fin.cons (α := fun _ : Fin (t+1) => Move) m w) 0) (normalWord t (Fin.tail (Fin.cons (α := fun _ : Fin (t+1) => Move) m w))) = s then 1 else 0) = _
  simp [equivalent]

/-- A predecessor erases the head, leaves a single/double head, or creates a fresh head. -/
def neighborTag (m : Move) (h : Block) : Fin 4 :=
  if m.1 = h.1 then
    if zeroBlock (mergeBlock m h) then 0 else if doubleBlock (mergeBlock m h) then 2 else 1
  else 3

def multiplicity (h : Block) (i : Fin 4) : Nat :=
  (Finset.univ.filter fun m : Move => neighborTag (invMove m) h = i).card

def expected (h : Block) (i : Fin 4) : Nat :=
  if doubleBlock h then ![0,2,4,12] i else ![1,2,3,12] i

private theorem multiplicities : ∀ (h : Block), zeroBlock h = false →
    ∀ i : Fin 4, multiplicity h i = expected h i := by
  decide +kernel

def taggedCount (F : Nat → Nat → Nat) (h : Block) (a b : Nat) (i : Fin 4) : Nat :=
  if i = 0 then F a b
  else if i = 1 then F (a+1) b
  else if i = 2 then F a (b+1)
  else if doubleBlock h then F (a+1) (b+1) else F (a+2) b

private theorem tag_spec (F : Nat → Nat → Nat) (m : Move) (h : Block) (w : List Block) :
    F (singles (normalStep m (h::w))) (doubles (normalStep m (h::w))) =
      taggedCount F h (singles w) (doubles w) (neighborTag m h) := by
  by_cases ha : m.1 = h.1
  · by_cases hz : zeroBlock (mergeBlock m h)
    · simp [normalStep, ha, hz, taggedCount, neighborTag]
    · by_cases hd : doubleBlock (mergeBlock m h) <;>
        simp [normalStep, ha, hz, hd, taggedCount, neighborTag, singles, doubles, Nat.add_comm]
  · by_cases hd : doubleBlock h <;>
      simp [normalStep, ha, hd, taggedCount, neighborTag, singles, doubles,
        (startBlock_data m).2.1, Nat.add_comm, Nat.add_left_comm]

private theorem tagged_sum (h : Block) (hz : zeroBlock h = false) (f : Fin 4 → Nat) :
    (∑ m : Move, f (neighborTag (invMove m) h)) = ∑ i : Fin 4, expected h i * f i := by
  rw [← Finset.sum_fiberwise Finset.univ (fun m : Move => neighborTag (invMove m) h)
    (fun m => f (neighborTag (invMove m) h))]
  apply Finset.sum_congr rfl
  intro i _
  rw [← multiplicities _ hz i]
  calc
    _ = ∑ m ∈ Finset.univ.filter (fun m : Move => neighborTag (invMove m) h = i), f i := by
      apply Finset.sum_congr rfl
      intro m hm
      rw [(Finset.mem_filter.mp hm).2]
    _ = _ := by simp [multiplicity]

theorem wordCount_eq_pathCount (t : Nat) (ht : t ≤ 24) (s : List Block) (hs : Normal s) :
    wordCount t s = pathCount t (singles s) (doubles s) := by
  induction t generalizing s with
  | zero =>
    cases s with
    | nil => simp [wordCount, normalWord, singles, doubles, pathCount_initial]
    | cons h w =>
      by_cases hd : doubleBlock h <;>
        simp [wordCount, normalWord, singles, doubles, hd, pathCount_initial]
  | succ t ih =>
    rw [wordCount_succ _ _ hs]
    have H (m : Move) := ih (by omega) (normalStep (invMove m) s) (normal_step _ _ hs)
    simp_rw [H]
    cases s with
    | nil =>
      have cardMoves : Fintype.card Move = 18 := by decide +kernel
      simp [normalStep, singles, doubles, fun m => (startBlock_data m).2.1,
        cardMoves, pathCount_empty t (by omega)]
    | cons h w =>
      simp_rw [tag_spec]
      rw [tagged_sum h hs.1, Fin.sum_univ_four]
      by_cases hd : doubleBlock h
      · simp [expected, taggedCount, hd, singles, doubles, Nat.add_comm 1 (doubles w),
          pathCount_double t (singles w) (doubles w) (by omega), doubleSum]
      · simp [expected, taggedCount, hd, singles, doubles, Nat.add_comm 1 (singles w),
          pathCount_single t (singles w) (doubles w) (by omega), singleSum]

end CubeMixing
