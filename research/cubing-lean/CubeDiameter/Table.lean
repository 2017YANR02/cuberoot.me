module

public import Mathlib.Data.Nat.Bitwise

@[expose] public section

namespace CubeDiameter.Network

/-- Bit x of a table is the truth value for the subset encoded by x. -/
def full (d : Nat) : Nat := (1 <<< (2^d)) - 1

@[simp] theorem full_bit (d x : Nat) : (full d).testBit x = decide (x < 2^d) := by
  simp [full, Nat.shiftLeft_eq, Nat.testBit_two_pow_sub_one]

def join (d lo hi : Nat) := (lo &&& full d) ||| (hi <<< (2^d))

theorem join_bit (d lo hi x : Nat) : (join d lo hi).testBit x =
    if x < 2^d then lo.testBit x else hi.testBit (x-2^d) := by
  by_cases hx : x < 2^d
  · simp [join, hx, Nat.not_le_of_gt hx]
  · simp [join, hx, Nat.le_of_not_gt hx]

/-- The characteristic table for coordinate j. -/
def stripe : Nat → Nat → Nat
  | 0, _ => 0
  | d+1, j =>
    if j = d then join d 0 (full d)
    else let s := stripe d j; join d s s

theorem stripe_bit (d j x : Nat) : (stripe d j).testBit x =
    (decide (x < 2^d) && x.testBit j) := by
  induction d generalizing x with
  | zero =>
    cases x <;> simp [stripe]
  | succ d ih =>
    rw [stripe]
    have pw : 2^(d+1) = 2^d+2^d := by omega
    by_cases hlow : x < 2^d
    · have hbd : x < 2^(d+1) := by omega
      by_cases he : j = d
      · subst j; simp [join_bit, hlow, hbd, Nat.testBit_lt_two_pow hlow]
      · simp [he, join_bit, hlow, ih, hbd]
    · have hsum : x = 2^d + (x-2^d) := by omega
      by_cases hbd : x < 2^(d+1)
      · have hsmall : x-2^d < 2^d := by omega
        by_cases he : j = d
        · subst j
          simp [join_bit, hlow, hbd, hsmall, Nat.testBit_of_two_pow_le_and_two_pow_add_one_gt (by omega : 2^d ≤ x) hbd]
        · by_cases hj : j < d
          · have hb : x.testBit j = (x-2^d).testBit j := by
              conv_lhs => rw [hsum, Nat.testBit_two_pow_add_gt hj]
            simp [he, join_bit, hlow, hbd, ih, hsmall, hb]
          · have hbig : 2^(d+1) ≤ 2^j := Nat.pow_le_pow_right (by decide) (by omega)
            simp [he, join_bit, hlow, hbd, ih, hsmall,
              Nat.testBit_lt_two_pow (show x < 2^j by omega),
              Nat.testBit_lt_two_pow (show x-2^d < 2^j by omega)]
      · have hlarge : ¬ x-2^d < 2^d := by omega
        split <;> simp [join_bit, hlow, hlarge, hbd, ih]

/-- Population count of the low d bits in a d-bit mask. -/
def weight : Nat → Nat → Nat
  | 0, _ => 0
  | d+1, x => if x < 2^d then weight d x else 1 + weight d (x-2^d)

def weightTable : Nat → Nat → Nat
  | 0, k => if k = 0 then 1 else 0
  | d+1, 0 => join d (weightTable d 0) 0
  | d+1, k+1 => join d (weightTable d (k+1)) (weightTable d k)

theorem weight_bit (d k x : Nat) (hx : x < 2^d) :
    (weightTable d k).testBit x = decide (weight d x = k) := by
  induction d generalizing x k with
  | zero =>
    obtain rfl : x = 0 := by simpa using hx
    cases k <;> simp [weightTable, weight]
  | succ d ih =>
    have pw : 2^(d+1) = 2^d+2^d := by omega
    cases k <;> by_cases hh : x < 2^d <;>
      simp [weightTable, join_bit, weight, hh, ih, show x-2^d < 2^d by omega]; omega

