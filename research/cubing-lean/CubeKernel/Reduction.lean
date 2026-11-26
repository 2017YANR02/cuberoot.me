module

public import CubeKernel.Geometry
public import CubeKernel.Support
public import Mathlib.Data.Finset.Sort
public import Mathlib.Data.Fintype.Prod

/-! A parameter kernel for six-colour short solutions in the single-slice metric.
Ordinary mirror-paired depths are the only interchangeable names. -/

@[expose] public section

namespace CubeKernel

variable {D E : Type} {odd : Bool}

def sliceLabels [DecidableEq D] : Slice D odd → Finset D
  | .inner a _ => {a}
  | .outer _ | .middle _ => ∅

def stickerLabels [DecidableEq D] (p : Sticker D odd) : Finset D :=
  sliceLabels p.2.2.1 ∪ sliceLabels p.2.2.2

private theorem sliceLabels_map [DecidableEq D] [DecidableEq E] (f : D → E) (s : Slice D odd) :
    sliceLabels (s.map f) = (sliceLabels s).image f := by
  cases s <;> simp [sliceLabels, Slice.map]

private theorem sliceLabels_size [DecidableEq D] (s : Slice D odd) : (sliceLabels s).card ≤ 1 := by
  cases s <;> simp [sliceLabels]

private theorem stickerLabels_map [DecidableEq D] [DecidableEq E] (f : D → E) (p : Sticker D odd) :
    stickerLabels (mapSticker f p) = (stickerLabels p).image f := by
  rcases p with ⟨a,b,s,t⟩
  simp [stickerLabels, mapSticker, sliceLabels_map, Finset.image_union]

private theorem stickerLabels_size [DecidableEq D] (p : Sticker D odd) : (stickerLabels p).card ≤ 2 := by
  unfold stickerLabels
  have h := Finset.card_union_le (sliceLabels p.2.2.1) (sliceLabels p.2.2.2)
  have := sliceLabels_size p.2.2.1
  have := sliceLabels_size p.2.2.2
  omega

def wordLabels [DecidableEq D] : List (Turn D odd) → Finset D
  | [] => ∅
  | t :: w => sliceLabels t.2.1 ∪ wordLabels w

theorem wordLabels_size [DecidableEq D] (w : List (Turn D odd)) : (wordLabels w).card ≤ w.length := by
  induction w with
  | nil => simp [wordLabels]
  | cons t w ih =>
    simp only [wordLabels,List.length_cons]
    have := Finset.card_union_le (sliceLabels t.2.1) (wordLabels w)
    have := sliceLabels_size t.2.1
    omega

theorem wordLabels_map [DecidableEq D] [DecidableEq E] (f : D → E) (w : List (Turn D odd)) :
    wordLabels (w.map (mapTurn f)) = (wordLabels w).image f := by
  induction w with
  | nil => simp [wordLabels]
  | cons t w ih =>
    simp [wordLabels, mapTurn, Finset.image_union, sliceLabels_map, ih]

private theorem map_turn_fixed [DecidableEq D] {f : D → D} (t : Turn D odd)
    (h : ∀ d ∈ sliceLabels t.2.1, f d = d) : mapTurn f t = t := by
  rcases t with ⟨a,s,amount⟩
  cases s with
  | outer => rfl
  | middle => rfl
  | inner d side => simp [mapTurn, Slice.map, h d (by simp [sliceLabels])]

private theorem map_word_fixed [DecidableEq D] {f : D → D} (w : List (Turn D odd))
    (h : ∀ d ∈ wordLabels w, f d = d) : w.map (mapTurn f) = w := by
  induction w with
  | nil => rfl
  | cons t w ih =>
    have ht := map_turn_fixed t (fun d hd => h d (Finset.mem_union_left _ hd))
    have hw := ih (fun d hd => h d (Finset.mem_union_right _ hd))
    simp [ht,hw]

/-- A depth transposition is a twin relation precisely when it preserves the colouring. -/
def Twins [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool)) (a b : D) : Prop :=
  ∀ p, x (mapSticker (Equiv.swap a b) p) = x p

theorem twins_refl [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool)) (a : D) :
    Twins x a a := by
  intro p
  rw [Equiv.swap_self]
  exact congrArg x (mapSticker_id p)

