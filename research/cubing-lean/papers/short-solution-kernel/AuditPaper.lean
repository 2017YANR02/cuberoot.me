import Lean.Util.CollectAxioms
import CubeKernel

open Lean Elab Command in
run_cmd do
  let allowed := [``propext, ``Classical.choice, ``Quot.sound]
  for name in [``CubeKernel.Physical.physical_kernel,
      ``CubeKernel.Physical.PackedCube.kernel_distinct_faces_correct,
      ``CubeKernel.Physical.PackedCube.kernel_search_tree,
      ``CubeKernel.Physical.PackedCube.twin_comparison_count,
      ``CubeKernel.Physical.findShort_correct] do
    let axioms ← Lean.collectAxioms name
    unless axioms.all (fun ax => allowed.contains ax) &&
        allowed.all (fun ax => axioms.contains ax) do
      throwError m!"Unexpected transitive axioms for {name}: {axioms}"
    logInfo m!"{name}: {axioms}"
