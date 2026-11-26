module

public import CubeDiameter.Bounds

@[expose] public section

namespace CubeDiameter

/-- The two-sided diameter growth statement proved by `paper2011` in Main. -/
def Paper2011 : Prop :=
  ∃ c C : ℝ, 0 < c ∧ 0 < C ∧ ∃ N, ∀ n ≥ N,
    c * scale n ≤ diameter n ∧ (diameter n : ℝ) ≤ C * scale n

noncomputable def countingConstant : ℝ :=
  Real.logb 2 ((Nat.factorial 24 : ℝ) / (Nat.factorial 4 : ℝ)^6) / 4

def Paper2026 : Prop := ∀ ε : ℝ, 0 < ε → ∃ N, ∀ n ≥ N,
  (countingConstant - ε) * scale n ≤ diameter n ∧
  (diameter n : ℝ) ≤ (61/2 + ε) * scale n

end CubeDiameter
