module

public import CubeKernel.Main

/-! Dense, six-colour kernel instances. Only the new depth count, the parity
of the side, and six square arrays survive the preprocessing step. -/

@[expose] public section

namespace CubeKernel.Physical

abbrev Grid (α : Type) (n : Nat) := Vector (Vector α n) n

/-- In axis order, the negative and positive face grids. -/
abbrev PackedFaces (α : Type) (n : Nat) := Vector (Grid α n × Grid α n) 3

def packGrid {α : Type} {r : Nat} {o : Bool} (x : Sticker (Fin r) o → α)
    (axis : Fin 3) (sign : Bool) : Grid α (order r o) :=
  Vector.ofFn fun i => Vector.ofFn fun j => x (axis, sign, readSlice i, readSlice j)

def pack {α : Type} {r : Nat} {o : Bool} (x : Sticker (Fin r) o → α) :
    PackedFaces α (order r o) :=
  Vector.ofFn fun axis => (packGrid x axis false, packGrid x axis true)

def unpack {α : Type} {r : Nat} {o : Bool} (x : PackedFaces α (order r o)) :
    Sticker (Fin r) o → α :=
  fun (axis, sign, i, j) =>
    let grid := if sign then x[axis].2 else x[axis].1
    grid[sliceIndex i][sliceIndex j]

@[simp] theorem unpack_pack {α : Type} {r : Nat} {o : Bool} (x : Sticker (Fin r) o → α) :
    unpack (pack x) = x := by
  funext p
  rcases p with ⟨axis,sign,i,j⟩
  cases sign <;> simp [unpack, pack, packGrid]

@[simp] theorem pack_unpack {α : Type} {r : Nat} {o : Bool} (x : PackedFaces α (order r o)) :
    pack (unpack (r := r) (o := o) x) = x := by
  apply Vector.ext
  intro a ha
  apply Prod.ext
  all_goals apply Vector.ext; intro i hi; apply Vector.ext; intro j hj
  all_goals simp [pack, packGrid, unpack]

/-- Six explicit colours. Optional missing colours of the chart model never
appear in the dense input or the output. -/
abbrev StickerColor := Fin 3 × Bool

structure PackedCube where
  depthCount : Nat
  odd : Bool
  faces : PackedFaces StickerColor (order depthCount odd)

namespace PackedCube

def colors (x : PackedCube) : Colors (Fin x.depthCount) x.odd := some ∘ unpack x.faces

def stickerCount (x : PackedCube) : Nat := 6 * (order x.depthCount x.odd)^2

/-- Restrict and renumber, then materialize every output sticker. -/
def keep (x : PackedCube) (R : Finset (Fin x.depthCount)) : PackedCube where
  depthCount := R.card
  odd := x.odd
  faces := pack fun p => unpack x.faces
    (mapSticker Subtype.val (mapSticker (R.orderIsoOfFin rfl).toEquiv p))

theorem keep_short_iff (x : PackedCube) (R : Finset (Fin x.depthCount)) (k : Nat) :
    Short (keep x R).colors k ↔ Short (restrict R x.colors) k := by
  unfold colors keep
  simp only [unpack_pack]
  exact short_pull_iff (R.orderIsoOfFin rfl).toEquiv (restrict R x.colors) k

/-- A missing output is an immediate negative answer. -/
def kernel (x : PackedCube) (k : Nat) : Option PackedCube :=
  (retained x.colors k).map (keep x)

theorem kernel_correct (x : PackedCube) (k : Nat) :
    match kernel x k with
    | none => ¬ Short x.colors k
    | some y => y.odd = x.odd ∧ order y.depthCount y.odd ≤ 4*k+7 ∧
        y.stickerCount ≤ 6*(4*k+7)^2 ∧ (Short x.colors k ↔ Short y.colors k) := by
  have h := short_solution_kernel x.colors k
  unfold kernel
  cases hr : retained x.colors k with
  | none => simpa only [hr, Option.map_none] using h
  | some R =>
    simp only [hr] at h
    have hd : order R.card x.odd ≤ 4*k+7 := by
      have e : order R.card x.odd = side R.card x.odd := by cases x.odd <;> rfl
      exact e ▸ h.1
    exact ⟨rfl, hd, Nat.mul_le_mul_left 6 (Nat.pow_le_pow_left hd 2),
      h.2.trans (keep_short_iff x R k).symm⟩

theorem short_iff_distance (x : PackedCube) (k : Nat)
    (s : CubeDiameter.Position (order x.depthCount x.odd)) (hs : observe s.val = x.colors) :
    Short x.colors k ↔ CubeDiameter.distance s ≤ k := hs ▸ named_short_iff s k

end PackedCube

end CubeKernel.Physical
