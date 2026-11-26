module

public import CubeDiameter.GridStage
public import Mathlib.Analysis.SpecialFunctions.Pow.Asymptotics

@[expose] public section

namespace CubeDiameter.GridStage
open Filter Lift Network Representatives Rectangle
open scoped Topology

private theorem budget_le (Y w : ℕ) (hw : 0 < w) :
    budget Y w ≤ (Y/w)*(2*Y) + 2*Y + 28*(Y+w)*2^w + Y*(56+2*w) := by
  have h := Nat.mul_le_mul_left ((Y/w+1)*2^w) (show 20+8*w ≤ 28*w by omega)
  have k := Nat.mul_le_mul_right (28*2^w) (Nat.div_mul_le_self Y w)
  unfold budget
  nlinarith only [h,k]

private theorem real_budget (n w : ℕ) (hw : 0 < w) (a : ℝ)
    (hwN : (w : ℝ) ≤ n) (hpow : (2:ℝ)^w ≤ (n:ℝ)^a)
    (hwA : (w:ℝ) ≤ (n:ℝ)^a) (hA : 1 ≤ (n:ℝ)^a) :
    (budget (side n) w : ℝ) ≤ (n:ℝ)^2 / (2*w) + 128*n*(n:ℝ)^a := by
  let Y := side n
  have hY : 2*Y ≤ n := by dsimp [Y,side]; omega
  have hYR : 2*(Y:ℝ) ≤ n := by exact_mod_cast hY
  have hwr : 0 < (w:ℝ) := by exact_mod_cast hw
  have hd : (Y/w : ℕ)*w ≤ Y := Nat.div_mul_le_self ..
  have hdr : ((Y/w:ℕ):ℝ) * w ≤ Y := by exact_mod_cast hd
  have hmajor : ((Y/w:ℕ):ℝ)*(2*Y) ≤ (n:ℝ)^2/(2*w) := by
    apply (le_div_iff₀ (by positivity)).mpr
    have sq := mul_self_le_mul_self (by positivity : 0 ≤ 2*(Y:ℝ)) hYR
    nlinarith [mul_le_mul_of_nonneg_right hdr (by positivity : 0 ≤ 4*(Y:ℝ))]
  have hb := budget_le Y w hw
  have hbr : (budget Y w : ℝ) ≤ ((Y/w:ℕ):ℝ)*(2*Y) + 2*Y +
      28*((Y:ℝ)+w)*2^w + Y*(56+2*(w:ℝ)) := by exact_mod_cast hb
  have h1 := mul_le_mul (show 28*((Y:ℝ)+w) ≤ 56*n by linarith) hpow
    (by positivity) (by positivity)
  have h2 := mul_le_mul (show (Y:ℝ) ≤ n by linarith) (show 56+2*(w:ℝ) ≤ 58*(n:ℝ)^a by linarith)
    (by positivity) (by positivity)
  have h3 := mul_le_mul_of_nonneg_left hA (by positivity : 0 ≤ (n:ℝ))
  exact hbr.trans (by nlinarith [hmajor,h1,h2,h3])

/-- A logarithm is eventually smaller than any fixed positive multiple of a
    positive power, also along the integer orders of cubes. -/
private theorem eventually_log_le (c t : ℝ) (hc : 0 < c) (ht : 0 < t) :
    ∀ᶠ n : ℕ in atTop, Real.logb 2 n ≤ c*(n:ℝ)^t := by
  have h2 : 0 < Real.log 2 := Real.log_pos (by norm_num)
  have h := (isLittleO_log_rpow_atTop ht).bound (mul_pos hc h2)
  filter_upwards [tendsto_natCast_atTop_atTop.eventually h, eventually_ge_atTop 2] with n he hn
  have hx : (1:ℝ) ≤ n := by exact_mod_cast (show 1 ≤ n by omega)
  simp only [Real.norm_eq_abs,abs_of_nonneg (Real.log_nonneg hx),
    abs_of_nonneg (Real.rpow_nonneg (by positivity : 0 ≤ (n:ℝ)) t)] at he
  rw [Real.logb,div_le_iff₀ h2]
  linarith

/-- For each tolerance the same strip width works for every stage and every
    mask. This is the one-half coefficient per stage in the 2026 argument. -/
