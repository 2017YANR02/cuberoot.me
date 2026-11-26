module

public import CubeDiameter.Compression
public import CubeDiameter.GridStage

@[expose] public section

namespace CubeDiameter.Sparse
open Rectangle GridStage Finset

def depth (i : Fin n) := min i.val i.rev.val
def mag (hn : 0 < n) (u : Fin (n+2)) := depth (owner hn u)

@[simp] theorem depth_rev (i : Fin n) : depth i.rev = depth i := by simp [depth,min_comm]
@[simp] theorem mag_rev (hn : 0 < n) (u : Fin (n+2)) : mag hn u.rev = mag hn u := by simp [mag,owner_rev]
@[simp] theorem mag_layer (hn : 0 < n) (i : Fin n) : mag hn (layer i) = depth i := by simp [mag]

def has (hn : 0 < n) (p : Point n) (k : ℕ) : Prop :=
  mag hn p.1 = k ∨ mag hn p.2.1 = k ∨ mag hn p.2.2 = k

def SparseAt (hn : 0 < n) (p : Point n) := ∀ a ∈ depths n, has hn p a → ∀ b ∈ depths n, has hn p b → a = b

@[simp] theorem has_quarter (hn : 0 < n) (a : Fin 3) (p : Point n) (k : ℕ) :
    has hn (quarter a p) k ↔ has hn p k := by
  rcases p with ⟨x,y,z⟩; fin_cases a <;> simp [has,quarter,or_assoc,or_left_comm,or_comm]

@[simp] theorem has_step (hn : 0 < n) (m : Move n) (p : Point n) (k : ℕ) :
    has hn (step m p) k ↔ has hn p k := by
  have ht (a : Fin 3) (i : Fin n) (q : Point n) : has hn (twist a i q) k ↔ has hn q k := by
    unfold twist; split <;> simp
  rcases m with ⟨a,i,t⟩; fin_cases t <;> simp [step,ht]

@[simp] theorem has_walk (hn : 0 < n) (w : List (Move n)) (p : Point n) (k : ℕ) :
    has hn (walk w p) k ↔ has hn p k := by
  induction w generalizing p <;> simp_all

private theorem misses (hn : 0 < n) (m : Move n) (p : Point n) (h : ¬has hn p (depth m.2.1)) :
    step m p = p := by
  have hh : mag hn (coord m.1 p) = depth m.2.1 → has hn p (depth m.2.1) := by
    rcases m with ⟨a,i,t⟩; fin_cases a <;> simp [coord,has] <;> tauto
  have ne : owner hn (coord m.1 p) ≠ m.2.1 := fun he => h (hh (congrArg depth he))
  rcases m with ⟨a,i,t⟩; fin_cases t <;> simp [step,twist,onLayer_owner hn,ne]

private theorem filtered (hn : 0 < n) (keep : Fin n → Bool) (w : List (Move n)) (p : Point n)
    (h : ∀ m ∈ w, keep m.2.1 = false → ¬has hn p (depth m.2.1)) :
    walk (w.filter (fun m => keep m.2.1)) p = walk w p := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih =>
    have ht (q : Point n) (eq : ∀ k, has hn q k ↔ has hn p k) :
        walk (w.filter (fun a => keep a.2.1)) q = walk w q := ih q
      (fun a ha hn' hx => h a (by simp [ha]) hn' ((eq _).mp hx))
    cases hm : keep m.2.1
    · rw [List.filter_cons_of_neg (by simp [hm]),walk_cons,misses hn m p (h m (by simp) hm)]
      exact ht p (fun _ => Iff.rfl)
    · rw [List.filter_cons_of_pos (by simp [hm]),walk_cons,walk_cons]
      exact ht _ (has_step hn m p)

def base (w : List (Move n)) := w.filter (fun m => decide (depth m.2.1 ∉ depths n))
def proj (r : ℕ) (w : List (Move n)) :=
  w.filter (fun m => decide (depth m.2.1 ∉ depths n ∨ depth m.2.1 = r))

