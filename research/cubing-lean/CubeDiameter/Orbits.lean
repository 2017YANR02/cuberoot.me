module

public import CubeDiameter.Strip

@[expose] public section

namespace CubeDiameter.Rectangle
open Lift Network Representatives

def tableRows := (split24 ++ split16 ++ split8).zip (words24 ++ words16 ++ words8)

theorem word_on_subcube (b : Batch n) (c : Batch 6) (d : Depths n)
    (hc : ∀ j, b.label (d.slice j) = c.label j) (m : Move 6) (p : Point 6) :
    walk (b.word m) (pointMap d.embed p) = pointMap d.embed (walk (c.word m) p) := by
  have ho (u : Fin 8) : owner b.pos (d.embed u) = d.slice (owner c.pos u) := by
    have h := d.onLayer_embed (owner c.pos u) u
    simpa [onLayer_owner b.pos,onLayer_owner c.pos] using h
  simp only [word_action,coord_map,ho,hc]
  split
  · exact d.step_embed (m.1,_,m.2.2) p
  · rfl

theorem expand_on_subcube (b : Batch n) (c : Batch 6) (d : Depths n)
    (hc : ∀ j, b.label (d.slice j) = c.label j) (w : List (Move 6)) (p : Point 6) :
    walk (b.expand w) (pointMap d.embed p) = pointMap d.embed (walk (c.expand w) p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih =>
    change walk (b.word m ++ b.expand w) _ = pointMap _ (walk (c.word m ++ c.expand w) p)
    rw [walk_append,walk_append,word_on_subcube b c d hc,ih]

private def code : Fin 3 → Fin 7
  | 0 => 3 | 1 => 1 | 2 => 2

private def modelLabel (r c : Fin 3) : Fin 6 → Fin 7
  | 0 => 0 | 1 => code r | 2 => code c | 3 => (code c).rev | 4 => (code r).rev | 5 => 6

private def model (r c : Fin 3) : Batch 6 :=
  ⟨by decide,modelLabel r c,by intro i; fin_cases i <;> simp [modelLabel]⟩

namespace Selection

def role (s : Selection n) (i : ℕ) : Fin 3 :=
  if i ∈ s.rows then 1 else if i ∈ s.cols then 2 else 0

private theorem near_role (s : Selection n) (i : ℕ) (hi : 0 < i) :
    s.nearLabel i = code (s.role i) := by
  simp only [nearLabel,role,hi.ne',ite_false]
  split <;> first | rfl | (split <;> rfl)

private theorem model_frame (s : Selection n) (d : Depths n) (j : Fin 6) :
    s.batch.label (d.slice j) = (model (s.role d.row) (s.role d.col)).label j := by
  have hz : s.label (d.slice 0) = 0 := by
    rw [s.label_shallow _ (show 2*0+1<n by have := s.size; omega)]; rfl
  have hr : s.label (d.slice 1) = code (s.role d.row) :=
    (s.label_shallow _ d.row_inner).trans (s.near_role _ d.row_pos)
  have hc : s.label (d.slice 2) = code (s.role d.col) :=
    (s.label_shallow _ d.col_inner).trans (s.near_role _ d.col_pos)
  fin_cases j
  · exact hz
  · exact hr
  · exact hc
  · exact (s.label_rev (d.slice 2)).trans (congrArg Fin.rev hc)
  · exact (s.label_rev (d.slice 1)).trans (congrArg Fin.rev hr)
  · exact (s.label_rev (d.slice 0)).trans (congrArg Fin.rev hz)

end Selection

/-- Actual 24-wire index permutation of a table stage, in listed order. -/
def output (stage : Stage) (i : Fin 24) : Fin 24 :=
  stage.foldl (fun k ab => if k.val = ab.1 then Fin.ofNat 24 ab.2 else
    if k.val = ab.2 then Fin.ofNat 24 ab.1 else k) i

private def checkRoles (row : Stage × List (Move 6)) : Bool :=
  (List.finRange 3).all fun r => (List.finRange 3).all fun c => (List.finRange 24).all fun i =>
    decide (walk ((model r c).expand row.2) (wire i.val) =
      wire (if r = 1 ∧ c = 2 then output row.1 i else i).val)

private theorem allRoles : tableRows.all checkRoles = true := by decide +kernel

/-- On every generic orbit, including the one with row and column interchanged,
    the expanded stage acts iff that ordered pair belongs to the rectangle. -/
theorem rectangle_on_orbit (s : Selection n) (d : Depths n) (i : Fin 24)
    {stage w} (h : (stage,w) ∈ tableRows) :
    walk (s.batch.expand w) (pointMap d.embed (wire i.val)) =
      pointMap d.embed (wire (if d.row ∈ s.rows ∧ d.col ∈ s.cols then output stage i else i).val) := by
  have hh := List.all_eq_true.mp allRoles (stage,w) h
  have he : ∀ (r c : Fin 3) (j : Fin 24),
      walk ((model r c).expand w) (wire j.val) =
      wire (if r = 1 ∧ c = 2 then output stage j else j).val := by
    simpa [checkRoles,List.all_eq_true] using hh
  rw [expand_on_subcube s.batch _ d (s.model_frame d),he]
  have hr : s.role d.row = 1 ↔ d.row ∈ s.rows := by
    by_cases a : d.row ∈ s.rows <;> by_cases b : d.row ∈ s.cols <;> simp [Selection.role,a,b]
  have hc : s.role d.col = 2 ↔ d.col ∈ s.cols := by
    by_cases a : d.col ∈ s.rows
    · have b : d.col ∉ s.cols := Finset.disjoint_left.mp s.disjoint a
      simp [Selection.role,a,b]
    · by_cases b : d.col ∈ s.cols <;> simp [Selection.role,a,b]
  simp only [hr,hc]

end CubeDiameter.Rectangle
