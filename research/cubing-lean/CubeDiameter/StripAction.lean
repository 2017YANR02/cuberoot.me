module

public import CubeDiameter.Orbits

@[expose] public section

namespace CubeDiameter.Rectangle
open Lift Representatives Network

theorem walk_one_group {α : Type} [DecidableEq α] (k : α) (ok : Prop) [Decidable ok]
    (f : α → List (Move n)) (p : Fin 24 → Point n) (g : Fin 24 → Fin 24)
    (h : ∀ a i, walk (f a) (p i) = p (if a = k ∧ ok then g i else i))
    (as : List α) (hd : as.Nodup) (i : Fin 24) :
    walk (as.flatMap f) (p i) = p (if k ∈ as ∧ ok then g i else i) := by
  induction as generalizing i with
  | nil => simp
  | cons a as ih =>
    obtain ⟨hn,ht⟩ := List.nodup_cons.mp hd
    rw [List.flatMap_cons,walk_append,h,ih ht]
    by_cases e : a = k
    · subst a; by_cases hok : ok <;> simp [hn,hok]
    · by_cases hok : ok <;> simp [e,Ne.symm e,hok]

namespace Selection

private theorem group_mem (s : Selection n) (active : ℕ → ℕ → Bool) (p : Finset ℕ) (x y : ℕ) :
    (x ∈ (s.group active p).rows ∧ y ∈ (s.group active p).cols) ↔
      p = s.pattern active y ∧ (x ∈ s.rows ∧ y ∈ s.cols ∧ active x y = true) := by
  simp only [group,Finset.mem_inter,Finset.mem_filter]
  constructor
  · rintro ⟨⟨hx,hp⟩,hy,he⟩
    exact ⟨he.symm,hx,hy,(Finset.mem_filter.mp (he ▸ hp : x ∈ s.pattern active y)).2⟩
  · rintro ⟨rfl,hx,hy,ha⟩; exact ⟨⟨hx,Finset.mem_filter.mpr ⟨hx,ha⟩⟩,hy,rfl⟩

theorem strip_action (s : Selection n) (active : ℕ → ℕ → Bool) (d : Depths n) (i : Fin 24)
    {stage w} (h : (stage,w) ∈ tableRows) :
    walk (s.stripWord active w) (pointMap d.embed (wire i.val)) =
      pointMap d.embed (wire (if d.row ∈ s.rows ∧ d.col ∈ s.cols ∧ active d.row d.col = true
        then output stage i else i).val) := by
  have step (p : Finset ℕ) (j : Fin 24) := rectangle_on_orbit (s.group active p) d j h
  simp only [group_mem] at step
  have res := walk_one_group _ _ _ (fun j => pointMap d.embed (wire j.val)) _
    step _ s.rows.powerset.nodup_toList i
  have hm : s.pattern active d.col ∈ s.rows.powerset := Finset.mem_powerset.mpr (Finset.filter_subset ..)
  simpa only [stripWord,Finset.mem_toList,hm,true_and] using res

theorem strip_stage (s : Selection n) (active : ℕ → ℕ → Bool)
    {stage w} (h : (stage,w) ∈ tableRows) :
    ∃ word : List (Move n),
      word.length ≤ 2*s.cols.card + 2^s.rows.card*(20+8*s.rows.card) ∧
      ∀ (d : Depths n) (i : Fin 24), walk word (pointMap d.embed (wire i.val)) =
        pointMap d.embed (wire (if d.row ∈ s.rows ∧ d.col ∈ s.cols ∧ active d.row d.col = true
          then output stage i else i).val) := by
  refine ⟨s.stripWord active w, ?_, fun d i => s.strip_action active d i h⟩
  obtain ⟨ho,hr,hc⟩ := appendixF_cost_profile (List.of_mem_zip h).2
  have ht := s.strip_length active w
  rw [hc] at ht
  have hb := Nat.mul_le_mul_left (2^s.rows.card) (Nat.add_le_add ho (Nat.mul_le_mul_right s.rows.card hr))
  omega

end Selection
end CubeDiameter.Rectangle
