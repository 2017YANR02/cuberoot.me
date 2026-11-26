module

public import CubeDiameter.Schedule
public import CubeDiameter.SetRoutes

@[expose] public section

namespace CubeDiameter.Schedule
open Finset Network Representatives Rectangle
abbrev Wires := Finset ℕ
abbrev Reorder := Equiv.Perm ℕ

def imageOf (g : Reorder) (s : Wires) := s.map g.toEmbedding

@[simp] theorem image_refl (s : Wires) : imageOf (Equiv.refl ℕ) s = s := by simp [imageOf]
@[simp] theorem image_trans (g h : Reorder) (s : Wires) :
    imageOf (g.trans h) s = imageOf h (imageOf g s) := by
  unfold imageOf; rw [Finset.map_map]; rfl
@[simp] theorem image_inverse (g : Reorder) (s : Wires) :
    imageOf g (imageOf g.symm s) = s := by rw [← image_trans]; simp
@[simp] theorem image_unapply (g : Reorder) (s : Wires) :
    imageOf g.symm (imageOf g s) = s := by rw [← image_trans]; simp
@[simp] theorem image_card (g : Reorder) (s : Wires) : (imageOf g s).card = s.card := by simp [imageOf]
theorem image_mono (g : Reorder) {s t : Wires} (h : s ⊆ t) : imageOf g s ⊆ imageOf g t := map_subset_map.mpr h

def spinPerm : Reorder := perm (cycle [0,12,19] ++ cycle [1,13,16] ++ cycle [2,14,17] ++
  cycle [3,15,18] ++ cycle [4,9,22] ++ cycle [5,10,23] ++ cycle [6,11,20] ++ cycle [7,8,21])

def orientation : Fin 3 → Reorder
  | 0 => Equiv.refl ℕ
  | 1 => spinPerm
  | 2 => spinPerm.trans spinPerm

def orient (r g : Reorder) := r.symm.trans (g.trans r)

def Level.reorder (l : Level) (on : Bool) : Reorder :=
  if on then orient (orientation l.turn) (perm l.entry.1) else Equiv.refl ℕ

theorem advance_agrees {l : Level} (h : l ∈ levels) (b : Bool) (j : Fin 24) :
    (l.advance b j).val = l.reorder b j.val := by
  have cert : levels.all (fun lev => [true,false].all (fun bit => (List.finRange 24).all
    (fun i => decide ((lev.advance bit i).val = lev.reorder bit i.val)))) = true := by decide +kernel
  have hh := List.all_eq_true.mp cert l h
  have hb := List.all_eq_true.mp hh b (by cases b <;> simp)
  exact of_decide_eq_true (List.all_eq_true.mp hb j (List.mem_finRange j))

abbrev LocalProgram := List (Level × Bool)

def motion : LocalProgram → Reorder
  | [] => Equiv.refl ℕ
  | (l,b)::rest => (l.reorder b).trans (motion rest)

theorem motion_append (x y : LocalProgram) : motion (x ++ y) = (motion x).trans (motion y) := by
  induction x with
  | nil => ext; rfl
  | cons p ps ih => rcases p with ⟨l,b⟩; ext i; simp [motion,ih]

private theorem perm_fixes {d : ℕ} {s : Stage} (h : Valid d s) {x : ℕ} (hx : d ≤ x) : perm s x = x := by
  induction s with
  | nil => rfl
  | cons ab ss ih =>
    obtain ⟨hp,hq⟩ := h ab (by simp)
    change perm ss (Equiv.swap ab.1 ab.2 x) = x
    rw [Equiv.swap_apply_of_ne_of_ne (by omega) (by omega)]
    exact ih (fun a ha => h a (by simp [ha]))

private theorem chosen_fixes {d : ℕ} (q : Choices) (h : ∀ ab ∈ q, Valid d ab.1)
    {x : ℕ} (hx : d ≤ x) : chosen q x = x := by
  induction q with
  | nil => rfl
  | cons ab q ih =>
    obtain ⟨a,b⟩ := ab
    cases b
    · exact ih (fun e he => h e (by simp [he]))
    · change chosen q (perm a x) = x
      rw [perm_fixes (h (a,true) (by simp)) hx]; exact ih (fun e he => h e (by simp [he]))

