module

public import CubeMixing.Event
public import CubeMixing.Walk

/-! Push the counted normal forms onto the actual face-turn group. Different
forms can land in the same physical position. This decreases the uniform mass
upper bound and preserves the random-walk mass lower bound. -/
@[expose] public section
namespace CubeMixing
open Finset
open scoped Classical

noncomputable def physicalEvent : Finset faceGroup := eventForms.image evalBlocks

private theorem count_image (t : ℕ) (W : Finset (Fin t → Move)) (S : Finset (List Block))
    (h : ∀ w ∈ W, normalWord t w ∈ S) :
    W.card ≤ eventCount t (S.image evalBlocks) := by
  apply card_le_eventCount
  intro w hw
  rw [position_eq_normal]
  exact mem_image_of_mem _ (h w hw)

theorem count_physicalEvent : 399695360270146915170628141056 ≤ eventCount 24 physicalEvent :=
  calc
    _ = eventWords.card := card_eventWords.symm
    _ ≤ _ := count_image 24 eventWords eventForms normalWord_mem_of_mem_eventWords

theorem card_physicalEvent : physicalEvent.card ≤ 1892777155494089392 := by
  rw [← card_eventForms]
  exact card_image_le

def excess24 : ℚ := 2696588658879280033237343 / 10578732486636654821376000

theorem quarter_lt_excess24 : (1:ℚ)/4 < excess24 := by decide +kernel

theorem variation_of_group_size (hk : 43252003274489856000 ≤ Nat.card faceGroup) :
    excess24 ≤ totalVariation 24 := by
  have hp : (399695360270146915170628141056 : ℚ) / 18^24 ≤ probability 24 physicalEvent :=
    div_le_div_of_nonneg_right (by exact_mod_cast count_physicalEvent) (by positivity)
  have hs : (physicalEvent.card : ℚ) ≤ 1892777155494089392 := by exact_mod_cast card_physicalEvent
  have hg : (43252003274489856000 : ℚ) ≤ Nat.card faceGroup := by exact_mod_cast hk
  have hu : uniform physicalEvent ≤ (1892777155494089392 : ℚ)/43252003274489856000 := by
    calc
      _ ≤ (physicalEvent.card : ℚ) / 43252003274489856000 :=
        div_le_div_of_nonneg_left (by positivity) (by norm_num) hg
      _ ≤ _ := div_le_div_of_nonneg_right hs (by positivity)
  refine le_trans ?_ (event_excess_le 24 physicalEvent)
  calc
    excess24 = (399695360270146915170628141056 : ℚ)/18^24 -
               1892777155494089392/43252003274489856000 := by decide +kernel
    _ ≤ _ := sub_le_sub hp hu

end CubeMixing
