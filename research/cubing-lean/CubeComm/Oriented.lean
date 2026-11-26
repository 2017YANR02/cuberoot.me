import CubeComm.Model
import Mathlib.GroupTheory.Perm.Cycle.Concrete
import Mathlib.Algebra.Ring.Fin
import Mathlib.Data.Fintype.BigOperators

namespace CubeComm

open Equiv
variable {n m : ℕ} [NeZero m]

/-- The action on the position and orientation of one cubie, as a genuine permutation. -/
def oriented (p : Perm (Fin n)) (v : Vec n m) : Perm (Fin n × Fin m) where
  toFun := act p v
  invFun s := (p.symm s.1, s.2 - v (p.symm s.1))
  left_inv := by rintro ⟨i,z⟩; simp [act]
  right_inv := by rintro ⟨i,z⟩; simp [act]

theorem balanced_iff_sum (v : Vec n m) : balanced v ↔ ∑ i, v i = 0 := by
  simp [balanced, total, List.finRange, List.map_ofFn, List.sum_ofFn, Function.comp_def]

theorem balanced_relabel (e : Perm (Fin n)) {v : Vec n m} (h : balanced v) :
    balanced (v ∘ e) := by
  rw [balanced_iff_sum] at *
  exact (Equiv.sum_comp e v).trans h

private theorem orbit_comm (p : PermMap n) (i : Fin n) (k : Nat) :
    orbit p (p i) k = p (orbit p i k) := by
  induction k with
  | zero => rfl
  | succ k ih => exact congrArg p ih

/-- Recover an inverse using the already checked n-step period. -/
def positionPerm [NeZero n] (p : PermMap n) (h : fullCycle p = true) : Perm (Fin n) where
  toFun := p
  invFun i := orbit p i (n-1)
  left_inv i := by
    change orbit p (p i) (n-1) = i
    rw [orbit_comm]
    change orbit p i (n-1+1) = i
    rw [Nat.sub_add_cancel (NeZero.pos n)]
    exact (of_decide_eq_true h).1 i
  right_inv i := by
    change orbit p i (n-1+1) = i
    rw [Nat.sub_add_cancel (NeZero.pos n)]
    exact (of_decide_eq_true h).1 i

private theorem pow_eq_orbit (p : Perm (Fin n)) (i : Fin n) (k : Nat) :
    (p ^ k) i = orbit p i k := by
  induction k with
  | zero => rfl
  | succ k ih => rw [pow_succ', Perm.mul_apply, ih, orbit]

abbrev SingleCycle (p : Perm (Fin n)) : Prop := p.IsCycleOn Set.univ

theorem position_single [NeZero n] (p : PermMap n) (h : fullCycle p = true) :
    SingleCycle (positionPerm p h) := by
  refine ⟨(positionPerm p h).bijective.bijOn_univ, ?_⟩
  intro i _ j _
  obtain ⟨k, hk⟩ := (of_decide_eq_true h).2 i j
  exact ⟨(k.val : ℤ), by rw [zpow_natCast, pow_eq_orbit]; exact hk⟩

private theorem oriented_pow (p : Perm (Fin n)) (v : Vec n m) (i : Fin n) (z : Fin m) (k : ℕ) :
    (oriented p v ^ k) (i,z) =
      ((p ^ k) i, z + ∑ t ∈ Finset.range k, v ((p ^ t) i)) := by
  induction k with
  | zero => simp
  | succ k ih =>
    rw [pow_succ', Perm.mul_apply, ih, pow_succ', Perm.mul_apply, Finset.sum_range_succ]
    change (_, (z + _) + _) = (_, z + (_ + _))
    rw [add_assoc]

private theorem visits_all (p : Perm (Fin n)) (cycle : SingleCycle p) (i : Fin n) :
    Function.Bijective (fun k : Fin n => (p ^ k.val) i) := by
  apply Finite.surjective_iff_bijective.mp
  intro j
  have hc : p.IsCycleOn (Finset.univ : Finset (Fin n)) := by simpa using cycle
  obtain ⟨k, hk, h⟩ := hc.exists_pow_eq (Finset.mem_univ i) (Finset.mem_univ j)
  exact ⟨⟨k, by simpa using hk⟩, h⟩

theorem oriented_order [NeZero n] (p : Perm (Fin n)) (v : Vec n m) (cycle : SingleCycle p)
    (legal : balanced v) : orderOf (oriented p v) = n := by
  have hc : p.IsCycleOn (Finset.univ : Finset (Fin n)) := by simpa using cycle
  apply (orderOf_eq_iff (NeZero.pos n)).2
  constructor
  · ext ⟨i,z⟩ : 1
    rw [oriented_pow]
    have hp : (p ^ n) i = i := by simpa using hc.pow_card_apply (Finset.mem_univ i)
    have hs : ∑ t ∈ Finset.range n, v ((p ^ t) i) = 0 := by
      rw [← Fin.sum_univ_eq_sum_range]
      let e := Equiv.ofBijective _ (visits_all p cycle i)
      exact (e.sum_comp v).trans ((balanced_iff_sum v).mp legal)
    simp [hp, hs]
  · intro k hk positive identityPower
    have h := Equiv.congr_fun identityPower ((0 : Fin n), (0 : Fin m))
    rw [oriented_pow] at h
    have fixed : (p ^ k) 0 = 0 := congrArg Prod.fst h
    have dvd : n ∣ k := by simpa using (hc.pow_apply_eq (Finset.mem_univ (0 : Fin n))).mp fixed
    exact (Nat.not_dvd_of_pos_of_lt positive hk) dvd

theorem single_sign (p : Perm (Fin n)) [Nontrivial (Fin n)] (cycle : SingleCycle p) :
    Perm.sign p = -(-1) ^ n := by
  have h := Perm.isCycle_iff_exists_isCycleOn.mpr
    ⟨Set.univ, Set.nontrivial_univ, cycle, fun _ _ => Set.mem_univ _⟩
  have hs : p.support = Finset.univ :=
    Finset.eq_univ_of_forall fun i => Perm.mem_support.mpr (cycle.apply_ne Set.nontrivial_univ (Set.mem_univ i))
  simpa [hs] using h.sign

end CubeComm
