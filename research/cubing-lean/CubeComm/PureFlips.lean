import CubeComm.Certificate


/-!
A pure flip has even total orientation. For a cycle p, use p in both
factors, with offsets 0 and y. Their orientation equation becomes
y(i) = y(p(i)) + u(p²(i)). Starting with y(0) = 0 determines the other
eleven offsets. The cycle closes because the total of u is zero.
The sum of y is the sum of u on the six alternating positions of the cycle.

P, Q and R use three such sets, with R the symmetric difference of P
and Q. If both of the first two parities are one, the third is zero.
-/
namespace CubeComm

abbrev EdgeVec := Vec 12 2

private def sum12 (u : EdgeVec) : Fin 2 :=
  u 0 + (u 1 + (u 2 + (u 3 + (u 4 + (u 5 + (u 6 + (u 7 + (u 8 + (u 9 + (u 10 + (u 11 + 0)))))))))))

private def parityP (u : EdgeVec) : Fin 2 := u 0 + u 1 + u 2 + u 3 + u 4 + u 5
private def cycleP : Vector (Fin 12) 12 := #v[6, 7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 0]
private def offsetP (u : EdgeVec) : Vector (Fin 2) 12 :=
  #v[0,
     u 1 + u 7,
     u 1 + u 7 + u 2 + u 8,
     u 1 + u 7 + u 2 + u 8 + u 3 + u 9,
     u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10,
     u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11,
     u 1,
     u 1 + u 7 + u 2,
     u 1 + u 7 + u 2 + u 8 + u 3,
     u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4,
     u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5,
     u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11 + u 0]

private theorem liftP (u : EdgeVec) (legal : balanced u) (h : parityP u = 0) :
    balanced (offsetP u).get ∧ lifts cycleP.get cycleP.get (fun _ => 0) (offsetP u).get u := by
  change sum12 u = 0 at legal
  unfold sum12 at legal
  unfold parityP at h
  constructor
  · change (0) + ((u 1 + u 7) + ((u 1 + u 7 + u 2 + u 8) + ((u 1 + u 7 + u 2 + u 8 + u 3 + u 9) + ((u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10) + ((u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11) + ((u 1) + ((u 1 + u 7 + u 2) + ((u 1 + u 7 + u 2 + u 8 + u 3) + ((u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4) + ((u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5) + ((u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11 + u 0) + 0))))))))))) = 0
    grind only
  · intro i
    match i with
    | 0 => change (0) + 0 = 0 + (u 1) + u 1; grind only
    | 1 => change (u 1 + u 7) + 0 = 0 + (u 1 + u 7 + u 2) + u 2; grind only
    | 2 => change (u 1 + u 7 + u 2 + u 8) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3) + u 3; grind only
    | 3 => change (u 1 + u 7 + u 2 + u 8 + u 3 + u 9) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4) + u 4; grind only
    | 4 => change (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5) + u 5; grind only
    | 5 => change (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11 + u 0) + u 0; grind only
    | 6 => change (u 1) + 0 = 0 + (u 1 + u 7) + u 7; grind only
    | 7 => change (u 1 + u 7 + u 2) + 0 = 0 + (u 1 + u 7 + u 2 + u 8) + u 8; grind only
    | 8 => change (u 1 + u 7 + u 2 + u 8 + u 3) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3 + u 9) + u 9; grind only
    | 9 => change (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10) + u 10; grind only
    | 10 => change (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5) + 0 = 0 + (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11) + u 11; grind only
    | 11 => change (u 1 + u 7 + u 2 + u 8 + u 3 + u 9 + u 4 + u 10 + u 5 + u 11 + u 0) + 0 = 0 + (0) + u 6; grind only

private def parityQ (u : EdgeVec) : Fin 2 := u 0 + u 1 + u 2 + u 6 + u 7 + u 8
private def cycleQ : Vector (Fin 12) 12 := #v[3, 4, 5, 1, 2, 6, 9, 10, 11, 7, 8, 0]
private def offsetQ (u : EdgeVec) : Vector (Fin 2) 12 :=
  #v[0,
     u 1 + u 4,
     u 1 + u 4 + u 2 + u 5,
     u 1,
     u 1 + u 4 + u 2,
     u 1 + u 4 + u 2 + u 5 + u 6,
     u 1 + u 4 + u 2 + u 5 + u 6 + u 9,
     u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10,
     u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11,
     u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7,
     u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8,
     u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 0]

