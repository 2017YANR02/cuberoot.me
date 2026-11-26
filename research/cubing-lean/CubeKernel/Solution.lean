module

public import CubeKernel.Packed
import all CubeKernel.Reduction

/-! Witness extraction. Search only retained depths, lift the actual word
by its inclusion into the original cube, and invert it to obtain a solution. -/

@[expose] public section

namespace CubeKernel.Physical

variable {D : Type} {o : Bool} {r : ℕ}

def physicalMoves (r : ℕ) (o : Bool) : List (Turn (Fin r) o) :=
  (List.finRange 3).flatMap fun a => (List.finRange (order r o)).flatMap fun i =>
    (List.finRange 3).map fun t => (turnEquiv r o).symm (a,i,t)

private theorem mem_physicalMoves (t : Turn (Fin r) o) : t ∈ physicalMoves r o := by
  generalize he : (turnEquiv r o) t = m
  rcases m with ⟨a,i,j⟩
  apply List.mem_flatMap.mpr
  refine ⟨a,by simp, List.mem_flatMap.mpr ⟨i,by simp,List.mem_map.mpr ⟨j,by simp,?_⟩⟩⟩
  rw [← he]
  exact (turnEquiv r o).symm_apply_apply _

def searchWord [Fintype D] [DecidableEq D] (moves : List (Turn D o)) (x : Colors D o)
    (u : List (Turn D o)) : ℕ → Option (List (Turn D o))
  | 0 => if paint u = x then some u else none
  | k+1 => if paint u = x then some u else
      moves.findSome? fun a => searchWord moves x (u ++ [a]) k

private theorem searchWord_sound [Fintype D] [DecidableEq D] (moves : List (Turn D o))
    (x : Colors D o) (k : ℕ) (u w : List (Turn D o)) (h : searchWord moves x u k = some w) :
    w.length ≤ u.length + k ∧ paint w = x := by
  induction k generalizing u with
  | zero =>
    by_cases e : paint u = x <;> simp [searchWord,e] at h
    subst w; simp [e]
  | succ k ih =>
    by_cases e : paint u = x
    · simp [searchWord,e] at h
      subst w; simp [e]
    · simp only [searchWord,ite_eq_right e] at h
      obtain ⟨a,_,ha⟩ := List.exists_of_findSome?_eq_some h
      obtain ⟨hl,hp⟩ := ih (u ++ [a]) ha
      exact ⟨by simp at hl; omega,hp⟩

private theorem searchWord_complete [Fintype D] [DecidableEq D] (moves : List (Turn D o))
    (hall : ∀ a, a ∈ moves) (x : Colors D o) (k : ℕ) (u w : List (Turn D o))
    (hl : w.length ≤ k) (h : paint (u ++ w) = x) : searchWord moves x u k ≠ none := by
  induction k generalizing u w with
  | zero =>
    have : w = [] := by simpa using hl
    subst w; simp at h; simp [searchWord,h]
  | succ k ih =>
    by_cases e : paint u = x
    · simp [searchWord,e]
    · cases w with
      | nil => exact False.elim (e (by simpa using h))
      | cons a w =>
        simp only [searchWord,ite_eq_right e]
        exact fun hn => ih (u ++ [a]) w (by simpa using hl)
          (by simpa [List.append_assoc] using h) (List.findSome?_eq_none_iff.mp hn a (hall a))

