import CubeComm.Rows

namespace CubeComm

/-- Add one slot by prepending a singleton or lengthening the first part. -/
private def grow : List Nat → List (List Nat)
  | [] => [[1]]
  | k :: ks => [1 :: k :: ks, (k+1) :: ks]

def compositions : Nat → List (List Nat)
  | 0 => [[]]
  | n+1 => (compositions n).flatMap grow

theorem composition_mem (parts : List Nat) (pos : ∀ k ∈ parts, 0 < k) :
    parts ∈ compositions parts.sum := by
  match parts with
  | [] => decide
  | 0 :: _ => have := pos 0 (by simp); omega
  | 1 :: ks =>
    have ih := composition_mem ks (fun k hk => pos k (by simp [hk]))
    rw [List.sum_cons, Nat.add_comm, Nat.add_one, compositions]
    apply List.mem_flatMap.mpr
    exact ⟨ks, ih, by cases ks <;> simp [grow]⟩
  | (k+2) :: ks =>
    have ih := composition_mem ((k+1) :: ks) (by
      intro t ht
      rcases List.mem_cons.mp ht with rfl | h
      · omega
      · exact pos t (by simp [h]))
    have s : ((k+2) :: ks).sum = ((k+1) :: ks).sum + 1 := by simp; omega
    rw [s, compositions]
    exact List.mem_flatMap.mpr ⟨_, ih, by simp [grow]⟩
termination_by parts.sum

/-- Permutation in image notation: each consecutive block is a cycle. -/
def canonicalFrom (start : Nat) : List Nat → List Nat
  | [] => []
  | k :: ks => (List.range (k-1)).map (fun i => start+i+1) ++ [start] ++
      canonicalFrom (start+k) ks

def evenType (n : Nat) (p : List Nat) : Bool :=
  decide (p.Pairwise (· ≤ ·)) && (n - p.length) % 2 == 0

def Row.images (r : Row d m) := r.target.toList.map Fin.val

theorem cornerCoverage :
    ((compositions 8).filter (evenType 8)).all
      (fun p => (cornerRows.map Row.images).contains (canonicalFrom 0 p)) = true := by decide +kernel

theorem edgeCoverage :
    ((compositions 12).filter (fun p => evenType 12 p && p.length != 12)).all
      (fun p => (edgeRows.map Row.images).contains (canonicalFrom 0 p)) = true := by decide +kernel

theorem cornerRepresentative (p : List Nat) (h : ∀ k ∈ p, 0 < k) (size : p.sum = 8)
    (evenSorted : evenType 8 p = true) :
    ∃ r ∈ cornerRows, r.images = canonicalFrom 0 p := by
  have hp := composition_mem p h
  rw [size] at hp
  have found := List.all_eq_true.mp cornerCoverage p (List.mem_filter.mpr ⟨hp, evenSorted⟩)
  simpa using found

theorem edgeRepresentative (p : List Nat) (h : ∀ k ∈ p, 0 < k) (size : p.sum = 12)
    (evenSorted : evenType 12 p = true) (nontrivial : p.length ≠ 12) :
    ∃ r ∈ edgeRows, r.images = canonicalFrom 0 p := by
  have hp := composition_mem p h
  rw [size] at hp
  have found := List.all_eq_true.mp edgeCoverage p (List.mem_filter.mpr ⟨hp, by simp [evenSorted, nontrivial]⟩)
  simpa using found

end CubeComm
