module

public import CubeKernel.Geometry
public import CubeDiameter.Rectangle

/-! Identify the labelled-depth geometry with the six-colour, single-slice
model in `CubeDiameter`. A depth alphabet of size r gives a cube of order
2r+2 (even) or 2r+3 (odd). The normal of a face belongs to its outer layer. -/

@[expose] public section

namespace CubeKernel.Physical

def order (r : ℕ) (o : Bool) := 2*r + 2 + o.toNat

theorem order_pos (r : ℕ) (o : Bool) : 0 < order r o := by simp [order]

theorem order_of_size {n : ℕ} (hn : 2 ≤ n) :
    order ((n-2)/2) (decide (n%2 = 1)) = n := by
  by_cases h : n%2 = 1 <;> simp [order,h] <;> omega

def sliceIndex (s : Slice (Fin r) o) : Fin (order r o) :=
  match s with
  | .outer false => ⟨0, order_pos r o⟩
  | .outer true => (⟨0, order_pos r o⟩ : Fin (order r o)).rev
  | .inner d false => ⟨d.val+1, by have := d.isLt; simp only [order]; omega⟩
  | .inner d true => (⟨d.val+1, by have := d.isLt; simp only [order]; omega⟩ : Fin (order r o)).rev
  | .middle h => ⟨r+1, by simp only [order]; omega⟩

theorem sliceIndex_rev (s : Slice (Fin r) o) : sliceIndex s.rev = (sliceIndex s).rev := by
  cases s with
  | outer b => cases b <;> simp [Slice.rev,sliceIndex]
  | inner d b => cases b <;> simp [Slice.rev,sliceIndex]
  | middle h =>
    subst o
    apply Fin.ext
    simp [sliceIndex,Slice.rev,Fin.rev,order]; omega

def readSlice (i : Fin (order r o)) : Slice (Fin r) o :=
  if hz : i.val = 0 then .outer false
  else if he : i.val+1 = order r o then .outer true
  else if hl : i.val ≤ r then .inner ⟨i.val-1, by omega⟩ false
  else if hh : i.rev.val ≤ r then .inner ⟨i.rev.val-1, by have := i.isLt; simp only [Fin.rev] at *; omega⟩ true
  else .middle (by
    have hi := i.isLt
    cases o <;> simp_all [order,Fin.rev]; omega)

@[simp] theorem sliceIndex_read (i : Fin (order r o)) : sliceIndex (readSlice i) = i := by
  have hi := i.isLt
  apply Fin.ext
  unfold readSlice
  split <;> rename_i h
  · simpa [sliceIndex] using h.symm
  split <;> rename_i h'
  · simp [sliceIndex,Fin.rev]; omega
  split <;> rename_i hl
  · simp [sliceIndex]; omega
  split <;> rename_i hh
  · simp [sliceIndex,Fin.rev]; omega
  · change r+1 = i.val
    have hr : ¬ order r o - (i.val+1) ≤ r := hh
    have ht : o.toNat ≤ 1 := by cases o <;> decide
    simp only [order] at hr hi
    omega

@[simp] theorem readSlice_index (s : Slice (Fin r) o) : readSlice (sliceIndex s) = s := by
  cases s with
  | outer b =>
    cases b
    · simp [readSlice,sliceIndex]
    · have hl : 0 < order r o - 1 := by simp [order]
      have hr : order r o - 1 + 1 = order r o := by have := order_pos r o; omega
      simp [readSlice,sliceIndex,Fin.rev,Nat.ne_of_gt hl,hr]
  | inner d b =>
    have hd := d.isLt
    have h1 : d.val+1+1 ≠ order r o := by simp [order]; omega
    have h2 : order r o - (d.val+1+1) ≠ 0 := by simp [order]; omega
    have h3 : order r o - (d.val+1+1) + 1 ≠ order r o := by simp [order]; omega
    have h4 : ¬order r o - (d.val+1+1) ≤ r := by simp [order]; omega
    have h5 : order r o - (order r o - (d.val+1+1) + 1) = d.val+1 := by simp [order]; omega
    cases b <;> simp [readSlice,sliceIndex,Fin.rev,h1,h2,h3,h4,h5,show d.val+1≤r by omega]
  | middle h =>
    subst o
    have h1 : r+1+1 ≠ order r true := by simp [order]; omega
    have h2 : ¬ (order r true - (r+1+1)) ≤ r := by simp [order]; omega
    simp [readSlice,sliceIndex,Fin.rev,h1,h2]

