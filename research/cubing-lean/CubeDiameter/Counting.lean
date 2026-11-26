module

public import CubeDiameter.GenericCenters
public import Mathlib.Data.Fintype.Perm
public import Mathlib.Logic.Equiv.Fin.Basic

@[expose] public section

namespace CubeDiameter.Counting
open GridStage Schedule Lift Representatives Finset

abbrev Slots := Fin 6 × Fin 4
def index : Slots ≃ Fin 24 := finProdFinEquiv

/-- The quotient of labeled placements by the four equal colors on each face. -/
def Layout := {c : Slots → Fin 6 // ∃ p : Equiv.Perm Slots, ∀ i, (p i).1 = c i}
noncomputable instance : Fintype Layout := by unfold Layout; exact Fintype.ofFinite _

def layout (p : Equiv.Perm Slots) : Layout := ⟨fun i => (p i).1,p,fun _ => rfl⟩
noncomputable def rep (c : Layout) : Equiv.Perm Slots := c.property.choose
theorem rep_spec (c : Layout) (i : Slots) : (rep c i).1 = c.val i := c.property.choose_spec i

theorem row_preserved (p : Equiv.Perm Slots) (i : Slots) :
    (p ((rep (layout p)).symm i)).1 = i.1 := by
  have h := rep_spec (layout p) ((rep (layout p)).symm i)
  rw [Equiv.apply_symm_apply] at h; exact h.symm

noncomputable def within (p : Equiv.Perm Slots) (f : Fin 6) : Equiv.Perm (Fin 4) := by
  let g := fun k : Fin 4 => (p ((rep (layout p)).symm (f,k))).2
  have hi : Function.Injective g := by
    intro a b hab
    have he : p ((rep (layout p)).symm (f,a)) = p ((rep (layout p)).symm (f,b)) :=
      Prod.ext ((row_preserved p (f,a)).trans (row_preserved p (f,b)).symm) hab
    exact congrArg Prod.snd ((rep (layout p)).symm.injective (p.injective he))
  exact Equiv.ofBijective g ⟨hi,Finite.surjective_of_injective hi⟩

theorem restore (p : Equiv.Perm Slots) (i : Slots) :
    ((rep (layout p) i).1, within p (rep (layout p) i).1 (rep (layout p) i).2) = p i := by
  apply Prod.ext
  · exact rep_spec (layout p) i
  · change (p ((rep (layout p)).symm (rep (layout p) i))).2 = _
    rw [Equiv.symm_apply_apply]

theorem slots_factorial :
    Nat.factorial 24 ≤ Fintype.card Layout * (Nat.factorial 4)^6 := by
  let code := fun p : Equiv.Perm Slots => (layout p,within p)
  have hc : Function.Injective code := by
    intro p q eq
    have h1 := congrArg Prod.fst eq
    have h2 := congrArg Prod.snd eq
    change layout p = layout q at h1
    change within p = within q at h2
    apply Equiv.ext; intro i
    have hh := restore p i
    rw [h1,h2,restore] at hh
    exact hh.symm
  simpa [Fintype.card_perm,Fintype.card_fun,Slots] using Fintype.card_le_of_injective code hc

def colorsPerOrbit := Nat.factorial 24 / (Nat.factorial 4)^6

theorem colors_le : colorsPerOrbit ≤ Fintype.card Layout := by
  have h := slots_factorial
  change 3246670537110000 ≤ _
  norm_num [Nat.factorial] at h
  omega

def pairs (n : ℕ) : Depths n ≃ (depths n).offDiag where
  toFun d := ⟨(d.row,d.col),Finset.mem_offDiag.mpr ⟨mem_depths.mpr ⟨d.row_pos,d.row_inner⟩,
    mem_depths.mpr ⟨d.col_pos,d.col_inner⟩,d.distinct⟩⟩
  invFun p := let h := Finset.mem_offDiag.mp p.property
    ⟨p.val.1,p.val.2,(mem_depths.mp h.1).1,(mem_depths.mp h.2.1).1,
      (mem_depths.mp h.1).2,(mem_depths.mp h.2.1).2,h.2.2⟩
  left_inv _ := rfl
  right_inv _ := rfl

instance (n : ℕ) : Fintype (Depths n) := Fintype.ofEquiv _ (pairs n).symm

theorem card_depth_pairs (n : ℕ) : Fintype.card (Depths n) = side n * (side n - 1) := by
  rw [Fintype.card_congr (pairs n),Fintype.card_coe,Finset.offDiag_card,card_depths,Nat.mul_sub_one]

private theorem face_read : ∀ a b : Slots, solved 6 (wire (index a).val) = solved 6 (wire (index b).val)
    → a.1 = b.1 := by decide +kernel

theorem realize (hn : 2 ≤ n) (colors : Depths n → Layout) :
    ∃ w : List (Move n), ∀ (d : Depths n) (i : Slots),
      paint w (sticker d (index i)) = solved 6 (wire (index (rep (colors d) i)).val) := by
  let gs d := index.symm.trans ((rep (colors d)).trans index)
  obtain ⟨prog,hp,hs⟩ := route_colors gs
  have hl : ∀ lm ∈ prog, lm.1 ∈ levels := fun _ h => hp ▸ List.mem_map_of_mem h
  refine ⟨compile prog hn 1,?_⟩
  intro d i
  have hh := simulate prog hl hn 1 d (index i)
  change solved n (walk _ _) = _
  rw [hh,hs,solved_sticker]; simp [gs]

noncomputable def encode (hn : 2 ≤ n) (colors : Depths n → Layout) : Position n :=
  let w := (realize hn colors).choose
  ⟨paint w,w,rfl⟩

theorem encode_injective (hn : 2 ≤ n) : Function.Injective (encode hn) := by
  intro colors colors' h
  funext d
  apply Subtype.ext
  funext i
  have he := congrArg (fun x : Position n => x.val (sticker d (index i))) h
  change paint (realize hn colors).choose _ = paint (realize hn colors').choose _ at he
  rw [(realize hn colors).choose_spec, (realize hn colors').choose_spec] at he
  exact (rep_spec (colors d) i).symm.trans ((face_read _ _ he).trans (rep_spec (colors' d) i))

theorem legal_count (n : ℕ) (hn : 2 ≤ n) :
    colorsPerOrbit ^ (side n * (side n-1)) ≤ Fintype.card (Position n) := by
  have h := Fintype.card_le_of_injective _ (encode_injective hn)
  rw [Fintype.card_fun,card_depth_pairs] at h
  exact (Nat.pow_le_pow_left colors_le _).trans h

theorem finite_lower (n : ℕ) (hn : 2 ≤ n) :
    colorsPerOrbit ^ (side n * (side n-1)) ≤ (9*n+1)^diameter n :=
  (legal_count n hn).trans (state_count_le n)

end CubeDiameter.Counting
