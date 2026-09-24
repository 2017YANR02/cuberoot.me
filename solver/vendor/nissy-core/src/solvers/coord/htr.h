#ifndef SOLVERS_COORD_HTR_H
#define SOLVERS_COORD_HTR_H

STATIC uint64_t coordinate_htr_coord(cube_t, const unsigned char *);
STATIC cube_t coordinate_htr_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_htr_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_htr_gendata(unsigned char *);

STATIC bool htr_checkmoves(bool *, uint8_t, const uint8_t *);
STATIC bool htr_solution_prune(const solution_moves_t [NON_NULL]);
STATIC bool is_cp_htr(uint64_t, const unsigned char *);

STATIC coord_t coordinate_htr = {
	.name = "HTR",
	.coord = &coordinate_htr_coord,
	.cube = &coordinate_htr_cube,
	.isnasty = &coordinate_htr_isnasty,
	.gendata = coordinate_htr_gendata,
	.max = CLASSES_CP_16 * COMB_8_4,
	.trans_mask = TM_UDFIX,
	.moves_mask_gendata = MM18_DR,
	.moves_mask_solve = MM18_DRHTR,
	.is_admissible = &solution_lastqt_cw,
	.solution_prune = &htr_solution_prune,
	.is_solvable = &is_drfinnoe_solvable,
	.is_solved = &is_cp_htr,
	.allow_niss = true,
	.pruning_distribution = {
		[0] = 22,
		[1] = 18,
		[2] = 86,
		[3] = 268,
		[4] = 920,
		[5] = 4042,
		[6] = 12716,
		[7] = 24852,
		[8] = 33116,
		[9] = 45032,
		[10] = 47144,
		[11] = 21676,
		[12] = 3692,
		[13] = 176
	},
	.pruning_max = 13,
	.sym = {
		.classes = CLASSES_CP_16,
		.max = FACT_8,
		.coord = &coord_cp,
		.cube = &invcoord_cp,
		.max2 = COMB_8_4,
		.coord2 = &coord_epudsep,
		.cube2 = &invcoord_epudsep,
		.merge = &coordinate_merge_ce,
	},
};

STATIC uint64_t
coordinate_htr_coord(cube_t cube, const unsigned char *data)
{
	return coord_coord_generic(&coordinate_htr, cube, data);
}

STATIC cube_t
coordinate_htr_cube(uint64_t i, const unsigned char *data)
{
	return coord_cube_generic(&coordinate_htr, i, data);
}

STATIC bool
coordinate_htr_isnasty(uint64_t i, const unsigned char *data)
{
	return coord_isnasty_generic(&coordinate_htr, i, data);
}

STATIC size_t
coordinate_htr_gendata(unsigned char *data)
{
	return coord_gendata_generic(&coordinate_htr, data);
}

STATIC bool
htr_checkmoves(bool *f, uint8_t n, const uint8_t *moves)
{
	uint8_t i;
	bool is_d, is_u;

	for (i = 0; i < n; i++) {
		is_d = moves[i] == MOVE_D || moves[i] == MOVE_D3;
		is_u = moves[i] == MOVE_U || moves[i] == MOVE_U3;
		if (is_d && *f)
			return true;
		*f = *f || is_d || is_u;

		if (i < n-1 && moveaxis(moves[i]) == 0 &&
		    parallel(moves[i], moves[i+1]))
			return true;
	}

	return false;
}

STATIC bool
htr_solution_prune(const solution_moves_t s[NON_NULL])
{
	bool f;

	f = false;

	return htr_checkmoves(&f, s->nmoves, s->moves) ||
	       htr_checkmoves(&f, s->npremoves, s->premoves);
}

STATIC bool
is_cp_htr(uint64_t i, const unsigned char *data)
{
	static uint8_t is_cp16_htr_table[DIV_ROUND_UP(CLASSES_CP_16, 8)] = {
		[0] = 81, [7] = 144, [8] = 16, [25] = 130, [26] = 34,
		[37] = 64, [38] = 48, [39] = 8, [212] = 20, [226] = 32,
		[227] = 2, [298] = 160, [300] = 128, [301] = 1
	};

	uint64_t e, c;

	e = i % COMB_8_4;
	c = i / COMB_8_4;

	return e == 0 && is_cp16_htr_table[c / 8] & (UINT8_C(1) << (c % 8));
}

#endif /* SOLVERS_COORD_HTR_H */