theorem proj_agrees (hn : 0 < n) (w : List (Move n)) (r : ℕ) (p : Point n)
    (h : ∀ k ∈ depths n, has hn p k → k = r) : walk (proj r w) p = walk w p := by
  apply filtered hn (fun i => decide (depth i ∉ depths n ∨ depth i = r))
  intro m _ hskip hh
  simp at hskip
  exact hskip.2 (h _ (mem_depths.mpr hskip.1) hh)

theorem absent_agrees (hn : 0 < n) (w : List (Move n)) (r : ℕ) (p : Point n) (h : ¬has hn p r) :
    walk (proj r w) p = walk (base w) p := by
  have hf : base (proj r w) = base w := by
    simp only [base,proj,List.filter_filter]
    congr 1; funext m
    by_cases e : depth m.2.1 ∈ depths n <;> simp [e]
  rw [← hf]
  symm; apply filtered hn (fun i => decide (depth i ∉ depths n)); intro m hm hskip hx
  have he := (List.mem_filter.mp hm).2
  simp at hskip
  simp only [decide_eq_true_eq] at he
  exact h ((he.resolve_left (by simpa using hskip)) ▸ hx)

def slots (hn : 0 < n) (r : ℕ) : Fin 5 → Fin n
  | 0 => ⟨0,hn⟩
  | 1 => (⟨0,hn⟩ : Fin n).rev
  | 2 => ⟨(n-1)/2,by omega⟩
  | 3 => ⟨min r (n-1),by omega⟩
  | 4 => (⟨min r (n-1),by omega⟩ : Fin n).rev

private theorem slot_covers (hn : 0 < n) (r : ℕ) (i : Fin n) (h : depth i ∉ depths n ∨ depth i = r) :
    ∃ k, slots hn r k = i := by
  simp only [mem_depths,depth,Fin.rev] at h
  have hi := i.isLt
  by_cases hz : i.val = 0
  · exact ⟨0,Fin.ext (by simpa [slots] using hz.symm)⟩
  by_cases he : i.val = n-1
  · exact ⟨1,Fin.ext (by simpa [slots,Fin.rev] using he.symm)⟩
  by_cases hc : i.val = (n-1)/2
  · exact ⟨2,Fin.ext hc.symm⟩
  by_cases hl : i.val ≤ n-(i.val+1)
  · exact ⟨3,Fin.ext (by simp [slots]; omega)⟩
  · exact ⟨4,Fin.ext (by simp [slots,Fin.rev]; omega)⟩

private theorem base_short (hn : 0 < n) (w : List (Move n)) :
    ∃ u : List (Move n), u.length ≤ Compression.bound ∧ ∀ p, walk u p = walk (base w) p :=
  Compression.compress (slots hn 0) _ (fun _ hm => slot_covers hn _ _ (.inl (of_decide_eq_true (List.mem_filter.mp hm).2)))

private theorem proj_short (hn : 0 < n) (r : ℕ) (w : List (Move n)) :
    ∃ u : List (Move n), u.length ≤ Compression.bound ∧ ∀ p, walk u p = walk (proj r w) p :=
  Compression.compress (slots hn r) _ (fun _ hm => slot_covers hn _ _ (of_decide_eq_true (List.mem_filter.mp hm).2))

/-- On each exceptional orbit all contributing slice turns are common, or
    use a single additional depth. Projections at distinct depths commute on
    these orbits after cancelling the shared word. -/
