module

public import CubeDiameter.Phase

@[expose] public section

namespace CubeDiameter.Schedule
open Finset Network

def Preserves (g : Reorder) (groups : List Wires) := ∀ s ∈ groups, imageOf g s = s

private theorem image_of_fixed (g : Reorder) (s : Wires) (h : ∀ i ∈ s, g i = i) : imageOf g s = s := by
  ext x
  change x ∈ s.map g.toEmbedding ↔ _
  rw [mem_map]
  constructor
  · rintro ⟨y,hy,rfl⟩; simpa [h y hy] using hy
  · intro hx; exact ⟨x,hx,h x hx⟩

private theorem image_of_fixed_outside (g : Reorder) (s : Wires) (h : ∀ i ∉ s, g i = i) :
    imageOf g s = s := by
  ext x
  change x ∈ s.map g.toEmbedding ↔ _
  rw [mem_map_equiv]
  by_cases hx : x ∈ s
  · have hg : g.symm x ∈ s := by
      by_contra hf
      have hh := h _ hf
      rw [g.apply_symm_apply] at hh
      exact hf (hh ▸ hx)
    simp [hx,hg]
  · have hh : g.symm x = x := g.injective (by rw [g.apply_symm_apply,h x hx])
    simp [hh]

def Refines (f : Phase) (prev next : List Wires) : Prop :=
  f.domain ∈ prev ∧ f.left ⊆ f.domain ∧ ∀ s ∈ next,
    s = f.left ∨ s = f.right ∨ (s ∈ prev ∧ Disjoint s f.domain)

theorem Phase.refine_groups (f : Phase) (g : Reorder) (prev next : List Wires)
    (hp : Preserves g prev) (ht : Refines f prev next) :
    ∃ p : LocalProgram, p.map Prod.fst = f.levels ∧ Preserves (g.trans (motion p)) next := by
  have dom := hp f.domain ht.1
  have sub : imageOf g f.left ⊆ f.domain := (image_mono g ht.2.1).trans_eq dom
  have card : (imageOf g f.left).card = f.take := by simp [Phase.left]
  obtain ⟨p,hp',hleft,hout⟩ := f.split sub card
  have stay := image_of_fixed_outside _ _ hout
  have hdom : imageOf (g.trans (motion p)) f.domain = f.domain := by rw [image_trans,dom,stay]
  have hle : imageOf (g.trans (motion p)) f.left = f.left := by rw [image_trans,hleft]
  refine ⟨p,hp',?_⟩
  intro s hs
  rcases ht.2.2 s hs with rfl | rfl | ⟨hprev,hdisj⟩
  · exact hle
  · change (f.domain \ f.left).map _ = _
    rw [map_sdiff]; exact congrArg₂ (fun a b : Wires => a \ b) hdom hle
  · rw [image_trans,hp s hprev]
    exact image_of_fixed _ _ (fun i hi => hout i (Finset.disjoint_left.mp hdisj hi))

/-- A face contributes four wires. With the paper's orientation change the
    first face split from FR is R, and the first split from BD is D. -/
def face (f : ℕ) : Wires := Ico (4*f) (4*f+4)

private def initialGroups : List Wires := [range 24]
private def groups1 : List Wires := [range 8,Ico 8 24]
private def groups2 : List Wires := [range 8,Ico 8 16,Ico 16 24]
private def groups3 : List Wires := [face 0,face 1,Ico 8 16,Ico 16 24]
private def groups4 : List Wires := [face 0,face 1,face 2,face 3,Ico 16 24]
def faces : List Wires := [face 0,face 1,face 2,face 3,face 4,face 5]

private theorem verify {f : Phase} {a b : List Wires}
    (h : decide (f.domain ∈ a) && decide (f.left ⊆ f.domain) && b.all (fun s =>
      decide (s = f.left ∨ s = f.right ∨ (s ∈ a ∧ Disjoint s f.domain))) = true) : Refines f a b := by
  simpa [Refines,List.all_eq_true,and_assoc] using h

/-- Every arrangement obtained by permuting the 24 slots can be separated
    into six face-color classes, with all other wires irrelevant. -/
theorem sort_faces (g : Reorder) (hg : imageOf g (range 24) = range 24) :
    ∃ p : LocalProgram, p.map Prod.fst = levels ∧ Preserves (g.trans (motion p)) faces := by
  have init : Preserves g initialGroups := by simpa [Preserves,initialGroups] using hg
  obtain ⟨a,ha,ga⟩ := Phase.refine_groups ⟨0,0⟩ _ _ groups1 init (verify (by decide +kernel))
  obtain ⟨b,hb,gb⟩ := Phase.refine_groups ⟨1,1⟩ _ _ groups2 ga (verify (by decide +kernel))
  obtain ⟨c,hc,gc⟩ := Phase.refine_groups ⟨2,0⟩ _ _ groups3 gb (verify (by decide +kernel))
  obtain ⟨d,hd,gd⟩ := Phase.refine_groups ⟨2,1⟩ _ _ groups4 gc (verify (by decide +kernel))
  obtain ⟨e,he,ge⟩ := Phase.refine_groups ⟨2,2⟩ _ _ faces gd (verify (by decide +kernel))
  refine ⟨a ++ b ++ c ++ d ++ e,?_,?_⟩
  · simp only [List.map_append,ha,hb,hc,hd,he]; rfl
  · simpa only [motion_append, Equiv.trans_assoc] using ge

end CubeDiameter.Schedule
