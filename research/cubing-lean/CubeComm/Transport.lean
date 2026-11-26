import CubeComm.Classification
import CubeComm.PureFlips

namespace CubeComm

open Equiv
variable {n m : ℕ} [NeZero m]

/-- Data of one oriented full cycle whose twist or flip sum is zero. -/
structure CycleFactor (n m : ℕ) [NeZero m] where
  pos : Perm (Fin n)
  offsets : Vec n m
  cycle : SingleCycle pos
  legal : balanced offsets

def CycleFactor.action (f : CycleFactor n m) := oriented f.pos f.offsets

def comm {G : Type*} [Group G] (a b : G) := a * b * a⁻¹ * b⁻¹

def Realizes (p : Perm (Fin n)) (v : Vec n m) :=
  ∃ a b : CycleFactor n m, comm a.action b.action = oriented p v

theorem realizes_of_equation [NeZero n] (p : Perm (Fin n)) (v : Vec n m)
    {a b : PermMap n} {x y : Vec n m}
    (ca : fullCycle a = true) (cb : fullCycle b = true) (hx : balanced x) (hy : balanced y)
    (eqn : ∀ s, act a x (act b y s) = act p v (act b y (act a x s))) : Realizes p v := by
  let A : CycleFactor n m := ⟨positionPerm a ca, x, position_single a ca, hx⟩
  let B : CycleFactor n m := ⟨positionPerm b cb, y, position_single b cb, hy⟩
  have ab : A.action * B.action = oriented p v * B.action * A.action := Perm.ext eqn
  exact ⟨A, B, by simp [comm, ab, mul_assoc]⟩

theorem realize_representative (r : Representative d m) (u : Vec (d+1) m) (h : balanced u) :
    Realizes r.perm u := by
  obtain ⟨ca, cb, x, y, hx, hy, eqn⟩ := realizeRow r.row r.valid u h
  exact realizes_of_equation r.perm u ca cb hx hy eqn

private def CycleFactor.relabel (f : CycleFactor n m) (e : Perm (Fin n)) : CycleFactor n m where
  pos := e * f.pos * e⁻¹
  offsets := f.offsets ∘ e.symm
  cycle := by simpa [SingleCycle] using f.cycle.conj (g := e)
  legal := balanced_relabel _ f.legal

private theorem relabel_oriented (p e : Perm (Fin n)) (u : Vec n m) :
    (e.prodCongr (Equiv.refl (Fin m))).permCongrHom (oriented p u) =
      oriented (e * p * e⁻¹) (u ∘ e.symm) := by
  ext s : 1
  rfl

theorem transport {p t : Perm (Fin n)} (conj : IsConj p t)
    (h : ∀ v : Vec n m, balanced v → Realizes p v)
    (u : Vec n m) (hu : balanced u) : Realizes t u := by
  obtain ⟨e, rfl⟩ := isConj_iff.mp conj
  obtain ⟨a,b,hab⟩ := h (u ∘ e) (balanced_relabel e hu)
  refine ⟨a.relabel e, b.relabel e, ?_⟩
  have hh := congrArg (e.prodCongr (Equiv.refl (Fin m))).permCongrHom hab
  unfold comm CycleFactor.action at hh ⊢
  simp only [map_mul, map_inv, relabel_oriented] at hh
  simpa [CycleFactor.relabel, Function.comp_assoc] using hh

theorem realize_identity_edges (v : EdgeVec) (hv : balanced v) :
    Realizes (1 : Perm (Fin 12)) v := by
  obtain ⟨p,y,hp,hy,eqn⟩ := pureFlips v hv
  exact realizes_of_equation 1 v hp hp (by unfold balanced; decide +kernel : balanced (fun _ : Fin 12 => (0 : Fin 2))) hy eqn

end CubeComm
