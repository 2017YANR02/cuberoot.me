module

public import CubeDiameter.Rectangle

@[expose] public section

namespace CubeDiameter.Rectangle
open Lift Representatives Network

/-- The six symbols denote the three input coordinates and their reflections.
    Tracking the symbols retains the identity of two distinct physical layers
    even when both layers have the same batch label. -/
def signed (q : α × α × α) (r : α → α) : Fin 6 → α
  | 0 => q.1 | 1 => q.2.1 | 2 => q.2.2
  | 3 => r q.2.2 | 4 => r q.2.1 | 5 => r q.1

theorem signed_rev (q : Fin k × Fin k × Fin k) (i : Fin 6) :
    signed q Fin.rev i.rev = (signed q Fin.rev i).rev := by
  fin_cases i <;> simp [signed]

def initial : Point 4 := (0,1,2)

def Batch.color (b : Batch n) (u : Fin (n+2)) := b.label (owner b.pos u)

theorem Batch.color_rev (b : Batch n) (u : Fin (n+2)) :
    b.color u.rev = (b.color u).rev := by rw [Batch.color,owner_rev,b.reflect]; rfl

def Batch.classes (b : Batch n) (p : Point n) := (b.color p.1,b.color p.2.1,b.color p.2.2)

private theorem color_signed (b : Batch n) (p : Point n) (i : Fin 6) :
    b.color (signed p Fin.rev i) = signed (b.classes p) Fin.rev i := by
  fin_cases i <;> simp [signed,Batch.classes,Batch.color_rev]

def spin (a t : Fin 3) (p : Point n) : Point n :=
  match t with
  | 0 => quarter a p
  | 1 => quarter a (quarter a p)
  | 2 => quarter a (quarter a (quarter a p))

private theorem spin_map (p : Point m) (f : Fin (m+2) → Fin (n+2))
    (hr : ∀ u, f u.rev = (f u).rev) (a t : Fin 3) :
    spin a t (pointMap f p) = pointMap f (spin a t p) := by
  fin_cases t <;> simp [spin,quarter_map f hr]

private theorem step_owner (hn : 0 < n) (a t : Fin 3) (p : Point n) :
    step (a,owner hn (coord a p),t) p = spin a t p := by
  fin_cases t <;> simp [step,spin,twist,coord_quarter,onLayer_owner hn]

abbrev Classes := Fin 7 × Fin 7 × Fin 7

def symbolStep (k : Classes) (m : Move 6) (q : Point 4) : Point 4 :=
  if signed k Fin.rev (coord m.1 q) = select m.2.1 then spin m.1 m.2.2 q else q

def symbolWalk (k : Classes) (w : List (Move 6)) (q : Point 4) : Point 4 :=
  w.foldl (fun q m => symbolStep k m q) q

theorem word_on_symbols (b : Batch n) (p : Point n) (m : Move 6) (q : Point 4) :
    walk (b.word m) (pointMap (signed p Fin.rev) q) =
      pointMap (signed p Fin.rev) (symbolStep (b.classes p) m q) := by
  rw [word_action, step_owner]
  change (if b.color (coord m.1 (pointMap (signed p Fin.rev) q)) = _ then _ else _) = _
  simp only [coord_map, color_signed, symbolStep]
  split
  · exact spin_map _ _ (signed_rev p) _ _
  · rfl

theorem expand_on_symbols (b : Batch n) (p : Point n) (w : List (Move 6)) (q : Point 4) :
    walk (b.expand w) (pointMap (signed p Fin.rev) q) =
      pointMap (signed p Fin.rev) (symbolWalk (b.classes p) w q) := by
  induction w generalizing q with
  | nil => rfl
  | cons m w ih =>
    change walk (b.word m ++ b.expand w) _ = _
    rw [walk_append,word_on_symbols,ih]; rfl

/-- The labels at the near and far ends of each family count as the same depth family. -/
def containsFamily (k : Classes) (x : Fin 7) : Bool :=
  [k.1,k.2.1,k.2.2].any (fun u => u == x || u == x.rev)

/-- A surface point has at least one outer coordinate. The move must fix it
    whenever it lacks either of the two selected inner depth families. -/
def outsideRectangle (k : Classes) : Bool :=
  containsFamily k 0 && !(containsFamily k 1 && containsFamily k 2)

def checksSupport (w : List (Move 6)) : Bool :=
  (List.finRange 7).all fun x => (List.finRange 7).all fun y =>
    (List.finRange 7).all fun z =>
      !outsideRectangle (x,y,z) || decide (symbolWalk (x,y,z) w initial = initial)

theorem checksSupport_sound {w : List (Move 6)} (h : checksSupport w = true)
    (b : Batch n) (p : Point n) (hout : outsideRectangle (b.classes p) = true) :
    walk (b.expand w) p = p := by
  have hs : ∀ x y z : Fin 7, outsideRectangle (x,y,z) = true →
      symbolWalk (x,y,z) w initial = initial := by
    simpa [checksSupport, List.all_eq_true, Bool.or_eq_true, or_iff_not_imp_left] using h
  have eq := expand_on_symbols b p w initial
  have hfix : symbolWalk (b.classes p) w initial = initial := hs _ _ _ hout
  rw [hfix] at eq
  exact eq

private theorem allSupport :
    (words24 ++ words16 ++ words8).all checksSupport = true := by decide +kernel

theorem appendixF_parallel (b : Batch n) :
    List.Forall₂ (fun stage w =>
      (∀ (d : Depths n), (∀ s, b.label (d.slice s) = select s) →
        ∀ (f x y : Fin 6), let p := chart f (layer x) (layer y)
          walk (b.expand w) (pointMap d.embed p) = pointMap d.embed (moveWire stage p)) ∧
      (∀ p : Point n, outsideRectangle (b.classes p) = true → walk (b.expand w) p = p))
      (split24 ++ split16 ++ split8) (words24 ++ words16 ++ words8) := by
  have h := List.all_eq_true.mp allSupport
  generalize he : words24 ++ words16 ++ words8 = ws at *
  generalize he' : split24 ++ split16 ++ split8 = ss at *
  have hg := appendixF_geometry
  rw [he, he'] at hg
  clear he he'
  induction hg with
  | nil => exact .nil
  | @cons stage w ss ws hw ht ih =>
    refine .cons ⟨?_, checksSupport_sound (h w (by simp)) b⟩ (ih (fun w hw => h w (by simp [hw])))
    intro d hd f x y
    dsimp only
    rw [expand_on_frame b d hd, (realizes_iff stage w).mp hw]

end CubeDiameter.Rectangle
