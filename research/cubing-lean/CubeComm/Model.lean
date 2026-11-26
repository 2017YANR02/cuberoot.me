import Std

namespace CubeComm

local instance : Std.Associative (α := Fin m) (· + ·) := ⟨Lean.Grind.Fin.add_assoc⟩
local instance : Std.Commutative (α := Fin m) (· + ·) := ⟨Lean.Grind.Fin.add_comm⟩

abbrev Vec (n m : Nat) := Fin n → Fin m
abbrev PermMap (n : Nat) := Fin n → Fin n

/-- A cubie initially at i moves to p i and its orientation increases by v i. -/
def act (p : PermMap n) (v : Vec n m) (s : Fin n × Fin m) :=
  (p s.1, s.2 + v s.1)

def orbit (p : PermMap n) (i : Fin n) : Nat → Fin n
  | 0 => i
  | k + 1 => p (orbit p i k)

/-- Every slot returns after n steps, and its first n iterates cover every slot. -/
def fullCycle [NeZero n] (p : PermMap n) : Bool :=
  decide ((∀ i, orbit p i n = i) ∧
    ∀ i j, ∃ k : Fin n, orbit p i k.val = j)

def total (v : Vec n m) [NeZero m] := ((List.finRange n).map v).sum

def balanced [NeZero m] (v : Vec n m) := total v = 0

/-- The orientation equation for A B = T B A, with composition right to left. -/
def lifts (a b : PermMap n) (x y u : Vec n m) : Prop :=
  ∀ i, y i + x (b i) = x i + y (a i) + u (b (a i))

theorem act_equation (a b t : PermMap n) (x y u : Vec n m)
    (permEq : ∀ i, a (b i) = t (b (a i))) (h : lifts a b x y u) :
    ∀ s, act a x (act b y s) = act t u (act b y (act a x s)) := by
  rintro ⟨i, z⟩
  simp only [act, Prod.mk.injEq]
  exact ⟨permEq i, by simpa only [Lean.Grind.Fin.add_assoc] using congrArg (z + ·) (h i)⟩

/-- Add one oriented solution to another with the same permutations. -/
theorem lifts_add (h : lifts a b x y u) (k : lifts a b x' y' u') :
    lifts a b (fun i => x i + x' i) (fun i => y i + y' i) (fun i => u i + u' i) := by
  intro i
  have hi := h i
  have ki := k i
  calc
    _ = (y i + x (b i)) + (y' i + x' (b i)) := by dsimp only; ac_rfl
    _ = _ := by rw [hi, ki]; dsimp only; ac_rfl

theorem sum_add [NeZero m] (l : List ι) (x y : ι → Fin m) :
    (l.map (fun i => x i + y i)).sum = (l.map x).sum + (l.map y).sum := by
  induction l with
  | nil => simp
  | cons i l ih => simp only [List.map_cons, List.sum_cons, ih]; ac_rfl

theorem balanced_add [NeZero m] {x y : Vec n m} (hx : balanced x) (hy : balanced y) :
    balanced (fun i => x i + y i) := by
  unfold balanced total at *
  rw [sum_add, hx, hy, Fin.zero_add]

structure Solution [NeZero m] (a b : PermMap n) (u : Vec n m) where
  x : Vec n m
  y : Vec n m
  x_ok : balanced x
  y_ok : balanced y
  equation : lifts a b x y u

def combine [NeZero m] (l : List ι) (vectors : ι → Vec n m) : Vec n m :=
  fun i => (l.map (fun j => vectors j i)).sum

private theorem zero_sum [NeZero m] (l : List ι) : (l.map (fun _ => (0 : Fin m))).sum = 0 := by
  induction l with
  | nil => rfl
  | cons _ _ ih => simp [ih]

noncomputable def combineSolutions [NeZero m] (l : List ι) (u : ι → Vec n m)
    (sol : ∀ j, Solution a b (u j)) : Solution a b (combine l u) := by
  induction l with
  | nil =>
    exact ⟨fun _ => 0, fun _ => 0, by simp [balanced, total, zero_sum], by simp [balanced, total, zero_sum],
      by simp [lifts, combine]⟩
  | cons j l tail =>
    exact ⟨_, _, balanced_add (sol j).x_ok tail.x_ok, balanced_add (sol j).y_ok tail.y_ok,
      lifts_add (sol j).equation tail.equation⟩

end CubeComm
