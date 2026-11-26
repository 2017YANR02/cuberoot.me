module

public import CubeKernel.Packed
public import Mathlib.Data.Fintype.Perm

/-! Short solutions allowing each face to be monochromatic in any order of
the six colours. A single reduction suffices for every assignment of colours
to faces because layer twins depend only on equality of sticker colours. -/

@[expose] public section

namespace CubeKernel

variable {D : Type} {o : Bool}

def renameColor (ρ : Equiv.Perm (Fin 3 × Bool)) (x : Physical.Colors D o) :
    Physical.Colors D o := fun p => (x p).map ρ

theorem twins_renameColor [DecidableEq D] (ρ : Equiv.Perm (Fin 3 × Bool))
    (x : Physical.Colors D o) (a b : D) : Twins (renameColor ρ x) a b ↔ Twins x a b := by
  constructor
  · intro h p
    exact ρ.optionCongr.injective (h p)
  · intro h p
    exact congrArg (Option.map ρ) (h p)

private theorem twinClass_rename [Fintype D] [DecidableEq D] (ρ : Equiv.Perm (Fin 3 × Bool))
    (x : Physical.Colors D o) (a : D) : twinClass (renameColor ρ x) a = twinClass x a := by
  ext b
  simp [twinClass,twins_renameColor]

private theorem candidates_rename [Fintype D] [DecidableEq D] (ρ : Equiv.Perm (Fin 3 × Bool))
    (x : Physical.Colors D o) (k : ℕ) : candidates (renameColor ρ x) k = candidates x k := by
  simp [candidates,twinClass_rename]

theorem retained_renameColor [Fintype D] [LinearOrder D] (ρ : Equiv.Perm (Fin 3 × Bool))
    (x : Physical.Colors D o) (k : ℕ) : retained (renameColor ρ x) k = retained x k := by
  simp only [retained,candidates_rename,twinClass_rename]

namespace Physical.PackedCube

/-- Apply the same colour permutation to all six face arrays. -/
def recolor (ρ : Equiv.Perm StickerColor) (x : PackedCube) : PackedCube :=
  ⟨x.depthCount,x.odd,pack (ρ ∘ unpack x.faces)⟩

theorem recolor_colors (ρ : Equiv.Perm StickerColor) (x : PackedCube) :
    (recolor ρ x).colors = renameColor ρ x.colors := by
  funext p
  simp [colors,renameColor,recolor,Function.comp_def]

theorem recolor_colors_apply (ρ : Equiv.Perm StickerColor) (x : PackedCube)
    (p : Sticker (Fin x.depthCount) x.odd) : (recolor ρ x).colors p = (x.colors p).map ρ :=
  congrFun (recolor_colors ρ x) p

private theorem keep_recolor (ρ : Equiv.Perm StickerColor) (x : PackedCube)
    (R : Finset (Fin x.depthCount)) : keep (recolor ρ x) R = recolor ρ (keep x R) := by
  simp only [keep,recolor,unpack_pack]
  rfl

theorem kernel_recolor (ρ : Equiv.Perm StickerColor) (x : PackedCube) (k : ℕ) :
    kernel (recolor ρ x) k = (kernel x k).map (recolor ρ) := by
  change ((retained (D := Fin x.depthCount) (odd := x.odd) (recolor ρ x).colors k).map (keep (recolor ρ x))) =
    ((retained x.colors k).map (keep x)).map (recolor ρ)
  rw [recolor_colors,retained_renameColor ρ x.colors k]
  cases retained x.colors k with
  | none => rfl
  | some R => exact congrArg some (keep_recolor ρ x R)

/-- Some assignment of six distinct colours to the six solved faces admits
a solution within the move budget. -/
def SolvableMonochrome (x : PackedCube) (k : ℕ) : Prop :=
  ∃ ρ : Equiv.Perm StickerColor, Short (recolor ρ x).colors k

theorem kernel_monochrome_correct (x : PackedCube) (k : ℕ) :
    match kernel x k with
    | none => ¬ SolvableMonochrome x k
    | some y => y.odd = x.odd ∧ order y.depthCount y.odd ≤ 4*k+7 ∧
        y.stickerCount ≤ 6*(4*k+7)^2 ∧ (SolvableMonochrome x k ↔ SolvableMonochrome y k) := by
  cases hk : kernel x k with
  | none =>
    rintro ⟨ρ,hρ⟩
    have h := kernel_correct (recolor ρ x) k
    simp only [kernel_recolor,hk,Option.map_none] at h
    exact h hρ
  | some y =>
    have h := kernel_correct x k
    simp only [hk] at h
    refine ⟨h.1,h.2.1,h.2.2.1,exists_congr (fun ρ => ?_)⟩
    have hρ := kernel_correct (recolor ρ x) k
    simp only [kernel_recolor,hk,Option.map_some] at hρ
    exact hρ.2.2.2

/-- Enumerate, on the single reduced instance, at most 6! possible palettes. -/
def decideMonochrome (x : PackedCube) (k : ℕ) : Bool :=
  match kernel x k with
  | none => false
  | some y =>
    letI : Fintype (Equiv.Perm StickerColor) := fintypePerm
    decide (∃ ρ : Equiv.Perm StickerColor, search (recolor ρ y).colors [] k = true)

theorem palette_count : Fintype.card (Equiv.Perm StickerColor) = 720 := by
  rw [Fintype.card_perm]
  decide

theorem decideMonochrome_correct (x : PackedCube) (k : ℕ) :
    decideMonochrome x k = true ↔ SolvableMonochrome x k := by
  have h := kernel_monochrome_correct x k
  unfold decideMonochrome
  cases hk : kernel x k with
  | none =>
    simp only [hk] at h
    simp [h]
  | some y =>
    simp only [hk] at h
    rw [h.2.2.2]
    simp [SolvableMonochrome,search_correct,Short]

end Physical.PackedCube

end CubeKernel
