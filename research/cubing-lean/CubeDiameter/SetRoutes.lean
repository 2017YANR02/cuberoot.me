module

public import CubeDiameter.MaskRouting

@[expose] public section

namespace CubeDiameter.Network
open Finset

def Valid (d : ℕ) (stage : Stage) := ∀ ab ∈ stage, ab.1 ≤ ab.2 ∧ ab.2 < d

private theorem swap_bounded {a b : ℕ} (ha : a < d) (hb : b < d) {s : Finset ℕ} (hs : s ⊆ range d) :
    s.map (Equiv.swap a b).toEmbedding ⊆ range d := by
  intro x hx
  obtain ⟨y,hy,rfl⟩ := mem_map.mp hx
  have hh := mem_range.mp (hs hy)
  by_cases hya : y = a <;> by_cases hyb : y = b <;>
    simp_all [Equiv.swap_apply_def]

theorem perm_bounded (stage : Stage) (hv : Valid d stage) (hs : s ⊆ range d) :
    s.map (perm stage).toEmbedding ⊆ range d := by
  induction stage generalizing s with
  | nil => simpa [perm] using hs
  | cons ab ss ih =>
    obtain ⟨ha,hb⟩ := hv ab (by simp)
    rw [show (perm (ab::ss)).toEmbedding =
      (Equiv.swap ab.1 ab.2).toEmbedding.trans (perm ss).toEmbedding from rfl,← map_map]
    exact ih (fun a h => hv a (by simp [h])) (swap_bounded (ha.trans_lt hb) hb hs)

theorem act_mask (stage : Stage) (hv : Valid d stage) (hs : s ⊆ range d) :
    act d stage (mask s) = mask (s.map (perm stage).toEmbedding) := by
  induction stage generalizing s with
  | nil => simp [act,perm]
  | cons ab ss ih =>
    obtain ⟨ha,hb⟩ := hv ab (by simp)
    change act d ss (swapIndex d ab.1 ab.2 (mask s)) = _
    rw [swap_mask hs _ _ ha, ih (fun a h => hv a (by simp [h])) (swap_bounded (ha.trans_lt hb) hb hs)]
    rw [map_map]; rfl

abbrev Choices := List (Stage × Bool)

def chosen : Choices → Equiv.Perm ℕ
  | [] => Equiv.refl ℕ
  | (s,true)::q => (perm s).trans (chosen q)
  | (_,false)::q => chosen q

theorem route_subset {ss : List Stage} (hv : ∀ stage ∈ ss, Valid d stage)
    {s t : Finset ℕ} (hs : s ⊆ range d) (h : Routes d ss (mask s) (mask t)) :
    ∃ q : Choices, q.map Prod.fst = ss ∧ s.map (chosen q).toEmbedding = t := by
  induction ss generalizing s with
  | nil =>
    have nil_eq {x y : ℕ} (hn : Routes d [] x y) : x = y := by cases hn; rfl
    have eq := nil_eq h
    exact ⟨[], rfl, by simpa [chosen] using (Finset.geomSum_injective (by decide : 2 ≤ 2) eq)⟩
  | cons st ss ih =>
    have ht := fun a (ha : a ∈ ss) => hv a (by simp [ha])
    have hh := hv st (by simp)
    cases h with
    | skip h =>
      obtain ⟨q,hq,he⟩ := ih ht hs h
      exact ⟨(st,false)::q, by simp [hq], he⟩
    | take h =>
      rw [act_mask st hh hs] at h
      obtain ⟨q,hq,he⟩ := ih ht (perm_bounded st hh hs) h
      refine ⟨(st,true)::q,by simp [hq],?_⟩
      rw [map_map] at he
      exact he

private theorem checkValid {d : ℕ} {ss : List Stage}
    (h : ss.all (fun s => s.all fun ab => decide (ab.1 ≤ ab.2 ∧ ab.2 < d)) = true) :
    ∀ stage ∈ ss, Valid d stage := by
  simpa [Valid,List.all_eq_true] using h

theorem split24_subsets {s : Finset ℕ} (hb : s ⊆ range 24) (hc : s.card = 8) :
    ∃ q : Choices, q.map Prod.fst = split24 ∧ s.map (chosen q).toEmbedding = range 8 := by
  apply route_subset (d := 24) (checkValid (by decide +kernel)) hb
  have hm : mask (range 8) = 255 := by decide +kernel
  rw [hm]; exact split24_routes _ (mask_lt hb) ((weight_mask hb).trans hc)

theorem split16_subsets {s : Finset ℕ} (hb : s ⊆ range 16) (hc : s.card = 8) :
    ∃ q : Choices, q.map Prod.fst = split16 ∧ s.map (chosen q).toEmbedding = range 8 := by
  apply route_subset (d := 16) (checkValid (by decide +kernel)) hb
  have hm : mask (range 8) = 255 := by decide +kernel
  rw [hm]; exact split16_routes _ (mask_lt hb) ((weight_mask hb).trans hc)

theorem split8_subsets {s : Finset ℕ} (hb : s ⊆ range 8) (hc : s.card = 4) :
    ∃ q : Choices, q.map Prod.fst = split8 ∧ s.map (chosen q).toEmbedding = range 4 := by
  apply route_subset (d := 8) (checkValid (by decide +kernel)) hb
  have hm : mask (range 4) = 15 := by decide +kernel
  rw [hm]; exact split8_routes _ (mask_lt hb) ((weight_mask hb).trans hc)

end CubeDiameter.Network
