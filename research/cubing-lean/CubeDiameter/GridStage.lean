module

public import CubeDiameter.StripAction
public import Mathlib.Order.Interval.Finset.Nat

@[expose] public section

namespace CubeDiameter.GridStage
open Lift Network Representatives Rectangle
open scoped BigOperators

/-- Positive depths strictly before the middle. The two parities of n give
    the same formula, with integer division. -/
def side (n : ℕ) := (n-2)/2
def depths (n : ℕ) := Finset.Icc 1 (side n)

@[simp] theorem mem_depths : i ∈ depths n ↔ 0 < i ∧ 2*i+1 < n := by
  simp only [depths,Finset.mem_Icc,side]; omega

@[simp] theorem card_depths (n : ℕ) : (depths n).card = side n := by simp [depths]

def band (width i : ℕ) := (i-1)/width
def block (n width k : ℕ) := (depths n).filter (fun i => band width i = k)

private theorem block_card (hw : 0 < width) (n k : ℕ) : (block n width k).card ≤ width := by
  have hs : block n width k ⊆ Finset.Ioc (k*width) (k*width+width) := by
    intro i hi
    obtain ⟨h,e⟩ := Finset.mem_filter.mp hi
    have hpos := (mem_depths.mp h).1
    obtain ⟨hl,hu⟩ := (Nat.div_eq_iff hw).mp e
    rw [Finset.mem_Ioc]; omega
  simpa using Finset.card_le_card hs

def mkSelection (hn : 2 ≤ n) (R C : Finset ℕ) (hr : R ⊆ depths n) (hc : C ⊆ depths n)
    (disj : Disjoint R C) : Selection n where
  size := hn
  rows := R
  cols := C
  disjoint := disj
  shallow := fun _ h => mem_depths.mp ((Finset.mem_union.mp h).elim (fun h => hr h) (fun h => hc h))

def outerStrip (hn : 2 ≤ n) (width k : ℕ) : Selection n :=
  mkSelection hn (block n width k) (depths n \ block n width k)
    (Finset.filter_subset ..) Finset.sdiff_subset (Finset.disjoint_left.mpr (fun _ h hc => (Finset.mem_sdiff.mp hc).2 h))

/-- Pairs in the same block are processed a row at a time. Removing i keeps
    the two slice families disjoint even on the diagonal blocks. -/
def innerStrip (hn : 2 ≤ n) (width i : ℕ) : Selection n :=
  mkSelection hn (depths n ∩ {i}) ((block n width (band width i)).erase i)
    Finset.inter_subset_left ((Finset.erase_subset ..).trans (Finset.filter_subset ..))
    (Finset.disjoint_left.mpr (fun _ hr hc => (Finset.mem_erase.mp hc).1
      (Finset.mem_singleton.mp (Finset.mem_inter.mp hr).2)))

noncomputable def word (hn : 2 ≤ n) (width : ℕ) (active : ℕ → ℕ → Bool) (w : List (Move 6)) :=
  ((List.range (side n / width + 1)).flatMap fun k => (outerStrip hn width k).stripWord active w) ++
  ((depths n).toList.flatMap fun i => (innerStrip hn width i).stripWord active w)

