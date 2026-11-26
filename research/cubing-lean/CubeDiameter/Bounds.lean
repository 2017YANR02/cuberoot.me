module

public import Mathlib.Data.Fintype.BigOperators
public import Mathlib.Data.Fintype.Prod
public import Mathlib.Data.Fintype.Option
public import Mathlib.Data.Fintype.Pi
public import Mathlib.Data.Fin.Rev
public import Mathlib.Tactic.FinCases
public import Mathlib.Data.Fintype.Card
public import Mathlib.Analysis.SpecialFunctions.Log.Base
public import Mathlib.Tactic.Linarith
public import Mathlib.Tactic.Positivity
public import Mathlib.Tactic.NormNum

/-!
# A lower bound on the diameter of the slice-turn Rubik's cube

Every cube-specific definition and proof used by `lower2011` is in this file.
The solved coloring fixes the six face colors in space. Each of the three axes has
n layers and three nonidentity turns. The result is uniform for every n ≥ 16.

The independent probes below give a direct proof of the lower-bound direction of
Demaine, Demaine, Eisenstat, Lubiw and Winslow (2011), arXiv:1106.5736.
The numeric coefficient 1/128 is a convenient explicit bound for this construction.
-/

@[expose] public section

/-! ## Sticker coordinates, slice turns and distance -/

namespace CubeDiameter

open scoped Classical

/-- Axis, layer (from 0 to n-1), and amount (quarter, half, inverse quarter). -/
abbrev Move (n : ℕ) := Fin 3 × Fin n × Fin 3
abbrev Point (n : ℕ) := Fin (n+2) × Fin (n+2) × Fin (n+2)
abbrev State (n : ℕ) := Point n → Option (Fin 3 × Bool)

def coord (a : Fin 3) (p : Point n) : Fin (n+2) :=
  match a with
  | 0 => p.1
  | 1 => p.2.1
  | 2 => p.2.2

/-- Boundary planes encode sticker normals; only points on exactly one such plane carry color. -/
def boundary (u : Fin (n+2)) : Option Bool :=
  if u = 0 then some false else if u.val = n+1 then some true else none

def solved (n : ℕ) : State n := fun (x,y,z) =>
  match boundary x, boundary y, boundary z with
  | some s, none, none => some (0,s)
  | none, some s, none => some (1,s)
  | none, none, some s => some (2,s)
  | _, _, _ => none

def layer (i : Fin n) : Fin (n+2) := ⟨i.val+1, by omega⟩

def quarter (a : Fin 3) (p : Point n) : Point n :=
  let (x,y,z) := p
  match a with
  | 0 => (x,z.rev,y)
  | 1 => (z,y,x.rev)
  | 2 => (y.rev,x,z)

/-- The sentinel normal coordinate of a face sticker belongs to the adjacent
    outer layer. This makes a face turn rotate its own face as well as its rim. -/
def onLayer (i : Fin n) (u : Fin (n+2)) : Bool :=
  decide (u = layer i ∨ (u.val = 0 ∧ i.val = 0) ∨ (u.val = n+1 ∧ i.val+1 = n))

def twist (a : Fin 3) (i : Fin n) (p : Point n) : Point n :=
  if onLayer i (coord a p) then quarter a p else p

theorem coord_quarter (a : Fin 3) (p : Point n) : coord a (quarter a p) = coord a p := by
  rcases p with ⟨x,y,z⟩
  fin_cases a <;> rfl

theorem twist_four (a : Fin 3) (i : Fin n) (p : Point n) :
    twist a i (twist a i (twist a i (twist a i p))) = p := by
  by_cases h : onLayer i (coord a p) = true
  · simp only [twist, coord_quarter, h, ite_true]
    rcases p with ⟨x,y,z⟩
    fin_cases a <;> simp [quarter]
  · simp [twist, h]

def step (m : Move n) (p : Point n) : Point n :=
  let t := twist m.1 m.2.1
  match m.2.2 with
  | 0 => t p
  | 1 => t (t p)
  | 2 => t (t (t p))

def inverse (m : Move n) : Move n := (m.1, m.2.1, m.2.2.rev)

@[simp] theorem step_inverse (m : Move n) (p : Point n) : step (inverse m) (step m p) = p := by
  rcases m with ⟨a,i,r⟩
  fin_cases r <;> exact twist_four a i p

/-- Pull back the solved coloring along the word. Reversing the convention on
    composition does not change the set of words available at each length. -/
def walk (w : List (Move n)) (p : Point n) : Point n := w.foldl (fun q m => step m q) p
def paint (w : List (Move n)) : State n := solved n ∘ walk w

