import Lean.Util.CollectAxioms
import CubingLean

open Lean Elab Command in
/-- Print each theorem's transitive axiom dependencies and reject unexpected ones. -/
elab "#audit_axioms " decl:ident : command => do
  let name ← liftCoreM <| Elab.realizeGlobalConstNoOverloadWithInfo decl
  let axioms ← Lean.collectAxioms name
  let allowed := [``propext, ``Classical.choice, ``Quot.sound]
  let unexpected := axioms.filter fun ax => !allowed.contains ax
  unless unexpected.isEmpty do
    throwErrorAt decl m!"{name} depends on unexpected axioms: {unexpected}"
  logInfoAt decl m!"{name}: {axioms}"

#check CubeDiameter.lower2011
#audit_axioms CubeDiameter.lower2011
#audit_axioms CubeDiameter.reverse_solves
#audit_axioms CubeDiameter.Network.split24_routes
#audit_axioms CubeDiameter.Network.split16_routes
#audit_axioms CubeDiameter.Network.split8_routes
#audit_axioms CubeDiameter.Representatives.appendixF_geometry
#audit_axioms CubeDiameter.Rectangle.Selection.appendixF_rectangle
#audit_axioms CubeDiameter.Rectangle.Selection.strip_stage
#audit_axioms CubeDiameter.GridStage.action
#audit_axioms CubeDiameter.GridStage.budget_asymptotic
#audit_axioms CubeDiameter.Schedule.permnet61_cost
#audit_axioms CubeDiameter.Network.split24_subsets
#audit_axioms CubeDiameter.Network.split16_subsets
#audit_axioms CubeDiameter.Network.split8_subsets
#audit_axioms CubeDiameter.Schedule.sort_faces
#audit_axioms CubeDiameter.Schedule.solve_generic_centers
#audit_axioms CubeDiameter.Counting.finite_lower
#audit_axioms CubeDiameter.sharp_lower
#audit_axioms CubeDiameter.Sparse.sparse_word
#audit_axioms CubeDiameter.whole_cube_word
#audit_axioms CubeDiameter.upper2026
#audit_axioms CubeDiameter.paper2026
#audit_axioms CubeDiameter.paper2011
#check CubeDiameter.paper2011
#check CubeDiameter.paper2026
#audit_axioms CubeDiameter.almost_all_lower
#audit_axioms CubeDiameter.ratio_lt_237
#audit_axioms CubeDiameter.typical_factor_237

#audit_axioms CubeComm.cornerRows_ok
#audit_axioms CubeComm.edgeRows_ok
#audit_axioms CubeComm.cornerRepresentative
#audit_axioms CubeComm.edgeRepresentative
#audit_axioms CubeComm.realizeRow
#audit_axioms CubeComm.pureFlips
#audit_axioms CubeComm.superflip_factor_constraints
#audit_axioms CubeComm.inverses
#audit_axioms CubeComm.superflip_commutator
#audit_axioms CubeComm.factor_orders

#check CubeComm.every_even_cube
#audit_axioms CubeComm.every_even_cube

#audit_axioms CubeKernel.short_solution_kernel
#audit_axioms CubeKernel.Physical.physical_kernel
#audit_axioms CubeKernel.Physical.decideShort_iff
#audit_axioms CubeKernel.retained_branching
#audit_axioms CubeKernel.Physical.PackedCube.kernel_correct
#audit_axioms CubeKernel.Physical.PackedCube.short_iff_distance
#audit_axioms CubeKernel.Physical.findShort_correct
#audit_axioms CubeKernel.Physical.findShort_eq_none_iff
#audit_axioms CubeKernel.Physical.PackedCube.findShort_correct
#audit_axioms CubeKernel.Physical.PackedCube.kernel_search_tree
#audit_axioms CubeKernel.Physical.PackedCube.twin_comparison_count
#audit_axioms CubeKernel.Physical.PackedCube.kernel_monochrome_correct
#audit_axioms CubeKernel.Physical.PackedCube.palette_count
#audit_axioms CubeKernel.Physical.PackedCube.kernel_distinct_faces_correct
#audit_axioms CubeKernel.Physical.PackedCube.decide_distinct_faces_iff

#audit_axioms CubeMixing.visible_injective
#audit_axioms CubeMixing.evalTurns_surjective
#audit_axioms CubeMixing.visible_position_eq_paint
#audit_axioms CubeMixing.visible_range_iff_word
#audit_axioms CubeMixing.position_eq_normal
#audit_axioms CubeMixing.card_eventWords
#audit_axioms CubeMixing.card_eventForms
#audit_axioms CubeMixing.OrderCheck.faceGroup_card_lower
#audit_axioms CubeMixing.tv24_lower
#audit_axioms CubeMixing.mixing_time_at_least_25
#audit_axioms CubeMixing.eventCount_univ
#audit_axioms CubeMixing.color_laws_mass_one
#audit_axioms CubeMixing.colorTotalVariation_eq
#audit_axioms CubeMixing.visible_tv24_lower
#audit_axioms CubeMixing.visible_mixing_time_at_least_25
