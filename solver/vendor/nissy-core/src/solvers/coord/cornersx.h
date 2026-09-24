#ifndef SOLVERS_COORD_CORNERSX_H
#define SOLVERS_COORD_CORNERSX_H

STATIC bool is_cornersx_solved(uint64_t, const unsigned char *);

STATIC coord_t coordinate_cornersx = {
	.name = "CORNERSX",
	.coord = &coordinate_corners_coord,
	.cube = &coordinate_corners_cube,
	.isnasty = &coordinate_corners_isnasty,
	.gendata = coordinate_corners_gendata,
	.max = CLASSES_CP_48 * POW_3_7,
	.trans_mask = TM_ALLTRANS,
	.moves_mask_gendata = MM18_ALLMOVES,
	.moves_mask_solve = MM18_URF,
	.is_admissible = &solution_always_valid,
	.solution_prune = NULL,
	.is_solvable = &cube_true,
	.is_solved = &is_cornersx_solved,
	.allow_niss = false,
	.pruning_distribution = {
		[0] = 5,
		[1] = 11,
		[2] = 42,
		[3] = 240,
		[4] = 1115,
		[5] = 5848,
		[6] = 29088,
		[7] = 133410,
		[8] = 508020,
		[9] = 1100543,
		[10] = 371364,
		[11] = 2322,
	},
	.pruning_max = 11,
	.sym = {
		.classes = CLASSES_CP_48,
		.max = FACT_8,
		.coord = &coord_cp,
		.cube = &invcoord_cp,
		.max2 = POW_3_7,
		.coord2 = &coord_co,
		.cube2 = &invcoord_co,
		.merge = &coordinate_merge_cpco,
	},
};

STATIC bool
is_cornersx_solved(uint64_t coord, const unsigned char *data)
{
	/*
	TODO we use a bit of an ugly trick to check all rotated versions of
        the cube. We would like to apply rotations, but our oriented_cube_t
	type does not allow to do this directly (we would just be changing
	the orientation field, not the cube itself). So we apply slice moves
	instead. We should make this less ugly.
	*/
	static uint8_t mt[] = {
		[MOVE_x] = MOVE_M, [MOVE_x2] = MOVE_M2, [MOVE_x3] = MOVE_M3,
		[MOVE_y] = MOVE_E, [MOVE_y2] = MOVE_E2, [MOVE_y3] = MOVE_E3,
		[MOVE_z] = MOVE_S3, [MOVE_z2] = MOVE_S2, [MOVE_z3] = MOVE_S
	};

	uint8_t i, j;
	cube_t cube;
	oriented_cube_t oc;

	cube = coordinate_corners_cube(coord, data);
	oc.orientation = ORIENTATION_UF;
	for (i = ORIENTATION_UF; i <= ORIENTATION_BL; i++) {
		oc.cube = cube;
		for (j = 0; orientation_moves[i][j] != UINT8_MAX; j++)
			oc = move_extended(oc, mt[orientation_moves[i][j]]);
		if (coordinate_corners_coord(oc.cube, data) == 0)
			return true;
	}

	return false;
}

#endif /* SOLVERS_COORD_CORNERSX_H */
