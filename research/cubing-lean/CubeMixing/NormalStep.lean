module

public import CubeMixing.Normal
public import Mathlib.Data.Fin.Tuple.Basic
public import Mathlib.Data.Fintype.Pi

@[expose] public section

namespace CubeMixing

@[simp] theorem startBlock_axis (m : Move) : (startBlock m).1 = m.1 := rfl
@[simp] theorem invMove_axis (m : Move) : (invMove m).1 = m.1 := rfl
@[simp] theorem mergeBlock_axis (m : Move) (b : Block) : (mergeBlock m b).1 = b.1 := rfl

theorem startBlock_data : ∀ m : Move, zeroBlock (startBlock m) = false ∧
    doubleBlock (startBlock m) = false ∧ zeroBlock (mergeBlock (invMove m) (startBlock m)) = true := by
  decide +kernel

private theorem undo_merge : ∀ (m : Move) (h : Block), m.1 = h.1 →
    mergeBlock (invMove m) (mergeBlock m h) = h ∧
    (zeroBlock (mergeBlock m h) = true → startBlock (invMove m) = h) := by
  decide +kernel

theorem step_of_fresh (m : Move) (w : List Block) (h : freshAxis m.1 w) :
    normalStep m w = startBlock m :: w := by
  cases w with
  | nil => rfl
  | cons a w => exact ite_eq_right h

theorem normal_step (m : Move) (w : List Block) (hw : Normal w) : Normal (normalStep m w) := by
  cases w with
  | nil => exact ⟨(startBlock_data m).1, trivial, trivial⟩
  | cons h w =>
    obtain ⟨hz, hf, hn⟩ := hw
    by_cases e : m.1 = h.1
    · simp only [normalStep, ite_eq_left e]
      split
      · exact hn
      · rename_i k
        exact ⟨by simpa using k, hf, hn⟩
    · rw [step_of_fresh m (h :: w) e]
      exact ⟨(startBlock_data m).1, e, hz, hf, hn⟩

theorem step_inverse (m : Move) (w : List Block) (hw : Normal w) :
    normalStep (invMove m) (normalStep m w) = w := by
  have erase (tail : List Block) : normalStep (invMove m) (startBlock m :: tail) = tail := by
    simp [normalStep, (startBlock_data m).2.2]
  cases w with
  | nil => exact erase []
  | cons h w =>
    obtain ⟨hz, hf, hn⟩ := hw
    by_cases e : m.1 = h.1
    · rw [normalStep, ite_eq_left e]
      dsimp only
      by_cases he : zeroBlock (mergeBlock m h) = true
      · rw [ite_eq_left he, step_of_fresh]
        · rw [(undo_merge m h e).2 he]
        · simpa [e] using hf
      · rw [ite_eq_right he]
        simp [normalStep, e, (undo_merge m h e).1, hz]
    · rw [step_of_fresh m (h :: w) e, erase]

def normalWord : (t : Nat) → (Fin t → Move) → List Block
  | 0, _ => []
  | t+1, w => normalStep (w 0) (normalWord t (Fin.tail w))

theorem normal_word (t : Nat) (w : Fin t → Move) : Normal (normalWord t w) := by
  induction t with
  | zero => trivial
  | succ t ih => exact normal_step _ _ (ih _)

theorem sum_sizes (w : List Block) : singles w + doubles w = w.length := by
  induction w with
  | nil => rfl
  | cons h w ih =>
    by_cases d : doubleBlock h <;> simp [singles, doubles, d] <;> omega

end CubeMixing