theorem action (hn : 2 ≤ n) {width : ℕ} (active : ℕ → ℕ → Bool)
    {stage w} (h : (stage,w) ∈ tableRows) (d : Depths n) (j : Fin 24) :
    walk (word hn width active w) (pointMap d.embed (wire j.val)) =
      pointMap d.embed (wire (if active d.row d.col then output stage j else j).val) := by
  let p := fun j : Fin 24 => pointMap d.embed (wire j.val)
  let row := band width d.row
  let col := band width d.col
  have hr : d.row ∈ depths n := mem_depths.mpr ⟨d.row_pos,d.row_inner⟩
  have hc : d.col ∈ depths n := mem_depths.mpr ⟨d.col_pos,d.col_inner⟩
  have hrow : row ∈ List.range (side n / width + 1) := by
    have hy := (Finset.mem_Icc.mp hr).2
    exact List.mem_range.mpr (Nat.lt_add_one_of_le (Nat.div_le_div_right (by omega : d.row-1 ≤ side n)))
  have out k (i : Fin 24) :
      walk ((outerStrip hn width k).stripWord active w) (p i) =
        p (if k = row ∧ (col ≠ row ∧ active d.row d.col = true) then output stage i else i) := by
    rw [show p i = pointMap d.embed (wire i.val) from rfl,Selection.strip_action _ _ _ _ h]
    simp only [outerStrip,mkSelection,block,Finset.mem_filter,Finset.mem_sdiff,hr,hc,true_and,row,col,p]
    by_cases e : band width d.row = k
    · subst k; simp
    · simp [e,Ne.symm e]
  have inn k (i : Fin 24) :
      walk ((innerStrip hn width k).stripWord active w) (p i) =
        p (if k = d.row ∧ (col = row ∧ active d.row d.col = true) then output stage i else i) := by
    rw [show p i = pointMap d.embed (wire i.val) from rfl,Selection.strip_action _ _ _ _ h]
    simp only [innerStrip,mkSelection,block,Finset.mem_filter,Finset.mem_inter,Finset.mem_singleton,
      Finset.mem_erase,hr,hc,true_and,row,col,p]
    by_cases e : d.row = k
    · subst k; simp [d.distinct.symm]
    · simp [e,Ne.symm e]
  have a := walk_one_group _ _ _ _ _ out (List.range (side n / width + 1)) List.nodup_range j
  have b := fun i => walk_one_group _ _ _ _ _ inn _ (depths n).nodup_toList i
  unfold word
  rw [walk_append]
  change walk _ (walk _ (p j)) = _
  rw [a,b]
  simp only [hrow,true_and,Finset.mem_toList,hr]
  by_cases e : col = row <;> simp [e,p]

def budget (Y width : ℕ) := (Y/width+1) * (2*Y + 2^width*(20+8*width)) + Y*(56+2*width)

private theorem length_flatMap_le (l : List α) (f : α → List β) (K : ℕ)
    (h : ∀ x ∈ l, (f x).length ≤ K) : (l.flatMap f).length ≤ l.length*K := by
  induction l with
  | nil => simp
  | cons x l ih =>
    rw [List.flatMap_cons,List.length_append,List.length_cons,Nat.add_mul,Nat.one_mul,Nat.add_comm _ K]
    exact Nat.add_le_add (h x (by simp)) (ih (fun y hy => h y (by simp [hy])))

private theorem strip_cost_bound (s : Selection n) (active : ℕ → ℕ → Bool)
    {w stage} (h : (stage,w) ∈ tableRows) {R C : ℕ} (hr : s.rows.card ≤ R) (hc : s.cols.card ≤ C) :
    (s.stripWord active w).length ≤ 2*C + 2^R*(20+8*R) := by
  obtain ⟨ha,hb,he⟩ := appendixF_cost_profile (List.of_mem_zip h).2
  have ht := s.strip_length active w
  rw [he] at ht
  rw [Nat.add_comm] at ht
  exact ht.trans (Nat.add_le_add (Nat.mul_le_mul_left _ hc)
    (Nat.mul_le_mul (Nat.pow_le_pow_right (by decide) hr) (Nat.add_le_add ha (Nat.mul_le_mul hb hr))))

theorem length_le (hn : 2 ≤ n) (hw : 0 < width) (active : ℕ → ℕ → Bool)
    {stage w} (h : (stage,w) ∈ tableRows) : (word hn width active w).length ≤ budget (side n) width := by
  unfold word budget
  rw [List.length_append]
  apply Nat.add_le_add
  · have hh := length_flatMap_le (List.range (side n / width + 1)) _
        (2*side n + 2^width*(20+8*width)) (fun k _ =>
          strip_cost_bound (outerStrip hn width k) active h (block_card hw n k)
            ((Finset.card_le_card Finset.sdiff_subset).trans_eq (card_depths n)))
    simpa only [List.length_range] using hh
  · have hi i : (innerStrip hn width i).rows.card ≤ 1 := by
      simpa [innerStrip,mkSelection] using Finset.card_le_card (Finset.inter_subset_right (s₁ := depths n) (s₂ := {i}))
    have hh := length_flatMap_le (depths n).toList _ (56 + 2*width) (fun i _ => by
      have hx := strip_cost_bound (innerStrip hn width i) active h (hi i)
        ((Finset.card_le_card (Finset.erase_subset ..)).trans (block_card hw n (band width i)))
      simpa [Nat.add_comm] using hx)
    simpa only [Finset.length_toList,card_depths] using hh

end CubeDiameter.GridStage
