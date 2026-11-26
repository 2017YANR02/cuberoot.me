module

public import CubeDiameter.Selection

@[expose] public section

namespace CubeDiameter.Rectangle
open Lift Network Representatives

namespace Selection
variable (s : Selection n)

/-- The three shallow families in table order: outside, row, column. -/
def domain : Fin 3 → Finset ℕ
  | 0 => {0}
  | 1 => s.rows
  | 2 => s.cols

def lowIndex (j : Fin 3) : Fin 6 := ⟨j.val, by have := j.isLt; omega⟩

private theorem lowVal (j : Fin 3) : (select (lowIndex j)).val = j.val := by fin_cases j <;> rfl

private theorem near_bound (i : ℕ) : (s.nearLabel i).val ≤ 3 := by
  unfold nearLabel
  split <;> first | decide | (split <;> first | decide | (split <;> decide))

private theorem near_eq (i : ℕ) (j : Fin 3) :
    s.nearLabel i = select (lowIndex j) ↔ i ∈ s.domain j := by
  have hr : 0 ∉ s.rows := fun h => (s.shallow 0 (Finset.mem_union_left _ h)).1.false
  have hc : 0 ∉ s.cols := fun h => (s.shallow 0 (Finset.mem_union_right _ h)).1.false
  by_cases h0 : i = 0
  · subst i; fin_cases j <;> simp [nearLabel,select,lowIndex,domain,hr,hc]
  · by_cases h1 : i ∈ s.rows
    · have h2 : i ∉ s.cols := Finset.disjoint_left.mp s.disjoint h1
      fin_cases j <;> simp [nearLabel,select,lowIndex,domain,h0,h1,h2]
    · by_cases h2 : i ∈ s.cols <;>
        fin_cases j <;> simp [nearLabel,select,lowIndex,domain,h0,h1,h2]

private theorem domain_shallow (j : Fin 3) (i : ℕ) (h : i ∈ s.domain j) : 2*i+1 < n := by
  fin_cases j
  · have : i = 0 := by simpa [domain] using h
    have := s.size; omega
  · exact (s.shallow i (Finset.mem_union_left _ h)).2
  · exact (s.shallow i (Finset.mem_union_right _ h)).2

private theorem label_eq (i : Fin n) (j : Fin 3) :
    s.label i = select (lowIndex j) ↔ i.val ∈ s.domain j := by
  by_cases hn : i < i.rev
  · simpa [label,hn] using s.near_eq i.val j
  · have hno : i.val ∉ s.domain j := by
      intro h
      have hh := s.domain_shallow j i.val h
      apply hn
      simp only [Fin.lt_def,Fin.rev]; omega
    simp only [hno, iff_false,label,ite_eq_right hn]
    split
    · intro h
      have hh := congrArg Fin.val h
      have hb := s.near_bound i.rev.val
      rw [lowVal] at hh
      simp only [Fin.rev] at hh hb
      have := j.isLt
      omega
    · intro h
      have hh := congrArg Fin.val h
      rw [lowVal] at hh
      have := j.isLt
      change 3 = j.val at hh
      omega

private theorem layers_card (j : Fin 6) :
    (s.batch.layers j).length = (s.batch.layers j).toFinset.card := by
  exact (List.toFinset_card_of_nodup ((List.nodup_finRange n).filter _)).symm

theorem length_low (j : Fin 3) :
    (s.batch.layers (lowIndex j)).length = (s.domain j).card := by
  rw [s.layers_card, ← Finset.card_image_of_injective _ Fin.val_injective]
  congr 1
  ext x
  simp only [Finset.mem_image,List.mem_toFinset,Batch.layers,List.mem_filter,List.mem_finRange,
    true_and,beq_iff_eq]
  change (∃ a : Fin n, s.label a = select (lowIndex j) ∧ a.val = x) ↔ _
  constructor
  · rintro ⟨a,ha,rfl⟩; exact (s.label_eq a j).mp ha
  · intro h
    have := s.domain_shallow j x h
    exact ⟨⟨x,by omega⟩,(s.label_eq _ j).mpr h,rfl⟩

theorem length_rev (j : Fin 6) : (s.batch.layers j.rev).length = (s.batch.layers j).length := by
  rw [s.layers_card,s.layers_card,← Finset.card_image_of_injective _ (Fin.revPerm (n := n)).injective]
  congr 1
  ext i
  have he (z : Fin 6) : select z.rev = (select z).rev := by fin_cases z <;> rfl
  simp only [Finset.mem_image,List.mem_toFinset,Batch.layers,List.mem_filter,List.mem_finRange,
    true_and,beq_iff_eq]
  change (∃ a : Fin n, s.label a = select j.rev ∧ a.rev = i) ↔ s.label i = select j
  constructor
  · rintro ⟨a,ha,rfl⟩; simp [s.label_rev, ha, he]
  · intro hi; exact ⟨i.rev, by rw [s.label_rev,hi,he], Fin.rev_rev _⟩

end Selection

/-- Classify each occurrence, counting both sides of the cube. -/
def family (j : Fin 6) : Fin 3 := ⟨min j.val j.rev.val, by
  have := j.isLt; simp only [Fin.rev]; omega⟩

def occurrences (w : List (Move 6)) (k : Fin 3) := w.countP (fun m => family m.2.1 == k)

/-- Exact cost in single-layer STM moves. -/
theorem length_expand (s : Selection n) (w : List (Move 6)) :
    (s.batch.expand w).length = occurrences w 0 + occurrences w 1 * s.rows.card +
      occurrences w 2 * s.cols.card := by
  have h (i : Fin 6) : (s.batch.layers i).length = (s.domain (family i)).card := by
    have hlo := s.length_low
    have hhi := s.length_rev
    fin_cases i
    · exact hlo 0
    · exact hlo 1
    · exact hlo 2
    · exact (hhi (Selection.lowIndex 2)).trans (hlo 2)
    · exact (hhi (Selection.lowIndex 1)).trans (hlo 1)
    · exact (hhi (Selection.lowIndex 0)).trans (hlo 0)
  induction w with
  | nil => simp [Batch.expand,occurrences]
  | cons m w ih =>
    change (s.batch.word m ++ s.batch.expand w).length = _
    rw [List.length_append,ih,Batch.word,List.length_map,h]
    simp only [occurrences,List.countP_cons]
    generalize family m.2.1 = k
    fin_cases k <;> simp [Selection.domain, Nat.add_mul] <;> omega

/-- Concrete bounds on the number of occurrences in each family, including
    the exact coefficient of the long dimension of a strip. -/
theorem appendixF_cost_profile {w : List (Move 6)} (hw : w ∈ words24 ++ words16 ++ words8) :
    occurrences w 0 ≤ 20 ∧ occurrences w 1 ≤ 8 ∧ occurrences w 2 = 2 := by
  have h : (words24 ++ words16 ++ words8).all (fun w =>
    decide (occurrences w 0 ≤ 20 ∧ occurrences w 1 ≤ 8 ∧ occurrences w 2 = 2)) = true := by decide +kernel
  exact of_decide_eq_true (List.all_eq_true.mp h w hw)

end CubeDiameter.Rectangle
