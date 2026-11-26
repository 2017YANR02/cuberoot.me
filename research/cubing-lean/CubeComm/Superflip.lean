import CubeComm.Model

namespace CubeComm

abbrev Corner := Fin 8 × Fin 3
abbrev Edge := Fin 12 × Fin 2

/-- In the oriented-cubie action, equality is tested on each corner and edge. -/
structure CubeMap where
  corners : Corner → Corner
  edges : Edge → Edge

def CubeMap.comp (f g : CubeMap) : CubeMap :=
  ⟨f.corners ∘ g.corners, f.edges ∘ g.edges⟩

def CubeMap.power (f : CubeMap) : Nat → CubeMap
  | 0 => ⟨id, id⟩
  | k+1 => f.comp (f.power k)

def CubeMap.same (f g : CubeMap) : Prop :=
  (∀ i z, f.corners (i,z) = g.corners (i,z)) ∧ (∀ i z, f.edges (i,z) = g.edges (i,z))

instance (f g : CubeMap) : Decidable (f.same g) := by unfold CubeMap.same; infer_instance

def identity : CubeMap := ⟨id, id⟩
def superflip : CubeMap := ⟨id, act id (fun _ => 1)⟩

private def next {n : Nat} [NeZero n] (i : Fin n) := i + 1
private def prev {n : Nat} [NeZero n] (i : Fin n) := i - 1
private def alternating (i : Fin 12) : Fin 2 := Fin.ofNat 2 i.val

def factorA : CubeMap := ⟨act next (fun _ => 0), act next (fun _ => 0)⟩
def factorB : CubeMap := ⟨act next (fun _ => 0), act next alternating⟩
def invA : CubeMap := ⟨act prev (fun _ => 0), act prev (fun _ => 0)⟩
def invB : CubeMap := ⟨act prev (fun _ => 0), act prev (fun i => alternating (prev i))⟩

theorem superflip_factor_constraints :
    fullCycle (next (n := 8)) = true ∧ fullCycle (next (n := 12)) = true ∧
    balanced (fun _ : Fin 8 => (0 : Fin 3)) ∧ balanced (fun _ : Fin 12 => (0 : Fin 2)) ∧
    balanced alternating := by
  unfold balanced
  decide +kernel

theorem inverses :
    (factorA.comp invA).same identity ∧ (invA.comp factorA).same identity ∧
    (factorB.comp invB).same identity ∧ (invB.comp factorB).same identity := by decide +kernel

theorem superflip_commutator :
    (((factorA.comp factorB).comp invA).comp invB).same superflip := by decide +kernel

def exactOrder24 (f : CubeMap) : Prop :=
  (f.power 24).same identity ∧ ∀ k : Fin 23, ¬ (f.power (k.val + 1)).same identity

instance (f : CubeMap) : Decidable (exactOrder24 f) := by unfold exactOrder24; infer_instance

theorem factor_orders : exactOrder24 factorA ∧ exactOrder24 factorB := by decide +kernel

end CubeComm
