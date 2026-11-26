module

public import CubeMixing.Main

/-! The random walk observed as six actual sticker colours on the 54
facelets. Events run over all reachable visible colourings. -/

@[expose] public section

namespace CubeMixing

open Finset
open scoped Classical

abbrev VisibleState := Set.range visible

noncomputable instance visibleFintype : Fintype VisibleState :=
  Fintype.ofEquiv faceGroup visibleEquiv

def visiblePosition (t : Nat) (w : Fin t → Move) : VisibleState :=
  ⟨visible (position t w), position t w, rfl⟩

theorem visiblePosition_eq (t : Nat) (w : Fin t → Move) :
    visiblePosition t w = visibleEquiv (position t w) := rfl

noncomputable def colorProbability (t : Nat) (E : Finset VisibleState) : ℚ :=
  (univ.filter fun w : Fin t → Move => visiblePosition t w ∈ E).card / (18 : ℚ)^t

noncomputable def colorUniform (E : Finset VisibleState) : ℚ :=
  E.card / (Nat.card VisibleState : ℚ)

noncomputable def colorTotalVariation (t : Nat) : ℚ :=
  univ.sup' univ_nonempty (fun E : Finset VisibleState => colorProbability t E - colorUniform E)

noncomputable def colorPreimage (E : Finset VisibleState) : Finset faceGroup :=
  E.map visibleEquiv.symm.toEmbedding

noncomputable def colorImage (E : Finset faceGroup) : Finset VisibleState :=
  E.map visibleEquiv.toEmbedding

theorem mem_colorPreimage (E : Finset VisibleState) (g : faceGroup) :
    g ∈ colorPreimage E ↔ visibleEquiv g ∈ E := by
  simp [colorPreimage]

theorem colorPreimage_image (E : Finset faceGroup) : colorPreimage (colorImage E) = E := by
  ext x
  rw [mem_colorPreimage]
  simp [colorImage]

theorem colorProbability_preimage (t : Nat) (E : Finset VisibleState) :
    colorProbability t E = probability t (colorPreimage E) := by
  have h : (univ.filter fun w : Fin t → Move => visiblePosition t w ∈ E) =
      (univ.filter fun w : Fin t → Move => position t w ∈ colorPreimage E) := by
    ext w
    constructor
    · intro hw
      exact Finset.mem_filter.mpr ⟨mem_univ _, (mem_colorPreimage E _).mpr (Finset.mem_filter.mp hw).2⟩
    · intro hw
      exact Finset.mem_filter.mpr ⟨mem_univ _, (mem_colorPreimage E _).mp (Finset.mem_filter.mp hw).2⟩
  unfold colorProbability probability eventCount
  rw [h]

theorem colorUniform_preimage (E : Finset VisibleState) : colorUniform E = uniform (colorPreimage E) := by
  unfold colorUniform uniform
  rw [← (Nat.card_congr visibleEquiv : Nat.card faceGroup = Nat.card VisibleState)]
  simp [colorPreimage]

theorem colorTotalVariation_eq (t : Nat) : colorTotalVariation t = totalVariation t := by
  apply le_antisymm
  · unfold colorTotalVariation
    apply Finset.sup'_le
    intro E _
    rw [colorProbability_preimage, colorUniform_preimage]
    exact event_excess_le _ _
  · unfold totalVariation
    apply Finset.sup'_le
    intro E _
    have h := Finset.le_sup' (fun F : Finset VisibleState => colorProbability t F - colorUniform F)
      (mem_univ (colorImage E))
    rw [colorProbability_preimage, colorUniform_preimage, colorPreimage_image] at h
    exact h

theorem eventCount_univ (t : Nat) : eventCount t univ = 18^t := by
  have hm : Fintype.card Move = 18 := by decide
  simp [eventCount, hm]

theorem probability_univ (t : Nat) : probability t univ = 1 := by
  simp [probability,eventCount_univ]

theorem uniform_univ : uniform univ = 1 := by
  simp [uniform, Nat.card_eq_fintype_card]

theorem color_laws_mass_one (t : Nat) : colorProbability t univ = 1 ∧ colorUniform univ = 1 := by
  have h : colorPreimage univ = univ := by ext x; simp [mem_colorPreimage]
  rw [colorProbability_preimage,colorUniform_preimage,h]
  exact ⟨probability_univ t,uniform_univ⟩

theorem visible_tv24_lower : excess24 ≤ colorTotalVariation 24 := by
  rw [colorTotalVariation_eq]
  exact tv24_lower

theorem visible_mixing_time_at_least_25 (t : Nat) (ht : colorTotalVariation t ≤ 1/4) : 25 ≤ t :=
  mixing_time_at_least_25 t ((colorTotalVariation_eq t) ▸ ht)

end CubeMixing
