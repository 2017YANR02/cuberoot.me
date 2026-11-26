module

public import CubeMixing.Bound
public import CubeMixing.GroupSize

/-! Deterministic, finite counting lower bound on the mixing time of the
standard fixed-centre 3×3×3 cube under independent uniform face turns. -/
@[expose] public section
namespace CubeMixing

theorem tv24_lower : excess24 ≤ totalVariation 24 :=
  variation_of_group_size OrderCheck.faceGroup_card_lower

/-- At no time below 25 does total variation fall to one quarter. -/
theorem mixing_time_at_least_25 (t : ℕ) (ht : totalVariation t ≤ 1/4) : 25 ≤ t := by
  by_contra! h
  have h24 := variation_antitone (show t ≤ 24 by omega)
  exact (not_lt_of_ge ht) (quarter_lt_excess24.trans_le (tv24_lower.trans h24))

end CubeMixing
