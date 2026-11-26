module

public import CubeDiameter.Main

@[expose] public section

namespace CubeDiameter
open Counting GridStage Filter
open scoped Topology

noncomputable def ball (n k : ℕ) : Finset (Position n) := by
  classical exact Finset.univ.filter (fun s => distance s ≤ k)

/-- The size of every radius-k ball about the solved coloring. -/
theorem ball_count (n k : ℕ) : (ball n k).card ≤ (9*n+1)^k := by
  classical
  let all := (Finset.univ : Finset (Fin k → Option (Move n))).image decode
  have sub : ball n k ⊆ all := by
    intro s hs
    have hle := (Finset.mem_filter.mp hs).2
    obtain ⟨w,hw,hp⟩ := optimal_word s
    let pad := w.map some ++ List.replicate (k-w.length) none
    have hlen : pad.length = k := by simp [pad]; omega
    let seq := fun i : Fin k => pad.get (i.cast hlen.symm)
    refine Finset.mem_image.mpr ⟨seq,Finset.mem_univ _,Subtype.ext ?_⟩
    have he : List.ofFn seq = pad := by apply List.ext_getElem <;> simp [seq,hlen]
    change paint ((List.ofFn seq).filterMap id) = _
    rw [he]; simpa [pad,List.filterMap_append,List.filterMap_replicate] using hp
  have hc : all.card ≤ Fintype.card (Fin k → Option (Move n)) :=
    Finset.card_image_le.trans_eq Finset.card_univ
  simpa only [Fintype.card_fun,Fintype.card_option,card_moves,Fintype.card_fin] using (Finset.card_le_card sub).trans hc

/-- Fraction of legal colorings optimally solvable in at most
    floor((countingConstant - ε) * n² / log₂ n) moves. -/
noncomputable def easyFraction (ε : ℝ) (n : ℕ) : ℝ :=
  ((ball n ⌊(countingConstant-ε)*scale n⌋₊).card : ℝ) / Fintype.card (Position n)

/-- Under the uniform distribution on legal colored positions, the proportion
    below any fixed positive loss from the leading lower constant tends to zero. -/
