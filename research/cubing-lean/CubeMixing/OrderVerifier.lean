module

public import CubeMixing.Faces

/-! A single code stores the 54 images of a permutation as six-bit digits.
The certificates below verify one straight-line program node at a time,
keeping kernel verification independent of the length of an expanded word. -/

@[expose] public section
namespace CubeMixing.OrderCheck

def digit (code : Nat) (s : Sticker) : Sticker :=
  ⟨((code >>> (6*s.val)) % 64) % 54, Nat.mod_lt _ (by decide)⟩

def Certified (code : Nat) : Prop := ∃ g : faceGroup, ∀ x, g.val x = digit code x

def checkOne (code : Nat) : Bool := (List.finRange 54).all fun x => digit code x == x
def checkFace (code : Nat) (a : Fin 3) (s : Bool) : Bool :=
  (List.finRange 54).all fun x => digit code x == faceMap a s x
def checkMul (code lhs rhs : Nat) : Bool :=
  (List.finRange 54).all fun x => digit code x == digit lhs (digit rhs x)

theorem cert_one (code : Nat) (h : checkOne code = true) : Certified code := by
  refine ⟨1,fun x => ?_⟩
  exact (beq_iff_eq.mp (List.all_eq_true.mp h x (by simp))).symm

theorem cert_face (code : Nat) (a : Fin 3) (s : Bool) (h : checkFace code a s = true) :
    Certified code := by
  refine ⟨generator a s,fun x => ?_⟩
  exact (beq_iff_eq.mp (List.all_eq_true.mp h x (by simp))).symm

theorem cert_mul (code : Nat) {lhs rhs : Nat} (hl : Certified lhs) (hr : Certified rhs)
    (h : checkMul code lhs rhs = true) : Certified code := by
  obtain ⟨g,hg⟩ := hl
  obtain ⟨g',hg'⟩ := hr
  refine ⟨g*g',fun x => ?_⟩
  change g.val (g'.val x) = _
  rw [hg',hg]
  exact (beq_iff_eq.mp (List.all_eq_true.mp h x (by simp))).symm

end CubeMixing.OrderCheck