/-- A transposition is listed with its smaller endpoint first. An index with
    different bits at a,b changes by exactly the difference in place values. -/
def swapIndex (d a b x : Nat) : Nat :=
  if x < 2^d then
    match x.testBit a, x.testBit b with
    | true, false => x + (2^b-2^a)
    | false, true => x - (2^b-2^a)
    | _, _ => x
  else x

def swapTable (d a b t : Nat) : Nat :=
  let sa := stripe d a
  let sb := stripe d b
  let diff := sa ^^^ sb
  let low := diff &&& sa
  let high := diff &&& sb
  let delta := 2^b - 2^a
  (t ^^^ (t &&& diff)) ||| ((t >>> delta) &&& low) ||| ((t <<< delta) &&& high)

theorem swap_bit (d a b t x : Nat) : (swapTable d a b t).testBit x =
    t.testBit (swapIndex d a b x) := by
  by_cases hx : x < 2^d
  · cases ha : x.testBit a <;> cases hb : x.testBit b
    all_goals simp [swapTable, swapIndex, hx, stripe_bit, ha, hb, Nat.add_comm]
    have hle : 2^b ≤ x := by
      by_contra! hh
      simp [Nat.testBit_lt_two_pow hh] at hb
    intro _
    exact Nat.le_trans hle (Nat.le_add_right _ _)
  · simp [swapTable, swapIndex, hx, stripe_bit]

abbrev Stage := List (Nat × Nat)

def act (d : Nat) (s : Stage) (x : Nat) := s.foldl (fun i ab => swapIndex d ab.1 ab.2 i) x
def pull (d : Nat) (s : Stage) (t : Nat) := s.foldr (fun ab v => swapTable d ab.1 ab.2 v) t

theorem pull_bit (d : Nat) (s : Stage) (t x : Nat) :
    (pull d s t).testBit x = t.testBit (act d s x) := by
  induction s generalizing x with
  | nil => rfl
  | cons ab s ih =>
    change (swapTable d ab.1 ab.2 (pull d s t)).testBit x = _
    rw [swap_bit, ih]; rfl

/-- At each stage the whole permutation is either applied once or skipped. -/
inductive Routes (d : Nat) : List Stage → Nat → Nat → Prop
  | done (x) : Routes d [] x x
  | skip {s ss x y} : Routes d ss x y → Routes d (s::ss) x y
  | take {s ss x y} : Routes d ss (act d s x) y → Routes d (s::ss) x y

def predecessors (d : Nat) (ss : List Stage) (goal : Nat) :=
  ss.foldr (fun s t => t ||| pull d s t) (1 <<< goal)

theorem predecessor_iff (d : Nat) (ss : List Stage) (x goal : Nat) :
    (predecessors d ss goal).testBit x = true ↔ Routes d ss x goal := by
  induction ss generalizing x with
  | nil =>
    simp only [predecessors, List.foldr_nil, Nat.shiftLeft_eq, Nat.one_mul, Nat.testBit_two_pow, decide_eq_true_eq]
    constructor
    · rintro rfl; constructor
    · intro h; cases h; rfl
  | cons s ss ih =>
    change ((predecessors d ss goal) ||| pull d s (predecessors d ss goal)).testBit x = true ↔ _
    rw [Nat.testBit_or, Bool.or_eq_true, pull_bit, ih, ih]
    exact ⟨fun h => h.elim Routes.skip Routes.take, fun h => by cases h <;> simp_all⟩

theorem routes_of_certificate {d k : Nat} {ss : List Stage} {goal : Nat}
    (cert : predecessors d ss goal = weightTable d k) {x : Nat}
    (hx : x < 2^d) (hw : weight d x = k) : Routes d ss x goal := by
  apply (predecessor_iff ..).mp
  simp [cert, weight_bit _ _ _ hx, hw]

end CubeDiameter.Network
