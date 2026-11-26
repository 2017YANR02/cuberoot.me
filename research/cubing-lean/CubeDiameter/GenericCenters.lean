module

public import CubeDiameter.OrbitColor

@[expose] public section

namespace CubeDiameter.Schedule
open Filter Lift Network Rectangle Finset

def localize (p : Program) (x y : ℕ) : LocalProgram := p.map (fun lm => (lm.1,lm.2 x y))

private theorem assemble (ls : List Level) (ps : ℕ → ℕ → LocalProgram)
    (h : ∀ x y, (ps x y).map Prod.fst = ls) :
    ∃ prog : Program, prog.map Prod.fst = ls ∧ ∀ x y, localize prog x y = ps x y := by
  induction ls generalizing ps with
  | nil =>
    exact ⟨[],rfl,fun x y => (List.map_eq_nil_iff.mp (h x y)).symm⟩
  | cons l ls ih =>
    let flag := fun x y => ((ps x y).head?.map Prod.snd).getD false
    have split (x y : ℕ) : ps x y = (l,flag x y)::(ps x y).tail := by
      have ht := h x y
      cases hv : ps x y with
      | nil => simp [hv] at ht
      | cons pair q =>
        obtain ⟨k,b⟩ := pair
        simp [hv] at ht
        simp [flag,hv,ht.1]
    have ht x y : ((ps x y).tail.map Prod.fst) = ls := by
      have hh := h x y
      conv at hh => lhs; rw [split x y]
      exact (List.cons.inj hh).2
    obtain ⟨q,hq,he⟩ := ih (fun x y => (ps x y).tail) ht
    exact ⟨(l,flag)::q, by simp [hq],fun x y =>
      (congrArg (List.cons (l,flag x y)) (he x y)).trans (split x y).symm⟩

theorem execute_motion (prog : Program) (h : ∀ lm ∈ prog, lm.1 ∈ levels) (x y : ℕ) (i : Fin 24) :
    (execute prog x y i).val = motion (localize prog x y) i.val := by
  induction prog generalizing i with
  | nil => rfl
  | cons lm ls ih =>
    change (execute ls x y (lm.1.advance (lm.2 x y) i)).val =
      motion (localize ls x y) (lm.1.reorder (lm.2 x y) i.val)
    rw [ih (fun a ha => h a (by simp [ha])),advance_agrees (h lm (by simp))]

private theorem depth_eq {d e : Depths n} (r : d.row = e.row) (c : d.col = e.col) : d = e := by
  cases d; cases e; congr

/-- Choose independent switches for all ordinary center orbits. Each input
    permutation specifies which solved face color to put at each of its slots. -/
theorem route_colors (gs : Depths n → Equiv.Perm (Fin 24)) :
    ∃ prog : Program, prog.map Prod.fst = levels ∧ ∀ (d : Depths n) (i : Fin 24),
      solved n (sticker d (execute prog d.row d.col i)) = solved n (sticker d (gs d i)) := by
  classical
  let g d := extend (gs d).symm
  have result (d : Depths n) := sort_faces (g d) (extend_preserves _)
  let ps (d : Depths n) := (result d).choose
  have ok d : (ps d).map Prod.fst = levels := (result d).choose_spec.1
  let valid x y := ∃ d : Depths n, d.row = x ∧ d.col = y
  let allp x y := if hv : valid x y then ps hv.choose else levels.map (fun l => (l,false))
  have at_pair (d : Depths n) : allp d.row d.col = ps d := by
    have hv : valid d.row d.col := ⟨d,rfl,rfl⟩
    simp only [allp,dite_eq_left hv]
    rw [depth_eq hv.choose_spec.1 hv.choose_spec.2]
  have good x y : (allp x y).map Prod.fst = levels := by
    unfold allp; split
    · exact ok _
    · simp [List.map_map,Function.comp_def]
  obtain ⟨prog,hp,hproj⟩ := assemble levels allp good
  refine ⟨prog,hp,?_⟩
  intro d i
  obtain ⟨f,hf,hi⟩ := in_face (gs d i)
  apply same_face_color d hf _ hi
  have hp' : ∀ lm ∈ prog, lm.1 ∈ levels := fun _ hl => hp ▸ List.mem_map_of_mem hl
  rw [execute_motion prog hp',hproj,at_pair]
  have hpres := (result d).choose_spec.2 f hf
  have hm : (g d |>.trans (motion (ps d))) (gs d i).val ∈ imageOf ((g d).trans (motion (ps d))) f :=
    Finset.mem_map_of_mem _ hi
  rw [hpres] at hm
  simpa only [Equiv.trans_apply,g,extend_agrees,Equiv.symm_apply_apply] using hm

/-- Simultaneous reachability of all balanced colorings and the sharp
    network upper cost, on every generic center orbit of the cube. -/
theorem realize_generic_centers (ε : ℝ) (he : 0 < ε) :
    ∀ᶠ n : ℕ in atTop, ∀ gs : Depths n → Equiv.Perm (Fin 24),
      ∃ w : List (Move n), (w.length : ℝ) ≤ (61/2+ε)*scale n ∧ ∀ d i,
        paint w (sticker d i) = solved n (sticker d (gs d i)) := by
  filter_upwards [permnet61_cost ε he] with n hc gs
  obtain ⟨prog,hp,hr⟩ := route_colors gs
  obtain ⟨w,hw,ha⟩ := hc prog hp
  exact ⟨w,hw,fun d i => (congrArg (solved n) (ha d i)).trans (hr d i)⟩

/-- Every legal scramble has a word within the 30.5 budget that restores
    the colors of all its generic centers. The input length is unrestricted. -/
theorem solve_generic_centers (ε : ℝ) (he : 0 < ε) :
    ∀ᶠ n : ℕ in atTop, ∀ scramble : List (Move n),
      ∃ sol : List (Move n), (sol.length : ℝ) ≤ (61/2+ε)*scale n ∧ ∀ d i,
        paint scramble (walk sol (sticker d i)) = solved n (sticker d i) := by
  filter_upwards [realize_generic_centers ε he] with n hc scramble
  obtain ⟨w,hw,hg⟩ := hc (fun d => orbitPerm d scramble)
  refine ⟨inverseWord w,by simpa [inverseWord] using hw,?_⟩
  intro d i
  obtain ⟨j,hj⟩ := walk_closed d (inverseWord w) i
  have ht := hg d j
  rw [← orbitPerm_spec] at ht
  change solved n (walk w (sticker d j)) = paint scramble (sticker d j) at ht
  rw [← hj] at ht
  have hrev := walk_inverse (inverseWord w) (sticker d i)
  rw [inverseWord_involutive] at hrev
  exact (ht.symm.trans (congrArg (solved n) hrev))

end CubeDiameter.Schedule
