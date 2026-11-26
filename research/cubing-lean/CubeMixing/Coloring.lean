module

public import CubeMixing.Faces

/-! The 54 numbered facelets are coordinates. The actual visible state has six
colours. The colours on a cubie, together with one marked face colour,
determine that facelet uniquely on the solved 3×3×3. -/
@[expose] public section
namespace CubeMixing

abbrev FaceColor := Fin 3 × Bool

def faceColor (s : Sticker) : FaceColor :=
  (⟨s.val/18, by omega⟩, s.val / 9 % 2 == 1)

theorem solved_color : ∀ s, CubeDiameter.solved 3 (stickerPoint s) = some (faceColor s) := by
  decide

/-- Send the sentinel face coordinate into the outer layer carrying the sticker. -/
def pieceCoordinate (u : Fin 5) : ℕ := max 1 (min 3 u.val)

def pieceAt (s : Sticker) : ℕ × ℕ × ℕ :=
  let p := stickerPoint s
  (pieceCoordinate p.1, pieceCoordinate p.2.1, pieceCoordinate p.2.2)

private def PreservesPieces (p : Equiv.Perm Sticker) : Prop :=
  ∀ s t, pieceAt (p s) = pieceAt (p t) ↔ pieceAt s = pieceAt t

set_option maxHeartbeats 2200000 in
private theorem face_preserves : ∀ a b, PreservesPieces (face a b) := by
  unfold PreservesPieces
  decide +kernel

theorem same_piece (g : faceGroup) : ∀ x y,
    pieceAt (g.val x) = pieceAt (g.val y) ↔ pieceAt x = pieceAt y := by
  refine Subgroup.closure_induction (p := fun p _ => PreservesPieces p) ?_ ?_ ?_ ?_ g.property
  · rintro _ ⟨⟨a,b⟩,rfl⟩
    exact face_preserves a b
  · intro _ _; rfl
  · intro a b _ _ ha hb x y
    exact (ha (b x) (b y)).trans (hb x y)
  · intro a _ ha x y
    simpa using (ha (a.symm x) (a.symm y)).symm

def containsColor (s : Sticker) (c : FaceColor) : Prop :=
  ∃ t, pieceAt t = pieceAt s ∧ faceColor t = c

instance (s : Sticker) (c : FaceColor) : Decidable (containsColor s c) :=
  inferInstanceAs (Decidable (∃ t : Sticker, pieceAt t = pieceAt s ∧ faceColor t = c))

-- A cubie with two or three colours is identified by its colour set.
-- Marking one of these colours then recovers the individual facelet.
set_option maxHeartbeats 2200000 in
private theorem color_signature : ∀ s t : Sticker, faceColor s = faceColor t →
    (∀ c, containsColor s c ↔ containsColor t c) → s = t := by decide +kernel

def visible (g : faceGroup) : Sticker → FaceColor := faceColor ∘ g.val

theorem visible_injective : Function.Injective visible := by
  intro g h eq
  have pt (i : Sticker) : faceColor (g.val i) = faceColor (h.val i) := congrFun eq i
  have transport (a b : faceGroup) (hab : ∀ i, faceColor (a.val i) = faceColor (b.val i))
      (i : Sticker) (c : FaceColor) : containsColor (a.val i) c → containsColor (b.val i) c := by
    rintro ⟨u,hu,hc⟩
    let v := a.val.symm u
    have hv : a.val v = u := a.val.apply_symm_apply u
    refine ⟨b.val v, (same_piece b v i).mpr ((same_piece a v i).mp (hv ▸ hu)), ?_⟩
    exact (hab v).symm.trans ((congrArg faceColor hv).trans hc)
  apply Subtype.ext
  apply Equiv.ext
  intro s
  exact color_signature _ _ (pt s) (fun c => ⟨transport g h pt s c, transport h g (fun i => (pt i).symm) s c⟩)

/-- Every element of the face-turn group represents a different visible colouring. -/
noncomputable def visibleEquiv : faceGroup ≃ Set.range visible := Equiv.ofInjective visible visible_injective

end CubeMixing
