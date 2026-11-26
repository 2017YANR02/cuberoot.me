import CubeComm.Model

namespace CubeComm

variable {m : Nat} [NeZero m]

/-- Index j receives w and the last slot receives -w. -/
def spoke (j : Fin d) (w : Fin m) (i : Fin (d+1)) : Fin m :=
  if i = Fin.last d then -w else if i = j.castSucc then w else 0

private theorem sum_indicator (l : List (Fin d)) (hl : l.Nodup) (k : Fin d)
    (w : Fin d → Fin m) :
    (l.map (fun j => if k = j then w j else 0)).sum = if k ∈ l then w k else 0 := by
  induction l with
  | nil => simp
  | cons j l ih =>
    obtain ⟨hj, hd⟩ := List.nodup_cons.mp hl
    by_cases he : k = j
    · subst j; simp [ih hd, hj]
    · simp [he, ih hd]

private theorem sum_neg (l : List ι) (f : ι → Fin m) :
    (l.map (fun i => -f i)).sum = -(l.map f).sum := by
  induction l with
  | nil => simp; grind
  | cons i l ih => simp only [List.map_cons, List.sum_cons, ih]; grind

private theorem sum_snoc (l : List (Fin m)) (z : Fin m) :
    (l ++ [z]).sum = l.sum + z := by
  induction l with
  | nil => simp
  | cons j l ih => simp [ih, Lean.Grind.Fin.add_assoc]

theorem decompose (u : Vec (d+1) m) (h : balanced u) :
    combine (List.finRange d) (fun j => spoke j (u j.castSucc)) = u := by
  funext i
  refine Fin.lastCases ?_ (fun k => ?_) i
  · unfold balanced total at h
    rw [List.finRange_succ_last, List.map_append, List.map_map] at h
    simp only [List.map_cons, List.map_nil, Function.comp_def, sum_snoc] at h
    simp [combine, spoke]
    rw [sum_neg (List.finRange d) (fun j => u j.castSucc)]
    grind
  · have hk : k.castSucc ≠ Fin.last d := fun h => by have := congrArg Fin.val h; simp at this; omega
    have inj (j : Fin d) : k.castSucc = j.castSucc ↔ k = j := ⟨fun h => Fin.ext (congrArg (fun t : Fin (d+1) => t.val) h), congrArg Fin.castSucc⟩
    simpa [combine, spoke, hk, inj] using
      sum_indicator (List.finRange d) (List.nodup_finRange d) k (fun j => u j.castSucc)

structure Row (d m : Nat) where
  target : Vector (Fin (d+1)) (d+1)
  a : Vector (Fin (d+1)) (d+1)
  b : Vector (Fin (d+1)) (d+1)
  xCode : Vector Nat d
  yCode : Vector Nat d

def digit (code : Nat) (i : Fin n) : Fin m := Fin.ofNat m (code / m^i.val)

def Row.OK (r : Row d m) : Prop :=
  fullCycle r.a.get = true ∧ fullCycle r.b.get = true ∧
  (∀ i, r.a.get (r.b.get i) = r.target.get (r.b.get (r.a.get i))) ∧
  ∀ (j : Fin d) (w : Fin m),
    let x := fun i => w * digit (r.xCode.get j) i
    let y := fun i => w * digit (r.yCode.get j) i
    balanced x ∧ balanced y ∧ lifts r.a.get r.b.get x y (spoke j w)

instance (r : Row d m) : Decidable r.OK := by unfold Row.OK balanced lifts; infer_instance

/-- For any balanced orientation on this target, both full cycles have balanced
    lifts. Their actions satisfy A ∘ B = T ∘ B ∘ A on every cubie and orientation. -/
theorem realizeRow (r : Row d m) (ok : r.OK) (u : Vec (d+1) m) (h : balanced u) :
    fullCycle r.a.get = true ∧ fullCycle r.b.get = true ∧
    ∃ x y, balanced x ∧ balanced y ∧ ∀ s,
      act r.a.get x (act r.b.get y s) =
      act r.target.get u (act r.b.get y (act r.a.get x s)) := by
  let basis (j : Fin d) : Solution r.a.get r.b.get (spoke j (u j.castSucc)) :=
    let cert := ok.2.2.2 j (u j.castSucc)
    ⟨_, _, cert.1, cert.2.1, cert.2.2⟩
  have sol := combineSolutions (List.finRange d) _ basis
  rw [decompose u h] at sol
  exact ⟨ok.1, ok.2.1, sol.x, sol.y, sol.x_ok, sol.y_ok,
    act_equation _ _ _ _ _ _ ok.2.2.1 sol.equation⟩

end CubeComm
