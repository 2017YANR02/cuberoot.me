module

public import CubeDiameter.Surface
public import CubeDiameter.GenericCenters

@[expose] public section

namespace CubeDiameter.Sparse
open Schedule Rectangle GridStage Lift Representatives Network

private def familyOf (k x : Fin 7) := x = k ∨ x = k.rev

private theorem label_membership (s : Selection n) (i : Fin n) :
    (familyOf 1 (s.label i) → depth i ∈ s.rows) ∧
    (familyOf 2 (s.label i) → depth i ∈ s.cols) := by
  by_cases lo : i < i.rev
  · have de : depth i = i.val := min_eq_left lo.le
    rw [de]
    simp only [Selection.label,lo,ite_true,Selection.nearLabel]
    split_ifs <;> simp_all [familyOf,Fin.rev]
  · by_cases hi : i.rev < i
    · have de : depth i = i.rev.val := min_eq_right hi.le
      rw [de]
      simp only [Selection.label,lo,hi,ite_false,ite_true,Selection.nearLabel]
      split_ifs <;> simp_all [familyOf,Fin.rev]
    · simp only [Selection.label,lo,hi,ite_false]; simp [familyOf,Fin.rev]

private theorem end_label (s : Selection n) (u : Fin (n+2)) (h : IsEnd u) :
    familyOf 0 (s.batch.color u) := by
  let z : Fin n := ⟨0,s.batch.pos⟩
  have hz : s.label z = 0 := by rw [s.label_shallow z (by have := s.size; dsimp [z]; omega)]; rfl
  have ho : owner s.batch.pos (0 : Fin (n+2)) = z := by apply Fin.ext; simp [owner,z]
  have hc : s.batch.color (0 : Fin (n+2)) = 0 := by
    change s.label (owner _ _) = 0; rw [ho,hz]
  obtain hh|hh := h
  · exact .inl ((congrArg s.batch.color (Fin.ext hh : u = 0)).trans hc)
  · have e : u = (0 : Fin (n+2)).rev := Fin.ext (by simp [Fin.rev]; omega)
    exact .inr (by rw [e,Batch.color_rev,hc])

private theorem has_family (k : Classes) (i : Fin 7) : containsFamily k i = true ↔
    familyOf i k.1 ∨ familyOf i k.2.1 ∨ familyOf i k.2.2 := by
  simp [containsFamily,familyOf,or_assoc]

