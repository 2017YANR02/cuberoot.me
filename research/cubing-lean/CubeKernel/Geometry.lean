module

public import Mathlib.Data.Finset.Basic
public import Mathlib.Data.Fintype.Fin
public import Mathlib.Tactic.FinCases

/-! Sticker coordinates for a cube with named mirror pairs of ordinary layers.
The two outer layers and the optional central layer do not carry names. -/

@[expose] public section

namespace CubeKernel

inductive Slice (D : Type) (odd : Bool)
  | outer (side : Bool)
  | inner (d : D) (side : Bool)
  | middle (h : odd = true)
deriving DecidableEq

namespace Slice

def depth? : Slice D o → Option D
  | .inner d _ => some d
  | _ => none

def map (f : D → E) : Slice D o → Slice E o
  | .outer b => .outer b
  | .inner d b => .inner (f d) b
  | .middle h => .middle h

def rev : Slice D o → Slice D o
  | .outer b => .outer (!b)
  | .inner d b => .inner d (!b)
  | .middle h => .middle h

@[simp] theorem map_rev (f : D → E) (s : Slice D o) : map f s.rev = (map f s).rev := by
  cases s <;> rfl

theorem map_injective {f : D → E} (hf : Function.Injective f) :
    Function.Injective (map (o := o) f) := by
  intro s t he
  cases s <;> cases t <;> simp_all [map, Function.Injective.eq_iff hf]

@[simp] theorem map_id (s : Slice D o) : s.map id = s := by cases s <;> rfl
@[simp] theorem map_comp (f : E → F) (g : D → E) (s : Slice D o) :
    (s.map g).map f = s.map (f ∘ g) := by cases s <;> rfl

end Slice

abbrev Turn (D : Type) (odd : Bool) := Fin 3 × Slice D odd × Fin 3
abbrev Sticker (D : Type) (odd : Bool) := Fin 3 × Bool × Slice D odd × Slice D odd

def mapTurn (f : D → E) (m : Turn D o) : Turn E o := (m.1, m.2.1.map f, m.2.2)
def mapSticker (f : D → E) (p : Sticker D o) : Sticker E o :=
  (p.1, p.2.1, p.2.2.1.map f, p.2.2.2.map f)

@[simp] theorem mapSticker_id (p : Sticker D o) : mapSticker id p = p := by simp [mapSticker]
@[simp] theorem mapSticker_comp (f : E → F) (g : D → E) (p : Sticker D o) :
    mapSticker f (mapSticker g p) = mapSticker (f ∘ g) p := by simp [mapSticker]
@[simp] theorem mapTurn_id (m : Turn D o) : mapTurn id m = m := by simp [mapTurn]
@[simp] theorem mapTurn_comp (f : E → F) (g : D → E) (m : Turn D o) :
    mapTurn f (mapTurn g m) = mapTurn (f ∘ g) m := by simp [mapTurn]

inductive Coord (D : Type) (odd : Bool)
  | normal (side : Bool)
  | layer (s : Slice D odd)
deriving DecidableEq

namespace Coord

def owner : Coord D o → Slice D o
  | .normal b => .outer b
  | .layer s => s

def rev : Coord D o → Coord D o
  | .normal b => .normal (!b)
  | .layer s => .layer s.rev

def map (f : D → E) : Coord D o → Coord E o
  | .normal b => .normal b
  | .layer s => .layer (s.map f)

@[simp] theorem owner_map (f : D → E) (x : Coord D o) :
    (x.map f).owner = x.owner.map f := by cases x <;> rfl
@[simp] theorem rev_map (f : D → E) (x : Coord D o) :
    (x.map f).rev = x.rev.map f := by cases x <;> simp [map, rev]

end Coord

abbrev Point (D : Type) (odd : Bool) := Coord D odd × Coord D odd × Coord D odd

def mapPoint (f : D → E) (p : Point D o) : Point E o :=
  (p.1.map f, p.2.1.map f, p.2.2.map f)

def chart (p : Sticker D o) : Point D o :=
  let (_, b, x, y) := p
  match p.1 with
  | 0 => (.normal b, .layer x, .layer y)
  | 1 => (.layer x, .normal b, .layer y)
  | 2 => (.layer x, .layer y, .normal b)

theorem chart_map (f : D → E) (p : Sticker D o) :
    chart (mapSticker f p) = mapPoint f (chart p) := by
  rcases p with ⟨a,b,x,y⟩
  fin_cases a <;> rfl

def coordinate (a : Fin 3) (p : Point D o) : Coord D o :=
  match a with
  | 0 => p.1
  | 1 => p.2.1
  | 2 => p.2.2

theorem coordinate_map (f : D → E) (a : Fin 3) (p : Point D o) :
    coordinate a (mapPoint f p) = (coordinate a p).map f := by fin_cases a <;> rfl

def rotate (a : Fin 3) (p : Point D o) : Point D o :=
  let (x,y,z) := p
  match a with
  | 0 => (x,z.rev,y)
  | 1 => (z,y,x.rev)
  | 2 => (y.rev,x,z)

theorem rotate_map (f : D → E) (a : Fin 3) (p : Point D o) :
    rotate a (mapPoint f p) = mapPoint f (rotate a p) := by
  rcases p with ⟨x,y,z⟩
  fin_cases a <;> simp [rotate,mapPoint]

def quarter [DecidableEq D] (a : Fin 3) (s : Slice D o) (p : Point D o) : Point D o :=
  if (coordinate a p).owner = s then rotate a p else p