theorem almost_all_lower (ε : ℝ) (he : 0 < ε) (he' : ε < countingConstant) :
    Tendsto (easyFraction ε) atTop (𝓝 0) := by
  have hu : ∀ᶠ n : ℕ in atTop, easyFraction ε n ≤ (1:ℝ)/n := by
    filter_upwards [lowerCoefficient_limit.eventually_const_lt
      (by linarith : countingConstant-ε/2 < countingConstant),
      linear_overhead 1 (ε/2) (by positivity),eventually_ge_atTop 6] with n hc room hn
    have hnR : (6:ℝ) ≤ n := by exact_mod_cast hn
    have hsc : 0 < scale n := div_pos (pow_pos (by linarith) _) (Real.logb_pos (by norm_num) (by linarith))
    let k := ⌊(countingConstant-ε)*scale n⌋₊
    have hf : (k:ℝ) ≤ (countingConstant-ε)*scale n := Nat.floor_le (mul_nonneg (by linarith) hsc.le)
    have hw : (k:ℝ)+1 < lowerCoefficient n * scale n := by
      have hh := mul_lt_mul_of_pos_right hc hsc
      nlinarith only [hh,hf,room,hnR]
    have hgap : (9*n+1)^(k+1) < colorsPerOrbit^(side n*(side n-1)) := by
      by_contra! h
      have hh := lowerCoefficient_of_count n (k+1) hn h
      push_cast at hh; linarith
    have hcub := (hgap.le.trans (legal_count n (by omega)))
    rw [pow_succ] at hcub
    have hm : (ball n k).card * n ≤ Fintype.card (Position n) :=
      (Nat.mul_le_mul (ball_count n k) (by omega : n ≤ 9*n+1)).trans hcub
    have hpos : 0 < Fintype.card (Position n) := by
      let s : Position n := ⟨paint [],[],rfl⟩
      exact Fintype.card_pos_iff.mpr ⟨s⟩
    change ((ball n k).card:ℝ) / (Fintype.card (Position n):ℝ) ≤ 1/(n:ℝ)
    apply (div_le_div_iff₀ (by exact_mod_cast hpos) (by linarith)).mpr
    simpa only [one_mul] using (show ((ball n k).card:ℝ)*n ≤ (Fintype.card (Position n):ℝ) by exact_mod_cast hm)
  apply tendsto_of_tendsto_of_tendsto_of_le_of_le' tendsto_const_nhds
    (tendsto_const_nhds.div_atTop (tendsto_natCast_atTop_atTop (R := ℝ))) _ hu
  exact .of_forall (fun n => by unfold easyFraction; positivity)

/-- A strict comparison of the exact constants; no decimal approximation of
    a logarithm enters the proof. -/
theorem ratio_lt_237 : (61/2)/countingConstant < (237/100 : ℝ) := by
  have hm : (1:ℝ) < colorsPerOrbit := by norm_num [colorsPerOrbit,Nat.factorial]
  have h2 := Real.log_pos (by norm_num : (1:ℝ)<2)
  have hM := Real.log_pos hm
  have num : (2:ℕ)^12200 < colorsPerOrbit^237 := by decide +kernel
  have realnum : (2:ℝ)^12200 < (colorsPerOrbit:ℝ)^237 := by exact_mod_cast num
  have hl := Real.log_lt_log (by positivity) realnum
  rw [Real.log_pow,Real.log_pow] at hl
  rw [countingConstant_eq,div_lt_iff₀ (by positivity)]
  field_simp
  norm_num at hl
  linarith

/-- Proportion of positions whose optimal distance, multiplied by 2.37,
    falls below a uniform solution-length budget with leading coefficient A. -/
noncomputable def ratioFailures (A : ℝ) (n : ℕ) : ℝ := by
  classical exact (((Finset.univ : Finset (Position n)).filter (fun s =>
    (237/100 : ℝ)*distance s < A*scale n)).card : ℝ) / Fintype.card (Position n)

/-- A uniform upper budget exists which is at most 2.37 times the optimal
    distance for an asymptotically full proportion of legal positions. -/
theorem typical_factor_237 :
    ∃ η : ℝ, 0 < η ∧ (∀ᶠ n : ℕ in atTop, (diameter n : ℝ) ≤ (61/2+η)*scale n) ∧
      Tendsto (ratioFailures (61/2+η)) atTop (𝓝 0) := by
  classical
  have hc : 0 < countingConstant := by
    rw [countingConstant_eq]
    have hm : (1:ℝ) < colorsPerOrbit := by norm_num [colorsPerOrbit,Nat.factorial]
    exact div_pos (div_pos (Real.log_pos hm) (Real.log_pos (by norm_num))) (by norm_num)
  have hg := (div_lt_iff₀ hc).mp ratio_lt_237
  let gap := (237/100 : ℝ)*countingConstant - 61/2
  have hp : 0 < gap := by dsimp [gap]; linarith
  let δ := gap/10
  have hd : 0 < δ := by dsimp [δ]; positivity
  have hd' : δ < countingConstant := by dsimp [δ,gap]; linarith
  refine ⟨δ,hd,eventually_atTop.mpr (upper2026 δ hd),?_⟩
  have hbudget : (61/2+δ) ≤ (237/100 : ℝ)*(countingConstant-δ) := by dsimp [δ,gap]; linarith
  have le : ∀ᶠ n : ℕ in atTop, ratioFailures (61/2+δ) n ≤ easyFraction δ n := by
    filter_upwards [eventually_ge_atTop 2] with n hn
    have hnR : (2:ℝ) ≤ n := by exact_mod_cast hn
    have hs : 0 ≤ scale n := div_nonneg (sq_nonneg _) (Real.logb_pos (by norm_num) (by linarith)).le
    apply div_le_div_of_nonneg_right _ (by positivity)
    apply Nat.cast_le.mpr
    apply Finset.card_le_card
    intro s h
    apply Finset.mem_filter.mpr
    refine ⟨Finset.mem_univ _,Nat.le_floor ?_⟩
    have hh := (Finset.mem_filter.mp h).2
    have hu := mul_le_mul_of_nonneg_right hbudget hs
    nlinarith only [hh,hu]
  apply tendsto_of_tendsto_of_tendsto_of_le_of_le' tendsto_const_nhds (almost_all_lower δ hd hd') _ le
  exact .of_forall (fun _ => by unfold ratioFailures; positivity)

end CubeDiameter