theorem twins_symm [DecidableEq D] {x : Sticker D odd → Option (Fin 3 × Bool)} {a b : D}
    (h : Twins x a b) : Twins x b a := by simpa only [Twins, Equiv.swap_comm b a] using h

theorem twins_trans [DecidableEq D] {x : Sticker D odd → Option (Fin 3 × Bool)} {a b c : D}
    (hab : Twins x a b) (hbc : Twins x b c) : Twins x a c := by
  by_cases hac : a = c
  · subst c; exact twins_refl _ _
  by_cases hba : b = a
  · subst b; exact hbc
  by_cases hbc' : b = c
  · subst b; exact hab
  have comp : ((Equiv.swap a b : D → D) ∘ (Equiv.swap b c : D → D)) ∘
      (Equiv.swap a b : D → D) = (Equiv.swap a c : D → D) := by
    funext z
    simp only [Function.comp_apply, Equiv.swap_apply_def]
    split_ifs <;> grind
  intro p
  rw [← comp, ← mapSticker_comp, ← mapSticker_comp, hab, hbc, hab]

theorem twins_of_unused [DecidableEq D] (w : List (Turn D odd)) (a b : D)
    (ha : a ∉ wordLabels w) (hb : b ∉ wordLabels w) : Twins (paint w) a b := by
  intro p
  have hw := map_word_fixed (f := Equiv.swap a b) w (fun d hd =>
    Equiv.swap_apply_of_ne_of_ne (fun e => ha (e ▸ hd)) (fun e => hb (e ▸ hd)))
  have hp := paint_embed (Equiv.swap a b) (Equiv.swap a b).injective w p
  rwa [hw] at hp

/-- Reachability at a prescribed word budget, allowing unused moves. -/
def Short [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool)) (k : ℕ) : Prop :=
  ∃ w : List (Turn D odd), w.length ≤ k ∧ paint w = x

def restrict (R : Finset D) (x : Sticker D odd → Option (Fin 3 × Bool)) :
    Sticker R odd → Option (Fin 3 × Bool) := x ∘ mapSticker Subtype.val

private theorem slice_lift [DecidableEq D] (R : Finset D) (s : Slice D odd)
    (hs : sliceLabels s ⊆ R) : ∃ t : Slice R odd, t.map Subtype.val = s := by
  cases s with
  | outer b => exact ⟨.outer b,rfl⟩
  | middle h => exact ⟨.middle h,rfl⟩
  | inner a b => exact ⟨.inner ⟨a,hs (by simp [sliceLabels])⟩ b,rfl⟩

private theorem sticker_lift [DecidableEq D] (R : Finset D) (p : Sticker D odd)
    (hp : stickerLabels p ⊆ R) : ∃ q : Sticker R odd, mapSticker Subtype.val q = p := by
  rcases p with ⟨a,b,s,t⟩
  obtain ⟨u,hu⟩ := slice_lift R s (fun _ h => hp (Finset.mem_union_left _ h))
  obtain ⟨v,hv⟩ := slice_lift R t (fun _ h => hp (Finset.mem_union_right _ h))
  exact ⟨(a,b,u,v),by simp [mapSticker,hu,hv]⟩

theorem short_restrict [DecidableEq D] (R : Finset D) {x : Sticker D odd → Option (Fin 3 × Bool)}
    {k : ℕ} (h : Short x k) : Short (restrict R x) k := by
  obtain ⟨w,hw,rfl⟩ := h
  exact ⟨projectWord R w,(length_projectWord_le R w).trans hw,funext (paint_project R w)⟩

