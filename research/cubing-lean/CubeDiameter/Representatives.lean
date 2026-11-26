module

public import CubeDiameter.Bounds
public import CubeDiameter.Permnet61

@[expose] public section

namespace CubeDiameter.Representatives
open Network

/-- Faces are labeled U,L,F,R,B,D. Coordinates increase toward R,U,F. -/
def faceInfo : Fin 6 → String × Fin 3 × Bool
  | 0 => ("U",1,true)
  | 1 => ("L",0,false)
  | 2 => ("F",2,true)
  | 3 => ("R",0,true)
  | 4 => ("B",2,false)
  | 5 => ("D",1,false)

/-- Depth and angle use 0-based codes. A subscript in a word denotes inner
    depth; an ordinary digit 2 denotes a half turn. -/
def namedTurn (f : Fin 6) (r t : Fin 3) : Move 6 :=
  let (_, axis, positive) := faceInfo f
  let i : Fin 6 := ⟨r.val, by omega⟩
  (axis, if positive then i.rev else i, if positive then t.rev else t)

local notation "B₂" => namedTurn 4 1 0
local notation "B₂'" => namedTurn 4 1 2
local notation "B₂2" => namedTurn 4 1 1
local notation "D₂" => namedTurn 5 1 0
local notation "D₂'" => namedTurn 5 1 2
local notation "F₂" => namedTurn 2 1 0
local notation "F₂'" => namedTurn 2 1 2
local notation "F₂2" => namedTurn 2 1 1
local notation "L₂" => namedTurn 1 1 0
local notation "L₂'" => namedTurn 1 1 2
local notation "L₂2" => namedTurn 1 1 1
local notation "R₂" => namedTurn 3 1 0
local notation "R₂'" => namedTurn 3 1 2
local notation "R₂2" => namedTurn 3 1 1
local notation "U₂" => namedTurn 0 1 0
local notation "U₂'" => namedTurn 0 1 2
local notation "U₂2" => namedTurn 0 1 1
local notation "B₃" => namedTurn 4 2 0
local notation "B₃'" => namedTurn 4 2 2
local notation "B₃2" => namedTurn 4 2 1
local notation "D₃" => namedTurn 5 2 0
local notation "D₃'" => namedTurn 5 2 2
local notation "F₃" => namedTurn 2 2 0
local notation "F₃'" => namedTurn 2 2 2
local notation "F₃2" => namedTurn 2 2 1
local notation "L₃" => namedTurn 1 2 0
local notation "L₃'" => namedTurn 1 2 2
local notation "R₃" => namedTurn 3 2 0
local notation "R₃'" => namedTurn 3 2 2
local notation "R₃2" => namedTurn 3 2 1
local notation "U₃" => namedTurn 0 2 0
local notation "U₃'" => namedTurn 0 2 2
local notation "B" => namedTurn 4 0 0
local notation "B'" => namedTurn 4 0 2
local notation "B2" => namedTurn 4 0 1
local notation "D" => namedTurn 5 0 0
local notation "D'" => namedTurn 5 0 2
local notation "D2" => namedTurn 5 0 1
local notation "F" => namedTurn 2 0 0
local notation "F'" => namedTurn 2 0 2
local notation "F2" => namedTurn 2 0 1
local notation "L" => namedTurn 1 0 0
local notation "L'" => namedTurn 1 0 2
local notation "L2" => namedTurn 1 0 1
local notation "R" => namedTurn 3 0 0
local notation "R'" => namedTurn 3 0 2
local notation "R2" => namedTurn 3 0 1
local notation "U" => namedTurn 0 0 0
local notation "U'" => namedTurn 0 0 2
local notation "U2" => namedTurn 0 0 1

/-- Screen column and row coordinates on each face; rows increase downwards. -/
def chart (face : Fin 6) (u v : Fin 8) : Point 6 :=
  match face with
  | 0 => (u,7,v)
  | 1 => (0,v.rev,u)
  | 2 => (u,v.rev,7)
  | 3 => (7,v.rev,u.rev)
  | 4 => (u.rev,v.rev,0)
  | 5 => (u,0,v.rev)

