module

public import CubeKernel.Decision
public import CubeKernel.GeometryPhysical

/-! The short-solution kernel and its decision procedure on the same physical
positions and distances used by the diameter theorems. -/

@[expose] public section

namespace CubeKernel.Physical

variable {D E : Type} {o : Bool} {r : ℕ}

private theorem short_pull [DecidableEq D] [DecidableEq E] (e : E ≃ D)
    {x : Colors D o} {k : ℕ} (h : Short x k) : Short (x ∘ mapSticker e) k := by
  obtain ⟨w,hw,rfl⟩ := h
  refine ⟨w.map (mapTurn e.symm),by simpa using hw,funext ?_⟩
  intro p
  have hp := paint_embed e.symm e.symm.injective w (mapSticker e p)
  have hid : (e.symm : D → E) ∘ (e : E → D) = id := funext e.symm_apply_apply
  simpa only [mapSticker_comp,hid,mapSticker_id,Function.comp_apply] using hp

theorem short_pull_iff [DecidableEq D] [DecidableEq E] (e : E ≃ D) (x : Colors D o) (k : ℕ) :
    Short (x ∘ mapSticker e) k ↔ Short x k := by
  refine ⟨fun h => ?_,short_pull e⟩
  have hu := short_pull e.symm h
  have hid : (e : E → D) ∘ (e.symm : D → E) = id := funext e.apply_symm_apply
  have hx : (x ∘ mapSticker e) ∘ mapSticker e.symm = x := by
    funext p
    simp only [Function.comp_apply,mapSticker_comp,hid,mapSticker_id]
  rwa [hx] at hu

theorem distance_iff {n : ℕ} (s : CubeDiameter.Position n) (k : ℕ) :
    CubeDiameter.distance s ≤ k ↔
      ∃ w : List (CubeDiameter.Move n), w.length ≤ k ∧ CubeDiameter.paint w = s.val := by
  classical
  constructor
  · intro h
    obtain ⟨w,hw,he⟩ := CubeDiameter.optimal_word s
    exact ⟨w,hw ▸ h,he⟩
  · rintro ⟨w,hw,he⟩
    exact (Nat.find_min' (CubeDiameter.has_length s) ⟨w,rfl,he⟩).trans hw

theorem named_short_iff (s : CubeDiameter.Position (order r o)) (k : ℕ) :
    Short (observe s.val) k ↔ CubeDiameter.distance s ≤ k :=
  (within_legal_iff s.property k).trans (distance_iff s k).symm

/-- Renumber the retained mirror pairs in increasing order, making the
reduced input a conventional physical cube with consecutively numbered layers. -/
def reducedColors (s : CubeDiameter.State (order r o)) (R : Finset (Fin r)) :
    Colors (Fin R.card) o :=
  restrict R (observe s) ∘ mapSticker (R.orderIsoOfFin rfl).toEquiv

theorem reduced_short_iff (s : CubeDiameter.State (order r o)) (R : Finset (Fin r)) (k : ℕ) :
    Short (reducedColors s R) k ↔ Short (restrict R (observe s)) k :=
  short_pull_iff (R.orderIsoOfFin rfl).toEquiv _ _

/-- Projection of any physical scramble is legal, even when its length is
larger than the search budget or this particular set of names is arbitrary. -/
def reducedPosition (s : CubeDiameter.Position (order r o)) (R : Finset (Fin r)) :
    CubeDiameter.Position (order R.card o) :=
  ⟨extend (reducedColors s.val R), by
    have hin := (named_short_iff s (CubeDiameter.distance s)).mpr (Nat.le_refl _)
    have hred := (reduced_short_iff s.val R _).mpr (short_restrict R hin)
    obtain ⟨w,_,hw⟩ := (within_iff (reducedColors s.val R) _).mp hred
    exact ⟨w,hw⟩⟩

private theorem reduced_distance_iff (s : CubeDiameter.Position (order r o)) (R : Finset (Fin r)) (k : ℕ) :
    CubeDiameter.distance (reducedPosition s R) ≤ k ↔ Short (restrict R (observe s.val)) k :=
  (distance_iff (reducedPosition s R) k).trans
    ((within_iff (reducedColors s.val R) k).symm.trans (reduced_short_iff s.val R k))

theorem decideShort_iff (s : CubeDiameter.Position (order r o)) (k : ℕ) :
    decideShort (observe s.val) k = true ↔ CubeDiameter.distance s ≤ k :=
  (decideShort_correct _ _).trans (named_short_iff s k)

/-- For all cube orders at least two (`order_of_size`), either reject or
return a legal physical position of the same parity and side at most 4k+7
with exactly the same answer to the distance-k question. -/
theorem physical_kernel (s : CubeDiameter.Position (order r o)) (k : ℕ) :
    match retained (observe s.val) k with
    | none => k < CubeDiameter.distance s
    | some R => 2 ≤ order R.card o ∧ order R.card o ≤ 4*k+7 ∧
        (CubeDiameter.distance s ≤ k ↔ CubeDiameter.distance (reducedPosition s R) ≤ k) := by
  have h := short_solution_kernel (observe s.val) k
  cases hr : retained (observe s.val) k with
  | none =>
    simp only [hr] at h
    exact Nat.lt_of_not_ge (fun hs => h ((named_short_iff s k).mpr hs))
  | some R =>
    simp only [hr] at h
    have hord : order R.card o = side R.card o := by cases o <;> rfl
    exact ⟨by unfold order; omega,hord ▸ h.1,
      (named_short_iff s k).symm.trans (h.2.trans (reduced_distance_iff s R k).symm)⟩

end CubeKernel.Physical