/-- Every successful short word of the selected kernel is correct on all
original stickers after replacing its names by the original layer names. -/
theorem lift_word [Fintype D] [LinearOrder D] {x : Colors D o} {k : ℕ}
    {R : Finset D} (hr : retained x k = some R) (w : List (Turn R o))
    (hl : w.length ≤ k) (hw : paint w = restrict R x) :
    paint (w.map (mapTurn Subtype.val)) = x := by
  let w' := w.map (mapTurn Subtype.val)
  have hin : ∀ p, stickerLabels p ⊆ R → paint w' p = x p := by
    intro p hp
    obtain ⟨q,rfl⟩ := sticker_lift R p hp
    exact (paint_embed Subtype.val Subtype.val_injective w q).trans (congrFun hw q)
  have huse : wordLabels w' ⊆ R := by
    intro d hd
    rw [show wordLabels w' = _ from wordLabels_map Subtype.val w] at hd
    obtain ⟨z,_,rfl⟩ := Finset.mem_image.mp hd
    exact z.property
  have hlen : w'.length ≤ k := by simpa [w'] using hl
  apply funext
  by_cases hs : Fintype.card D ≤ 2*k+2
  · simp [retained,hs] at hr
    exact fun p => hin p (hr ▸ Finset.subset_univ _)
  by_cases h : (candidates x k).Nonempty
  · let a := (candidates x k).min' h
    let C := twinClass x a
    let S := representatives C k
    have hR : Cᶜ ∪ S = R := by simpa [retained,hs,h,C,S,a] using hr
    have hcomp : Cᶜ.card ≤ k := (Finset.mem_filter.mp ((candidates x k).min'_mem h)).2
    have hcc : C.card + Cᶜ.card = Fintype.card D := by simp
    have hrep : S.card = k+2 := (reps_card C k).trans (Nat.min_eq_left (by omega))
    apply check_on_retained stickerLabels (fun a b => mapSticker (Equiv.swap a b))
      stickerLabels_size (fun a b => stickerLabels_map _) R C S (wordLabels w') k
      (hR ▸ Finset.subset_union_right) (reps_subset C k) _ hrep.ge huse
      ((wordLabels_size w').trans hlen) _ _ hin
    · intro d hd
      by_contra hn
      exact hd (hR ▸ Finset.mem_union_left _ (Finset.mem_compl.mpr hn))
    · intro b hb c hc hub huc p hp
      rw [twins_of_unused w' b c hub huc p,class_twins x a b hb c hc p] at hp
      exact hp
  · simp [retained,hs,h] at hr

/-- Find a short generating word for the original colouring. The word search
takes place on the physically renumbered kernel. -/
def generatingWord (x : Colors (Fin r) o) (k : ℕ) : Option (List (Turn (Fin r) o)) :=
  match retained x k with
  | none => none
  | some R =>
    let e := (R.orderIsoOfFin rfl).toEquiv
    let y := restrict R x ∘ mapSticker e
    (searchWord (physicalMoves R.card o) y [] k).map fun w =>
      (w.map (mapTurn e)).map (mapTurn Subtype.val)

theorem generatingWord_correct (x : Colors (Fin r) o) (k : ℕ) :
    match generatingWord x k with
    | none => ¬Short x k
    | some w => w.length ≤ k ∧ paint w = x := by
  have hc := retained_correct x k
  unfold generatingWord
  cases hr : retained x k with
  | none => simpa only [hr] using hc
  | some R =>
    simp only [hr] at hc
    let e := (R.orderIsoOfFin rfl).toEquiv
    let y := restrict R x ∘ mapSticker e
    generalize ht : searchWord (physicalMoves R.card o) y [] k = t
    change match (searchWord (physicalMoves R.card o) y [] k).map _ with
      | none => ¬Short x k
      | some w => w.length ≤ k ∧ paint w = x
    rw [ht]
    cases t with
    | none =>
      intro hx
      obtain ⟨w,hl,hw⟩ := (short_pull_iff e _ k).mpr (hc.2.mp hx)
      exact searchWord_complete _ mem_physicalMoves y k [] w hl (by simpa using hw) ht
    | some w =>
      obtain ⟨hl,hw⟩ := searchWord_sound _ y k [] w ht
      simp only [List.length_nil,Nat.zero_add] at hl
      refine ⟨by simpa using hl, lift_word hr _ (by simpa using hl) ?_⟩
      funext p
      have h := paint_embed e e.injective w (mapSticker e.symm p)
      have hid : (e : Fin R.card → R) ∘ (e.symm : R → Fin R.card) = id := funext e.apply_symm_apply
      simpa only [mapSticker_comp,hid,mapSticker_id,hw,y,Function.comp_apply] using h

/-- Return the solving moves in the original physical coordinates. -/
def findShort (s : CubeDiameter.Position (order r o)) (k : ℕ) :
    Option (List (CubeDiameter.Move (order r o))) :=
  (generatingWord (observe s.val) k).map fun w => CubeDiameter.inverseWord (w.map turnIndex)

theorem findShort_correct (s : CubeDiameter.Position (order r o)) (k : ℕ) :
    match findShort s k with
    | none => k < CubeDiameter.distance s
    | some w => w.length ≤ k ∧ s.val ∘ CubeDiameter.walk w = CubeDiameter.solved _ := by
  have h := generatingWord_correct (observe s.val) k
  unfold findShort
  cases e : generatingWord (observe s.val) k with
  | none =>
    simp only [e] at h
    exact Nat.lt_of_not_ge fun hs => h ((named_short_iff s k).mpr hs)
  | some w =>
    simp only [e] at h
    have hp : CubeDiameter.paint (w.map turnIndex) = s.val := by
      rw [← extend_paint,h.2,extend_observe_legal s.property]
    have hs := CubeDiameter.reverse_solves (w.map turnIndex)
    exact ⟨by simpa [CubeDiameter.inverseWord] using h.1, hp ▸ hs.2⟩

theorem findShort_eq_none_iff (s : CubeDiameter.Position (order r o)) (k : ℕ) :
    findShort s k = none ↔ k < CubeDiameter.distance s := by
  have h := generatingWord_correct (observe s.val) k
  cases e : generatingWord (observe s.val) k with
  | none =>
    simp only [e] at h
    simp [findShort,e,Nat.lt_of_not_ge (fun hs => h ((named_short_iff s k).mpr hs))]
  | some w =>
    simp only [e] at h
    have hdist := (named_short_iff s k).mp ⟨w,h⟩
    simp [findShort,e,Nat.not_lt_of_ge hdist]

/-- Dense six-face input needs no prior proof of physical legality. -/
def PackedCube.findShort (x : PackedCube) (k : ℕ) : Option (List (CubeDiameter.Move (order x.depthCount x.odd))) :=
  (generatingWord x.colors k).map fun w => CubeDiameter.inverseWord (w.map turnIndex)

theorem PackedCube.findShort_correct (x : PackedCube) (k : ℕ) :
    match x.findShort k with
    | none => ¬Short x.colors k
    | some w => w.length ≤ k ∧ extend x.colors ∘ CubeDiameter.walk w = CubeDiameter.solved _ := by
  have h := generatingWord_correct x.colors k
  unfold PackedCube.findShort
  cases e : generatingWord x.colors k with
  | none => simpa only [e,Option.map_none] using h
  | some w =>
    simp only [e] at h
    have hw : CubeDiameter.paint (w.map turnIndex) = extend x.colors := by rw [← extend_paint,h.2]
    have hs := CubeDiameter.reverse_solves (w.map turnIndex)
    exact ⟨by simpa [CubeDiameter.inverseWord] using h.1, hw ▸ hs.2⟩

end CubeKernel.Physical
