module

public import CubeKernel.Reduction
public import Mathlib.Data.Fintype.Pi
public import Mathlib.Data.Fintype.Option
public import Mathlib.Data.Fintype.Sum

/-! An executable short-word decision algorithm. The exponential enumeration
is on retained names only. A positive result means the *entire* given
colouring is produced by the word. -/

@[expose] public section

namespace CubeKernel

variable {D : Type} {odd : Bool}

def search [Fintype D] [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool))
    (current : List (Turn D odd)) : ℕ → Bool
  | 0 => decide (paint current = x)
  | k+1 => decide (paint current = x) ||
    decide (∃ t : Turn D odd, search x (current ++ [t]) k = true)

theorem search_correct [Fintype D] [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool))
    (k : ℕ) (current : List (Turn D odd)) :
    search x current k = true ↔
      ∃ w : List (Turn D odd), w.length ≤ k ∧ paint (current ++ w) = x := by
  induction k generalizing current with
  | zero => simp [search]
  | succ k ih =>
    simp only [search,Bool.or_eq_true,decide_eq_true_eq]
    constructor
    · rintro (h | ⟨t,ht⟩)
      · exact ⟨[],by simp,by simpa using h⟩
      · obtain ⟨w,hw,he⟩ := (ih _).mp ht
        exact ⟨t :: w,by simpa using hw,by simpa [List.append_assoc] using he⟩
    · rintro ⟨w,hw,he⟩
      cases w with
      | nil => exact Or.inl (by simpa using he)
      | cons t w =>
        exact Or.inr ⟨t,(ih _).mpr ⟨w,by simpa using hw,by simpa [List.append_assoc] using he⟩⟩

/-- Reject malformed short-solution candidates without searching, otherwise
search the reduced puzzle for a word of length at most `k`. -/
def decideShort [Fintype D] [LinearOrder D] (x : Sticker D odd → Option (Fin 3 × Bool)) (k : ℕ) : Bool :=
  match retained x k with
  | none => false
  | some R => search (restrict R x) [] k

theorem decideShort_correct [Fintype D] [LinearOrder D] (x : Sticker D odd → Option (Fin 3 × Bool)) (k : ℕ) :
    decideShort x k = true ↔ Short x k := by
  unfold decideShort
  have h := retained_correct x k
  cases hr : retained x k with
  | none => simp only [hr] at h; simp [h]
  | some R =>
    simp only [hr] at h
    rw [h.2,search_correct]
    simp [Short]

def evenSliceEquiv : Slice D false ≃ Option D × Bool where
  toFun
    | .outer b => (none,b)
    | .inner d b => (some d,b)
    | .middle h => nomatch h
  invFun
    | (none,b) => .outer b
    | (some d,b) => .inner d b
  left_inv s := by cases s with | middle h => contradiction | outer | inner => rfl
  right_inv s := by rcases s with ⟨_|d,b⟩ <;> rfl

def oddSliceEquiv : Slice D true ≃ (Option D × Bool) ⊕ Unit where
  toFun
    | .outer b => .inl (none,b)
    | .inner d b => .inl (some d,b)
    | .middle _ => .inr ()
  invFun
    | .inl (none,b) => .outer b
    | .inl (some d,b) => .inner d b
    | .inr _ => .middle rfl
  left_inv s := by cases s <;> rfl
  right_inv s := by rcases s with ⟨_|d,b⟩ | ⟨⟩ <;> rfl

theorem card_slice [Fintype D] [DecidableEq D] : Fintype.card (Slice D odd) = side (Fintype.card D) odd := by
  cases odd
  · rw [Fintype.card_congr (evenSliceEquiv (D:=D))]
    simp [side]; omega
  · rw [Fintype.card_congr (oddSliceEquiv (D:=D))]
    simp [side]; omega

theorem card_turn [Fintype D] [DecidableEq D] : Fintype.card (Turn D odd) = 9 * side (Fintype.card D) odd := by
  simp [Turn,Fintype.card_prod,card_slice]; omega

/-- Exact branching factor of the reduced search is nine times its side. -/
theorem retained_branching [Fintype D] [LinearOrder D] (x : Sticker D odd → Option (Fin 3 × Bool))
    (k : ℕ) (R : Finset D) (hR : retained x k = some R) : Fintype.card (Turn R odd) ≤ 9*(4*k+7) := by
  have h := short_solution_kernel x k
  simp only [hR] at h
  rw [card_turn,Fintype.card_coe]
  exact Nat.mul_le_mul_left 9 h.1

end CubeKernel
