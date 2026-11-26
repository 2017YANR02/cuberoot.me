import CubeComm.Transport
import CubeComm.Superflip

namespace CubeComm

open Equiv
abbrev CubieAction := Perm Corner × Perm Edge

/-- Coordinates of a fixed-centre 3×3×3 cube. Orientations are indexed by the source slot. -/
structure Coordinates where
  cp : Perm (Fin 8)
  ep : Perm (Fin 12)
  twists : Vec 8 3
  flips : Vec 12 2

def Coordinates.action (s : Coordinates) : CubieAction :=
  (oriented s.cp s.twists, oriented s.ep s.flips)

/-- The three cubie constraints: matching permutation signs, zero total twist, even flips. -/
def Coordinates.Legal (s : Coordinates) : Prop :=
  Perm.sign s.cp = Perm.sign s.ep ∧ balanced s.twists ∧ balanced s.flips

private theorem oriented_one [NeZero m] :
    oriented (1 : Perm (Fin n)) (fun _ => (0 : Fin m)) = 1 := by
  ext ⟨i,z⟩ : 1; simp [oriented, act]

private theorem oriented_mul [NeZero m] (p q : Perm (Fin n)) (v w : Vec n m) :
    oriented p v * oriented q w = oriented (p*q) (fun i => w i + v (q i)) := by
  ext ⟨i,z⟩ : 1; simp [oriented, act, add_assoc]

private theorem oriented_inv [NeZero m] (p : Perm (Fin n)) (v : Vec n m) :
    (oriented p v)⁻¹ = oriented p⁻¹ (fun i => -v (p.symm i)) := by
  ext ⟨i,z⟩ : 1
  change (_, z - _) = (_, z + -_)
  rw [sub_eq_add_neg]
  rfl

private theorem balanced_inv [NeZero m] (p : Perm (Fin n)) {v : Vec n m} (h : balanced v) :
    balanced (fun i => -v (p.symm i)) := by
  rw [balanced_iff_sum, Finset.sum_neg_distrib, Equiv.sum_comp p.symm, (balanced_iff_sum _).mp h, neg_zero]

/-- The legal cubie actions form a subgroup of the product of the two oriented permutation groups. -/
def cubeGroup : Subgroup CubieAction where
  carrier := { g | ∃ s : Coordinates, s.Legal ∧ s.action = g }
  one_mem' := by
    refine ⟨⟨1, 1, fun _ => 0, fun _ => 0⟩, ?_, ?_⟩
    · simp [Coordinates.Legal, balanced_iff_sum]
    · exact Prod.ext oriented_one oriented_one
  mul_mem' := by
    rintro _ _ ⟨s, hs, rfl⟩ ⟨t, ht, rfl⟩
    refine ⟨⟨s.cp * t.cp, s.ep * t.ep, fun i => t.twists i + s.twists (t.cp i),
      fun i => t.flips i + s.flips (t.ep i)⟩, ?_, ?_⟩
    · exact ⟨by simpa only [map_mul] using congrArg₂ (· * ·) hs.1 ht.1,
        balanced_add ht.2.1 (balanced_relabel t.cp hs.2.1),
        balanced_add ht.2.2 (balanced_relabel t.ep hs.2.2)⟩
    · exact Prod.ext (oriented_mul ..).symm (oriented_mul ..).symm
  inv_mem' := by
    rintro _ ⟨s, hs, rfl⟩
    refine ⟨⟨s.cp⁻¹, s.ep⁻¹, fun i => -s.twists (s.cp.symm i), fun i => -s.flips (s.ep.symm i)⟩, ?_, ?_⟩
    · exact ⟨by simpa only [map_inv] using congrArg Inv.inv hs.1,
        balanced_inv _ hs.2.1, balanced_inv _ hs.2.2⟩
    · exact Prod.ext (oriented_inv ..).symm (oriented_inv ..).symm

/-- An even cube has even corner and edge position permutations. -/
def EvenCube (g : cubeGroup) : Prop :=
  ∃ s : Coordinates, s.Legal ∧ s.action = g.val ∧ Perm.sign s.cp = 1

def FullCycles (g : cubeGroup) : Prop :=
  ∃ s : Coordinates, s.Legal ∧ s.action = g.val ∧ SingleCycle s.cp ∧ SingleCycle s.ep

def pairedCoordinates (c : CycleFactor 8 3) (e : CycleFactor 12 2) : Coordinates :=
  ⟨c.pos, e.pos, c.offsets, e.offsets⟩

theorem paired_legal (c : CycleFactor 8 3) (e : CycleFactor 12 2) :
    (pairedCoordinates c e).Legal := by
  refine ⟨?_, c.legal, e.legal⟩
  change Perm.sign c.pos = Perm.sign e.pos
  rw [single_sign _ c.cycle, single_sign _ e.cycle]
  decide

def pairFactors (c : CycleFactor 8 3) (e : CycleFactor 12 2) : cubeGroup :=
  ⟨(c.action, e.action), pairedCoordinates c e, paired_legal c e, rfl⟩

theorem pair_full (c : CycleFactor 8 3) (e : CycleFactor 12 2) : FullCycles (pairFactors c e) :=
  ⟨pairedCoordinates c e, paired_legal c e, rfl, c.cycle, e.cycle⟩

theorem pair_order (c : CycleFactor 8 3) (e : CycleFactor 12 2) : orderOf (pairFactors c e) = 24 := by
  rw [← Subgroup.orderOf_coe]
  change orderOf (oriented c.pos c.offsets, oriented e.pos e.offsets) = 24
  rw [Prod.orderOf_mk, oriented_order _ _ c.cycle c.legal, oriented_order _ _ e.cycle e.legal]
  decide

end CubeComm
