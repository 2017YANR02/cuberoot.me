module

public import CubeMixing.Normal
public import Mathlib.Algebra.BigOperators.Group.Finset.Basic
public import Mathlib.Data.Fintype.Option

/-! Finite inventories of the alternating-axis words, graded by length and
number of single-face blocks. No cube positions are enumerated. -/
@[expose] public section

namespace CubeMixing
open Finset

def allowed (previous : Option (Fin 3)) (h : Block) : Prop :=
  previous ≠ some h.1 ∧ zeroBlock h = false

def heads (previous : Option (Fin 3)) (double : Bool) : Finset Block :=
  univ.filter fun h => previous != some h.1 && !zeroBlock h && doubleBlock h == double

private theorem mem_heads (p : Option (Fin 3)) (d : Bool) (h : Block) :
    h ∈ heads p d ↔ allowed p h ∧ doubleBlock h = d := by
  simp [heads, allowed, and_assoc]

def prepend (h : Block) (s : Finset (List Block)) :=
  s.image (List.cons h)

def branches (p : Option (Fin 3)) (d : Bool) (tails : Fin 3 → Finset (List Block)) :=
  (heads p d).biUnion fun h => prepend h (tails h.1)

private theorem mem_branches (p : Option (Fin 3)) (d : Bool)
    (tails : Fin 3 → Finset (List Block)) (w : List Block) :
    w ∈ branches p d tails ↔ ∃ h v, w = h :: v ∧ allowed p h ∧ doubleBlock h = d ∧ v ∈ tails h.1 := by
  simp only [branches, mem_biUnion, mem_heads, prepend, mem_image]
  constructor
  · rintro ⟨h, ⟨hp, hd⟩, v, hv, rfl⟩
    exact ⟨h,v,rfl,hp,hd,hv⟩
  · rintro ⟨h,v,rfl,hp,hd,hv⟩
    exact ⟨h,⟨hp,hd⟩,v,hv,rfl⟩

private theorem branches_disjoint (p : Option (Fin 3)) (u v : Fin 3 → Finset (List Block)) :
    Disjoint (branches p false u) (branches p true v) := by
  rw [Finset.disjoint_left]
  intro w hw h'w
  obtain ⟨h,t,rfl,_,h₁,_⟩ := (mem_branches ..).mp hw
  obtain ⟨h',v,he,_,h₂,_⟩ := (mem_branches ..).mp h'w
  cases he
  simp_all

private theorem card_branches (p : Option (Fin 3)) (d : Bool)
    (tails : Fin 3 → Finset (List Block)) (n : ℕ) (ht : ∀ i, (tails i).card = n) :
    (branches p d tails).card = (heads p d).card * n := by
  unfold branches
  rw [card_biUnion]
  · simp [prepend, card_image_of_injective _ List.cons_injective, ht]
  · intro h _ h' _ hne
    apply Finset.disjoint_left.mpr
    intro w hw hw'
    obtain ⟨t,_,rfl⟩ := mem_image.mp hw
    obtain ⟨v,_,he⟩ := mem_image.mp hw'
    cases he
    exact hne rfl

def headNumber (first d : Bool) : ℕ :=
  (if first then 3 else 2) * (if d then 9 else 6)

private theorem card_heads (p : Option (Fin 3)) (d : Bool) :
    (heads p d).card = headNumber p.isNone d := by
  exact (by decide : ∀ (q : Option (Fin 3)) (b : Bool), (heads q b).card = headNumber q.isNone b) p d

def inventoryAux (p : Option (Fin 3)) : ℕ → ℕ → Finset (List Block)
  | 0, 0 => {[]}
  | 0, _+1 => ∅
  | r+1, 0 => branches p true (fun i => inventoryAux (some i) r 0)
  | r+1, a+1 => branches p false (fun i => inventoryAux (some i) r a) ∪
                 branches p true (fun i => inventoryAux (some i) r (a+1))
termination_by r _ => r

