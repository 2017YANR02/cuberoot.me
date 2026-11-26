module

public import CubeDiameter.Sparse
public import CubeDiameter.OrbitColor

@[expose] public section

namespace CubeDiameter.Sparse
open Lift Rectangle GridStage Representatives Schedule

def IsEnd (u : Fin (n+2)) := u.val = 0 ∨ u.val = n+1
def HasEnd (p : Point n) := IsEnd p.1 ∨ IsEnd p.2.1 ∨ IsEnd p.2.2

@[simp] theorem end_rev (u : Fin (n+2)) : IsEnd u.rev ↔ IsEnd u := by
  have := u.isLt; simp only [IsEnd,Fin.rev]; omega

theorem end_mag (hn : 0 < n) {u : Fin (n+2)} (h : IsEnd u) : mag hn u = 0 := by
  have := u.isLt
  simp only [IsEnd] at h
  simp only [mag,depth,owner,Fin.rev]; omega

@[simp] theorem hasEnd_quarter (a : Fin 3) (p : Point n) : HasEnd (quarter a p) ↔ HasEnd p := by
  rcases p with ⟨x,y,z⟩; fin_cases a <;> simp [HasEnd,quarter,or_comm,or_assoc,or_left_comm]

theorem hasEnd_walk (w : List (Move n)) (p : Point n) : HasEnd (walk w p) ↔ HasEnd p := by
  have ht (a : Fin 3) (i : Fin n) (q : Point n) : HasEnd (twist a i q) ↔ HasEnd q := by
    unfold twist; split <;> simp
  have hs (m : Move n) (q : Point n) : HasEnd (step m q) ↔ HasEnd q := by
    rcases m with ⟨a,i,t⟩; fin_cases t <;> simp [step,ht]
  induction w generalizing p <;> simp_all

theorem paint_no_end (w : List (Move n)) (p : Point n) (h : ¬HasEnd p) : paint w p = none := by
  have hh := fun he => h ((hasEnd_walk w p).mp he)
  change solved n (walk w p) = none
  generalize walk w p = q at *
  rcases q with ⟨x,y,z⟩
  have bd (u : Fin (n+2)) (hu : ¬IsEnd u) : boundary u = none := by
    simp only [IsEnd,not_or] at hu
    simp [boundary,Fin.ext_iff,hu.1,hu.2]
  simp [solved,bd x (fun e => hh (.inl e)),bd y (fun e => hh (.inr (.inl e))),
    bd z (fun e => hh (.inr (.inr e)))]

private theorem embed_depth (hn : 0 < n) (d : Depths n) (j : Fin 8) :
    (IsEnd (d.embed j) ↔ j = 0 ∨ j = 7) ∧
    (mag hn (d.embed j) = d.row ↔ j = 2 ∨ j = 5) ∧
    (mag hn (d.embed j) = d.col ↔ j = 3 ∨ j = 4) := by
  have a := d.row_inner
  have b := d.col_inner
  have c := d.row_pos
  have e := d.col_pos
  have f := d.distinct
  fin_cases j <;> simp [Depths.embed,Depths.slice,IsEnd,mag,depth,owner,layer,Fin.rev,Fin.ext_iff] <;> omega

private theorem covered (hn : 0 < n) (d : Depths n) (u : Fin (n+2))
    (h : IsEnd u ∨ mag hn u = d.row ∨ mag hn u = d.col) : ∃ j, d.embed j = u := by
  have a := d.row_inner
  have b := d.col_inner
  have c := d.row_pos
  have e := d.col_pos
  have hu := u.isLt
  rcases h with h | h | h
  · obtain h|h := h
    · exact ⟨0,Fin.ext h.symm⟩
    · exact ⟨7,Fin.ext h.symm⟩
  · simp only [mag,depth,owner,Fin.rev] at h
    by_cases he : u.val = d.row+1
    · exact ⟨2,Fin.ext he.symm⟩
    · exact ⟨5,Fin.ext (by simp [Depths.embed,Depths.slice,layer,Fin.rev]; omega)⟩
  · simp only [mag,depth,owner,Fin.rev] at h
    by_cases he : u.val = d.col+1
    · exact ⟨3,Fin.ext he.symm⟩
    · exact ⟨4,Fin.ext (by simp [Depths.embed,Depths.slice,layer,Fin.rev]; omega)⟩

