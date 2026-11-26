module

public import Mathlib.Data.Fintype.BigOperators
public import Mathlib.Data.Fintype.Prod
public import Mathlib.Data.Fin.Basic

@[expose] public section

namespace CubeMixing

/-- An axis, a choice of its face, and 1--3 quarter turns (encoded by 0--2). -/
abbrev Move := Fin 3 × Bool × Fin 3

/-- An axis and the exponents of its two opposite faces. -/
abbrev Block := Fin 3 × Fin 4 × Fin 4

def startBlock (m : Move) : Block :=
  (m.1, if m.2.1 then 0 else m.2.2.succ, if m.2.1 then m.2.2.succ else 0)

def mergeBlock (m : Move) (h : Block) : Block :=
  (h.1, (startBlock m).2.1 + h.2.1, (startBlock m).2.2 + h.2.2)

def zeroBlock (b : Block) : Bool := b.2 == (0, 0)

def doubleBlock (b : Block) : Bool := b.2.1 != 0 && b.2.2 != 0

def singles : List Block → Nat
  | [] => 0
  | h :: w => (if doubleBlock h then 0 else 1) + singles w

def doubles : List Block → Nat
  | [] => 0
  | h :: w => (if doubleBlock h then 1 else 0) + doubles w

/-- The next block, when present, starts on a different axis. -/
def freshAxis (i : Fin 3) : List Block → Prop
  | [] => True
  | h :: _ => i ≠ h.1

def Normal : List Block → Prop
  | [] => True
  | h :: w => zeroBlock h = false ∧ freshAxis h.1 w ∧ Normal w

def normalStep (m : Move) : List Block → List Block
  | [] => [startBlock m]
  | h :: w =>
    if m.1 = h.1 then
      let b := mergeBlock m h
      if zeroBlock b then w else b :: w
    else startBlock m :: h :: w

def invMove (m : Move) : Move := (m.1, m.2.1, Fin.rev m.2.2)

theorem invMove_inv (m : Move) : invMove (invMove m) = m := by
  exact (by decide : ∀ x : Move, invMove (invMove x) = x) m

end CubeMixing
