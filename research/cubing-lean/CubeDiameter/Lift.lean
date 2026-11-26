module

public import CubeDiameter.Representatives

@[expose] public section

namespace CubeDiameter.Lift
open Representatives Network

/-- A change of coordinates preserving reflection, and the test which decides
    whether a slice turn acts. The maps can also describe *omission* of an
    inactive slice in a larger word (see the rectangular batching lemmas). -/
def pointMap (f : Fin (m+2) → Fin (n+2)) (p : Point m) : Point n :=
  (f p.1, f p.2.1, f p.2.2)

@[simp] theorem coord_map (f : Fin (m+2) → Fin (n+2)) (a : Fin 3) (p : Point m) :
    coord a (pointMap f p) = f (coord a p) := by fin_cases a <;> rfl

theorem quarter_map (f : Fin (m+2) → Fin (n+2))
    (hr : ∀ u, f u.rev = (f u).rev) (a : Fin 3) (p : Point m) :
    quarter a (pointMap f p) = pointMap f (quarter a p) := by
  rcases p with ⟨x,y,z⟩
  fin_cases a <;> simp [pointMap, quarter, hr]

structure Depths (n : ℕ) where
  row : ℕ
  col : ℕ
  row_pos : 0 < row
  col_pos : 0 < col
  row_inner : 2*row+1 < n
  col_inner : 2*col+1 < n
  distinct : row ≠ col
deriving DecidableEq

namespace Depths
variable (d : Depths n)

def slice : Fin 6 → Fin n
  | 0 => ⟨0, by have := d.row_inner; omega⟩
  | 1 => ⟨d.row, by have := d.row_inner; omega⟩
  | 2 => ⟨d.col, by have := d.col_inner; omega⟩
  | 3 => (⟨d.col, by have := d.col_inner; omega⟩ : Fin n).rev
  | 4 => (⟨d.row, by have := d.row_inner; omega⟩ : Fin n).rev
  | 5 => (⟨0, by have := d.row_inner; omega⟩ : Fin n).rev

def embed : Fin 8 → Fin (n+2)
  | 0 => 0
  | 1 => layer (d.slice 0)
  | 2 => layer (d.slice 1)
  | 3 => layer (d.slice 2)
  | 4 => layer (d.slice 3)
  | 5 => layer (d.slice 4)
  | 6 => layer (d.slice 5)
  | 7 => Fin.last (n+1)

theorem embed_injective : Function.Injective d.embed := by
  intro x y he
  have hr := d.row_inner
  have hc := d.col_inner
  have hp := d.row_pos
  have hq := d.col_pos
  have hn := d.distinct
  have he' := congrArg Fin.val he
  fin_cases x <;> fin_cases y <;> first | rfl | (simp [embed,slice,layer,Fin.rev] at he'; all_goals omega)

theorem embed_rev (u : Fin 8) : d.embed u.rev = (d.embed u).rev := by
  have hr := d.row_inner
  have hc := d.col_inner
  fin_cases u <;> apply Fin.ext <;> simp [embed,slice,layer,Fin.rev] <;> omega

@[simp] theorem embed_layer (i : Fin 6) : d.embed (layer i) = layer (d.slice i) := by
  fin_cases i <;> rfl

theorem onLayer_embed (i : Fin 6) (u : Fin 8) :
    onLayer (d.slice i) (d.embed u) = onLayer i u := by
  have hr := d.row_inner
  have hc := d.col_inner
  have hp := d.row_pos
  have hq := d.col_pos
  have hn := d.distinct
  fin_cases i <;> fin_cases u <;>
    simp [onLayer,embed,slice,layer,Fin.ext_iff,Fin.rev] <;>
    omega

def move (m : Move 6) : Move n := (m.1, d.slice m.2.1, m.2.2)

theorem twist_embed (a : Fin 3) (i : Fin 6) (p : Point 6) :
    twist a (d.slice i) (pointMap d.embed p) = pointMap d.embed (twist a i p) := by
  simp only [twist, coord_map, onLayer_embed]
  split
  · exact quarter_map _ d.embed_rev _ _
  · rfl

theorem step_embed (m : Move 6) (p : Point 6) :
    step (d.move m) (pointMap d.embed p) = pointMap d.embed (step m p) := by
  rcases m with ⟨a,i,t⟩
  fin_cases t <;> simp [step, move, twist_embed]

theorem walk_embed (w : List (Move 6)) (p : Point 6) :
    walk (w.map d.move) (pointMap d.embed p) = pointMap d.embed (walk w p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih => simp only [List.map_cons, walk_cons, step_embed, ih]

end Depths

/-- Every representative realizes its stage on the embedded six-face charts
    for every permitted pair of depths, in either order and in either parity of n. -/
theorem appendixF_lift (d : Depths n) :
    List.Forall₂ (fun s w => ∀ (f : Fin 6) (x y : Fin 6),
      let p := chart f (layer x) (layer y)
      walk (w.map d.move) (pointMap d.embed p) = pointMap d.embed (moveWire s p))
      (split24 ++ split16 ++ split8) (words24 ++ words16 ++ words8) := by
  apply List.Forall₂.imp _ appendixF_geometry
  intro s w h f x y
  dsimp only
  rw [d.walk_embed, (realizes_iff s w).mp h]

end CubeDiameter.Lift
