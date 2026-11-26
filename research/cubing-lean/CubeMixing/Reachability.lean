module

public import CubeMixing.Walk

/-! Physical face-turn words and the states of the random walk. Products of
permutations act right-to-left. The slice model `CubeDiameter.walk` applies
its input list left-to-right, so the same pullback uses the reversed list. -/

@[expose] public section

namespace CubeMixing

def evalTurns : List Move → faceGroup
  | [] => 1
  | m :: w => turn m * evalTurns w

theorem evalTurns_append (v w : List Move) : evalTurns (v ++ w) = evalTurns v * evalTurns w := by
  induction v with
  | nil => simp [evalTurns]
  | cons m v ih => simp [evalTurns,ih,mul_assoc]

def undoTurn (m : Move) : Move := (m.1,m.2.1,m.2.2.rev)

theorem turn_undo (m : Move) : turn (undoTurn m) = (turn m)⁻¹ := by
  rcases m with ⟨a,h,t⟩
  apply eq_inv_of_mul_eq_one_left
  change generator a h ^ t.rev.succ.val * generator a h ^ t.succ.val = 1
  rw [← pow_add, show t.rev.succ.val + t.succ.val = 4 by fin_cases t <;> decide]
  exact generator_four a h

theorem evalTurns_undo (w : List Move) : evalTurns (w.reverse.map undoTurn) = (evalTurns w)⁻¹ := by
  induction w with
  | nil => simp [evalTurns]
  | cons m w ih =>
    rw [List.reverse_cons,List.map_append,evalTurns_append,ih]
    simp [evalTurns,turn_undo]

/-- The subgroup used for uniform measure consists exactly of ordinary
face-turn words. In particular every point of the uniform space is reachable. -/
theorem evalTurns_surjective : Function.Surjective evalTurns := by
  intro g
  have res : ∃ w : List Move, (evalTurns w).val = g.val := by
    refine Subgroup.closure_induction (p := fun g _ => ∃ w : List Move, (evalTurns w).val = g)
      ?_ ?_ ?_ ?_ g.property
    · rintro _ ⟨⟨a,h⟩,rfl⟩
      refine ⟨[(a,h,0)],?_⟩
      simp [evalTurns,turn,generator]
    · exact ⟨[],rfl⟩
    · rintro x y _ _ ⟨v,rfl⟩ ⟨w,rfl⟩
      exact ⟨v++w,by rw [evalTurns_append]; rfl⟩
    · rintro x _ ⟨w,rfl⟩
      exact ⟨w.reverse.map undoTurn,by rw [evalTurns_undo]; rfl⟩
  obtain ⟨w,hw⟩ := res
  exact ⟨w,Subtype.ext hw⟩

theorem position_eq_evalTurns (t : ℕ) (w : Fin t → Move) :
    position t w = evalTurns (List.ofFn w) := by
  induction t with
  | zero => rfl
  | succ t ih =>
    rw [position,List.ofFn_succ,evalTurns,ih]
    rfl

def physicalTurn (m : Move) : CubeDiameter.Move 3 := (m.1,if m.2.1 then 2 else 0,m.2.2)

private theorem generator_geometry (a : Fin 3) (h : Bool) (s : Sticker) :
    stickerPoint ((generator a h).val s) =
      CubeDiameter.twist a (if h then 2 else 0) (stickerPoint s) := face_geometry a h s

theorem turn_geometry (m : Move) (s : Sticker) :
    stickerPoint ((turn m).val s) = CubeDiameter.step (physicalTurn m) (stickerPoint s) := by
  rcases m with ⟨a,h,t⟩
  fin_cases t <;> simp [turn,physicalTurn,CubeDiameter.step,pow_succ,generator_geometry]

theorem word_geometry (w : List Move) (s : Sticker) :
    stickerPoint ((evalTurns w).val s) =
      CubeDiameter.walk (w.reverse.map physicalTurn) (stickerPoint s) := by
  induction w generalizing s with
  | nil => rfl
  | cons m w ih =>
    change stickerPoint ((turn m).val ((evalTurns w).val s)) = _
    simp [turn_geometry,List.map_append,CubeDiameter.walk_append,ih]

/-- Equality on each of the 54 observed colours, including face centres. -/
theorem visible_position_eq_paint (t : ℕ) (w : Fin t → Move) (s : Sticker) :
    some (visible (position t w) s) =
      CubeDiameter.paint ((List.ofFn w).reverse.map physicalTurn) (stickerPoint s) := by
  rw [position_eq_evalTurns]
  change some (faceColor ((evalTurns _).val s)) = CubeDiameter.solved 3 _
  rw [← solved_color,word_geometry]
  rfl

/-- A six-colour facelet observation is in the group's image exactly when
it is produced by an actual word of outer turns in the physical slice model. -/
theorem visible_range_iff_word (c : Sticker → FaceColor) :
    c ∈ Set.range visible ↔ ∃ w : List Move, ∀ s,
      some (c s) = CubeDiameter.paint (w.map physicalTurn) (stickerPoint s) := by
  constructor
  · rintro ⟨g,rfl⟩
    obtain ⟨w,rfl⟩ := evalTurns_surjective g
    refine ⟨w.reverse,fun s => ?_⟩
    change some (faceColor ((evalTurns w).val s)) = CubeDiameter.solved 3 _
    rw [← solved_color,word_geometry]
    rfl
  · rintro ⟨w,hw⟩
    refine ⟨evalTurns w.reverse,funext fun s => ?_⟩
    apply Option.some.inj
    change some (faceColor ((evalTurns w.reverse).val s)) = some (c s)
    rw [hw s, ← solved_color, word_geometry, List.reverse_reverse]
    rfl

end CubeMixing