def sliceEquiv (r : ℕ) (o : Bool) : Slice (Fin r) o ≃ Fin (order r o) :=
  ⟨sliceIndex,readSlice,readSlice_index,sliceIndex_read⟩

def coordIndex (x : Coord (Fin r) o) : Fin (order r o + 2) :=
  match x with
  | .normal false => 0
  | .normal true => Fin.last (order r o + 1)
  | .layer s => CubeDiameter.layer (sliceIndex s)

theorem coordIndex_rev (x : Coord (Fin r) o) : coordIndex x.rev = (coordIndex x).rev := by
  cases x with
  | normal b => cases b <;> simp [coordIndex,Coord.rev]
  | layer s =>
    apply Fin.ext
    have hi := (sliceIndex s).isLt
    simp [coordIndex,Coord.rev,sliceIndex_rev,CubeDiameter.layer,Fin.rev]
    omega

theorem owner_coordIndex (x : Coord (Fin r) o) :
    CubeDiameter.Rectangle.owner (order_pos r o) (coordIndex x) = sliceIndex x.owner := by
  cases x with
  | normal b =>
    cases b <;> apply Fin.ext <;> simp [Coord.owner,coordIndex,sliceIndex,
      CubeDiameter.Rectangle.owner,Fin.rev]
  | layer s => exact CubeDiameter.Rectangle.owner_layer _ _

def pointIndex (p : Point (Fin r) o) : CubeDiameter.Point (order r o) :=
  (coordIndex p.1,coordIndex p.2.1,coordIndex p.2.2)

def turnIndex (m : Turn (Fin r) o) : CubeDiameter.Move (order r o) :=
  (m.1,sliceIndex m.2.1,m.2.2)

def turnEquiv (r : ℕ) (o : Bool) : Turn (Fin r) o ≃ CubeDiameter.Move (order r o) :=
  ⟨turnIndex, fun m => (m.1,readSlice m.2.1,m.2.2), by intro m; simp [turnIndex],
    by intro m; simp [turnIndex]⟩

theorem index_coordinate (a : Fin 3) (p : Point (Fin r) o) :
    CubeDiameter.coord a (pointIndex p) = coordIndex (coordinate a p) := by
  fin_cases a <;> rfl

theorem index_rotate (a : Fin 3) (p : Point (Fin r) o) :
    CubeDiameter.quarter a (pointIndex p) = pointIndex (rotate a p) := by
  rcases p with ⟨x,y,z⟩
  fin_cases a <;> simp [CubeDiameter.quarter,pointIndex,rotate,coordIndex_rev]

theorem index_quarter (a : Fin 3) (s : Slice (Fin r) o) (p : Point (Fin r) o) :
    CubeDiameter.twist a (sliceIndex s) (pointIndex p) = pointIndex (quarter a s p) := by
  have inj : Function.Injective (@sliceIndex r o) := (sliceEquiv r o).injective
  simp only [CubeDiameter.twist,CubeDiameter.Rectangle.onLayer_owner (order_pos r o),
    index_coordinate,owner_coordIndex,inj.eq_iff,decide_eq_true_eq,quarter]
  split <;> simp [index_rotate]

theorem index_step (m : Turn (Fin r) o) (p : Point (Fin r) o) :
    CubeDiameter.step (turnIndex m) (pointIndex p) = pointIndex (step m p) := by
  rcases m with ⟨a,s,t⟩
  fin_cases t <;> simp [turnIndex,step,CubeDiameter.step,index_quarter]