theorem budget_asymptotic (ε : ℝ) (he : 0 < ε) :
    ∀ᶠ n : ℕ in atTop, ∃ w : ℕ, 0 < w ∧
      (budget (side n) w : ℝ) ≤ (1/2+ε)*scale n := by
  let b := 1/(1+ε)
  let a := (1+b)/2
  have hb : 0 < b := by dsimp [b]; positivity
  have hb1 : b < 1 := by dsimp [b]; rw [div_lt_iff₀ (by positivity)]; linarith
  have ha : 0 < a := by dsimp [a]; linarith
  have hab : 0 < a-b := by dsimp [a]; linarith
  have ha1 : a < 1 := by dsimp [a]; linarith
  have hl : Tendsto (fun n : ℕ => Real.logb 2 n) atTop atTop :=
    (Real.tendsto_logb_atTop (by norm_num : (1:ℝ)<2)).comp tendsto_natCast_atTop_atTop
  filter_upwards [eventually_ge_atTop 2, hl.eventually_ge_atTop (1/(a-b)),
    eventually_log_le 1 a (by norm_num) ha,
    eventually_log_le (ε/256) (1-a) (by positivity) (by linarith)] with n hn hlower hu hv
  let L := Real.logb 2 n
  let w := ⌊a*L⌋₊
  have hnR : (2:ℝ) ≤ n := by exact_mod_cast hn
  have hL : 0 < L := Real.logb_pos (by norm_num) (by linarith)
  have hgap : 1 ≤ (a-b)*L := by
    simpa [mul_comm] using (div_le_iff₀ hab).mp hlower
  have hf : (w:ℝ) ≤ a*L := Nat.floor_le (by positivity)
  have hfr : a*L < (w:ℝ)+1 := Nat.lt_floor_add_one _
  have hwlo : b*L ≤ (w:ℝ) := by nlinarith
  have hwpos : 0 < (w:ℝ) := (mul_pos hb hL).trans_le hwlo
  have hw : 0 < w := by exact_mod_cast hwpos
  have hN : 0 < (n:ℝ) := by linarith
  have hP : 0 < (n:ℝ)^a := Real.rpow_pos_of_pos hN _
  have hp1 : 1 ≤ (n:ℝ)^a := Real.one_le_rpow (by linarith) ha.le
  have hpN : (n:ℝ)^a ≤ n := by
    simpa only [Real.rpow_one] using Real.rpow_le_rpow_of_exponent_le (by linarith : (1:ℝ)≤n) ha1.le
  have hwA : (w:ℝ) ≤ (n:ℝ)^a :=
    hf.trans ((mul_le_of_le_one_left hL.le ha1.le).trans (by simpa [L] using hu))
  have htw : (2:ℝ)^w ≤ (n:ℝ)^a := by
    rw [← Real.rpow_natCast]
    calc
      _ ≤ (2:ℝ)^(L*a) := Real.rpow_le_rpow_of_exponent_le (by norm_num) (by linarith)
      _ = _ := by dsimp [L]; rw [Real.rpow_mul (by norm_num),Real.rpow_logb (by norm_num) (by norm_num) hN]
  have hmain : (n:ℝ)^2/(2*w) ≤ ((1+ε)/2)*scale n := by
    have hh : L ≤ (1+ε)*(w:ℝ) := by
      have := mul_le_mul_of_nonneg_left hwlo (by positivity : 0 ≤ 1+ε)
      dsimp [b] at this
      field_simp [show 1+ε ≠ 0 by positivity] at this
      nlinarith
    change _ ≤ ((1+ε)/2)*((n:ℝ)^2/L)
    rw [← mul_div_assoc, div_le_div_iff₀ (by positivity) hL]
    nlinarith [mul_le_mul_of_nonneg_right hh (sq_nonneg (n:ℝ))]
  have hsmall : 128*(n:ℝ)*(n:ℝ)^a ≤ ε/2*scale n := by
    have heq : (n:ℝ)^a*(n:ℝ)^(1-a) = n := by
      rw [← Real.rpow_add hN]; ring_nf; simp
    have hem := mul_le_mul_of_nonneg_left hv (by positivity : 0 ≤ (n:ℝ)*(n:ℝ)^a)
    change _ ≤ ε/2*((n:ℝ)^2/L)
    rw [← mul_div_assoc, le_div_iff₀ hL]
    dsimp [L]
    nlinarith [congrArg (fun x : ℝ => ε*(n:ℝ)*x) heq]
  exact ⟨w,hw,(real_budget n w hw a (hwA.trans hpN) htw hwA hp1).trans
    (by linarith [hmain,hsmall])⟩

end CubeDiameter.GridStage
