import Lean.Util.CollectAxioms
import CubeComm.Universal

namespace CubeComm

/-- Sun's single-commutator statement in the fixed-centre coordinate group. -/
theorem sun_single_commutator (g : cubeGroup) (hg : EvenCube g) :
    ∃ A B : cubeGroup, A * B * A⁻¹ * B⁻¹ = g := by
  obtain ⟨A, B, _, _, _, _, h⟩ := every_even_cube g hg
  exact ⟨A, B, h⟩

end CubeComm

open Lean Elab Command in
run_cmd do
  let allowed := [``propext, ``Classical.choice, ``Quot.sound]
  for name in [``CubeComm.every_even_cube, ``CubeComm.sun_single_commutator] do
    let axioms ← Lean.collectAxioms name
    unless axioms.all (fun ax => allowed.contains ax) &&
        allowed.all (fun ax => axioms.contains ax) do
      throwError m!"Unexpected transitive axioms for {name}: {axioms}"
    logInfo m!"{name}: {axioms}"
