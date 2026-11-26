module

public import CubeDiameter.Rectangle
public import CubeDiameter.Support

@[expose] public section

namespace CubeDiameter.Compression
open Lift Rectangle

/-- An arbitrary five slots of physical slices. The abstract input records
    which of those slices contain the six signed input coordinates. -/
abbrev Letter := Fin 3 × Fin 5 × Fin 3
abbrev Tests := Fin 5 → Fin 6 → Bool
abbrev Signature := Tests → Point 4

def decode (slots : Fin 5 → Fin n) (l : Letter) : Move n := (l.1,slots l.2.1,l.2.2)

def testAt (slots : Fin 5 → Fin n) (p : Point n) : Tests :=
  fun j i => onLayer (slots j) (signed p Fin.rev i)

def symbol (t : Tests) (l : Letter) (q : Point 4) : Point 4 :=
  if t l.2.1 (coord l.1 q) then spin l.1 l.2.2 q else q

def run (w : List Letter) (t : Tests) (q : Point 4) := w.foldl (fun q l => symbol t l q) q
def signature (w : List Letter) : Signature := fun t => run w t initial

private theorem step_cases (a : Fin 3) (i : Fin n) (t : Fin 3) (p : Point n) :
    step (a,i,t) p = if onLayer i (coord a p) then spin a t p else p := by
  fin_cases t <;> by_cases h : onLayer i (coord a p) = true <;> simp [step,spin,twist,coord_quarter,h]

private theorem simulated (slots : Fin 5 → Fin n) (p : Point n) (w : List Letter) (q : Point 4) :
    walk (w.map (decode slots)) (pointMap (signed p Fin.rev) q) =
      pointMap (signed p Fin.rev) (run w (testAt slots p) q) := by
  induction w generalizing q with
  | nil => rfl
  | cons l w ih =>
    have hm : step (decode slots l) (pointMap (signed p Fin.rev) q) =
      pointMap (signed p Fin.rev) (symbol (testAt slots p) l q) := by
      rw [decode,step_cases]
      simp only [symbol,testAt,coord_map]
      by_cases he : onLayer (slots l.2.1) (signed p Fin.rev (coord l.1 q)) = true
      · simp only [he,ite_true]; rcases l with ⟨a,k,t⟩; fin_cases t <;> simp [spin,quarter_map _ (signed_rev p)]
      · simp [he]
    rw [List.map_cons,walk_cons,hm,ih]; rfl

/-- Only the finite abstract transition system occurs in this constant. -/
noncomputable def minLength (s : Signature) : ℕ := by
  classical
  exact if h : ∃ m, ∃ w : List Letter, w.length = m ∧ signature w = s then Nat.find h else 0

noncomputable def finiteMax {α : Type} [Fintype α] (f : α → ℕ) := Finset.univ.sup f

theorem le_finiteMax {α : Type} [Fintype α] (f : α → ℕ) (x : α) : f x ≤ finiteMax f :=
  Finset.le_sup (f := f) (Finset.mem_univ x)

noncomputable def bound : ℕ := finiteMax minLength

private theorem shorter (w : List Letter) : ∃ v : List Letter, v.length ≤ bound ∧ signature v = signature w := by
  classical
  have h : ∃ m, ∃ v : List Letter, v.length = m ∧ signature v = signature w := ⟨_,w,rfl,rfl⟩
  obtain ⟨v,hv,hs⟩ := Nat.find_spec h
  have he : minLength (signature w) = Nat.find h := by unfold minLength; rw [dite_eq_left h]
  have hb : minLength (signature w) ≤ bound := le_finiteMax minLength (signature w)
  rw [he] at hb
  exact ⟨v,hv.trans_le hb,hs⟩

/-- Any word using five specified slices on each axis has an equivalent
    bounded-length word on those same slices, uniformly over the cube order. -/
theorem compress (slots : Fin 5 → Fin n) (w : List (Move n))
    (h : ∀ m ∈ w, ∃ i, slots i = m.2.1) :
    ∃ v : List (Move n), v.length ≤ bound ∧ ∀ p, walk v p = walk w p := by
  classical
  have liftWord (ls : List (Move n)) (hl : ∀ m ∈ ls, ∃ i, slots i = m.2.1) :
      ∃ q : List Letter, q.map (decode slots) = ls := by
    induction ls with
    | nil => exact ⟨[],rfl⟩
    | cons m ls ih =>
      obtain ⟨i,hi⟩ := hl m (by simp)
      obtain ⟨q,hq⟩ := ih (fun a ha => hl a (by simp [ha]))
      exact ⟨(m.1,i,m.2.2)::q,by simp [decode,hq,hi]⟩
  obtain ⟨q,rfl⟩ := liftWord w h
  obtain ⟨v,hv,hs⟩ := shorter q
  refine ⟨v.map (decode slots), by simpa using hv,?_⟩
  intro p
  have eq := congrArg (fun f : Signature => f (testAt slots p)) hs
  exact (simulated slots p v initial).trans ((congrArg (pointMap (signed p Fin.rev)) eq).trans
    (simulated slots p q initial).symm)

end CubeDiameter.Compression
