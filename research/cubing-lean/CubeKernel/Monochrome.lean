module

public import CubeKernel.ColorTargets

/-! A solve to six monochromatic faces may assign the six colours to faces
in any order. The direction of the solving word is the inverse of the
word used to pull back the solved colouring in the diameter model. -/

@[expose] public section
namespace CubeKernel.Physical.PackedCube

abbrev faceOf (p : Sticker D o) : StickerColor := (p.1,p.2.1)
abbrev facelet (p : Sticker (Fin r) o) : CubeDiameter.Point (order r o) := pointIndex (chart p)

@[simp] theorem facelet_solved (p : Sticker (Fin r) o) :
    CubeDiameter.solved (order r o) (facelet p) = some (faceOf p) := by
  rw [facelet,index_solved]
  rcases p with ⟨a,b,i,j⟩
  fin_cases a <;> rfl

theorem extend_facelet (y : Colors (Fin r) o) (p : Sticker (Fin r) o) :
    extend y (facelet p) = y p := congrFun (observe_extend y) p

private theorem rotated (a : Fin 3) (p : Sticker D o) :
    ∃ q : Sticker D o, rotate a (chart p) = chart q := by
  rcases p with ⟨f,b,i,j⟩
  fin_cases a <;> fin_cases f <;> first
    | exact ⟨(0,_,_,_),rfl⟩
    | exact ⟨(1,_,_,_),rfl⟩
    | exact ⟨(2,_,_,_),rfl⟩

private theorem walk_chart [DecidableEq D] (w : List (Turn D o)) (p : Sticker D o) :
    ∃ q : Sticker D o, walk w (chart p) = chart q := by
  have qt (a : Fin 3) (l : Slice D o) (s : Sticker D o) :
      ∃ q, quarter a l (chart s) = chart q := by
    unfold quarter; split
    · exact rotated a s
    · exact ⟨s,rfl⟩
  have st (m : Turn D o) (s : Sticker D o) : ∃ q, step m (chart s) = chart q := by
    rcases m with ⟨a,l,t⟩
    obtain ⟨s₁,h₁⟩ := qt a l s
    obtain ⟨s₂,h₂⟩ := qt a l s₁
    obtain ⟨s₃,h₃⟩ := qt a l s₂
    fin_cases t <;> simp [step,h₁,h₂,h₃]
  induction w generalizing p with
  | nil => exact ⟨p,rfl⟩
  | cons m w ih =>
    obtain ⟨q,hq⟩ := st m p
    simpa only [walk_cons,hq] using ih q

private def named (w : List (CubeDiameter.Move (order r o))) : List (Turn (Fin r) o) :=
  w.map (turnEquiv r o).symm

private theorem turnIndex_named (w : List (CubeDiameter.Move (order r o))) :
    (named w).map turnIndex = w := by
  simp only [named,List.map_map]
  have h : turnIndex ∘ (turnEquiv r o).symm = id :=
    funext fun m => (turnEquiv r o).apply_symm_apply m
  simp [h]

theorem walk_facelet (w : List (CubeDiameter.Move (order r o))) (p : Sticker (Fin r) o) :
    ∃ q : Sticker (Fin r) o, CubeDiameter.walk w (facelet p) = facelet q := by
  obtain ⟨q,hq⟩ := walk_chart (named w) p
  exact ⟨q,by rw [← turnIndex_named w,facelet,index_walk,hq]⟩

private theorem short_on_faces (y : Colors (Fin r) o) (k : Nat) :
    Short y k ↔ ∃ w : List (CubeDiameter.Move (order r o)), w.length ≤ k ∧
      ∀ p, CubeDiameter.paint w (facelet p) = y p := by
  constructor
  · rintro ⟨w,hl,rfl⟩
    exact ⟨w.map turnIndex,by simpa using hl,index_paint w⟩
  · rintro ⟨w,hl,hw⟩
    refine ⟨named w,by simpa [named] using hl,funext fun p => ?_⟩
    rw [← index_paint,turnIndex_named]
    exact hw p

/-- Each face has a single colour after the word, and different faces have
different colours. The universal variable visits every one of the six grids. -/
def SolvesToDistinctFaces (x : PackedCube) (k : Nat) : Prop :=
  ∃ w : List (CubeDiameter.Move (order x.depthCount x.odd)), w.length ≤ k ∧
    ∃ c : StickerColor → StickerColor, Function.Injective c ∧ ∀ p,
      extend x.colors (CubeDiameter.walk w (facelet p)) = some (c (faceOf p))