@[simp] theorem walk_nil (p : Point n) : walk [] p = p := rfl
@[simp] theorem walk_cons (m : Move n) (w : List (Move n)) (p : Point n) :
    walk (m :: w) p = walk w (step m p) := rfl
theorem walk_append (u v : List (Move n)) (p : Point n) :
    walk (u ++ v) p = walk v (walk u p) := List.foldl_append

def inverseWord (w : List (Move n)) := w.reverse.map inverse

theorem walk_inverse (w : List (Move n)) (p : Point n) :
    walk (inverseWord w) (walk w p) = p := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih =>
    simp only [inverseWord, List.reverse_cons, List.map_append, List.map_cons, List.map_nil]
    rw [walk_append, walk_cons]
    change step (inverse m) (walk (inverseWord w) (walk w (step m p))) = p
    rw [ih, step_inverse]

@[simp] theorem inverse_involutive (m : Move n) : inverse (inverse m) = m := by
  rcases m with ⟨a,i,r⟩
  simp [inverse]

theorem inverseWord_involutive (w : List (Move n)) : inverseWord (inverseWord w) = w := by
  simp [inverseWord, List.map_reverse, List.map_map, Function.comp_def]

/-- Every scramble of length k also has a solving word of length k. -/
theorem reverse_solves (w : List (Move n)) :
    (inverseWord w).length = w.length ∧ paint w ∘ walk (inverseWord w) = solved n := by
  refine ⟨by simp [inverseWord], ?_⟩
  funext p
  have h := walk_inverse (inverseWord w) p
  rw [inverseWord_involutive] at h
  exact congrArg (solved n) h

