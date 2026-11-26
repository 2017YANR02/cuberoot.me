module

public import CubeDiameter.Support

@[expose] public section

namespace CubeDiameter.Rectangle
open Lift Network Representatives

/-- Sets of shallow layer indices counted from zero. Overlap is forbidden
    because one physical layer cannot serve both depth roles. -/
structure Selection (n : ℕ) where
  size : 2 ≤ n
  rows : Finset ℕ
  cols : Finset ℕ
  disjoint : Disjoint rows cols
  shallow : ∀ i ∈ rows ∪ cols, 0 < i ∧ 2*i+1 < n

namespace Selection

variable (s : Selection n)

def nearLabel (i : ℕ) : Fin 7 :=
  if i = 0 then 0 else if i ∈ s.rows then 1 else if i ∈ s.cols then 2 else 3

def label (i : Fin n) : Fin 7 :=
  if i < i.rev then s.nearLabel i.val else
  if i.rev < i then (s.nearLabel i.rev.val).rev else 3

theorem label_rev (i : Fin n) : s.label i.rev = (s.label i).rev := by
  simp only [label,Fin.rev_rev]
  rcases lt_trichotomy i i.rev with h | h | h
  · simp [h,not_lt_of_gt h]
  · simp [h.le.not_gt,h.ge.not_gt]
  · simp [h,not_lt_of_gt h]

def batch : Batch n := ⟨by have := s.size; omega, s.label, s.label_rev⟩

theorem label_shallow (i : Fin n) (h : 2*i.val+1 < n) : s.label i = s.nearLabel i.val := by
  have hi : i < i.rev := by simp only [Fin.lt_def,Fin.rev]; omega
  simp [label,hi]

theorem frame (d : Depths n) (hr : d.row ∈ s.rows) (hc : d.col ∈ s.cols) :
    ∀ j, s.batch.label (d.slice j) = select j := by
  have hneg := Finset.disjoint_left.mp s.disjoint
  have nc : d.col ∉ s.rows := fun h => hneg h hc
  have orow := d.row_pos.ne'
  have ocol := d.col_pos.ne'
  have h0 : 2*0+1 < n := by have := s.size; omega
  have hzero : s.label (d.slice 0) = 0 := by
    rw [s.label_shallow _ h0]; rfl
  have hrow : s.label (d.slice 1) = 1 := by
    rw [s.label_shallow _ d.row_inner]; simp [Depths.slice,nearLabel,orow,hr]
  have hcol : s.label (d.slice 2) = 2 := by
    rw [s.label_shallow _ d.col_inner]; simp [Depths.slice,nearLabel,ocol,nc,hc]
  intro j
  change s.label _ = _
  fin_cases j
  · exact hzero
  · exact hrow
  · exact hcol
  · exact (s.label_rev (d.slice 2)).trans (congrArg Fin.rev hcol)
  · exact (s.label_rev (d.slice 1)).trans (congrArg Fin.rev hrow)
  · exact (s.label_rev (d.slice 0)).trans (congrArg Fin.rev hzero)

def depths (i j : ℕ) (hi : i ∈ s.rows) (hj : j ∈ s.cols) : Depths n where
  row := i
  col := j
  row_pos := (s.shallow i (Finset.mem_union_left _ hi)).1
  col_pos := (s.shallow j (Finset.mem_union_right _ hj)).1
  row_inner := (s.shallow i (Finset.mem_union_left _ hi)).2
  col_inner := (s.shallow j (Finset.mem_union_right _ hj)).2
  distinct := fun he => Finset.disjoint_left.mp s.disjoint hi (he ▸ hj)

/-- A single expanded word carries out the prescribed permutation on every
    chosen row/column pair at once and fixes each surface point missing one
    of the two families. -/
theorem appendixF_rectangle :
    List.Forall₂ (fun stage w =>
      (∀ (i j : ℕ) (hi : i ∈ s.rows) (hj : j ∈ s.cols) (f x y : Fin 6),
        let d := s.depths i j hi hj
        let p := chart f (layer x) (layer y)
        walk (s.batch.expand w) (pointMap d.embed p) = pointMap d.embed (moveWire stage p)) ∧
      (∀ p : Point n, outsideRectangle (s.batch.classes p) = true →
        walk (s.batch.expand w) p = p))
      (split24 ++ split16 ++ split8) (words24 ++ words16 ++ words8) := by
  apply List.Forall₂.imp _ (appendixF_parallel s.batch)
  intro stage w h
  exact ⟨fun i j hi hj => h.1 (s.depths i j hi hj) (s.frame _ hi hj), h.2⟩

end Selection
end CubeDiameter.Rectangle