private theorem attach_switches (r : Fin 3) (rows : List Entry) (q : Choices)
    (h : q.map Prod.fst = rows.map Prod.fst) :
    ∃ p : LocalProgram, p.map Prod.fst = rows.map (fun e => (⟨e,r⟩ : Level)) ∧
      motion p = orient (orientation r) (chosen q) := by
  induction rows generalizing q with
  | nil =>
    have he : q = [] := by simpa using h
    subst q; exact ⟨[],rfl,by ext; simp [motion,orient,chosen]⟩
  | cons e es ih =>
    cases q with
    | nil => simp at h
    | cons pair q =>
      obtain ⟨a,b⟩ := pair
      simp only [List.map_cons,List.cons.injEq] at h
      obtain ⟨p,hp,hm⟩ := ih q h.2
      refine ⟨(⟨e,r⟩,b)::p,by simp [hp],?_⟩
      cases b <;> ext i <;> simp [motion,hm,Level.reorder,orient,chosen,h.1]

structure Phase where
  base : Fin 3
  turn : Fin 3

def Phase.rows (f : Phase) : List Entry := match f.base with
  | 0 => split24.zip words24 | 1 => split16.zip words16 | 2 => split8.zip words8

def Phase.size (f : Phase) : ℕ := match f.base with | 0 => 24 | 1 => 16 | 2 => 8

def Phase.take (f : Phase) : ℕ := match f.base with | 0 => 8 | 1 => 8 | 2 => 4

def Phase.levels (f : Phase) := f.rows.map (fun e => (⟨e,f.turn⟩ : Level))

def Phase.domain (f : Phase) := imageOf (orientation f.turn) (range f.size)
def Phase.left (f : Phase) := imageOf (orientation f.turn) (range f.take)
def Phase.right (f : Phase) := f.domain \ f.left

private theorem row_valid (f : Phase) : ∀ row ∈ f.rows, Valid f.size row.1 := by
  have h : ∀ b r : Fin 3, (Phase.mk b r).rows.all (fun e => e.1.all (fun ab =>
    decide (ab.1 ≤ ab.2 ∧ ab.2 < (Phase.mk b r).size))) = true := by decide +kernel
  simpa [Valid,List.all_eq_true] using h f.base f.turn

theorem Phase.split (f : Phase) {s : Wires} (hs : s ⊆ f.domain) (hc : s.card = f.take) :
    ∃ p : LocalProgram, p.map Prod.fst = f.levels ∧ imageOf (motion p) s = f.left ∧
      ∀ i ∉ f.domain, motion p i = i := by
  let r := orientation f.turn
  let before := imageOf r.symm s
  have hb : before ⊆ range f.size := by
    have hh := image_mono r.symm hs
    simpa [Phase.domain,r,before] using hh
  have hz : before.card = f.take := (image_card ..).trans hc
  have route : ∃ q : Choices, q.map Prod.fst = f.rows.map Prod.fst ∧
      imageOf (chosen q) before = range f.take := by
    rcases f with ⟨base,turn⟩
    fin_cases base
    · exact split24_subsets hb hz
    · exact split16_subsets hb hz
    · exact split8_subsets hb hz
  obtain ⟨q,hq,hit⟩ := route
  obtain ⟨p,hp,hm⟩ := attach_switches f.turn f.rows q hq
  refine ⟨p,hp,?_,?_⟩
  · rw [hm]; change imageOf (orient r (chosen q)) s = _
    simp only [orient,image_trans]
    change imageOf r (imageOf (chosen q) before) = _
    rw [hit]; rfl
  · intro i hi
    have vq : ∀ ab ∈ q, Valid f.size ab.1 := by
      intro ab ha
      have hh := hq ▸ (List.mem_map_of_mem (f := Prod.fst) ha)
      obtain ⟨row,hr,eq⟩ := List.mem_map.mp hh
      exact eq ▸ row_valid f row hr
    have hx : f.size ≤ r.symm i := by
      simpa [Phase.domain,imageOf,Finset.mem_map_equiv,r] using hi
    rw [hm]; change r (chosen q (r.symm i)) = i
    rw [chosen_fixes q vq hx,r.apply_symm_apply]

end CubeDiameter.Schedule