def wire (i : Nat) : Point 6 :=
  let (u,v) : Fin 8 × Fin 8 := match i%4 with
    | 0 => (3,2)
    | 1 => (5,3)
    | 2 => (4,5)
    | _ => (2,4)
  chart (Fin.ofNat 6 (i/4)) u v

def moveWire (stage : Stage) (p : Point 6) : Point 6 :=
  stage.foldl (fun q ab => if q = wire ab.1 then wire ab.2 else if q = wire ab.2 then wire ab.1 else q) p

/-- The word column of Tables F.1, F.2 and F.3 of arXiv:2611.11018v1. -/
def words24 : List (List (Move 6)) := [
  [R, D, B, U, B₂2, R₂, U', L', F₃', L, U, R₂', B₂2, U', L', F₃, L, B', D', R'],
  [B', R', D2, F₂, D2, F', R₃', D2, F₂', D2, F, L₂2, F', R₃, F, L₂2, R, B],
  [R', F', B, R₂', D2, B₃, L2, D2, R₂, D₂, D2, L2, B₃', D2, L2, D₂', L2, B', F, R],
  [L', B', D', R, F, U, L₂', F2, R2, U₃, F2, R2, L₂, F₂, R2, F2, U₃', R2, F₂', F2, U', F', R', D, B, L],
  [B, D', L, F, U, R, U2, U₂, F2, R₃, U2, F2, U₂', B₂', F2, U2, R₃', F2, U2, B₂, R', U', F', L', D, B'],
  [F, U, L', B, D', R, F₂', D2, B2, R₃, D2, B2, F₂, D₂, B2, D2, R₃', B2, D₂', D2, R', D, B', L, U', F'],
  [R', D, B, L', U, F, R₂', U2, L2, F₃, U2, L2, R₂, U₂, L2, U2, F₃', L2, U₂', U2, F', U', L, B', D', R],
  [R', B', U, L, F', D, R₂', F2, L2, D₃, F2, L2, R₂, F₂, L2, F2, D₃', L2, F₂', F2, D', F, L', U', B, R],
  [B, R', U, L2, L₂, F2, U₃, L2, F2, L₂', B₂', F2, L2, U₃', F2, L2, B₂, U', R, B'],
  [B', R', F, D, L, D2, D₂, F2, L₃, D2, F2, D₂', B₂, F2, D2, L₃', F2, D2, B₂', L', D', F', R, B],
  [B', L, U, F, R', D, R2, R₂, F2, D₃, R2, F2, R₂', B₂', F2, R2, D₃', F2, R2, B₂, D', R, F', U', L', B],
  [B₂, D', U', F₃', D, U, B₂', D', U', F₃, D, U],
  [U', L, D', B₃2, D, R, L, F₂, R', L', D', B₃2, D, R, L, F₂', R', L', L', U],
  [R', F2, L2, F₃', L2, U₂, L2, F₃, L2, U₂', F2, R],
  [F₃2, L, B₂, L', F₃2, L, B₂', L'],
  [D2, L₂', D2, F₃, D2, L₂, D2, F₃'],
  [D2, R₂', D2, B₃, D2, R₂, D2, B₃'],
  [F₂, U2, L₃, U2, F₂', U2, L₃', U2],
  [D, R₂, D', B₃', D, R₂', D', B₃],
  [R, F₂, R', U₃', R, F₂', R', U₃],
  [D', R₃2, D, L₂2, D', R₃2, D, L₂2],
  [D2, L₂, D2, F₃2, D2, L₂', D2, F₃2],
  [R2, U₂, R2, B₃, R2, U₂', R2, B₃'],
  [B₂, R', F₃2, R, B₂', R', F₃2, R]]
def words16 : List (List (Move 6)) := [
  [R₂', U₂2, L', F₃, L, U₂2, R₂, B₂, L', F', R₂', F₃', R₂, F, L, B₂'],
  [F, L, R, U', R, L₂2, F₂', R', F', U₃, F, R, F₂, R', L₂, D₂, F', U₃', F, D₂', L₂, U, R', L', F'],
  [R2, R₂2, D, B₂', R2, D₃, R2, B₂, D', R2, R₂', U2, R₂, D₃', R₂', U2, R₂'],
  [L2, B₂, R, L₂2, U₃', L, B₂, D₂', L', U₃, L, D₂, B₂', R', L₂2, L', B₂', L2],
  [U, L, F, F₂, U, R₂, D₃, R₂', U', L2, F₂', R₂, L2, D₃', R₂', L2, F₂, L2, F₂', F', L', U'],
  [B₂2, L₂2, R, U₃, R, F₂2, D₂, R', U₃', R, D₂', F₂2, L₂2, R2, B₂2],
  [R, B₂', R', L', D', F₃', D, R, L, B₂, R', L', D', F₃, D, L],
  [L2, R₂, D₃, L2, F₂2, L2, D₃', L2, F₂2, R₂'],
  [D₃, L, F₂, L', D₃', L, F₂', L'],
  [F₃, L, U₂', L', F₃', L, U₂, L'],
  [B₂, L', F₃2, L, B₂', L', F₃2, L],
  [B₃, U, F₂, U', B₃', U, F₂', U'],
  [D, R₂, D', B₃', D, R₂', D', B₃],
  [F₂2, L', B₃2, L, F₂2, L', B₃2, L],
  [B, D₂, B', R₃', B, D₂', B', R₃],
  [B₂2, L', F₃2, L, B₂2, L', F₃2, L]]
def words8 : List (List (Move 6)) := [
  [L, F₂', L', B₃, L, F₂, L', B₃'],
  [U, F₃, U, B₂', U', F₃', U, B₂, U', U'],
  [L2, F₂2, L, F₂, L', D', B₃, D, L, F₂', L', D', B₃', D, F₂2, L2],
  [B₂', U', F₃, U, B₂, U', F₃', U],
  [L, F₂', L', B₃, L, F₂, L', B₃'],
  [F₂', L', B₃, L, F₂, L', B₃', L],
  [U, B₂', U', F₃, U, B₂, U', F₃']]

def realizes (stage : Stage) (w : List (Move 6)) : Bool :=
  (List.finRange 6).all fun f => (List.finRange 6).all fun x =>
    (List.finRange 6).all fun y =>
      let p := chart f (layer x) (layer y)
      decide (walk w p = moveWire stage p)

theorem realizes_iff (stage : Stage) (w : List (Move 6)) :
    realizes stage w = true ↔ ∀ (f x y : Fin 6),
      walk w (chart f (layer x) (layer y)) = moveWire stage (chart f (layer x) (layer y)) := by
  simp [realizes, List.all_eq_true]

private def checkRows : List Stage → List (List (Move 6)) → Bool
  | [], [] => true
  | s :: ss, w :: ws => realizes s w && checkRows ss ws
  | _, _ => false

private theorem all_rows {ss : List Stage} {ws : List (List (Move 6))} (h : checkRows ss ws = true) :
    List.Forall₂ (fun stage word => realizes stage word = true) ss ws := by
  induction ss generalizing ws with
  | nil => cases ws <;> simp [checkRows] at *
  | cons s ss ih =>
    cases ws with
    | nil => simp [checkRows] at h
    | cons w ws =>
      obtain ⟨hs,ht⟩ := Bool.and_eq_true_iff.mp h
      exact .cons hs (ih ht)

/-- Every word realizes its entire stage on all 216 stickers, including the
    stickers outside the advertised orbit. The checker rejects row-count mismatches. -/
theorem appendixF_geometry :
    List.Forall₂ (fun stage word => realizes stage word = true)
      (split24 ++ split16 ++ split8) (words24 ++ words16 ++ words8) :=
  all_rows (by decide +kernel)

end CubeDiameter.Representatives