theorem short_relabel_iff_solves (x : PackedCube) (ρ : Equiv.Perm StickerColor) (k : Nat) :
    Short (fun p => some (ρ (unpack x.faces p))) k ↔
      ∃ u : List (CubeDiameter.Move (order x.depthCount x.odd)), u.length ≤ k ∧ ∀ p,
        extend x.colors (CubeDiameter.walk u (facelet p)) = some (ρ.symm (faceOf p)) := by
  rw [short_on_faces]
  constructor
  · rintro ⟨w,hl,hw⟩
    refine ⟨CubeDiameter.inverseWord w,by simpa [CubeDiameter.inverseWord] using hl,?_⟩
    intro p
    obtain ⟨q,hq⟩ := walk_facelet (CubeDiameter.inverseWord w) p
    have undo := CubeDiameter.walk_inverse (CubeDiameter.inverseWord w) (facelet p)
    rw [CubeDiameter.inverseWord_involutive,hq] at undo
    have e := hw q
    change CubeDiameter.solved _ (CubeDiameter.walk w (facelet q)) = some (ρ _) at e
    rw [undo,facelet_solved] at e
    rw [hq,extend_facelet]
    exact congrArg some ((ρ.eq_symm_apply).mpr (Option.some.inj e).symm)
  · rintro ⟨u,hl,hu⟩
    refine ⟨CubeDiameter.inverseWord u,by simpa [CubeDiameter.inverseWord] using hl,?_⟩
    intro p
    obtain ⟨q,hq⟩ := walk_facelet (CubeDiameter.inverseWord u) p
    have undo := CubeDiameter.walk_inverse (CubeDiameter.inverseWord u) (facelet p)
    rw [CubeDiameter.inverseWord_involutive,hq] at undo
    have e := hu q
    rw [undo,extend_facelet] at e
    change some (unpack x.faces p) = some (ρ.symm (faceOf q)) at e
    change CubeDiameter.solved _ (CubeDiameter.walk (CubeDiameter.inverseWord u) (facelet p)) = _
    rw [hq,facelet_solved]
    exact congrArg some ((ρ.eq_symm_apply.mp (Option.some.inj e)).symm)

/-- The colour-enumerating kernel answers precisely the conventional six
monochromatic, distinct faces question on an arbitrary dense physical input. -/
theorem monochrome_iff_distinct_faces (x : PackedCube) (k : Nat) :
    SolvableMonochrome x k ↔ SolvesToDistinctFaces x k := by
  have short_eq (ρ : Equiv.Perm StickerColor) :
      Short (recolor ρ x).colors k ↔ Short (fun p => some (ρ (unpack x.faces p))) k := by
    exact Iff.of_eq (congrArg (fun y : Colors (Fin x.depthCount) x.odd => Short y k) (recolor_colors ρ x))
  constructor
  · rintro ⟨ρ,hs⟩
    obtain ⟨w,hl,hw⟩ := (short_relabel_iff_solves x ρ k).mp ((short_eq ρ).mp hs)
    exact ⟨w,hl,ρ.symm,ρ.symm.injective,hw⟩
  · rintro ⟨w,hl,c,hi,hc⟩
    let e : Equiv.Perm StickerColor := Equiv.ofBijective c ⟨hi,Finite.surjective_of_injective hi⟩
    exact ⟨e.symm,(short_eq _).mpr ((short_relabel_iff_solves x e.symm k).mpr ⟨w,hl,hc⟩)⟩

theorem kernel_distinct_faces_correct (x : PackedCube) (k : Nat) :
    match kernel x k with
    | none => ¬ SolvesToDistinctFaces x k
    | some y => y.odd = x.odd ∧ order y.depthCount y.odd ≤ 4*k+7 ∧
        y.stickerCount ≤ 6*(4*k+7)^2 ∧ (SolvesToDistinctFaces x k ↔ SolvesToDistinctFaces y k) := by
  have h := kernel_monochrome_correct x k
  cases hk : kernel x k <;> simpa only [hk,monochrome_iff_distinct_faces] using h

theorem decide_distinct_faces_iff (x : PackedCube) (k : Nat) :
    decideMonochrome x k = true ↔ SolvesToDistinctFaces x k :=
  (decideMonochrome_correct x k).trans (monochrome_iff_distinct_faces x k)

end CubeKernel.Physical.PackedCube