theorem quarter_map [DecidableEq D] [DecidableEq E] (f : D → E) (hf : Function.Injective f)
    (a : Fin 3) (s : Slice D o) (p : Point D o) :
    quarter a (s.map f) (mapPoint f p) = mapPoint f (quarter a s p) := by
  simp only [quarter,coordinate_map,Coord.owner_map,(Slice.map_injective hf).eq_iff]
  split <;> simp [rotate_map]

def step [DecidableEq D] (m : Turn D o) (p : Point D o) : Point D o :=
  let t := quarter m.1 m.2.1
  match m.2.2 with
  | 0 => t p
  | 1 => t (t p)
  | 2 => t (t (t p))

theorem step_map [DecidableEq D] [DecidableEq E] (f : D → E) (hf : Function.Injective f)
    (m : Turn D o) (p : Point D o) :
    step (mapTurn f m) (mapPoint f p) = mapPoint f (step m p) := by
  rcases m with ⟨a,s,t⟩
  fin_cases t <;> simp [step,mapTurn,quarter_map f hf]

def walk [DecidableEq D] (w : List (Turn D o)) (p : Point D o) : Point D o :=
  w.foldl (fun q m => step m q) p

@[simp] theorem walk_cons [DecidableEq D] (m : Turn D o) (w : List (Turn D o)) (p : Point D o) :
    walk (m::w) p = walk w (step m p) := rfl

theorem walk_map [DecidableEq D] [DecidableEq E] (f : D → E) (hf : Function.Injective f)
    (w : List (Turn D o)) (p : Point D o) :
    walk (w.map (mapTurn f)) (mapPoint f p) = mapPoint f (walk w p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih => simp only [List.map_cons,walk_cons,step_map f hf,ih]

def solved (p : Point D o) : Option (Fin 3 × Bool) :=
  match p with
  | (.normal b, .layer _, .layer _) => some (0,b)
  | (.layer _, .normal b, .layer _) => some (1,b)
  | (.layer _, .layer _, .normal b) => some (2,b)
  | _ => none

@[simp] theorem solved_map (f : D → E) (p : Point D o) : solved (mapPoint f p) = solved p := by
  rcases p with ⟨x,y,z⟩
  cases x <;> cases y <;> cases z <;> rfl

def paint [DecidableEq D] (w : List (Turn D o)) (p : Sticker D o) :=
  solved (walk w (chart p))

theorem paint_embed [DecidableEq D] [DecidableEq E] (f : D → E) (hf : Function.Injective f)
    (w : List (Turn D o)) (p : Sticker D o) :
    paint (w.map (mapTurn f)) (mapSticker f p) = paint w p := by
  simp [paint,chart_map,walk_map f hf]

def projectSlice [DecidableEq D] (R : Finset D) : Slice D o → Option (Slice (↥R) o)
  | .outer b => some (.outer b)
  | .inner d b => if hd : d ∈ R then some (.inner ⟨d,hd⟩ b) else none
  | .middle h => some (.middle h)

def projectTurn [DecidableEq D] (R : Finset D) (m : Turn D o) : Option (Turn (↥R) o) :=
  (projectSlice R m.2.1).map fun s => (m.1,s,m.2.2)

def projectWord [DecidableEq D] (R : Finset D) (w : List (Turn D o)) :=
  w.filterMap (projectTurn R)

theorem length_projectWord_le [DecidableEq D] (R : Finset D) (w : List (Turn D o)) :
    (projectWord R w).length ≤ w.length := List.length_filterMap_le ..

private theorem project_hit [DecidableEq D] (R : Finset D) (s : Slice D o)
    (t : Slice (↥R) o) (h : projectSlice R s = some t) : t.map Subtype.val = s := by
  cases s with
  | outer b => simp [projectSlice] at h; subst t; rfl
  | middle ho => simp [projectSlice] at h; subst t; rfl
  | inner d b =>
    by_cases hd : d ∈ R <;> simp [projectSlice, hd] at h
    subst t; rfl

private theorem project_miss [DecidableEq D] (R : Finset D) (s : Slice D o)
    (h : projectSlice R s = none) (t : Slice (↥R) o) : t.map Subtype.val ≠ s := by
  cases s with
  | outer b => simp [projectSlice] at h
  | middle ho => simp [projectSlice] at h
  | inner d b =>
    by_cases hd : d ∈ R <;> simp [projectSlice, hd] at h
    cases t <;> simp [Slice.map]; grind

theorem walk_project [DecidableEq D] (R : Finset D) (w : List (Turn D o)) (p : Point (↥R) o) :
    mapPoint Subtype.val (walk (projectWord R w) p) = walk w (mapPoint Subtype.val p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih =>
    rcases m with ⟨a,s,t⟩
    simp only [projectWord, List.filterMap_cons, projectTurn, walk_cons]
    cases h : projectSlice R s with
    | none =>
      have hs (q : Point (↥R) o) : quarter a s (mapPoint Subtype.val q) = mapPoint Subtype.val q := by
        simp [quarter,coordinate_map,project_miss R s h]
      have ht : step (a,s,t) (mapPoint Subtype.val p) = mapPoint Subtype.val p := by
        fin_cases t <;> simp [step,hs]
      simpa only [projectWord, Option.map_none, ht] using ih p
    | some z =>
      have hm := project_hit R s z h
      subst s
      have ht := step_map (Subtype.val : (↥R) → D) Subtype.val_injective (a,z,t) p
      simpa only [projectWord,Option.map_some,List.filterMap_cons,walk_cons,mapTurn] using (ih (step (a,z,t) p)).trans (congrArg (walk w) ht.symm)

theorem paint_project [DecidableEq D] (R : Finset D) (w : List (Turn D o)) (p : Sticker (↥R) o) :
    paint (projectWord R w) p = paint w (mapSticker Subtype.val p) := by
  simp only [paint,chart_map,← walk_project R w,solved_map]

end CubeKernel
