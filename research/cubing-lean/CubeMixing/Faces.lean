module

public import CubeDiameter.Bounds
public import CubeMixing.Normal
public import Mathlib.Algebra.Group.Subgroup.Lattice
public import Mathlib.GroupTheory.Perm.Basic

/-! The 18 face turns used in the random walk. A facelet is numbered by
face axis, side, and the other two geometric coordinates (in axis order).
The six quarter-turn permutations are restrictions of the slice turns in
`CubeDiameter` to the 54 coloured stickers of a fixed-centre 3×3×3. -/

@[expose] public section
namespace CubeMixing

abbrev Sticker := Fin 54

def stickerPoint (s : Sticker) : CubeDiameter.Point 3 :=
  let side : Fin 5 := if s.val / 9 % 2 = 0 then 0 else 4
  let u : Fin 5 := ⟨s.val / 3 % 3 + 1, by omega⟩
  let v : Fin 5 := ⟨s.val % 3 + 1, by omega⟩
  if s.val < 18 then (side,u,v) else if s.val < 36 then (u,side,v) else (u,v,side)

def stickerIndex (p : CubeDiameter.Point 3) : Sticker :=
  let encode (a : Nat) (side u v : Fin 5) : Sticker :=
    ⟨(18*a + (if side = 4 then 9 else 0) + 3*(u.val-1) + (v.val-1)) % 54, by omega⟩
  if p.1 = 0 ∨ p.1 = 4 then encode 0 p.1 p.2.1 p.2.2
  else if p.2.1 = 0 ∨ p.2.1 = 4 then encode 1 p.2.1 p.1 p.2.2
  else encode 2 p.2.2 p.1 p.2.1

def faceMap (a : Fin 3) (high : Bool) (s : Sticker) : Sticker :=
  stickerIndex (CubeDiameter.twist a (if high then 2 else 0) (stickerPoint s))

theorem face_geometry : ∀ a h s, stickerPoint (faceMap a h s) =
    CubeDiameter.twist a (if h then 2 else 0) (stickerPoint s) := by decide

theorem sticker_index_point : ∀ s : Sticker, stickerIndex (stickerPoint s) = s := by decide

theorem face_four (a : Fin 3) (h : Bool) (s : Sticker) :
    faceMap a h (faceMap a h (faceMap a h (faceMap a h s))) = s := by
  apply Function.LeftInverse.injective sticker_index_point
  simp only [face_geometry, CubeDiameter.twist_four]

def face (a : Fin 3) (h : Bool) : Equiv.Perm Sticker where
  toFun := faceMap a h
  invFun s := faceMap a h (faceMap a h (faceMap a h s))
  left_inv := face_four a h
  right_inv := face_four a h

def faceGroup : Subgroup (Equiv.Perm Sticker) :=
  Subgroup.closure (Set.range fun i : Fin 3 × Bool => face i.1 i.2)

def generator (a : Fin 3) (h : Bool) : faceGroup :=
  ⟨face a h, Subgroup.subset_closure ⟨(a,h), rfl⟩⟩

theorem generator_four (a : Fin 3) (h : Bool) : generator a h ^ 4 = 1 := by
  apply Subtype.ext
  apply Equiv.ext
  intro x
  simpa [pow_succ, generator, face] using face_four a h x

theorem opposite_commute (a : Fin 3) : Commute (generator a false) (generator a true) := by
  apply Subtype.ext
  apply Equiv.ext
  intro x
  exact (by decide : ∀ i : Fin 3, ∀ s : Sticker,
    faceMap i false (faceMap i true s) = faceMap i true (faceMap i false s)) a x

def turn (m : Move) : faceGroup := generator m.1 m.2.1 ^ m.2.2.succ.val

def blockTurn (b : Block) : faceGroup :=
  generator b.1 false ^ b.2.1.val * generator b.1 true ^ b.2.2.val

def evalBlocks : List Block → faceGroup
  | [] => 1
  | b :: w => blockTurn b * evalBlocks w

private theorem add_exponents (a : Fin 3) (s : Bool) (i j : Fin 4) :
    generator a s ^ (i+j).val = generator a s ^ i.val * generator a s ^ j.val := by
  rw [← pow_add, Fin.val_add]
  let x := generator a s
  have h : x ^ 4 = 1 := generator_four ..
  change x ^ ((i.val+j.val)%4) = x ^ (i.val+j.val)
  conv_rhs => rw [← Nat.mod_add_div (i.val+j.val) 4]
  rw [pow_add, pow_mul, h, one_pow, mul_one]

private theorem block_start (m : Move) : blockTurn (startBlock m) = turn m := by
  rcases m with ⟨a,h,s⟩
  cases h <;> simp [blockTurn,startBlock,turn]

private theorem block_merge (m : Move) (h : Block) (ha : m.1 = h.1) :
    blockTurn (mergeBlock m h) = turn m * blockTurn h := by
  rcases m with ⟨a,b,s⟩
  rcases h with ⟨a',x,y⟩
  change a = a' at ha
  subst a'
  cases b
  · simp [mergeBlock,blockTurn,startBlock,turn,add_exponents,mul_assoc]
  · have hc := ((opposite_commute a).pow_pow x.val s.succ.val).eq
    simp [mergeBlock,blockTurn,startBlock,turn,add_exponents, ← mul_assoc]
    exact hc

private theorem block_zero (h : Block) (hz : zeroBlock h = true) : blockTurn h = 1 := by
  rcases h with ⟨a,x,y⟩
  simp [zeroBlock] at hz
  obtain ⟨rfl,rfl⟩ := hz
  simp [blockTurn]

theorem eval_normalStep (m : Move) (w : List Block) :
    evalBlocks (normalStep m w) = turn m * evalBlocks w := by
  cases w with
  | nil => simp [normalStep,evalBlocks,block_start]
  | cons h w =>
    by_cases ha : m.1 = h.1
    · by_cases hz : zeroBlock (mergeBlock m h) = true
      · have e := (block_merge m h ha).symm.trans (block_zero _ hz)
        simp [normalStep,ha,hz,evalBlocks, ← mul_assoc,e]
      · simp [normalStep,ha,hz,evalBlocks,block_merge _ _ ha,mul_assoc]
    · simp [normalStep,ha,evalBlocks,block_start]

end CubeMixing