theorem index_walk (w : List (Turn (Fin r) o)) (p : Point (Fin r) o) :
    CubeDiameter.walk (w.map turnIndex) (pointIndex p) = pointIndex (walk w p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih => simp [CubeDiameter.walk_cons,index_step,ih]

private theorem bd_coordIndex (x : Coord (Fin r) o) :
    CubeDiameter.boundary (coordIndex x) =
      match x with | .normal b => some b | .layer _ => none := by
  cases x with
  | normal b => cases b <;> simp [coordIndex,CubeDiameter.boundary,Fin.ext_iff]
  | layer s =>
    have hl := (sliceIndex s).isLt
    simp [coordIndex,CubeDiameter.boundary,CubeDiameter.layer,Fin.ext_iff]
    omega

theorem index_solved (p : Point (Fin r) o) :
    CubeDiameter.solved (order r o) (pointIndex p) = solved p := by
  rcases p with ⟨x,y,z⟩
  cases x <;> cases y <;> cases z <;> simp [CubeDiameter.solved,pointIndex,bd_coordIndex,solved]

theorem index_paint (w : List (Turn (Fin r) o)) (p : Sticker (Fin r) o) :
    CubeDiameter.paint (w.map turnIndex) (pointIndex (chart p)) = paint w p := by
  simp [CubeDiameter.paint,index_walk,index_solved,paint]

def readCoord (i : Fin (order r o + 2)) : Coord (Fin r) o :=
  if hz : i.val = 0 then .normal false
  else if he : i.val = order r o + 1 then .normal true
  else .layer (readSlice ⟨i.val-1, by have := i.isLt; omega⟩)

@[simp] theorem coordIndex_read (i : Fin (order r o + 2)) : coordIndex (readCoord i) = i := by
  apply Fin.ext
  unfold readCoord
  split <;> rename_i hz
  · simpa [coordIndex] using hz.symm
  split <;> rename_i he
  · simpa [coordIndex] using he.symm
  simp [coordIndex,CubeDiameter.layer]
  omega

@[simp] theorem readCoord_index (x : Coord (Fin r) o) : readCoord (coordIndex x) = x := by
  cases x with
  | normal b => cases b <;> simp [coordIndex,readCoord]
  | layer s =>
    have h := (sliceIndex s).isLt
    simp [coordIndex,readCoord,CubeDiameter.layer,Nat.ne_of_lt h]

def readPoint (p : CubeDiameter.Point (order r o)) : Point (Fin r) o :=
  (readCoord p.1,readCoord p.2.1,readCoord p.2.2)

@[simp] theorem pointIndex_read (p : CubeDiameter.Point (order r o)) :
    pointIndex (readPoint p) = p := by simp [pointIndex,readPoint]

@[simp] theorem readPoint_index (p : Point (Fin r) o) :
    readPoint (pointIndex p) = p := by simp [pointIndex,readPoint]

/-- Invert the face chart exactly at the points bearing a sticker. -/
def readChart (p : Point D o) : Option (Sticker D o) :=
  match p with
  | (.normal b, .layer x, .layer y) => some (0,b,x,y)
  | (.layer x, .normal b, .layer y) => some (1,b,x,y)
  | (.layer x, .layer y, .normal b) => some (2,b,x,y)
  | _ => none

@[simp] theorem readChart_chart (s : Sticker D o) : readChart (chart s) = some s := by
  rcases s with ⟨a,b,x,y⟩
  fin_cases a <;> rfl

theorem chart_of_read {p : Point D o} {s : Sticker D o} (h : readChart p = some s) :
    chart s = p := by
  rcases p with ⟨x,y,z⟩
  cases x <;> cases y <;> cases z <;> simp [readChart] at h <;> subst s <;> rfl

private def normalWeight : Coord D o → ℕ
  | .normal _ => 1
  | .layer _ => 0

private def weight (p : Point D o) := normalWeight p.1 + normalWeight p.2.1 + normalWeight p.2.2

private theorem weight_step [DecidableEq D] (m : Turn D o) (p : Point D o) :
    weight (step m p) = weight p := by
  have hr (c : Coord D o) : normalWeight c.rev = normalWeight c := by cases c <;> rfl
  have hq (a : Fin 3) (q : Point D o) : weight (rotate a q) = weight q := by
    rcases q with ⟨x,y,z⟩
    fin_cases a <;> simp [weight,rotate,hr,Nat.add_comm,Nat.add_left_comm,Nat.add_assoc]
  have ht (a : Fin 3) (s : Slice D o) (q : Point D o) : weight (quarter a s q) = weight q := by
    unfold quarter; split <;> simp [hq]
  rcases m with ⟨a,s,t⟩
  fin_cases t <;> simp [step,ht]

private theorem weight_walk [DecidableEq D] (w : List (Turn D o)) (p : Point D o) :
    weight (walk w p) = weight p := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih => simp [ih,weight_step]

theorem solved_walk_off_chart [DecidableEq D] (w : List (Turn D o)) (p : Point D o)
    (hp : readChart p = none) : solved (walk w p) = none := by
  have h : weight p ≠ 1 := by
    rcases p with ⟨x,y,z⟩
    cases x <;> cases y <;> cases z <;> simp_all [weight,normalWeight,readChart]
  have ht : weight (walk w p) ≠ 1 := by rw [weight_walk]; exact h
  generalize walk w p = q at ht ⊢
  rcases q with ⟨x,y,z⟩
  cases x <;> cases y <;> cases z <;> simp_all [weight,normalWeight,solved]

abbrev Colors (D : Type) (o : Bool) := Sticker D o → Option (Fin 3 × Bool)

def observe (s : CubeDiameter.State (order r o)) : Colors (Fin r) o :=
  fun p => s (pointIndex (chart p))

def extend (s : Colors (Fin r) o) : CubeDiameter.State (order r o) :=
  fun p => (readChart (readPoint p)).bind s

@[simp] theorem observe_extend (s : Colors (Fin r) o) : observe (extend s) = s := by
  funext p
  simp [observe,extend]

theorem extend_paint (w : List (Turn (Fin r) o)) :
    extend (paint w) = CubeDiameter.paint (w.map turnIndex) := by
  funext p
  generalize hq : readPoint p = q
  have hpt : pointIndex q = p := hq ▸ pointIndex_read p
  subst p
  simp only [extend,readPoint_index]
  cases hs : readChart q with
  | some a =>
    rw [← chart_of_read hs]
    exact (index_paint w a).symm
  | none =>
    change none = CubeDiameter.solved _ (CubeDiameter.walk (w.map turnIndex) (pointIndex q))
    rw [index_walk,index_solved,solved_walk_off_chart w q hs]

theorem extend_observe_legal {s : CubeDiameter.State (order r o)} (hs : CubeDiameter.Legal s) :
    extend (observe s) = s := by
  obtain ⟨w,rfl⟩ := hs
  let e := turnEquiv r o
  let w' := w.map e.symm
  have hw : w'.map turnIndex = w := by
    simp only [w',List.map_map]
    have h : turnIndex ∘ e.symm = id := funext fun m => e.apply_symm_apply m
    simp [h]
  rw [← hw,← extend_paint,observe_extend]

/-- A physical input is given by its six arrays of sticker colours. Such an
input extends uniquely by absence of colour at non-sticker coordinates. -/
theorem within_iff (s : Colors (Fin r) o) (k : ℕ) :
    (∃ w : List (Turn (Fin r) o), w.length ≤ k ∧ paint w = s) ↔
      ∃ w : List (CubeDiameter.Move (order r o)), w.length ≤ k ∧
        CubeDiameter.paint w = extend s := by
  constructor
  · rintro ⟨w,hl,rfl⟩
    exact ⟨w.map turnIndex,by simpa using hl,(extend_paint w).symm⟩
  · rintro ⟨w,hl,he⟩
    let e := turnEquiv r o
    let w' := w.map e.symm
    have hm : w'.map turnIndex = w := by
      simp only [w',List.map_map]
      have h : turnIndex ∘ e.symm = id := funext fun m => e.apply_symm_apply m
      simp [h]
    refine ⟨w',by simpa [w'] using hl,?_⟩
    rw [← hm, ← extend_paint] at he
    simpa using congrArg observe he

theorem within_legal_iff {s : CubeDiameter.State (order r o)} (hs : CubeDiameter.Legal s) (k : ℕ) :
    (∃ w : List (Turn (Fin r) o), w.length ≤ k ∧ paint w = observe s) ↔
      ∃ w : List (CubeDiameter.Move (order r o)), w.length ≤ k ∧ CubeDiameter.paint w = s := by
  rw [within_iff, extend_observe_legal hs]

end CubeKernel.Physical
