#ifndef SOLVERS_COORD_DRSLICE_H
#define SOLVERS_COORD_DRSLICE_H

/*
The DRSLICE coordinate is almost identical to DRFINNOE, but it allows for
the centers of the E layer to be off by a rotation. For this reason we reuse
much of the code of DRFINNOE. We could make the pruning table 4x smaller
if we reduced the coordinate by rotations. TODO.
*/

STATIC uint64_t coordinate_drslice_coord(cube_t, const unsigned char *);
STATIC cube_t coordinate_drslice_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_drslice_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_drslice_gendata(unsigned char *);
STATIC bool is_drslice_solvable(cube_t);
STATIC bool is_drslice_solved(uint64_t, const unsigned char *);

STATIC coord_t coordinate_drslice = {
	.name = "DRSLICE",
	.coord = &coordinate_drslice_coord,
	.cube = &coordinate_drslice_cube,
	.isnasty = &coordinate_drslice_isnasty,
	.gendata = coordinate_drslice_gendata,
	.max = CLASSES_CP_16 * FACT_8,
	.trans_mask = TM_UDFIX,
	.moves_mask_gendata = MM18_DR,
	.moves_mask_solve = MM18_DR_NOD,
	.is_admissible = &solution_always_valid,
	.solution_prune = NULL,
	.is_solvable = &is_drslice_solvable,
	.is_solved = &is_drslice_solved,
	.allow_niss = false,
	.pruning_distribution = {
 		[0] = 3,
		[1] = 7,
		[2] = 18,
		[3] = 111,
		[4] = 433,
		[5] = 1618,
		[6] = 6718,
		[7] = 29182,
		[8] = 119873,
		[9] = 476999,
		[10] = 1858350,
		[11] = 6531166,
		[12] = 18338522,
		[13] = 32839235,
		[14] = 34118824,
		[15] = 17284701
	},
	.pruning_max = 15,
	.sym = {
		.classes = CLASSES_CP_16,
		.max = FACT_8,
		.coord = &coord_cp,
		.cube = &invcoord_cp,
		.max2 = FACT_8,
		.coord2 = &coord_epud,
		.cube2 = &invcoord_epud,
		.merge = &coordinate_merge_ce,
	},
};

STATIC uint64_t
coordinate_drslice_coord(cube_t cube, const unsigned char *data)
{
	return coord_coord_generic(&coordinate_drslice, cube, data);
}

STATIC cube_t
coordinate_drslice_cube(uint64_t i, const unsigned char *data)
{
	return coord_cube_generic(&coordinate_drslice, i, data);
}

STATIC size_t
coordinate_drslice_gendata(unsigned char *data)
{
	return coord_gendata_generic(&coordinate_drslice, data);
}

STATIC bool
coordinate_drslice_isnasty(uint64_t i, const unsigned char *data)
{
	return coord_isnasty_generic(&coordinate_drslice, i, data);
}

STATIC bool
is_drslice_solvable(cube_t cube) {
	return coord_eo(cube) == 0 &&
	       coord_eo(transform_edges(cube, TRANS_URr)) == 0 &&
	       coord_co(cube) == 0;
}

STATIC bool
is_drslice_solved(uint64_t i, const unsigned char *data)
{
	/* Pre-computed coordinates of U D' (= U' D up to trans) and U2 D2 */
	return i == 0 || i == 109779816 || i == 68468527;
}

#endif /* SOLVERS_COORD_DRSLICE_H */