def Legal (s : State n) : Prop := ∃ w, paint w = s
abbrev Position (n : ℕ) := {s : State n // Legal s}
noncomputable instance (n : ℕ) : Fintype (Position n) := Fintype.ofFinite _

theorem has_length (s : Position n) : ∃ k, ∃ w : List (Move n), w.length = k ∧ paint w = s.val :=
  let ⟨w,h⟩ := s.property
  ⟨_,w,rfl,h⟩

noncomputable def distance (s : Position n) : ℕ := Nat.find (has_length s)
noncomputable def diameter (n : ℕ) : ℕ := Finset.univ.sup (distance (n := n))

theorem optimal_word (s : Position n) :
    ∃ w : List (Move n), w.length = distance s ∧ paint w = s.val := Nat.find_spec (has_length s)

theorem distance_le_diameter (s : Position n) : distance s ≤ diameter n :=
  Finset.le_sup (f := distance) (Finset.mem_univ s)

@[simp] theorem card_moves (n : ℕ) : Fintype.card (Move n) = 9*n := by
  simp [Move, Nat.mul_comm, Nat.mul_left_comm]

end CubeDiameter

/-! ## Counting bounded-length words -/

namespace CubeDiameter

/-- A length budget can be filled by idle slots. The extra symbol changes only
    lower-order terms in the logarithm of the branching factor. -/
def decode (slots : Fin d → Option (Move n)) : Position n :=
  let w := (List.ofFn slots).filterMap id
  ⟨paint w, w, rfl⟩

theorem decode_surjective (n : ℕ) :
    Function.Surjective (decode (n := n) (d := diameter n)) := by
  intro s
  obtain ⟨w, hw, hp⟩ := optimal_word s
  have hle := distance_le_diameter s
  let pad := w.map some ++ List.replicate (diameter n - w.length) none
  have hlen : pad.length = diameter n := by simp [pad]; omega
  refine ⟨fun i => pad.get (i.cast hlen.symm), Subtype.ext ?_⟩
  have heq : (List.ofFn fun i : Fin (diameter n) => pad.get (i.cast hlen.symm)) = pad := by
    apply List.ext_getElem <;> simp [hlen]
  change paint ((List.ofFn _).filterMap id) = _
  rw [heq]
  simpa [pad, List.filterMap_append, List.filterMap_replicate] using hp

theorem state_count_le (n : ℕ) :
    Fintype.card (Position n) ≤ (9*n+1) ^ diameter n := by
  simpa only [Fintype.card_fun, Fintype.card_option, card_moves, Fintype.card_fin] using Fintype.card_le_of_surjective _ (decode_surjective n)

end CubeDiameter

/-! ## Independent commutators on center stickers -/

namespace CubeDiameter
namespace Grid

/-- Disjoint shallow-depth ranges on two axes identify k² distinct center orbits. -/
abbrev Cell (k : ℕ) := Fin k × Fin k

variable {n k : ℕ}
def ix (h : 4*k+2 ≤ n) (c : Cell k) : Fin n := ⟨c.1.val+1, by have := c.1.isLt; omega⟩
def iy (h : 4*k+2 ≤ n) (c : Cell k) : Fin n := ⟨k+c.2.val+1, by have := c.2.isLt; omega⟩

private theorem onX (h : 4*k+2 ≤ n) (c : Cell k) (u : Fin (n+2)) :
    onLayer (ix h c) u = decide (u = layer (ix h c)) := by
  have := c.1.isLt
  simp [onLayer, ix, show c.1.val+1+1 ≠ n by omega]
  rfl

private theorem onY (h : 4*k+2 ≤ n) (c : Cell k) (u : Fin (n+2)) :
    onLayer (iy h c) u = decide (u = layer (iy h c)) := by
  have := c.2.isLt
  simp [onLayer, iy, show k+c.2.val+1+1 ≠ n by omega]
  rfl

def X (h : 4*k+2 ≤ n) (c : Cell k) : Move n := (0, ix h c, 0)
def Y (h : 4*k+2 ≤ n) (c : Cell k) : Move n := (1, iy h c, 0)
def block (h : 4*k+2 ≤ n) (c : Cell k) : List (Move n) :=
  [X h c, Y h c, inverse (X h c), inverse (Y h c)]
def probe (h : 4*k+2 ≤ n) (c : Cell k) : Point n := (layer (ix h c), layer (iy h c), 0)

/-- All coordinate magnitudes that can occur anywhere on this probe's orbit. -/
def band (c : Cell k) (v : Fin (n+2)) : Prop :=
  v.val = 0 ∨ v.rev.val = 0 ∨ v.val = c.1.val+2 ∨ v.rev.val = c.1.val+2 ∨
  v.val = k+c.2.val+2 ∨ v.rev.val = k+c.2.val+2

theorem band_rev {c : Cell k} {v : Fin (n+2)} (hv : band c v) : band c v.rev := by
  simp only [band, Fin.rev_rev] at *
  tauto

def inside (c : Cell k) (p : Point n) : Prop := band c p.1 ∧ band c p.2.1 ∧ band c p.2.2

theorem inside_twist {c : Cell k} {p : Point n} (hp : inside c p) (a : Fin 3) (i : Fin n) :
    inside c (twist a i p) := by
  rcases p with ⟨x,y,z⟩
  obtain ⟨hx,hy,hz⟩ := hp
  unfold twist
  split
  · fin_cases a
    · exact ⟨hx, band_rev hz, hy⟩
    · exact ⟨hz, hy, band_rev hx⟩
    · exact ⟨band_rev hy, hx, hz⟩
  · exact ⟨hx,hy,hz⟩

theorem inside_step {c : Cell k} {p : Point n} (hp : inside c p) (m : Move n) :
    inside c (step m p) := by
  rcases m with ⟨a,i,r⟩
  fin_cases r <;> repeat first | exact hp | apply inside_twist

theorem inside_walk {c : Cell k} {p : Point n} (hp : inside c p) (w : List (Move n)) :
    inside c (walk w p) := by
  induction w generalizing p with
  | nil => exact hp
  | cons m w ih => exact ih (inside_step hp m)

theorem inside_probe (h : 4*k+2 ≤ n) (c : Cell k) : inside c (probe h c) := by
  exact ⟨Or.inr (Or.inr (Or.inl rfl)), Or.inr (Or.inr (Or.inr (Or.inr (Or.inl rfl)))), Or.inl rfl⟩

private theorem band_excludes_x (h : 4*k+2 ≤ n) {c d : Cell k} (hd : d.1 ≠ c.1)
    {v : Fin (n+2)} (hv : band c v) : v ≠ layer (ix h d) := by
  intro he
  subst v
  have hne : d.1.val ≠ c.1.val := fun hn => hd (Fin.ext hn)
  have := c.1.isLt
  have := c.2.isLt
  have := d.1.isLt
  simp only [band, layer, ix, Fin.rev] at hv
  omega

private theorem band_excludes_y (h : 4*k+2 ≤ n) {c d : Cell k} (hd : d.2 ≠ c.2)
    {v : Fin (n+2)} (hv : band c v) : v ≠ layer (iy h d) := by
  intro he
  subst v
  have hne : d.2.val ≠ c.2.val := fun hn => hd (Fin.ext hn)
  have := c.1.isLt
  have := c.2.isLt
  have := d.2.isLt
  simp only [band, layer, iy, Fin.rev] at hv
  omega

theorem block_other (h : 4*k+2 ≤ n) {c d : Cell k} (hd : d ≠ c) {p : Point n}
    (hp : inside c p) : walk (block h d) p = p := by
  simp only [block, walk_cons, walk_nil]
  by_cases hx : d.1 = c.1
  · have hy : d.2 ≠ c.2 := fun he => hd (Prod.ext hx he)
    have fixY (q : Point n) (hq : inside c q) : step (Y h d) q = q := by
      simp [Y, step, twist, coord, onY, band_excludes_y h hy hq.2.1]
    rw [fixY _ (inside_step hp _), step_inverse]
    calc
      _ = step (inverse (Y h d)) (step (Y h d) p) := congrArg _ (fixY p hp).symm
      _ = p := step_inverse _ _
  · have fixX (q : Point n) (hq : inside c q) : step (X h d) q = q := by
      simp [X, step, twist, coord, onX, band_excludes_x h hx hq.1]
    rw [fixX p hp]
    let q := step (Y h d) p
    have hf : step (inverse (X h d)) q = q := by
      calc
        _ = step (inverse (X h d)) (step (X h d) q) := congrArg _ (fixX q (inside_step hp _)).symm
        _ = q := step_inverse _ _
    rw [show step (inverse (X h d)) (step (Y h d) p) = step (Y h d) p from hf, step_inverse]

private theorem interior (i : Fin n) : boundary (layer i) = none := by
  have hi := i.isLt
  simp [boundary, layer, Fin.ext_iff, Nat.ne_of_lt hi]

@[simp] theorem initial_probe (h : 4*k+2 ≤ n) (c : Cell k) : solved n (probe h c) = some (2,false) := by
  simp only [probe, solved, interior]
  rfl

theorem changed_probe (h : 4*k+2 ≤ n) (c : Cell k) :
    solved n (walk (block h c) (probe h c)) = some (0,true) := by
  let p := probe h c
  have hi := (iy h c).isLt
  have hj := (ix h c).isLt
  have hy : (0 : Fin (n+2)).rev ≠ layer (iy h c) := by
    simp [layer, Fin.ext_iff, Fin.rev]; omega
  have hyFix : step (Y h c) (step (X h c) p) = step (X h c) p := by
    simp only [p, X, Y, step, twist, onX, onY, decide_eq_true_eq, probe, quarter, coord, ite_eq_right hy, ↓reduceIte]
  simp only [block, walk_cons, walk_nil]
  rw [show probe h c = p from rfl, hyFix, step_inverse]
  change solved n (twist 1 (iy h c) (twist 1 (iy h c) (twist 1 (iy h c) p))) = _
  simp only [p, probe, twist, onY, decide_eq_true_eq, coord, quarter, ↓reduceIte, Fin.rev_rev, solved, interior]
  simp [boundary, Fin.ext_iff]

def encodeWord (h : 4*k+2 ≤ n) (bits : Cell k → Bool) (cells : List (Cell k)) : List (Move n) :=
  cells.flatMap (fun c => if bits c then block h c else [])

private theorem encode_cons (h : 4*k+2 ≤ n) (bits : Cell k → Bool) (d : Cell k) (ds : List (Cell k)) :
    encodeWord h bits (d :: ds) = (if bits d then block h d else []) ++ encodeWord h bits ds := rfl

theorem skip (h : 4*k+2 ≤ n) (bits : Cell k → Bool) {c : Cell k}
    (cells : List (Cell k)) (hc : c ∉ cells) {p : Point n} (hp : inside c p) :
    walk (encodeWord h bits cells) p = p := by
  induction cells with
  | nil => rfl
  | cons d ds ih =>
    have hd : c ≠ d := fun he => hc (List.mem_cons.mpr (.inl he))
    have ht : c ∉ ds := fun hm => hc (List.mem_cons.mpr (.inr hm))
    simp only [encode_cons, walk_append]
    cases bits d
    · exact ih ht
    · rw [show walk (if true then block h d else []) p = p from block_other h (Ne.symm hd) hp]
      exact ih ht

theorem read_probe (h : 4*k+2 ≤ n) (bits : Cell k → Bool) (c : Cell k) (cells : List (Cell k))
    (hn : cells.Nodup) (hc : c ∈ cells) :
    paint (encodeWord h bits cells) (probe h c) =
      if bits c then some (0,true) else some (2,false) := by
  induction cells with
  | nil => simp at hc
  | cons d ds ih =>
    obtain ⟨hd, ht⟩ := List.nodup_cons.mp hn
    rcases List.mem_cons.mp hc with he | hm
    · subst d
      simp only [paint, Function.comp_apply, encode_cons, walk_append]
      cases bits c
      · rw [show walk (if false then block h c else []) (probe h c) = probe h c from rfl,
            skip h bits ds hd (inside_probe h c)]
        exact initial_probe h c
      · rw [skip h bits ds hd (inside_walk (inside_probe h c) _)]
        exact changed_probe h c
    · have hne : d ≠ c := fun he => hd (he.symm ▸ hm)
      simp only [paint, Function.comp_apply, encode_cons, walk_append]
      have hfix : walk (if bits d then block h d else []) (probe h c) = probe h c := by
        cases bits d
        · rfl
        · exact block_other h hne (inside_probe h c)
      rw [hfix]
      exact ih ht hm

noncomputable def encode (h : 4*k+2 ≤ n) (bits : Cell k → Bool) : Position n :=
  let w := encodeWord h bits Finset.univ.toList
  ⟨paint w, w, rfl⟩

theorem encode_injective (h : 4*k+2 ≤ n) : Function.Injective (encode h) := by
  intro b b' he
  funext c
  have eq := congrArg (fun s : Position n => s.val (probe h c)) he
  change paint (encodeWord h b _) _ = paint (encodeWord h b' _) _ at eq
  rw [read_probe h b c _ (Finset.nodup_toList _) (by simp),
      read_probe h b' c _ (Finset.nodup_toList _) (by simp)] at eq
  cases hb : b c <;> cases hb' : b' c <;> simp_all

theorem independent_states (h : 4*k+2 ≤ n) : 2^(k*k) ≤ Fintype.card (Position n) := by
  simpa [Cell, Fintype.card_fun] using Fintype.card_le_of_injective _ (encode_injective h)

theorem finite_lower_bound (n : ℕ) (hn : 2 ≤ n) :
    2^(((n-2)/4)*((n-2)/4)) ≤ (9*n+1)^diameter n :=
  (independent_states (k := (n-2)/4) (by omega)).trans (state_count_le n)

end Grid
end CubeDiameter

/-! ## Logarithmic bound and the main inequality -/

namespace CubeDiameter

/-- All logarithms in the leading coefficients use base two. -/
noncomputable def scale (n : ℕ) : ℝ := (n : ℝ)^2 / Real.logb 2 n

theorem log_counting_bound (n : ℕ) (hn : 2 ≤ n) :
    (((n-2)/4 : ℕ) : ℝ)^2 * Real.log 2 ≤ (diameter n : ℝ) * Real.log (9*(n:ℝ)+1) := by
  have hh := Grid.finite_lower_bound n hn
  have hc : (2:ℝ)^(((n-2)/4)*((n-2)/4)) ≤ (9*(n:ℝ)+1)^diameter n := by exact_mod_cast hh
  have hl := Real.log_le_log (by positivity) hc
  simpa [Real.log_pow, pow_two, Nat.cast_mul] using hl

/-- Explicit Ω half of the 2011 diameter result, using independent commutators. -/
theorem lower2011 (n : ℕ) (hn : 16 ≤ n) : scale n / 128 ≤ diameter n := by
  have hnR : (16:ℝ) ≤ n := by exact_mod_cast hn
  have hk : n ≤ 8*((n-2)/4) := by omega
  have hkR : (n:ℝ) ≤ 8*(((n-2)/4 : ℕ):ℝ) := by exact_mod_cast hk
  have hlog : 0 < Real.log n := Real.log_pos (by linarith)
  have htwo : 0 < Real.log 2 := Real.log_pos (by norm_num)
  have hbase : 9*(n:ℝ)+1 ≤ (n:ℝ)^2 := by nlinarith [sq_nonneg ((n:ℝ)-8)]
  have hlogs := Real.log_le_log (by positivity) hbase
  rw [Real.log_pow] at hlogs
  have bound := (log_counting_bound n (by omega)).trans (mul_le_mul_of_nonneg_left hlogs (by positivity))
  have hs := pow_le_pow_left₀ (show 0 ≤ (n:ℝ) by positivity) hkR 2
  have hs' := mul_le_mul_of_nonneg_right hs htwo.le
  unfold scale
  rw [Real.logb, div_div_eq_mul_div, div_le_iff₀ (by norm_num : (0:ℝ)<128),
      div_le_iff₀ hlog]
  nlinarith

end CubeDiameter
