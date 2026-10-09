#ifndef SOLVERS_COORD_CORNERS_H
#define SOLVERS_COORD_CORNERS_H

#define CLASSES_CP_48 984

STATIC uint64_t coordinate_corners_coord(const cube_t, const unsigned char *);
STATIC cube_t coordinate_corners_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_corners_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_corners_gendata(unsigned char *);

STATIC coord_t coordinate_corners = {
	.name = "CORNERS",
	.coord = &coordinate_corners_coord,
	.cube = &coordinate_corners_cube,
	.isnasty = &coordinate_corners_isnasty,
	.gendata = coordinate_corners_gendata,
	.max = CLASSES_CP_48 * POW_3_7,
	.trans_mask = TM_ALLTRANS,
	.moves_mask_gendata = MM18_ALLMOVES,
	.moves_mask_solve = MM18_ALLMOVES,
	.is_admissible = &solution_always_valid,
	.solution_prune = NULL,
	.is_solvable = &cube_true,
	.is_solved = NULL,
	.allow_niss = false,
	.pruning_distribution = {
		[0] = 1,
		[1] = 2,
		[2] = 9,
		[3] = 76,
		[4] = 708,
		[5] = 5022,
		[6] = 28248,
		[7] = 132076,
		[8] = 505705,
		[9] = 1102421,
		[10] = 375380,
		[11] = 2360,
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

STATIC uint64_t
coordinate_corners_coord(const cube_t cube, const unsigned char *data)
{
	return coord_coord_generic(&coordinate_corners, cube, data);
}

STATIC cube_t
coordinate_corners_cube(uint64_t i, const unsigned char *data)
{
	return coord_cube_generic(&coordinate_corners, i, data);
}

STATIC bool
coordinate_corners_isnasty(uint64_t i, const unsigned char *data)
{
	return coord_isnasty_generic(&coordinate_corners, i, data);
}

STATIC size_t
coordinate_corners_gendata(unsigned char *data)
{
	return coord_gendata_generic(&coordinate_corners, data);
}

#endif /* SOLVERS_COORD_CORNERS_H */
