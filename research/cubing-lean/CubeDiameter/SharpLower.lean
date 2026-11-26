module

public import CubeDiameter.Counting
public import CubeDiameter.Targets

@[expose] public section

namespace CubeDiameter
open Counting GridStage Filter
open scoped Topology

theorem countingConstant_eq : countingConstant = Real.log (colorsPerOrbit : ℝ) / Real.log 2 / 4 := by
  unfold countingConstant Real.logb
  congr 2
  norm_num [colorsPerOrbit,Nat.factorial]

private theorem count_lower_log (n k : ℕ) (hn : 6 ≤ n)
    (h : colorsPerOrbit ^ (side n*(side n-1)) ≤ (9*n+1)^k) :
    ((n:ℝ)-6)^2 * Real.log (colorsPerOrbit : ℝ) ≤
      4*(k : ℝ)*(Real.log 10 + Real.log n) := by
  have cast : (colorsPerOrbit : ℝ) ^ (side n*(side n-1)) ≤ (9*(n:ℝ)+1)^k := by exact_mod_cast h
  have hm : (1:ℝ) < colorsPerOrbit := by norm_num [colorsPerOrbit,Nat.factorial]
  have hl := Real.log_le_log (pow_pos (zero_lt_one.trans hm) _) cast
  simp only [Real.log_pow,Nat.cast_mul] at hl
  have hnR : (6:ℝ) ≤ n := by exact_mod_cast hn
  have ub : 9*(n:ℝ)+1 ≤ 10*n := by linarith
  have hu := Real.log_le_log (by positivity) ub
  rw [Real.log_mul (by norm_num) (by positivity)] at hu
  have hsz : n ≤ 2*(side n - 1) + 6 := by unfold side; omega
  have hsr : (n:ℝ) ≤ 2*((side n-1 : ℕ):ℝ)+6 := by exact_mod_cast hsz
  have sq := mul_self_le_mul_self (by linarith : 0 ≤ (n:ℝ)-6)
    (by linarith : (n:ℝ)-6 ≤ 2*((side n-1 : ℕ):ℝ))
  have hh : ((side n-1 : ℕ):ℝ) ≤ side n := by exact_mod_cast Nat.sub_le (side n) 1
  have hk : ((n:ℝ)-6)^2 ≤ 4*(side n:ℝ)*((side n-1:ℕ):ℝ) := by
    nlinarith [mul_le_mul_of_nonneg_right hh (by positivity : 0 ≤ ((side n-1:ℕ):ℝ))]
  have lower := mul_le_mul_of_nonneg_right hk (Real.log_pos hm).le
  have upper := mul_le_mul_of_nonneg_left hu (by positivity : 0 ≤ (k : ℝ))
  nlinarith only [lower,hl,upper]

noncomputable def lowerCoefficient (n : ℕ) :=
  (1-6/(n:ℝ))^2 * countingConstant / (1 + Real.log 10 / Real.log n)

theorem lowerCoefficient_of_count (n k : ℕ) (hn : 6 ≤ n)
    (h : colorsPerOrbit ^ (side n*(side n-1)) ≤ (9*n+1)^k) :
    lowerCoefficient n * scale n ≤ k := by
  have hnR : (6:ℝ) ≤ n := by exact_mod_cast hn
  have hN : (0:ℝ) < n := by linarith
  have hlog := Real.log_pos (by linarith : (1:ℝ) < n)
  have h10 := Real.log_pos (by norm_num : (1:ℝ)<10)
  have h2 := Real.log_pos (by norm_num : (1:ℝ)<2)
  have hsum : 0 < Real.log 10 + Real.log n := by positivity
  calc
    _ = ((n:ℝ)-6)^2 * Real.log (colorsPerOrbit : ℝ) / (4*(Real.log 10 + Real.log n)) := by
      unfold lowerCoefficient scale
      rw [countingConstant_eq,Real.logb]
      field_simp [hN.ne',hlog.ne',h2.ne',hsum.ne',show Real.log (n:ℝ)+Real.log 10 ≠ 0 by positivity]
      ring
    _ ≤ _ := (div_le_iff₀ (by positivity)).mpr (by nlinarith only [count_lower_log n k hn h])

theorem lowerCoefficient_bound (n : ℕ) (hn : 6 ≤ n) :
    lowerCoefficient n * scale n ≤ diameter n := lowerCoefficient_of_count _ _ hn (finite_lower n (by omega))

theorem lowerCoefficient_limit : Tendsto lowerCoefficient atTop (𝓝 countingConstant) := by
  have hx : Tendsto (fun n : ℕ => (6:ℝ)/n) atTop (𝓝 0) :=
    tendsto_const_nhds.div_atTop tendsto_natCast_atTop_atTop
  have hy : Tendsto (fun n : ℕ => Real.log 10/Real.log n) atTop (𝓝 0) :=
    tendsto_const_nhds.div_atTop (Real.tendsto_log_atTop.comp tendsto_natCast_atTop_atTop)
  unfold lowerCoefficient
  simpa only [Function.comp_def,Pi.div_def,sub_zero,one_pow,one_mul,add_zero,div_one] using
    ((((hx.const_sub 1).pow 2).mul_const countingConstant).div (hy.const_add 1) (by norm_num))

/-- The information-theoretic leading lower constant for the diameter of
    the actual slice-turn cube, obtained from independent legal colorings. -/
theorem sharp_lower (ε : ℝ) (he : 0 < ε) : ∃ N : ℕ, ∀ n ≥ N,
    (countingConstant-ε)*scale n ≤ diameter n := by
  apply eventually_atTop.mp
  filter_upwards [lowerCoefficient_limit.eventually_const_lt (by linarith : countingConstant-ε < countingConstant),
    eventually_ge_atTop 6] with n hc hn
  have hnR : (6:ℝ) ≤ n := by exact_mod_cast hn
  have hs : 0 ≤ scale n := div_nonneg (sq_nonneg _) (Real.logb_pos (by norm_num) (by linarith)).le
  exact (mul_le_mul_of_nonneg_right hc.le hs).trans (lowerCoefficient_bound n hn)

end CubeDiameter