private theorem liftQ (u : EdgeVec) (legal : balanced u) (h : parityQ u = 0) :
    balanced (offsetQ u).get ∧ lifts cycleQ.get cycleQ.get (fun _ => 0) (offsetQ u).get u := by
  change sum12 u = 0 at legal
  unfold sum12 at legal
  unfold parityQ at h
  constructor
  · change (0) + ((u 1 + u 4) + ((u 1 + u 4 + u 2 + u 5) + ((u 1) + ((u 1 + u 4 + u 2) + ((u 1 + u 4 + u 2 + u 5 + u 6) + ((u 1 + u 4 + u 2 + u 5 + u 6 + u 9) + ((u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10) + ((u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11) + ((u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7) + ((u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8) + ((u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 0) + 0))))))))))) = 0
    grind only
  · intro i
    match i with
    | 0 => change (0) + 0 = 0 + (u 1) + u 1; grind only
    | 1 => change (u 1 + u 4) + 0 = 0 + (u 1 + u 4 + u 2) + u 2; grind only
    | 2 => change (u 1 + u 4 + u 2 + u 5) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6) + u 6; grind only
    | 3 => change (u 1) + 0 = 0 + (u 1 + u 4) + u 4; grind only
    | 4 => change (u 1 + u 4 + u 2) + 0 = 0 + (u 1 + u 4 + u 2 + u 5) + u 5; grind only
    | 5 => change (u 1 + u 4 + u 2 + u 5 + u 6) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6 + u 9) + u 9; grind only
    | 6 => change (u 1 + u 4 + u 2 + u 5 + u 6 + u 9) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7) + u 7; grind only
    | 7 => change (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8) + u 8; grind only
    | 8 => change (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 0) + u 0; grind only
    | 9 => change (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10) + u 10; grind only
    | 10 => change (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8) + 0 = 0 + (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11) + u 11; grind only
    | 11 => change (u 1 + u 4 + u 2 + u 5 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 0) + 0 = 0 + (0) + u 3; grind only

private def parityR (u : EdgeVec) : Fin 2 := u 3 + u 4 + u 5 + u 6 + u 7 + u 8
private def cycleR : Vector (Fin 12) 12 := #v[4, 5, 6, 0, 1, 2, 9, 10, 11, 7, 8, 3]
private def offsetR (u : EdgeVec) : Vector (Fin 2) 12 :=
  #v[u 4,
     u 4 + u 1 + u 5,
     u 4 + u 1 + u 5 + u 2 + u 6,
     0,
     u 4 + u 1,
     u 4 + u 1 + u 5 + u 2,
     u 4 + u 1 + u 5 + u 2 + u 6 + u 9,
     u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10,
     u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11,
     u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7,
     u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8,
     u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 3]

private theorem liftR (u : EdgeVec) (legal : balanced u) (h : parityR u = 0) :
    balanced (offsetR u).get ∧ lifts cycleR.get cycleR.get (fun _ => 0) (offsetR u).get u := by
  change sum12 u = 0 at legal
  unfold sum12 at legal
  unfold parityR at h
  constructor
  · change (u 4) + ((u 4 + u 1 + u 5) + ((u 4 + u 1 + u 5 + u 2 + u 6) + ((0) + ((u 4 + u 1) + ((u 4 + u 1 + u 5 + u 2) + ((u 4 + u 1 + u 5 + u 2 + u 6 + u 9) + ((u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10) + ((u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11) + ((u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7) + ((u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8) + ((u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 3) + 0))))))))))) = 0
    grind only
  · intro i
    match i with
    | 0 => change (u 4) + 0 = 0 + (u 4 + u 1) + u 1; grind only
    | 1 => change (u 4 + u 1 + u 5) + 0 = 0 + (u 4 + u 1 + u 5 + u 2) + u 2; grind only
    | 2 => change (u 4 + u 1 + u 5 + u 2 + u 6) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6 + u 9) + u 9; grind only
    | 3 => change (0) + 0 = 0 + (u 4) + u 4; grind only
    | 4 => change (u 4 + u 1) + 0 = 0 + (u 4 + u 1 + u 5) + u 5; grind only
    | 5 => change (u 4 + u 1 + u 5 + u 2) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6) + u 6; grind only
    | 6 => change (u 4 + u 1 + u 5 + u 2 + u 6 + u 9) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7) + u 7; grind only
    | 7 => change (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8) + u 8; grind only
    | 8 => change (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 3) + u 3; grind only
    | 9 => change (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10) + u 10; grind only
    | 10 => change (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8) + 0 = 0 + (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11) + u 11; grind only
    | 11 => change (u 4 + u 1 + u 5 + u 2 + u 6 + u 9 + u 7 + u 10 + u 8 + u 11 + u 3) + 0 = 0 + (0) + u 0; grind only

/-- All balanced edge orientations, with identity target permutation. The same
    12-cycle is used by both factors and the first factor has zero flips. -/
theorem pureFlips (u : EdgeVec) (legal : balanced u) :
    ∃ (p : PermMap 12) (y : EdgeVec), fullCycle p = true ∧ balanced y ∧
      ∀ s, act p (fun _ => (0 : Fin 2)) (act p y s) =
        act id u (act p y (act p (fun _ => 0) s)) := by
  have build (p : PermMap 12) (y : EdgeVec) (cycle : fullCycle p = true)
      (h : balanced y ∧ lifts p p (fun _ => 0) y u) :=
    And.intro cycle (And.intro h.1 (act_equation p p id _ _ _ (fun _ => rfl) h.2))
  by_cases hP : parityP u = 0
  · exact ⟨_, _, build _ _ (by decide +kernel) (liftP u legal hP)⟩
  by_cases hQ : parityQ u = 0
  · exact ⟨_, _, build _ _ (by decide +kernel) (liftQ u legal hQ)⟩
  have hR : parityR u = 0 := by
    have add : parityR u = parityP u + parityQ u := by
      unfold parityP parityQ parityR; grind only
    have two : ∀ a b : Fin 2, a ≠ 0 → b ≠ 0 → a + b = 0 := by decide
    exact add.trans (two _ _ hP hQ)
  exact ⟨_, _, build _ _ (by decide +kernel) (liftR u legal hR)⟩

end CubeComm