private theorem cons_pre (p : Option (Fin 3)) (h : Block) (v : List Block) :
    Normal (h :: v) ∧ (∀ i ∈ p, freshAxis i (h :: v)) ↔
      allowed p h ∧ (Normal v ∧ ∀ i ∈ some h.1, freshAxis i v) := by
  cases p <;> simp [allowed, Normal, freshAxis] <;> tauto

private theorem mem_aux (p : Option (Fin 3)) (r a : ℕ) (w : List Block) :
    w ∈ inventoryAux p r a ↔ (Normal w ∧ ∀ i ∈ p, freshAxis i w) ∧ w.length = r ∧ singles w = a := by
  induction r generalizing p a w with
  | zero =>
    cases w <;> cases a <;> simp [inventoryAux, Normal, freshAxis, singles]
  | succ r ih =>
    cases a <;> cases w <;>
      simp only [inventoryAux, mem_union, mem_branches, List.cons.injEq,
        List.length_nil, List.length_cons, Nat.succ.injEq, Nat.zero_ne_add_one, cons_pre, singles]
    all_goals try simp
    all_goals rename_i h v
    all_goals cases hd : doubleBlock h <;> simp [ih, Nat.add_comm, and_assoc, and_left_comm]

/-- Root inventory; the grade is the number of occupied axes in the word
(counting repetitions at different blocks), followed by the number of single-face blocks. -/
def classWords := inventoryAux none

theorem mem_classWords (r a : ℕ) (w : List Block) :
    w ∈ classWords r a ↔ Normal w ∧ w.length = r ∧ singles w = a := by
  simp [classWords, mem_aux]

/-- Compute all grades of one length together; the recurrence has polynomial size. -/
def sizeRows : ℕ → Array ℕ
  | 0 => #[1]
  | r+1 =>
    let prev := sizeRows r
    Array.ofFn fun i : Fin (r+2) =>
      (if i.val = 0 then 0 else 12 * prev[i.val-1]?.getD 0) + 18 * prev[i.val]?.getD 0

def size (first : Bool) : ℕ → ℕ → ℕ
  | 0, a => if a = 0 then 1 else 0
  | r+1, a => (if a = 0 then 0 else headNumber first false * (sizeRows r)[a-1]?.getD 0) +
                headNumber first true * (sizeRows r)[a]?.getD 0

private theorem rows_size (r : ℕ) : (sizeRows r).size = r+1 := by
  cases r <;> simp [sizeRows]

private theorem lookup_row (r a : ℕ) : (sizeRows r)[a]?.getD 0 = size false r a := by
  cases r with
  | zero => cases a <;> simp [sizeRows,size]
  | succ r =>
    by_cases ha : a < r+2
    · have e : a < (sizeRows (r+1)).size := by rw [rows_size]; omega
      rw [getElem?_pos (sizeRows (r+1)) a e]
      simp [sizeRows,size,headNumber]
    · have e : (sizeRows (r+1)).size ≤ a := by rw [rows_size]; omega
      have e' : (sizeRows r).size ≤ a-1 := by rw [rows_size]; omega
      have e'' : (sizeRows r).size ≤ a := by omega
      simp [Array.getElem?_eq_none e,size,
        Array.getElem?_eq_none e',
        Array.getElem?_eq_none e'']

private theorem card_aux (r a : ℕ) (p : Option (Fin 3)) :
    (inventoryAux p r a).card = size p.isNone r a := by
  induction r generalizing a p with
  | zero => cases a <;> simp [inventoryAux, size]
  | succ r ih =>
    have cb (d : Bool) (j : ℕ) :
        (branches p d (fun i => inventoryAux (some i) r j)).card =
          headNumber p.isNone d * (sizeRows r)[j]?.getD 0 := by
      rw [card_branches p d _ (size false r j) (fun i => ih j (some i)), card_heads, lookup_row]
    cases a with
    | zero => simp [inventoryAux, size, cb]
    | succ a =>
      rw [inventoryAux, card_union_of_disjoint (branches_disjoint ..), cb, cb]
      simp [size]

def classSize := size true

theorem card_classWords (r a : ℕ) : (classWords r a).card = classSize r a := card_aux r a none

end CubeMixing
