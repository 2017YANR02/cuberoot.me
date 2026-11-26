module

public import CubeDiameter.NoSpill
public import CubeDiameter.SharpLower

@[expose] public section

namespace CubeDiameter
open Lift Schedule Rectangle GridStage Sparse Filter
open scoped Topology

/-- A word with the colors of a prescribed scramble on the whole cube.
    The linear term accounts for all non-generic pieces simultaneously. -/
theorem whole_cube_word (hn : 2 ≤ n) (hw : 0 < width) (scramble : List (Move n)) :
    ∃ short : List (Move n), short.length ≤ (2*n+1)*Compression.bound + 61*budget (side n) width ∧
      paint short = paint scramble := by
  have hn' : 0 < n := by omega
  obtain ⟨u,hlen,hsp⟩ := sparse_word hn' scramble
  let residual := inverseWord u ++ scramble
  obtain ⟨prog,hp,hr⟩ := route_colors (fun d => orbitPerm d residual)
  have hl : ∀ lm ∈ prog, lm.1 ∈ levels := fun lm hm => hp ▸ List.mem_map_of_mem hm
  let main := compile prog hn width
  have hlen' : prog.length = 61 := by simpa [levels_length] using congrArg List.length hp
  have hcost := compile_length prog hl hn hw
  rw [hlen'] at hcost
  have agrees : paint main = paint residual := by
    funext p
    by_cases he : HasEnd p
    · rcases sparse_or_generic hn' p he with hs | ⟨d,i,rfl⟩
      · have fix := compile_fixed hn width prog hp p he hs
        have hs' : SparseAt hn' (walk (inverseWord u) p) := by simpa only [SparseAt,has_walk] using hs
        have hi := walk_inverse (inverseWord u) p
        rw [inverseWord_involutive] at hi
        change solved n (walk (compile prog hn width) p) = solved n (walk (inverseWord u ++ scramble) p)
        rw [fix,walk_append,← hsp _ hs',hi]
      · change solved n (walk (compile prog hn width) (sticker d i)) = solved n (walk residual (sticker d i))
        rw [simulate prog hl hn width,hr,orbitPerm_spec]
    · rw [paint_no_end _ _ he,paint_no_end _ _ he]
  refine ⟨u ++ main,?_,?_⟩
  · rw [List.length_append]; exact Nat.add_le_add hlen hcost
  · funext p
    change solved n (walk (u ++ main) p) = _
    rw [walk_append]
    change paint main (walk u p) = _
    rw [agrees]
    change solved n (walk (inverseWord u ++ scramble) (walk u p)) = _
    rw [walk_append,walk_inverse]; rfl

theorem diameter_budget (hn : 2 ≤ n) (hw : 0 < width) :
    diameter n ≤ (2*n+1)*Compression.bound + 61*budget (side n) width := by
  classical
  apply Finset.sup_le
  intro s _
  obtain ⟨scramble,hs⟩ := s.property
  obtain ⟨w,hlen,he⟩ := whole_cube_word hn hw scramble
  exact (Nat.find_min' (has_length s) ⟨w,rfl,he.trans hs⟩).trans hlen

theorem linear_overhead (K : ℝ) (δ : ℝ) (hδ : 0 < δ) :
    ∀ᶠ n : ℕ in atTop, (2*(n:ℝ)+1)*K ≤ δ*scale n := by
  have hx : Tendsto (fun n : ℕ => (1:ℝ)/n) atTop (𝓝 0) :=
    tendsto_const_nhds.div_atTop tendsto_natCast_atTop_atTop
  have hy : Tendsto (fun n : ℕ => Real.log n/(n:ℝ)) atTop (𝓝 0) :=
    by simpa only [Real.rpow_one,Function.comp_def] using (isLittleO_log_rpow_atTop (by norm_num : (0:ℝ)<1)).tendsto_div_nhds_zero.comp (tendsto_natCast_atTop_atTop (R := ℝ))
  have hz : Tendsto (fun n : ℕ => (2+1/(n:ℝ))*K*(Real.log n/n)/Real.log 2) atTop (𝓝 0) := by
    simpa using (((hx.const_add 2).mul_const K).mul hy).div_const (Real.log 2)
  filter_upwards [hz.eventually_lt_const hδ,eventually_ge_atTop 2] with n h hn
  have hnR : (2:ℝ) ≤ n := by exact_mod_cast hn
  have hN : (0:ℝ) < n := by linarith
  have hlg := Real.log_pos (by linarith : (1:ℝ)<n)
  have h2 := Real.log_pos (by norm_num : (1:ℝ)<2)
  have hs : 0 ≤ scale n := div_nonneg (sq_nonneg _) (Real.logb_pos (by norm_num) (by linarith)).le
  calc
    _ = ((2+1/(n:ℝ))*K*(Real.log n/n)/Real.log 2)*scale n := by
      unfold scale; rw [Real.logb]; field_simp
    _ ≤ _ := mul_le_mul_of_nonneg_right h.le hs

/-- The 2026 leading upper coefficient in physical single-slice turns. -/
theorem upper2026 (ε : ℝ) (he : 0 < ε) : ∃ N : ℕ, ∀ n ≥ N,
    (diameter n : ℝ) ≤ (61/2+ε)*scale n := by
  apply eventually_atTop.mp
  filter_upwards [budget_asymptotic (ε/122) (by positivity),
    linear_overhead (Compression.bound : ℝ) (ε/2) (by positivity),eventually_ge_atTop 2]
    with n ⟨width,hw,hb⟩ hl hn
  have hc := diameter_budget hn hw
  have hreal : (diameter n : ℝ) ≤ (2*(n:ℝ)+1)*(Compression.bound:ℝ) + 61*(budget (side n) width : ℝ) := by
    exact_mod_cast hc
  linarith only [hreal,hl,hb]

/-- The two leading-constant inequalities for the whole n × n × n cube. -/
theorem paper2026 : Paper2026 := by
  intro ε he
  obtain ⟨A,ha⟩ := sharp_lower ε he
  obtain ⟨B,hb⟩ := upper2026 ε he
  exact ⟨max A B,fun n hn => ⟨ha n (le_max_left A B |>.trans hn),hb n (le_max_right A B |>.trans hn)⟩⟩

/-- The 2011 diameter growth rate, using the explicit upper construction. -/
theorem paper2011 : Paper2011 := by
  obtain ⟨N,hN⟩ := upper2026 1 (by norm_num)
  refine ⟨1/128,61/2+1,by norm_num,by norm_num,max 16 N,?_⟩
  intro n hn
  exact ⟨by simpa only [one_div,div_eq_inv_mul,mul_one] using lower2011 n ((le_max_left ..).trans hn),
    hN n ((le_max_right ..).trans hn)⟩

end CubeDiameter
