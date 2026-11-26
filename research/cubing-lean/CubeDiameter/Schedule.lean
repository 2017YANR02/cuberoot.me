module

public import CubeDiameter.StageBound

@[expose] public section

namespace CubeDiameter.Schedule
open Lift Rectangle GridStage Network Representatives Filter

/-- A 120-degree rigid rotation that cyclically permutes the three pairs of
    faces UL, FR and BD. Conjugating a physical slice turn costs one slice turn. -/
def rot (p : Point n) : Point n := (p.2.1,p.2.2.rev,p.1.rev)

def rotMove (m : Move n) : Move n :=
  match m.1 with
  | 0 => (2,m.2.1.rev,m.2.2.rev)
  | 1 => (0,m.2.1,m.2.2)
  | 2 => (1,m.2.1.rev,m.2.2.rev)

private theorem layer_reverse (i : Fin n) (u : Fin (n+2)) : onLayer i.rev u.rev = onLayer i u := by
  have hn : 0 < n := (Nat.zero_le _).trans_lt i.isLt
  simp [onLayer_owner hn,owner_rev]

private theorem step_rot (m : Move n) (p : Point n) : step (rotMove m) (rot p) = rot (step m p) := by
  rcases m with ⟨a,i,t⟩
  rcases p with ⟨x,y,z⟩
  by_cases h : onLayer i (coord a (x,y,z)) = true <;> fin_cases a <;> fin_cases t <;>
    simp [coord] at h <;> simp [step,rotMove,rot,twist,quarter,coord,layer_reverse,h]

theorem walk_rot (w : List (Move n)) (p : Point n) :
    walk (w.map rotMove) (rot p) = rot (walk w p) := by
  induction w generalizing p with
  | nil => rfl
  | cons m w ih => rw [List.map_cons,walk_cons,step_rot,ih,walk_cons]

def rotIndex : Fin 24 → Fin 24
  | 0 => 12
  | 1 => 13
  | 2 => 14
  | 3 => 15
  | 4 => 9
  | 5 => 10
  | 6 => 11
  | 7 => 8
  | 8 => 21
  | 9 => 22
  | 10 => 23
  | 11 => 20
  | 12 => 19
  | 13 => 16
  | 14 => 17
  | 15 => 18
  | 16 => 1
  | 17 => 2
  | 18 => 3
  | 19 => 0
  | 20 => 6
  | 21 => 7
  | 22 => 4
  | _ => 5

private theorem rot_wire (i : Fin 24) : rot (wire i.val) = wire (rotIndex i).val := by
  revert i; decide +kernel

private theorem rot_order (i : Fin 24) : rotIndex (rotIndex (rotIndex i)) = i := by
  revert i; decide +kernel

def sticker (d : Depths n) (i : Fin 24) := pointMap d.embed (wire i.val)

private theorem sticker_rot (d : Depths n) (i : Fin 24) :
    sticker d (rotIndex i) = rot (sticker d i) := by
  rw [sticker,← rot_wire]; simp [rot,sticker,pointMap,d.embed_rev]

abbrev Entry := Stage × List (Move 6)
structure Level where
  entry : Entry
  turn : Fin 3

def levels : List Level :=
  let first := split24.zip words24
  let middle := split16.zip words16
  let last := split8.zip words8
  first.map (fun e => ⟨e,0⟩) ++ middle.map (fun e => ⟨e,1⟩) ++
    last.map (fun e => ⟨e,0⟩) ++ last.map (fun e => ⟨e,1⟩) ++ last.map (fun e => ⟨e,2⟩)

theorem levels_length : levels.length = 61 := by decide +kernel

private theorem levels_valid : ∀ l ∈ levels, l.entry ∈ tableRows := by
  have h : levels.all (fun l => decide (l.entry ∈ tableRows)) = true := by decide +kernel
  exact fun l hl => of_decide_eq_true (List.all_eq_true.mp h l hl)

def conjugate (g : Fin 24 → Fin 24) (i : Fin 24) := rotIndex (g (rotIndex (rotIndex i)))

def Level.advance (l : Level) (active : Bool) (i : Fin 24) : Fin 24 :=
  let f := fun j => if active then output l.entry.1 j else j
  match l.turn with
  | 0 => f i
  | 1 => conjugate f i
  | 2 => conjugate (conjugate f) i

noncomputable def Level.compile (l : Level) (hn : 2 ≤ n) (width : ℕ) (active : ℕ → ℕ → Bool) :=
  let w := word hn width active l.entry.2
  match l.turn with
  | 0 => w
  | 1 => w.map rotMove
  | 2 => (w.map rotMove).map rotMove