/-- Lift a short solution. Two fresh depths in the retained part of a single
twin class handle the two tangent coordinates of every omitted sticker. -/
theorem short_of_retained [DecidableEq D] {x : Sticker D odd → Option (Fin 3 × Bool)}
    {k : ℕ} (R C S : Finset D) (hsr : S ⊆ R) (hsc : S ⊆ C)
    (homit : ∀ a, a ∉ R → a ∈ C) (hsize : k + 2 ≤ S.card)
    (htwin : ∀ a ∈ C, ∀ b ∈ C, Twins x a b)
    (h : Short (restrict R x) k) : Short x k := by
  classical
  obtain ⟨w,hw,he⟩ := h
  let w' := w.map (mapTurn Subtype.val)
  have hlen : w'.length = w.length := by simp [w']
  have huse : wordLabels w' ⊆ R := by
    intro d hd
    rw [show wordLabels w' = _ from wordLabels_map Subtype.val w] at hd
    obtain ⟨z,_,rfl⟩ := Finset.mem_image.mp hd
    exact z.property
  refine ⟨w',hlen ▸ hw,funext ?_⟩
  apply check_on_retained stickerLabels (fun a b => mapSticker (Equiv.swap a b))
    stickerLabels_size (fun a b => stickerLabels_map _) R C S (wordLabels w') k
    hsr hsc homit hsize huse ((wordLabels_size w').trans (hlen ▸ hw))
  · intro a ha b hb hua hub p hp
    rw [twins_of_unused w' a b hua hub p,htwin a ha b hb p] at hp
    exact hp
  · intro p hp
    obtain ⟨q,rfl⟩ := sticker_lift R p hp
    exact (paint_embed Subtype.val Subtype.val_injective w q).trans (congrFun he q)

/-- Enumeration used by the executable input-colouring test. -/
instance [Fintype D] [DecidableEq D] : Fintype (Slice D odd) where
  elems := (Finset.univ.image Slice.outer ∪
    (Finset.univ : Finset (D × Bool)).image (fun (d,b) => Slice.inner d b)) ∪
    (if h : odd = true then {Slice.middle h} else ∅)
  complete s := by
    cases s with
    | outer b => exact Finset.mem_union_left _ (Finset.mem_union_left _
        (Finset.mem_image.mpr ⟨b,Finset.mem_univ _,rfl⟩))
    | inner a b => exact Finset.mem_union_left _ (Finset.mem_union_right _
        (Finset.mem_image.mpr ⟨(a,b),Finset.mem_univ _,rfl⟩))
    | middle h => exact Finset.mem_union_right _ (by simp [h])

instance [Fintype D] [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool)) :
    DecidableRel (Twins x) := fun _ _ => inferInstanceAs (Decidable (∀ _, _))

def twinClass [Fintype D] [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool))
    (a : D) : Finset D := Finset.univ.filter (Twins x a)

theorem class_twins [Fintype D] [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool))
    (a : D) : ∀ b ∈ twinClass x a, ∀ c ∈ twinClass x a, Twins x b c := by
  intro b hb c hc
  exact twins_trans (twins_symm (Finset.mem_filter.mp hb).2) (Finset.mem_filter.mp hc).2

def candidates [Fintype D] [DecidableEq D] (x : Sticker D odd → Option (Fin 3 × Bool))
    (k : ℕ) : Finset D := Finset.univ.filter fun a => (twinClass x a)ᶜ.card ≤ k

private theorem has_candidate [Fintype D] [DecidableEq D] {x : Sticker D odd → Option (Fin 3 × Bool)}
    {k : ℕ} (hD : k < Fintype.card D) (h : Short x k) : (candidates x k).Nonempty := by
  obtain ⟨w,hw,rfl⟩ := h
  have hcard := (wordLabels_size w).trans hw
  have hlt : (wordLabels w).card < (Finset.univ : Finset D).card := by
    simpa only [Finset.card_univ] using (lt_of_le_of_lt hcard hD)
  obtain ⟨a,ha⟩ := Finset.sdiff_nonempty_of_card_lt_card hlt
  have hau := (Finset.mem_sdiff.mp ha).2
  have hsub : (twinClass (paint w) a)ᶜ ⊆ wordLabels w := by
    intro b hb
    by_contra hbu
    exact (Finset.mem_compl.mp hb) (Finset.mem_filter.mpr ⟨Finset.mem_univ _,twins_of_unused w a b hau hbu⟩)
  exact ⟨a,Finset.mem_filter.mpr ⟨Finset.mem_univ _,(Finset.card_le_card hsub).trans hcard⟩⟩

def representatives [LinearOrder D] (C : Finset D) (k : ℕ) : Finset D :=
  ((C.sort).take (k+2)).toFinset

private theorem reps_subset [LinearOrder D] (C : Finset D) (k : ℕ) : representatives C k ⊆ C := by
  intro a ha
  apply (Finset.mem_sort (· ≤ ·)).mp
  exact List.mem_of_mem_take (List.mem_toFinset.mp ha)

private theorem reps_card [LinearOrder D] (C : Finset D) (k : ℕ) :
    (representatives C k).card = min (k+2) C.card := by
  unfold representatives
  rw [List.toFinset_card_of_nodup ((C.sort_nodup (· ≤ ·)).take)]
  simp

/-- Find any sufficiently large twin class and keep its first k+2
representatives. Failure is a certificate that no word fits the budget. -/
def retained [Fintype D] [LinearOrder D] (x : Sticker D odd → Option (Fin 3 × Bool)) (k : ℕ) :
    Option (Finset D) :=
  if Fintype.card D ≤ 2*k+2 then some Finset.univ else
    if h : (candidates x k).Nonempty then
      let C := twinClass x ((candidates x k).min' h)
      some (Cᶜ ∪ representatives C k)
    else none

private theorem short_of_univ [Fintype D] [DecidableEq D] {x : Sticker D odd → Option (Fin 3 × Bool)}
    {k : ℕ} (h : Short (restrict Finset.univ x) k) : Short x k := by
  obtain ⟨w,hw,he⟩ := h
  refine ⟨w.map (mapTurn Subtype.val),by simpa using hw,funext ?_⟩
  intro p
  obtain ⟨q,rfl⟩ := sticker_lift Finset.univ p (Finset.subset_univ _)
  exact (paint_embed Subtype.val Subtype.val_injective w q).trans (congrFun he q)

/-- A computable rejection or an equivalent kernel using at most 2k+2 ordinary
depths. Every name represents two mirror layers; see `side_bound`. -/
theorem retained_correct [Fintype D] [LinearOrder D] (x : Sticker D odd → Option (Fin 3 × Bool)) (k : ℕ) :
    match retained x k with
    | none => ¬Short x k
    | some R => R.card ≤ 2*k+2 ∧ (Short x k ↔ Short (restrict R x) k) := by
  by_cases hlarge : Fintype.card D ≤ 2*k+2
  · simp only [retained,ite_eq_left hlarge]
    exact ⟨by simpa using hlarge,⟨short_restrict _,short_of_univ⟩⟩
  · by_cases h : (candidates x k).Nonempty
    · simp only [retained,ite_eq_right hlarge,dite_eq_left h]
      let a := (candidates x k).min' h
      let C := twinClass x a
      let S := representatives C k
      let R := Cᶜ ∪ S
      change R.card ≤ 2*k+2 ∧ (Short x k ↔ Short (restrict R x) k)
      have hcomp : Cᶜ.card ≤ k := (Finset.mem_filter.mp ((candidates x k).min'_mem h)).2
      have hcc : C.card + Cᶜ.card = Fintype.card D := by simp
      have hn : k+2 ≤ C.card := by omega
      have hrep : S.card = k+2 := (reps_card C k).trans (Nat.min_eq_left hn)
      have hub := Finset.card_union_le Cᶜ S
      refine ⟨by dsimp only [R]; omega,short_restrict _,?_⟩
      apply short_of_retained R C S (Finset.subset_union_right) (reps_subset C k) _ hrep.ge (class_twins x a)
      intro d hd
      by_contra hn
      exact hd (Finset.mem_union_left _ (Finset.mem_compl.mpr hn))
    · simp only [retained,ite_eq_right hlarge,dite_eq_right h]
      exact fun hw => h (has_candidate (by omega) hw)

/-- The ordinary pairs contribute twice their number, the outer layers two,
and the optional central layer at most one. -/
def side (d : ℕ) (odd : Bool) : ℕ := 2*d+2+(if odd then 1 else 0)

theorem side_bound {d k : ℕ} (h : d ≤ 2*k+2) (odd : Bool) : side d odd ≤ 4*k+7 := by
  cases odd <;> simp [side] <;> omega

theorem short_solution_kernel [Fintype D] [LinearOrder D] (x : Sticker D odd → Option (Fin 3 × Bool)) (k : ℕ) :
    match retained x k with
    | none => ¬Short x k
    | some R => side R.card odd ≤ 4*k+7 ∧ (Short x k ↔ Short (restrict R x) k) := by
  have h := retained_correct x k
  cases e : retained x k with
  | none => simpa [e] using h
  | some R =>
    simp only [e] at h
    exact ⟨side_bound h.1 odd,h.2⟩

end CubeKernel
