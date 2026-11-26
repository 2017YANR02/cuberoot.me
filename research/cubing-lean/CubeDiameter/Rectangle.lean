module

public import CubeDiameter.Lift

@[expose] public section

namespace CubeDiameter.Rectangle
open Lift Representatives Network

/-- Layer occupied by a sticker coordinate, including the normal coordinate
    at either end. -/
def owner (hn : 0 < n) (u : Fin (n+2)) : Fin n :=
  ⟨min (u.val-1) (n-1), by omega⟩

theorem owner_rev (hn : 0 < n) (u : Fin (n+2)) :
    owner hn u.rev = (owner hn u).rev := by
  apply Fin.ext
  have := u.isLt
  simp [owner,Fin.rev]
  omega

theorem onLayer_owner (hn : 0 < n) (i : Fin n) (u : Fin (n+2)) :
    onLayer i u = decide (owner hn u = i) := by
  have := i.isLt
  have := u.isLt
  simp only [onLayer,layer,owner,Fin.ext_iff,decide_eq_decide]
  omega

@[simp] theorem owner_layer (hn : 0 < n) (i : Fin n) : owner hn (layer i) = i := by
  apply Fin.ext
  have := i.isLt
  simp [owner,layer]; omega

/-- A symmetric seven-valued label on the layers. The two outside planes have
    labels 0 and 6; rows have labels 1,5, columns 2,4 and unused layers 3. -/
structure Batch (n : ℕ) where
  pos : 0 < n
  label : Fin n → Fin 7
  reflect : ∀ i, label i.rev = (label i).rev

def select : Fin 6 → Fin 7
  | 0 => 0 | 1 => 1 | 2 => 2 | 3 => 4 | 4 => 5 | 5 => 6

def Batch.layers (b : Batch n) (s : Fin 6) : List (Fin n) :=
  (List.finRange n).filter (fun i => b.label i == select s)

def Batch.word (b : Batch n) (m : Move 6) : List (Move n) :=
  (b.layers m.2.1).map fun i => (m.1, i, m.2.2)

def Batch.expand (b : Batch n) (w : List (Move 6)) : List (Move n) := w.flatMap b.word

private theorem step_misses (hn : 0 < n) {a : Fin 3} {i : Fin n} (t : Fin 3) (p : Point n)
    (h : owner hn (coord a p) ≠ i) : step (a,i,t) p = p := by
  fin_cases t <;> simp [step,twist,onLayer_owner hn,h]

private theorem coord_step (a : Fin 3) (i : Fin n) (t : Fin 3) (p : Point n) :
    coord a (step (a,i,t) p) = coord a p := by
  have hc (q : Point n) : coord a (twist a i q) = coord a q := by
    unfold twist; split <;> simp [coord_quarter]
  fin_cases t <;> simp [step,hc]

private theorem walk_layers (hn : 0 < n) (a : Fin 3) (t : Fin 3) (ls : List (Fin n))
    (hd : ls.Nodup) (p : Point n) :
    walk (ls.map (fun i => (a,i,t))) p =
      if owner hn (coord a p) ∈ ls then step (a, owner hn (coord a p), t) p else p := by
  induction ls generalizing p with
  | nil => simp
  | cons i ls ih =>
    obtain ⟨hf,ht⟩ := List.nodup_cons.mp hd
    simp only [List.map_cons,walk_cons,ih ht,coord_step,List.mem_cons]
    by_cases h : owner hn (coord a p) = i
    · simp [h,hf]
    · simp [h, step_misses hn t p h]


theorem word_action (b : Batch n) (m : Move 6) (p : Point n) :
    walk (b.word m) p =
      if b.label (owner b.pos (coord m.1 p)) = select m.2.1 then
        step (m.1, owner b.pos (coord m.1 p), m.2.2) p else p := by
  rw [Batch.word, Batch.layers, walk_layers b.pos _ _ _ (List.Nodup.filter _ (List.nodup_finRange n))]
  simp

/-- On one selected row/column pair, the parallel word executes exactly the
    same motion as the corresponding six-layer representative. -/
theorem word_on_frame (b : Batch n) (d : Depths n) (hc : ∀ s, b.label (d.slice s) = select s)
    (m : Move 6) (p : Point 6) :
    walk (b.word m) (pointMap d.embed p) = pointMap d.embed (step m p) := by
  rw [word_action]
  have ho (u : Fin 8) : owner b.pos (d.embed u) = d.slice (owner (by decide) u) := by
    have h := d.onLayer_embed (owner (by decide) u) u
    simpa [onLayer_owner b.pos, onLayer_owner (n := 6) (by decide)] using h
  simp only [coord_map,ho,hc]
  have hs : Function.Injective select := by decide +kernel
  simp only [hs.eq_iff]
  split
  next h =>
    rw [h]
    exact d.step_embed m p
  next h =>
    rw [show step m p = p from step_misses (n := 6) (by decide) _ _ h]

theorem expand_on_frame (b : Batch n) (d : Depths n) (hc : ∀ s, b.label (d.slice s) = select s)
    (w : List (Move 6)) (p : Point 6) :
    walk (b.expand w) (pointMap d.embed p) = pointMap d.embed (walk w p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih =>
    change walk (b.word m ++ b.expand w) _ = _
    rw [walk_append,word_on_frame b d hc,ih,walk_cons]

end CubeDiameter.Rectangle