def flip (d : Depths n) : Depths n :=
  ⟨d.col,d.row,d.col_pos,d.row_pos,d.col_inner,d.row_inner,d.distinct.symm⟩

def switch : Fin 8 → Fin 8
  | 0 => 0 | 1 => 1 | 2 => 3 | 3 => 2 | 4 => 5 | 5 => 4 | 6 => 6 | 7 => 7

private theorem flip_embed (d : Depths n) (p : Point 6) :
    pointMap (flip d).embed p = pointMap d.embed (pointMap switch p) := by
  have eq j : (flip d).embed j = d.embed (switch j) := by fin_cases j <;> rfl
  simp only [pointMap,eq]

private def touches (q : Point 6) (l h : Fin 8) : Prop :=
  q.1 = l ∨ q.1 = h ∨ (q.2.1 = l ∨ q.2.1 = h) ∨ q.2.2 = l ∨ q.2.2 = h

private theorem complete_frames (q : Point 6) (a : touches q 0 7) (b : touches q 2 5) (c : touches q 3 4) :
    ∃ i : Fin 24, q = wire i.val ∨ q = pointMap switch (wire i.val) := by
  unfold touches at a b c
  revert q
  decide +kernel

/-- A point with a boundary coordinate belongs to an ordinary oriented
    24-sticker orbit whenever it carries two distinct private depths. -/
theorem sparse_or_generic (hn : 0 < n) (p : Point n) (he : HasEnd p) :
    SparseAt hn p ∨ ∃ (d : Depths n) (i : Fin 24), p = sticker d i := by
  classical
  by_cases hs : SparseAt hn p
  · exact Or.inl hs
  right
  simp only [SparseAt,not_forall] at hs
  push Not at hs
  obtain ⟨a,ha,pa,b,hb,pb,ne⟩ := hs
  obtain ⟨ha0,han⟩ := mem_depths.mp ha
  obtain ⟨hb0,hbn⟩ := mem_depths.mp hb
  let d : Depths n := ⟨a,b,ha0,hb0,han,hbn,ne⟩
  have allcoord (k : Fin 3) : IsEnd (coord k p) ∨ mag hn (coord k p) = a ∨ mag hn (coord k p) = b := by
    rcases p with ⟨x,y,z⟩
    have hx := @end_mag n hn x
    have hy := @end_mag n hn y
    have hz := @end_mag n hn z
    simp only [HasEnd,has] at he pa pb
    fin_cases k <;> simp only [coord] <;> grind
  obtain ⟨x,hx⟩ := covered hn d p.1 (allcoord 0)
  obtain ⟨y,hy⟩ := covered hn d p.2.1 (allcoord 1)
  obtain ⟨z,hz⟩ := covered hn d p.2.2 (allcoord 2)
  let q : Point 6 := (x,y,z)
  have eq : p = pointMap d.embed q := Prod.ext hx.symm (Prod.ext hy.symm hz.symm)
  rw [eq] at he pa pb ⊢
  change has hn (pointMap d.embed q) d.row at pa
  change has hn (pointMap d.embed q) d.col at pb
  have es := fun j => (embed_depth hn d j).1
  have rs := fun j => (embed_depth hn d j).2.1
  have cs := fun j => (embed_depth hn d j).2.2
  obtain ⟨i,h|h⟩ := complete_frames q
    (by simpa only [HasEnd,pointMap,es,touches,or_assoc] using he)
    (by simpa only [has,pointMap,rs,touches,or_assoc] using pa)
    (by simpa only [has,pointMap,cs,touches,or_assoc] using pb)
  · exact ⟨d,i,congrArg _ h⟩
  · exact ⟨flip d,i,(congrArg (pointMap d.embed) h).trans (flip_embed d (wire i.val)).symm⟩

end CubeDiameter.Sparse
