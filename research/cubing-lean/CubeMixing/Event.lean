module

public import CubeMixing.Inventory
public import CubeMixing.Counting

@[expose] public section

namespace CubeMixing
open Finset

abbrev Grade := Fin 25 × Fin 25

def gradePaths (g : Grade) : Nat := pathCount 24 g.2.val (g.1.val - g.2.val)

/-- Each selected normal form has larger 24-step probability than the reciprocal
    of the order of the physical cube group. -/
def selectedGrades : Finset Grade :=
  univ.filter fun g => g.2.val ≤ g.1.val ∧ 18^24 < 43252003274489856000 * gradePaths g

def gradeWords (g : Grade) : Finset (List Block) := classWords g.1 g.2

def eventForms : Finset (List Block) := selectedGrades.biUnion gradeWords

def eventWords : Finset (Fin 24 → Move) := univ.filter fun w => normalWord 24 w ∈ eventForms

private theorem distinct_grades : (selectedGrades : Set Grade).PairwiseDisjoint gradeWords := by
  intro i _ j _ hij
  apply Finset.disjoint_left.mpr
  intro w hi hj
  obtain ⟨_,h₁,h₂⟩ := (mem_classWords _ _ _).mp hi
  obtain ⟨_,h₃,h₄⟩ := (mem_classWords _ _ _).mp hj
  exact hij (Prod.ext (Fin.ext (h₁.symm.trans h₃)) (Fin.ext (h₂.symm.trans h₄)))

private theorem per_grade (g : Grade) :
    (∑ w ∈ gradeWords g, wordCount 24 w) = classSize g.1 g.2 * gradePaths g := by
  calc
    _ = ∑ _w ∈ gradeWords g, gradePaths g := by
      apply Finset.sum_congr rfl
      intro w hw
      obtain ⟨hn,hl,hs⟩ := (mem_classWords _ _ _).mp hw
      have sum := sum_sizes w
      have hd : doubles w = g.1.val - g.2.val := by omega
      simp [gradePaths, wordCount_eq_pathCount 24 (by decide) w hn, hs, hd]
    _ = _ := by simp [gradeWords, card_classWords]

private theorem total_forms :
    (∑ g ∈ selectedGrades, classSize g.1 g.2) = 1892777155494089392 := by decide +kernel

private theorem total_words :
    (∑ g ∈ selectedGrades, classSize g.1 g.2 * gradePaths g) =
        399695360270146915170628141056 := by decide +kernel

theorem card_eventForms : eventForms.card = 1892777155494089392 := by
  simpa [eventForms, card_biUnion distinct_grades, gradeWords, card_classWords] using total_forms

theorem card_eventWords : eventWords.card = 399695360270146915170628141056 := by
  calc
    _ = ∑ s ∈ eventForms, wordCount 24 s := by
      exact (Finset.sum_card_fiberwise_eq_card_filter univ eventForms (normalWord 24)).symm
    _ = ∑ g ∈ selectedGrades, ∑ s ∈ gradeWords g, wordCount 24 s :=
      Finset.sum_biUnion distinct_grades
    _ = _ := by simpa only [per_grade] using total_words

set_option linter.constructorNameAsVariable false in
theorem normalWord_mem_of_mem_eventWords (w : Fin 24 → Move) (hw : w ∈ eventWords) :
    normalWord 24 w ∈ eventForms := by
  unfold eventWords at hw
  rw [Finset.mem_filter] at hw
  exact hw.2

end CubeMixing