theorem outside (s : Selection n) (p : Point n) (he : HasEnd p) (hs : SparseAt s.batch.pos p) :
    outsideRectangle (s.batch.classes p) = true := by
  have outer : containsFamily (s.batch.classes p) 0 = true := by
    apply (has_family ..).mpr
    rcases he with h|h|h
    · exact .inl (end_label s _ h)
    · exact .inr (.inl (end_label s _ h))
    · exact .inr (.inr (end_label s _ h))
  have row : containsFamily (s.batch.classes p) 1 = true → ∃ r ∈ s.rows, has s.batch.pos p r := by
    intro h
    rcases (has_family ..).mp h with h|h|h
    · exact ⟨_,(label_membership s _).1 h,.inl rfl⟩
    · exact ⟨_,(label_membership s _).1 h,.inr (.inl rfl)⟩
    · exact ⟨_,(label_membership s _).1 h,.inr (.inr rfl)⟩
  have col : containsFamily (s.batch.classes p) 2 = true → ∃ c ∈ s.cols, has s.batch.pos p c := by
    intro h
    rcases (has_family ..).mp h with h|h|h
    · exact ⟨_,(label_membership s _).2 h,.inl rfl⟩
    · exact ⟨_,(label_membership s _).2 h,.inr (.inl rfl)⟩
    · exact ⟨_,(label_membership s _).2 h,.inr (.inr rfl)⟩
  simp only [outsideRectangle,outer,Bool.true_and,Bool.not_eq_true',Bool.and_eq_false_iff]
  by_cases hr : containsFamily (s.batch.classes p) 1 = true
  · right; apply Bool.eq_false_iff.mpr; intro hc
    obtain ⟨r,hr',hp⟩ := row hr
    obtain ⟨c,hc',hq⟩ := col hc
    have eq := hs r (mem_depths.mpr (s.shallow _ (Finset.mem_union_left _ hr'))) hp c
      (mem_depths.mpr (s.shallow _ (Finset.mem_union_right _ hc'))) hq
    exact Finset.disjoint_left.mp s.disjoint hr' (eq ▸ hc')
  · exact .inl (Bool.eq_false_iff.mpr hr)

private theorem fixed_flatMap (l : List α) (f : α → List (Move n)) (p : Point n)
    (h : ∀ a ∈ l, walk (f a) p = p) : walk (l.flatMap f) p = p := by
  induction l with
  | nil => rfl
  | cons a ls ih =>
    rw [List.flatMap_cons,walk_append,h a (by simp),ih (fun z hz => h z (by simp [hz]))]

private theorem strip_fixed (s : Selection n) (active : Mask) {stage w} (h : (stage,w) ∈ tableRows)
    (p : Point n) (he : HasEnd p) (hs : SparseAt s.batch.pos p) : walk (s.stripWord active w) p = p := by
  unfold Selection.stripWord; apply fixed_flatMap; intro a _
  let g := s.group active a
  exact (List.forall₂_zip g.appendixF_rectangle h).2 p (outside g p he hs)

private theorem grid_fixed (hn : 2 ≤ n) (width : ℕ) (active : Mask) {stage w} (h : (stage,w) ∈ tableRows)
    (p : Point n) (he : HasEnd p) (hs : SparseAt (by omega) p) :
    walk (word hn width active w) p = p := by
  unfold word
  rw [walk_append,fixed_flatMap _ _ _ (fun k _ => strip_fixed (outerStrip hn width k) active h p he hs)]
  exact fixed_flatMap _ _ _ (fun i _ => strip_fixed (innerStrip hn width i) active h p he hs)

private theorem rot_has (hn : 0 < n) (p : Point n) (k : ℕ) : has hn (rot p) k ↔ has hn p k := by
  simp [rot,has,or_comm,or_left_comm]

private theorem rotated_fixed (hn : 0 < n) (w : List (Move n))
    (h : ∀ p, HasEnd p → SparseAt hn p → walk w p = p) (p : Point n) (he : HasEnd p) (hs : SparseAt hn p) :
    walk (w.map rotMove) p = p := by
  have e : rot (rot (rot p)) = p := by simp [rot]
  have e' (q : Point n) : HasEnd (rot q) ↔ HasEnd q := by simp [rot,HasEnd,or_comm,or_left_comm]
  have sp : SparseAt hn (rot (rot p)) := by simpa only [SparseAt,rot_has] using hs
  calc
    _ = walk (w.map rotMove) (rot (rot (rot p))) := congrArg _ e.symm
    _ = _ := by rw [walk_rot,h _ (by simpa only [e'] using he) sp,e]

theorem compile_fixed (hn : 2 ≤ n) (width : ℕ) (prog : Program) (hp : prog.map Prod.fst = levels)
    (p : Point n) (he : HasEnd p) (hs : SparseAt (by omega) p) : walk (compile prog hn width) p = p := by
  unfold compile; apply fixed_flatMap; intro lm h
  have hl : lm.1 ∈ levels := hp ▸ List.mem_map_of_mem h
  have cert : levels.all (fun l => decide (l.entry ∈ tableRows)) = true := by decide +kernel
  have hh := of_decide_eq_true (List.all_eq_true.mp cert lm.1 hl)
  rcases lm with ⟨⟨⟨stage,w⟩,r⟩,mask⟩
  have hw := grid_fixed hn width mask hh
  fin_cases r
  · exact hw p he hs
  · exact rotated_fixed _ _ hw p he hs
  · exact rotated_fixed _ _ (rotated_fixed _ _ hw) p he hs

end CubeDiameter.Sparse
