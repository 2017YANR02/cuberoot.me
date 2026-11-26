module

public import CubeDiameter.ColorRouting

@[expose] public section

namespace CubeDiameter.Schedule
open Lift Network Rectangle Representatives Finset

private theorem map_injective {f : Fin (m+2) → Fin (n+2)} (h : Function.Injective f) :
    Function.Injective (pointMap f) := by
  rintro ⟨x,y,z⟩ ⟨a,b,c⟩ he
  obtain ⟨hx,hy,hz⟩ := Prod.mk.inj he |>.imp_right Prod.mk.inj
  exact Prod.ext (h hx) (Prod.ext (h hy) (h hz))

theorem sticker_injective (d : Depths n) : Function.Injective (sticker d) := by
  have hw : Function.Injective (fun i : Fin 24 => wire i.val) := by decide +kernel
  exact (map_injective d.embed_injective).comp hw

private theorem step_closed (d : Depths n) (m : Move n) (i : Fin 24) :
    ∃ j : Fin 24, step m (sticker d i) = sticker d j := by
  have hc : ∀ (m : Move 6) (i : Fin 24), ∃ j : Fin 24, step m (wire i.val) = wire j.val := by decide +kernel
  rcases m with ⟨a,k,t⟩
  by_cases hit : ∃ l, d.slice l = k
  · obtain ⟨l,rfl⟩ := hit
    obtain ⟨j,hj⟩ := hc (a,l,t) i
    exact ⟨j,(d.step_embed (a,l,t) _).trans (congrArg (pointMap d.embed) hj)⟩
  · have hn : 0 < n := (Nat.zero_le _).trans_lt k.isLt
    have ho (u : Fin 8) : owner hn (d.embed u) = d.slice (owner (by decide) u) := by
      have h := d.onLayer_embed (owner (by decide) u) u
      simpa [onLayer_owner hn,onLayer_owner (n := 6) (by decide)] using h
    have miss : onLayer k (coord a (sticker d i)) = false := by
      simp only [sticker,coord_map,onLayer_owner hn,ho,decide_eq_false_iff_not]
      exact fun he => hit ⟨_,he⟩
    exact ⟨i,by fin_cases t <;> simp [step,twist,miss]⟩

theorem walk_closed (d : Depths n) (w : List (Move n)) (i : Fin 24) :
    ∃ j : Fin 24, walk w (sticker d i) = sticker d j := by
  induction w generalizing i with
  | nil => exact ⟨i,rfl⟩
  | cons m w ih =>
    obtain ⟨j,hj⟩ := step_closed d m i
    rw [walk_cons,hj]; exact ih j

noncomputable def orbitPerm (d : Depths n) (w : List (Move n)) : Equiv.Perm (Fin 24) := by
  let f := fun i => (walk_closed d w i).choose
  have spec i : walk w (sticker d i) = sticker d (f i) := (walk_closed d w i).choose_spec
  have hi : Function.Injective f := by
    intro i j h
    apply sticker_injective d
    calc
      _ = walk (inverseWord w) (walk w (sticker d i)) := (walk_inverse ..).symm
      _ = walk (inverseWord w) (walk w (sticker d j)) := by rw [spec,spec,h]
      _ = _ := walk_inverse ..
  exact Equiv.ofBijective f ⟨hi,Finite.surjective_of_injective hi⟩

theorem orbitPerm_spec (d : Depths n) (w : List (Move n)) (i : Fin 24) :
    walk w (sticker d i) = sticker d (orbitPerm d w i) := (walk_closed d w i).choose_spec

def small : Fin 24 ≃ {x : ℕ // x < 24} := ⟨fun i => ⟨i.val,i.isLt⟩,
  fun i => ⟨i.val,i.property⟩, fun _ => rfl, fun _ => rfl⟩

def extend (g : Equiv.Perm (Fin 24)) : Reorder := g.extendDomain small

theorem extend_agrees (g : Equiv.Perm (Fin 24)) (i : Fin 24) : extend g i.val = (g i).val :=
  Equiv.Perm.extendDomain_apply_image g small i

theorem extend_preserves (g : Equiv.Perm (Fin 24)) : imageOf (extend g) (range 24) = range 24 := by
  ext x
  change x ∈ (range 24).map _ ↔ _
  rw [mem_map]
  constructor
  · rintro ⟨k,hk,rfl⟩
    let i : Fin 24 := ⟨k,mem_range.mp hk⟩
    apply mem_range.mpr
    change extend g i.val < 24
    rw [extend_agrees]; exact (g i).isLt
  · intro hx
    let i : Fin 24 := ⟨x,mem_range.mp hx⟩
    refine ⟨(g.symm i).val,mem_range.mpr (g.symm i).isLt,?_⟩
    change extend g _ = x
    rw [extend_agrees,g.apply_symm_apply]

private theorem boundary_embed (d : Depths n) (u : Fin 8) : boundary (d.embed u) = boundary u := by
  have hr := d.row_inner
  have hc := d.col_inner
  have hp := d.row_pos
  have hq := d.col_pos
  fin_cases u <;> simp [boundary,Depths.embed,Depths.slice,layer,Fin.rev,Fin.ext_iff] <;>
    omega

theorem solved_sticker (d : Depths n) (i : Fin 24) : solved n (sticker d i) = solved 6 (wire i.val) := by
  unfold sticker pointMap solved
  simp only [boundary_embed]

theorem same_face_color (d : Depths n) {i j : Fin 24} {f : Wires}
    (hf : f ∈ faces) (hi : i.val ∈ f) (hj : j.val ∈ f) :
    solved n (sticker d i) = solved n (sticker d j) := by
  have cert : faces.all (fun F => (List.finRange 24).all (fun a => (List.finRange 24).all
    (fun b => decide (a.val ∈ F → b.val ∈ F → solved 6 (wire a.val) = solved 6 (wire b.val))))) = true := by
    decide +kernel
  have h := List.all_eq_true.mp cert f hf
  rw [solved_sticker,solved_sticker]
  exact (of_decide_eq_true (List.all_eq_true.mp (List.all_eq_true.mp h i (List.mem_finRange i))
    j (List.mem_finRange j))) hi hj

theorem in_face (i : Fin 24) : ∃ f ∈ faces, i.val ∈ f := by revert i; decide +kernel

end CubeDiameter.Schedule
