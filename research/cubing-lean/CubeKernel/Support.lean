module

public import Mathlib.Data.Finset.Card
public import Mathlib.Data.Finset.Max
public import Mathlib.Data.Fintype.Card
public import Mathlib.Logic.Equiv.Basic

/-! Two spare representatives suffice for objects with at most two depth labels. -/

@[expose] public section

namespace CubeKernel

/-- An invariant predicate on surface stickers is determined by the retained
ones when there are two fresh representatives beyond the labels of the word. -/
theorem check_on_retained {D P : Type} [DecidableEq D]
    (labels : P → Finset D) (swapPoint : D → D → P → P)
    (arity : ∀ p, (labels p).card ≤ 2)
    (swap_labels : ∀ a b p, labels (swapPoint a b p) = (labels p).image (Equiv.swap a b))
    (R C S U : Finset D) (k : ℕ)
    (spares : S ⊆ R) (inClass : S ⊆ C) (omitted : ∀ a, a ∉ R → a ∈ C)
    (nspares : k + 2 ≤ S.card) (used : U ⊆ R) (nused : U.card ≤ k)
    (good : P → Prop)
    (transport : ∀ a ∈ C, ∀ b ∈ C, a ∉ U → b ∉ U → ∀ p, good (swapPoint a b p) → good p)
    (inside : ∀ p, labels p ⊆ R → good p) : ∀ p, good p := by
  classical
  intro p
  generalize hm : (labels p \ R).card = m
  induction m using Nat.strong_induction_on generalizing p with
  | h m ih =>
    by_cases hp : labels p ⊆ R
    · exact inside p hp
    obtain ⟨a, ha, har⟩ := Finset.not_subset.mp hp
    have he := Finset.card_erase_add_one ha
    have hcap : (U ∪ (labels p).erase a).card < S.card := by
      have := Finset.card_union_le U ((labels p).erase a)
      have := arity p
      omega
    obtain ⟨b, hb⟩ := Finset.sdiff_nonempty_of_card_lt_card hcap
    obtain ⟨hbs, hbu⟩ := Finset.mem_sdiff.mp hb
    have hbr := spares hbs
    have hbn : b ∉ U := fun he => hbu (Finset.mem_union_left _ he)
    have hbt : b ∉ (labels p).erase a := fun he => hbu (Finset.mem_union_right _ he)
    have hab : a ≠ b := fun h => har (h ▸ hbr)
    have hbp : b ∉ labels p := fun h => hbt (Finset.mem_erase.mpr ⟨Ne.symm hab,h⟩)
    apply transport a (omitted a har) b (inClass hbs) (fun h => har (used h)) hbn p
    apply ih (labels (swapPoint a b p) \ R).card _ _ rfl
    have hsub : labels (swapPoint a b p) \ R ⊆ (labels p \ R).erase a := by
      intro z hz
      obtain ⟨hzlab,hzr⟩ := Finset.mem_sdiff.mp hz
      rw [swap_labels] at hzlab
      obtain ⟨x,hx,rfl⟩ := Finset.mem_image.mp hzlab
      by_cases hxa : x = a
      · subst x
        exact False.elim (hzr (by simpa using hbr))
      · have hxb : x ≠ b := fun h => hbp (h ▸ hx)
        rw [Equiv.swap_apply_of_ne_of_ne hxa hxb] at hzr ⊢
        exact Finset.mem_erase.mpr ⟨hxa,Finset.mem_sdiff.mpr ⟨hx,hzr⟩⟩
    have hle := Finset.card_le_card hsub
    have hlt := Finset.card_erase_add_one (Finset.mem_sdiff.mpr ⟨ha,har⟩)
    omega

end CubeKernel