private theorem sparse_aux (hn : 0 < n) (w base' : List (Move n)) (pr : ℕ → List (Move n))
    (K : ℕ) (hlen : base'.length ≤ K) (hbase : ∀ p, walk base' p = walk (base w) p)
    (hlen' : ∀ r, (pr r).length ≤ K) (hpr : ∀ r p, walk (pr r) p = walk (proj r w) p) :
    ∃ u : List (Move n), u.length ≤ (2*n+1)*K ∧ ∀ p, SparseAt hn p → walk u p = walk w p := by
  classical
  let fixWord := fun r => pr r ++ inverseWord base'
  have fixes (r) (p : Point n) (h : ¬has hn p r) : walk (fixWord r) p = p := by
    change walk (pr r ++ inverseWord base') p = _
    rw [walk_append,hpr,absent_agrees hn w r p h,← hbase,walk_inverse]
  have skip (ls : List ℕ) (p : Point n) (h : ∀ k ∈ ls, ¬has hn p k) :
      walk (ls.flatMap fixWord) p = p := by
    induction ls with
    | nil => rfl
    | cons k ls ih =>
      rw [List.flatMap_cons,walk_append,fixes _ _ (h k (by simp)),ih (fun i hi => h i (by simp [hi]))]
  have one (ls : List ℕ) (r : ℕ) (p : Point n) (hd : ls.Nodup) (hr : r ∈ ls)
      (h : ∀ k ∈ ls, has hn p k → k = r) : walk (ls.flatMap fixWord) p = walk (fixWord r) p := by
    induction ls with
    | nil => simp at hr
    | cons k ls ih =>
      obtain ⟨hne,ht⟩ := List.nodup_cons.mp hd
      rw [List.flatMap_cons,walk_append]
      rcases List.mem_cons.mp hr with e | hr
      · subst k; apply skip
        intro k hk hh; exact hne ((h k (by simp [hk]) ((has_walk ..).mp hh)) ▸ hk)
      · have ne : k ≠ r := fun he => hne (he ▸ hr)
        rw [fixes k p (fun hh => ne (h k (by simp) hh))]
        exact ih ht hr (fun a ha => h a (by simp [ha]))
  let ls := (depths n).toList
  refine ⟨ls.flatMap fixWord ++ base',?_,?_⟩
  · have len (l : List ℕ) : (l.flatMap fixWord).length ≤ l.length*(2*K) := by
      induction l with
      | nil => simp
      | cons r l ih =>
        simp only [List.flatMap_cons,List.length_append,fixWord,inverseWord,List.length_map,List.length_reverse,
          List.length_cons,Nat.add_mul,Nat.one_mul]
        change (pr r).length + base'.length + (l.flatMap fixWord).length ≤ _
        have := hlen' r; omega
    have hy : ls.length ≤ n := by simp [ls,side]; omega
    have hm := Nat.mul_le_mul_right (2*K) hy
    rw [List.length_append]
    nlinarith only [len ls,hm,hlen]
  · intro p hp
    rw [walk_append]
    by_cases h : ∃ r ∈ depths n, has hn p r
    · obtain ⟨r,hr,hasr⟩ := h
      have hh := fun k (hk : k ∈ depths n) (hx : has hn p k) => hp k hk hx r hr hasr
      rw [one ls r p (depths n).nodup_toList (Finset.mem_toList.mpr hr)
        (fun k hk => hh k (Finset.mem_toList.mp hk))]
      change walk base' (walk (pr r ++ inverseWord base') p) = _
      rw [walk_append,hpr,proj_agrees hn w r p hh]
      have inv := walk_inverse (inverseWord base') (walk w p)
      rwa [inverseWord_involutive] at inv
    · push Not at h
      rw [skip ls p (fun k hk => h k (Finset.mem_toList.mp hk)),hbase]
      apply filtered hn (fun i => decide (depth i ∉ depths n)); intro m _ hm; exact h _ (by simpa using hm)

theorem sparse_word (hn : 0 < n) (w : List (Move n)) :
    ∃ u : List (Move n), u.length ≤ (2*n+1)*Compression.bound ∧
      ∀ p, SparseAt hn p → walk u p = walk w p := by
  obtain ⟨base',hlen,hbase⟩ := base_short hn w
  choose pr hlen' hpr using fun r => proj_short hn r w
  exact sparse_aux hn w base' pr _ hlen hbase hlen' hpr

end CubeDiameter.Sparse
