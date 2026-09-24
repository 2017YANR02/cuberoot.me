#ifndef SOLVERS_COORD_DREO_H
#define SOLVERS_COORD_DREO_H

#define DRESEP_CLASSES 81

STATIC uint64_t coord_dresep_nosym(cube_t);
STATIC cube_t invcoord_dresep_nosym(uint64_t);

STATIC uint64_t coordinate_dreo_coord(cube_t, const unsigned char *);
STATIC cube_t coordinate_dreo_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_dreo_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_dreo_gendata(unsigned char *);

STATIC bool is_dreo_solvable(cube_t);

STATIC coord_t coordinate_dreo = {
	.name = "DREO",
	.coord = &coordinate_dreo_coord,
	.cube = &coordinate_dreo_cube,
	.isnasty = &coordinate_dreo_isnasty,
	.gendata = coordinate_dreo_gendata,
	.max = DRESEP_CLASSES * POW_3_7,
	.trans_mask = TM_UDRLFIX,
	.moves_mask_gendata = MM18_EO,
	.moves_mask_solve = MM18_EO,
	.is_admissible = &solution_lastqt_cw,
	.solution_prune = NULL,
	.is_solvable = &is_dreo_solvable,
	.is_solved = NULL,
	.allow_niss = true,
	.pruning_distribution = {
		[0] = 1,
		[1] = 1,
		[2] = 4,
		[3] = 22,
		[4] = 160,
		[5] = 1286,
		[6] = 8550,
		[7] = 42152,
		[8] = 90748,
		[9] = 33466,
		[10] = 757,
	},
	.pruning_max = 10,
	.sym = {
		.classes = DRESEP_CLASSES,
		.max = COMB_12_4,
		.coord = &coord_dresep_nosym,
		.cube = &invcoord_dresep_nosym,
		.max2 = POW_3_7,
		.coord2 = &coord_co,
		.cube2 = &invcoord_co,
		.merge = &coordinate_merge_ec,
	},
};

STATIC uint64_t
coord_dresep_nosym(cube_t cube)
{
	return coord_esep(cube) / COMB_8_4;
}

STATIC cube_t
invcoord_dresep_nosym(uint64_t coord)
{
	return invcoord_esep(coord * COMB_8_4);
}

STATIC uint64_t
coordinate_dreo_coord(cube_t cube, const unsigned char *data)
{
	return coord_coord_generic(&coordinate_dreo, cube, data);
}

STATIC cube_t
coordinate_dreo_cube(uint64_t i, const unsigned char *data)
{
	return coord_cube_generic(&coordinate_dreo, i, data);
}

STATIC bool
coordinate_dreo_isnasty(uint64_t i, const unsigned char *data)
{
	return coord_isnasty_generic(&coordinate_dreo, i, data);
}

STATIC size_t
coordinate_dreo_gendata(unsigned char *data)
{
	return coord_gendata_generic(&coordinate_dreo, data);
}

STATIC bool
is_dreo_solvable(cube_t cube) {
	uint8_t c[8], e[12], i, cocount;

	if (coord_eo(cube) != 0)
		return false;

	pieces(&cube, c, e);

	for (i = 0, cocount = 0; i < 8; i++)
		cocount += (c[i] & COBITS_2) >> COSHIFT;

	return cocount % 3 == 0;
}

#endif /* SOLVERS_COORD_DREO_H */
