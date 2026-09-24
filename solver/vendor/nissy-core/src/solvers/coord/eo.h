#ifndef SOLVERS_COORD_EO_H
#define SOLVERS_COORD_EO_H

STATIC uint64_t coordinate_eo_coord(cube_t, const unsigned char *);
STATIC cube_t coordinate_eo_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_eo_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_eo_gendata(unsigned char *);

STATIC coord_t coordinate_eo = {
	.name = "EO",
	.coord = &coordinate_eo_coord,
	.cube = &coordinate_eo_cube,
	.isnasty = &coordinate_eo_isnasty,
	.gendata = coordinate_eo_gendata,
	.max = POW_2_11,
	.trans_mask = TM_SINGLE(TRANS_UFr),
	.moves_mask_gendata = MM18_ALLMOVES,
	.moves_mask_solve = MM18_ALLMOVES,
	.is_admissible = &solution_lastqt_cw,
	.solution_prune = NULL,
	.is_solvable = &is_eo_even,
	.is_solved = NULL,
	.allow_niss = true,
	.pruning_distribution = {
		[0] = 1,
		[1] = 2,
		[2] = 25,
		[3] = 202,
		[4] = 620,
		[5] = 900,
		[6] = 285,
		[7] = 13,
	},
	.pruning_max = 7,
	.sym = {0},
};

STATIC uint64_t
coordinate_eo_coord(cube_t c, const unsigned char *data)
{
	return coord_eo(c);
}

STATIC cube_t
coordinate_eo_cube(uint64_t c, const unsigned char *data)
{
	cube_t cube = SOLVED_CUBE;
	set_eo(&cube, c);
	return cube;
}

STATIC bool
coordinate_eo_isnasty(uint64_t c, const unsigned char *data)
{
	return false;
}

STATIC size_t
coordinate_eo_gendata(unsigned char *data)
{
	return 0;
}

#endif /* SOLVERS_COORD_EO_H */