private theorem conjugate_action (w : List (Move n)) (g : Fin 24 → Fin 24) (d : Depths n)
    (h : ∀ i, walk w (sticker d i) = sticker d (g i)) (i : Fin 24) :
    walk (w.map rotMove) (sticker d i) = sticker d (conjugate g i) := by
  let j := rotIndex (rotIndex i)
  have e : rotIndex j = i := rot_order i
  calc
    _ = walk (w.map rotMove) (rot (sticker d j)) := congrArg _ (e ▸ sticker_rot d j)
    _ = _ := by rw [walk_rot,h,← sticker_rot]; rfl

theorem level_action {l : Level} (hl : l ∈ levels) (hn : 2 ≤ n) (width : ℕ)
    (active : ℕ → ℕ → Bool) (d : Depths n) (i : Fin 24) :
    walk (l.compile hn width active) (sticker d i) =
      sticker d (l.advance (active d.row d.col) i) := by
  rcases l with ⟨⟨stage,w⟩,t⟩
  have orig := fun i => GridStage.action hn (width := width) active (levels_valid _ hl) d i
  change ∀ i, walk (word hn width active w) (sticker d i) =
    sticker d ((fun j => if active d.row d.col then output stage j else j) i) at orig
  fin_cases t
  · exact orig i
  · exact conjugate_action _ _ _ orig i
  · exact conjugate_action _ _ _ (conjugate_action _ _ _ orig) i

theorem level_length {l : Level} (hl : l ∈ levels) (hn : 2 ≤ n) {width : ℕ} (hw : 0 < width)
    (active : ℕ → ℕ → Bool) : (l.compile hn width active).length ≤ budget (side n) width := by
  rcases l with ⟨⟨stage,w⟩,t⟩
  have h := length_le hn hw active (levels_valid _ hl)
  fin_cases t <;> simpa [Level.compile] using h

/-- Give each of the 61 occurrences its own arbitrary Boolean decision at
    each ordered pair of depths, even for repeated copies of the same word. -/
abbrev Mask := ℕ → ℕ → Bool
abbrev Program := List (Level × Mask)

def execute (prog : Program) (r c : ℕ) (i : Fin 24) :=
  prog.foldl (fun j lm => lm.1.advance (lm.2 r c) j) i

noncomputable def compile (prog : Program) (hn : 2 ≤ n) (width : ℕ) :=
  prog.flatMap fun lm => lm.1.compile hn width lm.2

theorem simulate (prog : Program) (h : ∀ lm ∈ prog, lm.1 ∈ levels) (hn : 2 ≤ n) (width : ℕ)
    (d : Depths n) (i : Fin 24) :
    walk (compile prog hn width) (sticker d i) = sticker d (execute prog d.row d.col i) := by
  induction prog generalizing i with
  | nil => rfl
  | cons lm ls ih =>
    change walk (lm.1.compile hn width lm.2 ++ compile ls hn width) _ = _
    rw [walk_append,level_action (h lm (by simp)),ih (fun x hx => h x (by simp [hx]))]; rfl

theorem compile_length (prog : Program) (h : ∀ lm ∈ prog, lm.1 ∈ levels) (hn : 2 ≤ n)
    (hw : 0 < width) : (compile prog hn width).length ≤ prog.length * budget (side n) width := by
  induction prog with
  | nil => simp [compile]
  | cons lm ls ih =>
    change (lm.1.compile hn width lm.2 ++ compile ls hn width).length ≤ _
    rw [List.length_append,List.length_cons,Nat.add_mul,Nat.one_mul,Nat.add_comm _ (budget ..)]
    exact Nat.add_le_add (level_length (h lm (by simp)) hn hw lm.2) (ih (fun x hx => h x (by simp [hx])))

/-- The 30.5 coefficient for executing the complete physical network on all
    generic orbits. The mask assignment is an input to this theorem. -/
theorem permnet61_cost (ε : ℝ) (he : 0 < ε) :
    ∀ᶠ n : ℕ in atTop, ∀ prog : Program, prog.map Prod.fst = levels →
      ∃ w : List (Move n), (w.length : ℝ) ≤ (61/2+ε)*scale n ∧
        ∀ (d : Depths n) (i : Fin 24), walk w (sticker d i) = sticker d (execute prog d.row d.col i) := by
  filter_upwards [budget_asymptotic (ε/61) (by positivity), eventually_ge_atTop 2]
    with n ⟨width,hw,hb⟩ hn prog hp
  have hl : ∀ lm ∈ prog, lm.1 ∈ levels := fun lm h => hp ▸ List.mem_map_of_mem h
  have hlen : prog.length = 61 := by simpa [levels_length] using congrArg List.length hp
  have hh := compile_length prog hl hn hw
  rw [hlen] at hh
  have hc : ((compile prog hn width).length : ℝ) ≤ 61*(budget (side n) width : ℝ) := by exact_mod_cast hh
  exact ⟨_,hc.trans (by linarith [hb]),simulate prog hl hn width⟩

end CubeDiameter.Schedule
