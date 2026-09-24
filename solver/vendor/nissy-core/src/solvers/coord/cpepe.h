#ifndef SOLVERS_COORD_CPEPE_H
#define SOLVERS_COORD_CPEPE_H

STATIC uint64_t coordinate_cpepe_coord(const cube_t, const unsigned char *);
STATIC cube_t coordinate_cpepe_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_cpepe_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_cpepe_gendata(unsigned char *);

STATIC coord_t coordinate_cpepe = {
	.name = "CPEPE",
	.coord = &coordinate_cpepe_coord,
	.cube = &coordinate_cpepe_cube,
	.isnasty = &coordinate_cpepe_isnasty,
	.gendata = coordinate_cpepe_gendata,
	.max = CLASSES_CP_16 * FACT_4,
	.trans_mask = TM_UDFIX,
	.moves_mask_gendata = MM18_DR,
	.moves_mask_solve = MM18_DR,
	.is_admissible = &solution_always_valid,
	.solution_prune = NULL,
	.is_solvable = &is_drfinnoe_solvable,
	.is_solved = NULL,
	.allow_niss = false,
	.pruning_distribution = {
 		[0] = 1,
		[1] = 3,
		[2] = 10,
		[3] = 44,
		[4] = 214,
		[5] = 846,
		[6] = 2413,
		[7] = 5122,
		[8] = 8639,
		[9] = 12128,
		[10] = 12571,
		[11] = 12985,
		[12] = 7754,
		[13] = 3366,
		[14] = 336,
	},
	.pruning_max = 14,
	.sym = {
		.classes = CLASSES_CP_16,
		.max = FACT_8,
		.coord = &coord_cp,
		.cube = &invcoord_cp,
		.max2 = FACT_4,
		.coord2 = &coord_epe,
		.cube2 = &invcoord_epe,
		.merge = &coordinate_merge_ce,
	},
};

STATIC uint64_t
coordinate_cpepe_coord(const cube_t cube, const unsigned char *data)
{
	return coord_coord_generic(&coordinate_cpepe, cube, data);
}

STATIC cube_t
coordinate_cpepe_cube(uint64_t i, const unsigned char *data)
{
	return coord_cube_generic(&coordinate_cpepe, i, data);
}

STATIC bool
coordinate_cpepe_isnasty(uint64_t i, const unsigned char *data)
{
	return coord_isnasty_generic(&coordinate_cpepe, i, data);
}

STATIC size_t
coordinate_cpepe_gendata(unsigned char *data)
{
	return coord_gendata_generic(&coordinate_cpepe, data);
}

#endif /* SOLVERS_COORD_CPEPE_H */
